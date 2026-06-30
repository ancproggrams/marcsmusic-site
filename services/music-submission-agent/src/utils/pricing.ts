import type { PlatformInput, PlatformRecord } from '../models/types.js';

export type PricingModel = 'free' | 'paid' | 'freemium' | 'unknown';

export interface PricingClassification {
  pricingModel: PricingModel;
  freeFirstPriority: number;
  requiresOwnerApproval: boolean;
  reason: string;
}

const paidSignals = [
  'paid',
  'payment',
  'fee',
  'budget',
  'credits',
  'subscription',
  'package',
  'premium',
  'campaign',
  'checkout'
];
const freeSignals = ['free', 'no fee', 'free submission', 'free playlist', 'gratis'];
const freemiumSignals = ['free and paid', 'free/premium', 'free or paid', 'credits', 'standard', 'premium'];

function haystack(input: PlatformInput | PlatformRecord): string {
  return [input.name, input.submissionMethod, input.feeAmount, input.manualReviewReason, input.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function classifyPricing(input: PlatformInput | PlatformRecord): PricingClassification {
  const text = haystack(input);
  const hasPaidFlag = Boolean(input.feeRequired || input.paymentRequired);
  const hasPaidSignal = paidSignals.some((signal) => text.includes(signal));
  const hasFreeSignal = freeSignals.some((signal) => text.includes(signal));
  const hasFreemiumSignal = freemiumSignals.some((signal) => text.includes(signal));

  if (hasPaidFlag || (hasPaidSignal && !hasFreeSignal)) {
    return {
      pricingModel: 'paid',
      freeFirstPriority: 10,
      requiresOwnerApproval: true,
      reason: 'Paid route, payment signal or fee flag detected. Keep outside free-first processing.'
    };
  }

  if (hasFreemiumSignal || (hasPaidSignal && hasFreeSignal)) {
    return {
      pricingModel: 'freemium',
      freeFirstPriority: 30,
      requiresOwnerApproval: true,
      reason: 'Freemium route detected. Only the free path may be inspected; paid upgrades require owner approval.'
    };
  }

  if (hasFreeSignal || (!hasPaidFlag && !hasPaidSignal)) {
    return {
      pricingModel: 'free',
      freeFirstPriority: 90,
      requiresOwnerApproval: false,
      reason: 'No payment signal detected. Eligible for free-first verification and form mapping.'
    };
  }

  return {
    pricingModel: 'unknown',
    freeFirstPriority: 40,
    requiresOwnerApproval: true,
    reason: 'Pricing could not be confirmed. Keep in manual review until verified.'
  };
}
