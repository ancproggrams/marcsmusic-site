import { resolveMx } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fetch } from 'undici';
import { config } from '../config.js';
import type { ContactRepository } from '../db/repositories.js';
import type { EmailVerificationResult } from '../models/types.js';

const execFileAsync = promisify(execFile);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roleLocalParts = new Set([
  'admin',
  'booking',
  'contact',
  'demo',
  'demos',
  'hello',
  'info',
  'music',
  'press',
  'promo',
  'submissions',
  'submit',
  'support'
]);
const disposableDomains = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'throwawaymail.com',
  'yopmail.com'
]);
const temporaryDomainSignals = ['temp', 'trash', 'throwaway', 'disposable'];

type Provider = 'mailgun' | 'aftership' | 'fallback';

function domainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function localPartFromEmail(email: string): string {
  return email.split('@')[0]?.toLowerCase() ?? '';
}

export class EmailVerifier {
  public constructor(
    private readonly smtpEnabled = config.emailSmtpVerifyEnabled,
    private readonly afterShipBinaryPath = config.afterShipEmailVerifierBin,
    private readonly provider: Provider = config.emailValidationProvider,
    private readonly mailgunApiKey = config.mailgunApiKey,
    private readonly mailgunValidationBaseUrl = config.mailgunValidationBaseUrl
  ) {}

  public async verify(email: string): Promise<EmailVerificationResult> {
    const normalized = email.trim().toLowerCase();

    if (this.provider === 'mailgun') {
      const mailgunResult = await this.verifyWithMailgun(normalized);
      if (mailgunResult) return mailgunResult;
    }

    if (this.provider === 'aftership' || this.provider === 'mailgun') {
      const afterShipResult = await this.verifyWithAfterShip(normalized);
      if (afterShipResult) return afterShipResult;
    }

    return this.verifyWithFallback(normalized);
  }

  private async verifyWithMailgun(email: string): Promise<EmailVerificationResult | null> {
    if (!this.mailgunApiKey) return null;

    const url = new URL(this.mailgunValidationBaseUrl);
    url.searchParams.set('address', email);
    url.searchParams.set('mailbox_verification', this.smtpEnabled ? 'true' : 'false');

    const auth = Buffer.from(`api:${this.mailgunApiKey}`).toString('base64');

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Basic ${auth}`,
          accept: 'application/json'
        },
        signal: AbortSignal.timeout(this.smtpEnabled ? 30_000 : 15_000)
      });

      if (!response.ok) return null;
      const payload = (await response.json()) as MailgunValidationPayload;
      return mapMailgunResult(email, payload, this.smtpEnabled);
    } catch {
      return null;
    }
  }

  private async verifyWithAfterShip(email: string): Promise<EmailVerificationResult | null> {
    if (!existsSync(this.afterShipBinaryPath)) return null;

    const args = ['--email', email];
    if (this.smtpEnabled) args.push('--smtp');

    try {
      const { stdout } = await execFileAsync(this.afterShipBinaryPath, args, {
        timeout: this.smtpEnabled ? 30_000 : 15_000,
        maxBuffer: 1024 * 1024
      });
      const payload = JSON.parse(stdout) as AfterShipPayload;
      if (!payload.ok || !payload.result) return null;
      return mapAfterShipResult(email, payload.result, this.smtpEnabled);
    } catch {
      return null;
    }
  }

  private async verifyWithFallback(normalized: string): Promise<EmailVerificationResult> {
    const syntaxValid = emailPattern.test(normalized);
    if (!syntaxValid) {
      return {
        email: normalized,
        syntaxValid,
        mxValid: false,
        roleAccount: false,
        disposable: false,
        temporary: false,
        smtpChecked: false,
        smtpDeliverable: null,
        status: 'rejected',
        reason: 'invalid email syntax',
        deliverabilityScore: 0,
        riskScore: 100
      };
    }

    const domain = domainFromEmail(normalized);
    const localPart = localPartFromEmail(normalized);
    const roleAccount = roleLocalParts.has(localPart);
    const disposable = disposableDomains.has(domain);
    const temporary = temporaryDomainSignals.some((signal) => domain.includes(signal));
    let mxValid = false;

    try {
      const mxRecords = await resolveMx(domain);
      mxValid = mxRecords.length > 0;
    } catch {
      mxValid = false;
    }

    const smtpChecked = false;
    const smtpDeliverable = null;
    let riskScore = 0;
    if (!mxValid) riskScore += 60;
    if (roleAccount) riskScore += 10;
    if (disposable) riskScore += 40;
    if (temporary) riskScore += 30;
    riskScore = Math.min(100, riskScore);
    const deliverabilityScore = Math.max(0, 100 - riskScore - (roleAccount ? 5 : 0));
    const status = mxValid && !disposable && !temporary ? 'verified' : 'rejected';
    const reason = status === 'verified' ? null : 'email failed MX or disposable/temporary checks';

    return {
      email: normalized,
      syntaxValid,
      mxValid,
      roleAccount,
      disposable,
      temporary,
      smtpChecked,
      smtpDeliverable,
      status,
      reason,
      deliverabilityScore,
      riskScore
    };
  }

  public async verifyAndStore(input: {
    email: string;
    platformId: string;
    sourceUrl?: string;
    contacts: ContactRepository;
  }): Promise<EmailVerificationResult> {
    const result = await this.verify(input.email);
    if (result.status === 'verified') {
      input.contacts.storeVerifiedEmail({
        platformId: input.platformId,
        email: result.email,
        sourceUrl: input.sourceUrl,
        deliverabilityScore: result.deliverabilityScore,
        riskScore: result.riskScore,
        verification: {
          syntaxValid: result.syntaxValid,
          mxValid: result.mxValid,
          roleAccount: result.roleAccount,
          disposable: result.disposable,
          temporary: result.temporary,
          smtpChecked: result.smtpChecked,
          smtpDeliverable: result.smtpDeliverable,
          status: result.status,
          reason: result.reason
        }
      });
    }

    return result;
  }
}

interface MailgunValidationPayload {
  address?: string;
  is_valid?: boolean;
  did_you_mean?: string | null;
  reason?: string[] | string | null;
  result?: string;
  risk?: 'low' | 'medium' | 'high' | 'unknown' | string;
  provider?: string;
  parts?: {
    display_name?: string | null;
    local_part?: string;
    domain?: string;
  };
  mailbox_verification?: string | boolean | null;
}

interface AfterShipPayload {
  ok: boolean;
  error?: string;
  result?: AfterShipResult;
}

interface AfterShipResult {
  email?: string;
  reachable?: 'yes' | 'no' | 'unknown' | string;
  disposable?: boolean;
  role_account?: boolean;
  free?: boolean;
  has_mx_records?: boolean;
  syntax?: { valid?: boolean; username?: string; domain?: string };
  smtp?: { deliverable?: boolean; disabled?: boolean; full_inbox?: boolean; host_exists?: boolean; catch_all?: boolean };
}

function mapMailgunResult(email: string, result: MailgunValidationPayload, smtpEnabled: boolean): EmailVerificationResult {
  const domain = domainFromEmail(email);
  const localPart = localPartFromEmail(email);
  const syntaxValid = emailPattern.test(email) && result.is_valid !== false;
  const mxValid = result.result !== 'undeliverable';
  const roleAccount = roleLocalParts.has(result.parts?.local_part?.toLowerCase() ?? localPart);
  const disposable = Array.isArray(result.reason) ? result.reason.includes('mailbox_is_disposable_address') : false;
  const temporary = disposable || temporaryDomainSignals.some((signal) => domain.includes(signal));
  const smtpChecked = smtpEnabled;
  const mailbox = result.mailbox_verification;
  const smtpDeliverable = smtpChecked
    ? mailbox === true || mailbox === 'true' || mailbox === 'deliverable' || result.result === 'deliverable'
    : null;
  const risk = result.risk ?? 'unknown';

  let riskScore = risk === 'high' ? 80 : risk === 'medium' ? 45 : risk === 'low' ? 10 : 30;
  if (!syntaxValid) riskScore += 70;
  if (!mxValid) riskScore += 50;
  if (roleAccount) riskScore += 10;
  if (disposable) riskScore += 40;
  if (temporary) riskScore += 30;
  if (smtpChecked && smtpDeliverable === false) riskScore += 50;
  riskScore = Math.min(100, riskScore);

  const status = syntaxValid && mxValid && !disposable && !temporary && (!smtpChecked || smtpDeliverable !== false) ? 'verified' : 'rejected';

  return {
    email,
    syntaxValid,
    mxValid,
    roleAccount,
    disposable,
    temporary,
    smtpChecked,
    smtpDeliverable,
    status,
    reason: status === 'verified' ? null : `Mailgun validation rejected or marked address risky: ${String(result.reason ?? result.result ?? 'unknown')}`,
    deliverabilityScore: Math.max(0, 100 - riskScore),
    riskScore
  };
}

function mapAfterShipResult(email: string, result: AfterShipResult, smtpEnabled: boolean): EmailVerificationResult {
  const domain = domainFromEmail(email);
  const syntaxValid = Boolean(result.syntax?.valid);
  const mxValid = Boolean(result.has_mx_records);
  const roleAccount = Boolean(result.role_account);
  const disposable = Boolean(result.disposable);
  const temporary = disposable || temporaryDomainSignals.some((signal) => domain.includes(signal));
  const smtpChecked = smtpEnabled && result.smtp !== undefined;
  const smtpDeliverable = smtpChecked ? Boolean(result.smtp?.deliverable) : null;
  const reachable = result.reachable ?? 'unknown';

  let riskScore = 0;
  if (!syntaxValid) riskScore += 100;
  if (!mxValid) riskScore += 60;
  if (roleAccount) riskScore += 10;
  if (disposable) riskScore += 40;
  if (temporary) riskScore += 30;
  if (reachable === 'no') riskScore += 60;
  if (smtpChecked && smtpDeliverable === false) riskScore += 50;
  riskScore = Math.min(100, riskScore);

  const deliverabilityScore = Math.max(0, 100 - riskScore - (reachable === 'unknown' ? 10 : 0));
  const status =
    syntaxValid && mxValid && !disposable && !temporary && reachable !== 'no' && (!smtpChecked || smtpDeliverable !== false)
      ? 'verified'
      : 'rejected';

  return {
    email,
    syntaxValid,
    mxValid,
    roleAccount,
    disposable,
    temporary,
    smtpChecked,
    smtpDeliverable,
    status,
    reason: status === 'verified' ? null : 'AfterShip email-verifier rejected or marked address risky',
    deliverabilityScore,
    riskScore
  };
}
