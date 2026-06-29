import { resolveMx } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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

function domainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function localPartFromEmail(email: string): string {
  return email.split('@')[0]?.toLowerCase() ?? '';
}

export class EmailVerifier {
  public constructor(
    private readonly smtpEnabled = false,
    private readonly afterShipBinaryPath = process.env.AFTERSHIP_EMAIL_VERIFIER_BIN ?? 'bin/aftership-email-verifier'
  ) {}

  public async verify(email: string): Promise<EmailVerificationResult> {
    const normalized = email.trim().toLowerCase();
    const afterShipResult = await this.verifyWithAfterShip(normalized);
    if (afterShipResult) {
      return afterShipResult;
    }

    return this.verifyWithFallback(normalized);
  }

  private async verifyWithAfterShip(email: string): Promise<EmailVerificationResult | null> {
    if (!existsSync(this.afterShipBinaryPath)) {
      return null;
    }

    const args = ['--email', email];
    if (this.smtpEnabled) {
      args.push('--smtp');
    }

    try {
      const { stdout } = await execFileAsync(this.afterShipBinaryPath, args, {
        timeout: this.smtpEnabled ? 30_000 : 15_000,
        maxBuffer: 1024 * 1024
      });
      const payload = JSON.parse(stdout) as AfterShipPayload;
      if (!payload.ok || !payload.result) {
        return null;
      }

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

    const smtpChecked = this.smtpEnabled;
    const smtpDeliverable = this.smtpEnabled ? null : null;
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
  syntax?: {
    valid?: boolean;
    username?: string;
    domain?: string;
  };
  smtp?: {
    deliverable?: boolean;
    disabled?: boolean;
    full_inbox?: boolean;
    host_exists?: boolean;
    catch_all?: boolean;
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
    syntaxValid &&
    mxValid &&
    !disposable &&
    !temporary &&
    reachable !== 'no' &&
    (!smtpChecked || smtpDeliverable !== false)
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
