import { createHash, randomUUID } from 'node:crypto';
import { enqueue, createWorker } from './jobs.js';

const cancelled = b => Boolean(b.cancelRequested) || ['cancelled','cancel_requested','refund_review'].includes(b.status);
export function reservesSlot(b, now = Date.now()) {
  if (['setup_pending','payment_unknown','paid_calendar_pending','calendar_failed','manual_review','confirmed','cancel_requested'].includes(b.status)) return true;
  return b.status === 'pending_payment' && Date.parse(b.expiresAt) > now;
}
const overlap = (a,b,c,d) => a < d && c < b;
const fingerprint = input => createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a],[b]) => a.localeCompare(b))))).digest('hex');
const failure = (message, statusCode=409) => Object.assign(new Error(message), { statusCode });

export function createBookingService({ store, integrations, prepareBooking, bufferMinutes, logger = console.error }) {
  const buffer = bufferMinutes * 60000;
  async function localConflict(tx, booking) {
    const start = new Date(Date.parse(booking.startUtc) - buffer), end = new Date(Date.parse(booking.endUtc) + buffer);
    const candidates = await tx.list('bookings', { before:end.toISOString(), after:start.toISOString(), limit:10001 });
    if (candidates.length > 10000) throw failure('Te veel reserveringen in dit tijdvenster.',503);
    return candidates.some(other => other.id !== booking.id && reservesSlot(other) && overlap(start,end,new Date(other.startUtc),new Date(other.endUtc)));
  }
  async function change(id, work) {
    return store.transaction(async tx => {
      const b = await tx.get('bookings',id);
      if (!b) throw failure('Booking niet gevonden.',404);
      await work(b, tx);
      b.updatedAt = new Date().toISOString();
      await tx.put('bookings', b);
      return b;
    });
  }
  async function project(tx,b) { await enqueue(tx,'crm',b.id,{revive:true}); }
  const handlers = {
    async setup(id) {
      let b = await store.get('bookings',id);
      if (!b || b.molliePaymentId || cancelled(b)) return;
      // Mollie expires idempotency keys after one hour. Never create anew after
      // this safety window when the previous POST may already have succeeded.
      if (Date.now()-Date.parse(b.createdAt) > 55*60000) {
        await change(id,async (b,tx) => { if (!cancelled(b)) b.status='payment_unknown'; await project(tx,b); });
        throw new Error('Payment creation outcome requires reconciliation');
      }
      const payment = await integrations.createPayment(b);
      await change(id, async (current,tx) => {
        if (current.molliePaymentId && current.molliePaymentId !== payment.id) throw new Error('Payment binding mismatch');
        current.molliePaymentId=payment.id; current.checkoutUrl=payment.checkoutUrl;
        if (!cancelled(current) && !current.paidAt) current.status='pending_payment';
        await tx.put('payments',{id:payment.id,bookingId:id,molliePaymentId:payment.id,status:payment.status || 'open',amountCents:current.priceCents});
        await project(tx,current);
        // Reconciliation is durable even if the provider webhook is lost.
        await enqueue(tx,'payment',id,{revive:true,dueAt:new Date(Date.now()+60000).toISOString()});
        await tx.audit('payment.created',{bookingId:id,paymentId:payment.id});
      });
    },
    async confirm(id) {
      let b = await store.get('bookings',id);
      if (!b || cancelled(b) || (b.status==='confirmed' && b.caldavEventUid)) return;
      if (!b.paidAt) throw new Error('Refusing confirmation without verified payment');
      const existing = await integrations.findOwnEvent(b);
      if (!existing) {
        const available = await integrations.windowAvailable(b);
        const conflict = await store.transaction(tx => localConflict(tx,b));
        if (!available || conflict) {
          await change(id,async (current,tx) => {
            if (!cancelled(current)) current.status='manual_review';
            await project(tx,current);
          });
          throw new Error('Paid booking needs calendar conflict review');
        }
      }
      b = await store.get('bookings',id);
      if (cancelled(b)) return;
      try {
        const event = existing || await integrations.createEvent(b);
        await change(id,async (current,tx) => {
          current.caldavEventUid=event.uid; current.calendarUrl=event.url;
          if (cancelled(current)) {
            current.status='cancel_requested';
            await enqueue(tx,'cancel',id,{revive:true});
          } else current.status='confirmed';
          await project(tx,current);
          await tx.audit('calendar.confirmed',{bookingId:id});
        });
      } catch (error) {
        await change(id,async (current,tx) => {
          if (!cancelled(current) && current.status!=='confirmed') current.status='calendar_failed';
          await project(tx,current);
        });
        throw error;
      }
    },
    async cancel(id) {
      const b = await store.get('bookings',id);
      if (!b || !cancelled(b)) return;
      // Wait until a previously claimed confirmation cannot still create an event.
      const confirmation = await store.get('jobs',`confirm:${id}`);
      if (confirmation?.status==='running' && Date.parse(confirmation.leaseUntil)>Date.now()) throw new Error('Confirmation still in flight');
      await integrations.deleteEvent(b.caldavEventUid || integrations.eventUid(b));
      await change(id,async (current,tx) => {
        current.status=current.paidAt ? 'refund_review' : 'cancelled';
        current.calendarDeletedAt=new Date().toISOString();
        await project(tx,current);
        await tx.audit('booking.cancelled',{bookingId:id,refundReview:Boolean(current.paidAt)});
      });
    },
    async crm(id) {
      let b = await store.get('bookings',id);
      if (!b) return;
      const contact = await integrations.upsertContact({ ...b.customer, consentSource:'booking' });
      const record = await integrations.ensureCrmBooking(b,contact.id);
      b = await change(id,async current => { current.crmContactId=contact.id; current.crmBookingId=record.id; });
      await integrations.updateCrmBooking(b);
    },
    async newsletter(email) {
      const subscription = await store.get('subscriptions',email);
      if (!subscription) return;
      const contact = await integrations.upsertContact(subscription);
      await integrations.addToNewsletter(contact.id);
      await store.transaction(async tx => {
        const current = await tx.get('subscriptions',email);
        if (current.version!==subscription.version) return;
        await tx.put('subscriptions',{...current,crmStatus:'synced',crmContactId:contact.id,updatedAt:new Date().toISOString()});
      });
    },
    async payment(id) {
      const b = await store.get('bookings',id);
      if (!b?.molliePaymentId || b.paidAt || ['payment_failed','payment_expired'].includes(b.status)) return;
      const payment = await integrations.getPayment(b.molliePaymentId);
      await applyPayment(payment);
      if (['open','pending','authorized'].includes(payment.status)) {
        await store.transaction(tx => enqueue(tx,'payment',id,{revive:true,dueAt:new Date(Date.now()+60000).toISOString()}));
      }
    }
  };
  const worker = createWorker(store, handlers, {
    onError: logger,
    async onDead(job) {
      if (job.kind === 'setup') {
        await change(job.key, async (booking, tx) => {
          if (!booking.molliePaymentId && !cancelled(booking)) booking.status = 'setup_failed';
          await project(tx, booking);
        });
      }
      if (job.kind === 'newsletter') {
        await store.transaction(async tx => {
          const subscription = await tx.get('subscriptions', job.key);
          if (subscription) await tx.put('subscriptions', { ...subscription, crmStatus: 'retry_failed', updatedAt: new Date().toISOString() });
        });
      }
    }
  });
  async function applyPayment(payment) {
    const id = String(payment.metadata?.bookingId || '');
    return store.transaction(async tx => {
      const found = id ? await tx.get('bookings',id) : (await tx.list('bookings',{paymentId:payment.id,limit:1}))[0];
      if (!found) throw failure('Onbekende betaling.',404);
      const validAmount = /^\d+\.\d{2}$/.test(payment.amount?.value || '') && Math.round(Number(payment.amount.value)*100) === found.priceCents;
      if (!validAmount || payment.amount.currency!==found.currency || (found.molliePaymentId && found.molliePaymentId!==payment.id) || (id && id!==found.id)) throw failure('Betaling komt niet overeen met de booking.',409);
      found.molliePaymentId=payment.id;
      const previousPayment = await tx.get('payments',payment.id);
      // A stale provider response must not move paid back to open/failed.
      const status = previousPayment?.status==='paid' ? 'paid' : payment.status;
      await tx.put('payments',{id:payment.id,bookingId:found.id,molliePaymentId:payment.id,status,amountCents:found.priceCents});
      found.molliePaymentStatus=status;
      if (status==='paid') {
        found.paidAt ||= new Date().toISOString();
        if (cancelled(found)) {
          found.cancelRequested=true;
          if (found.calendarDeletedAt || found.status==='cancelled') found.status='refund_review';
          else { found.status='cancel_requested'; await enqueue(tx,'cancel',found.id,{revive:true}); }
        } else if (found.status!=='confirmed') {
          if (!['manual_review','calendar_failed'].includes(found.status)) found.status='paid_calendar_pending';
          await enqueue(tx,'confirm',found.id);
        }
      } else if (!found.paidAt && !cancelled(found) && ['canceled','expired','failed'].includes(status)) {
        found.status=status==='canceled' ? 'cancelled' : `payment_${status}`;
      }
      found.updatedAt=new Date().toISOString();
      await tx.put('bookings',found); await project(tx,found);
      await tx.audit('payment.verified',{bookingId:found.id,paymentId:payment.id,status});
      return found;
    });
  }
  return {
    worker,
    async create(input,key) {
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(key || '')) throw failure('Een geldige Idempotency-Key is verplicht.',400);
      const hash = fingerprint(input);
      let booking = (await store.list('bookings',{requestKey:key,limit:1}))[0];
      if (!booking) {
        const prepared = await prepareBooking(input);
        booking = await store.transaction(async tx => {
          const existing = (await tx.list('bookings',{requestKey:key,limit:1}))[0];
          if (existing) return existing;
          if (await localConflict(tx,prepared)) throw failure('Dit tijdslot is net gereserveerd door iemand anders.');
          const b = {...prepared,status:'setup_pending',requestKey:key,requestHash:hash};
          await tx.put('bookings',b); await enqueue(tx,'setup',b.id);
          await tx.audit('booking.created',{bookingId:b.id});
          return b;
        });
      }
      if (booking.requestHash!==hash) throw failure('Deze Idempotency-Key hoort bij een andere aanvraag.');
      await worker.run(`setup:${booking.id}`);
      await worker.run(`crm:${booking.id}`);
      booking=await store.get('bookings',booking.id);
      if (cancelled(booking)) throw failure('Deze booking is geannuleerd.');
      if (!booking.checkoutUrl) throw failure('Betaling wordt voorbereid. Probeer opnieuw met dezelfde aanvraag.',503);
      return {bookingId:booking.id,status:booking.status,checkoutUrl:booking.checkoutUrl,expiresAt:booking.expiresAt};
    },
    async webhook(paymentId) {
      if (!/^tr_[A-Za-z0-9_-]{1,76}$/.test(paymentId || '')) throw failure('Ongeldige payment id.',400);
      const booking = await applyPayment(await integrations.getPayment(paymentId));
      await worker.run(`confirm:${booking.id}`);
      await worker.run(`cancel:${booking.id}`);
      await worker.run(`crm:${booking.id}`);
    },
    async cancel(id,actor='admin') {
      await change(id,async (b,tx) => {
        b.cancelRequested=true;
        if (!['cancelled','refund_review'].includes(b.status)) b.status='cancel_requested';
        await enqueue(tx,'cancel',id,{revive:true});
        await tx.audit('booking.cancel_requested',{bookingId:id,actor});
      });
      await worker.run(`cancel:${id}`); await worker.run(`crm:${id}`);
      const b = await store.get('bookings',id);
      return {ok:true,bookingId:id,status:b.status,pending:b.status==='cancel_requested'};
    },
    async subscribe(input) {
      await store.transaction(async tx => {
        const existing=await tx.get('subscriptions',input.email);
        await tx.put('subscriptions',{...input,id:input.email,newsletterOptIn:true,consentAt:existing?.consentAt || input.consentAt,
          version:(existing?.version || 0)+1,crmStatus:'pending_retry',createdAt:existing?.createdAt || input.consentAt});
        await enqueue(tx,'newsletter',input.email,{revive:true});
        await tx.audit('newsletter.consent',{email:input.email,consentAt:input.consentAt});
      });
      await worker.run(`newsletter:${input.email}`);
      return store.get('subscriptions',input.email);
    },
    async recover() {
      // Migrate legacy incomplete workflows once; normal jobs survive restarts.
      if (await store.get('metadata','workflow-recovery-v1')) return;
      await store.transaction(async tx => {
        for (let offset=0;;offset+=100) {
          const bookings=await tx.list('bookings',{limit:100,offset});
          for(const b of bookings) {
            if (['paid_calendar_pending','calendar_failed','manual_review'].includes(b.status)) {
              b.paidAt ||= b.updatedAt || b.createdAt;
              await tx.put('bookings',b); await enqueue(tx,'confirm',b.id);
            }
            if (b.molliePaymentId && !b.paidAt) await enqueue(tx,'payment',b.id);
          }
          if(bookings.length<100) break;
        }
        for(let offset=0;;offset+=100) {
          const subscriptions=await tx.list('subscriptions',{limit:100,offset});
          for(const s of subscriptions) if(s.crmStatus!=='synced') await enqueue(tx,'newsletter',s.email);
          if(subscriptions.length<100) break;
        }
        await tx.put('metadata',{id:'workflow-recovery-v1'});
      });
    }
  };
}
