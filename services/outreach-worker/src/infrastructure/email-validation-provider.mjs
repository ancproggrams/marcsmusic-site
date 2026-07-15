import { createHash, randomBytes } from "node:crypto";
import { lookup as dnsLookup, resolveMx as dnsResolveMx } from "node:dns/promises";
import { isIP, createConnection as netCreateConnection } from "node:net";
import { z } from "zod";
import { ApplicationError } from "../errors.mjs";
import { createAbortScope } from "./abort-signal.mjs";

const responseSchema = z.object({
  status: z.enum(["Valid", "Invalid", "Risky", "Unknown"]),
  checkedAt: z.iso.datetime(),
  providerReference: z.string().trim().min(1).max(180)
}).strict();

const DEFINITIVE_SMTP_STATUS = new Set(["Valid", "Invalid"]);
const SMTP_RESPONSE_BYTES_LIMIT = 64 * 1_024;

export class DisabledEmailValidationProvider {
  async validate() {
    return Object.freeze({
      status: "Unknown",
      checkedAt: new Date().toISOString(),
      providerReference: "provider-disabled",
      method: "disabled"
    });
  }
}

export class HttpEmailValidationProvider {
  constructor(config, options = {}) {
    this.url = config.url;
    this.token = config.token;
    this.timeoutMs = config.timeoutMs;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.signal = options.signal;
  }

  async validate(email, idempotencyKey, { signal } = {}) {
    const abortScope = createAbortScope({ signals: [this.signal, signal], timeoutMs: this.timeoutMs });
    try {
      const response = await this.fetch(this.url, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey
        },
        body: JSON.stringify({ email }),
        signal: abortScope.signal
      });
      if (!response.ok) {
        throw new ApplicationError("Email validation provider rejected the request", {
          code: `EMAIL_VALIDATION_HTTP_${response.status}`,
          statusCode: 503,
          retryable: response.status === 429 || response.status >= 500,
          details: { status: response.status }
        });
      }
      const body = await readJson(response);
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApplicationError("Email validation provider returned an invalid contract", {
          code: "EMAIL_VALIDATION_CONTRACT_INVALID", statusCode: 503, retryable: false
        });
      }
      return Object.freeze({ ...parsed.data, method: "http" });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      const aborted = abortScope.externallyAborted || abortScope.timedOut || error?.name === "AbortError";
      const externallyAborted = abortScope.externallyAborted;
      throw new ApplicationError(
        externallyAborted ? "Email validation aborted" : aborted ? "Email validation timed out" : "Email validation request failed",
        {
        code: externallyAborted ? "EMAIL_VALIDATION_ABORTED" : aborted ? "EMAIL_VALIDATION_TIMEOUT" : "EMAIL_VALIDATION_NETWORK_ERROR",
        statusCode: 503,
        retryable: true,
        cause: error
        }
      );
    } finally {
      abortScope.cleanup();
    }
  }
}

/**
 * Optional, fail-closed SMTP recipient probe. It performs only the SMTP
 * envelope dialogue and always closes the connection before DATA; therefore it
 * can never transmit a message body. Private/reserved destination addresses
 * are rejected to keep attacker-controlled email domains from becoming SSRF.
 */
export class SmtpMxEmailValidationProvider {
  constructor(config, options = {}) {
    this.heloDomain = config.heloDomain;
    this.connectTimeoutMs = config.connectTimeoutMs;
    this.commandTimeoutMs = config.commandTimeoutMs;
    this.totalTimeoutMs = config.totalTimeoutMs;
    this.maxMxHosts = config.maxMxHosts;
    this.resolveMx = options.resolveMx ?? dnsResolveMx;
    this.lookup = options.lookup ?? dnsLookup;
    this.createConnection = options.createConnection ?? netCreateConnection;
    this.port = options.port ?? 25;
    this.allowPrivateAddresses = options.allowPrivateAddresses === true;
    this.now = options.now ?? (() => new Date());
    this.randomBytes = options.randomBytes ?? randomBytes;
    this.signal = options.signal;
  }

  async validate(email, _idempotencyKey, { signal } = {}) {
    const abortScope = createAbortScope({ signals: [this.signal, signal] });
    const checkedAt = this.now().toISOString();
    try {
      throwIfAborted(abortScope.signal);
      const domain = recipientDomain(email);
      if (!domain) return smtpResult("Unknown", checkedAt, "recipient-domain-invalid");
      const deadline = Date.now() + this.totalTimeoutMs;
      let mxRecords;
      try {
        mxRecords = await bounded(
          this.resolveMx(domain),
          remaining(deadline, this.commandTimeoutMs),
          "smtp MX lookup timed out",
          abortScope.signal
        );
      } catch (error) {
        if (abortScope.externallyAborted) throw emailValidationAborted(error);
        return smtpResult("Unknown", checkedAt, "mx-lookup-unavailable");
      }
      const candidates = normalizeMxRecords(mxRecords).slice(0, this.maxMxHosts);
      if (!candidates.length) return smtpResult("Unknown", checkedAt, "mx-not-found");

      let lastResult = smtpResult("Unknown", checkedAt, "mx-unreachable");
      for (const candidate of candidates) {
        throwIfAborted(abortScope.signal);
        let addresses;
        try {
          addresses = await bounded(
            this.lookup(candidate.exchange, { all: true, verbatim: true }),
            remaining(deadline, this.commandTimeoutMs),
            "smtp address lookup timed out",
            abortScope.signal
          );
        } catch (error) {
          if (abortScope.externallyAborted) throw emailValidationAborted(error);
          continue;
        }
        const allowedAddresses = normalizeAddresses(addresses)
          .filter(({ address }) => this.allowPrivateAddresses || isPublicDestination(address))
          .slice(0, 2);
        if (!allowedAddresses.length) {
          lastResult = smtpResult("Unknown", checkedAt, "mx-address-disallowed", candidate.exchange);
          continue;
        }
        for (const address of allowedAddresses) {
          const probe = await probeSmtpServer({
            address: address.address,
            family: address.family,
            mxHost: candidate.exchange,
            port: this.port,
            heloDomain: this.heloDomain,
            recipient: email,
            recipientDomain: domain,
            connectTimeoutMs: remaining(deadline, this.connectTimeoutMs),
            commandTimeoutMs: this.commandTimeoutMs,
            deadline,
            createConnection: this.createConnection,
            randomBytes: this.randomBytes,
            signal: abortScope.signal
          });
          lastResult = smtpResult(probe.status, checkedAt, probe.reason, candidate.exchange);
          if (DEFINITIVE_SMTP_STATUS.has(probe.status) || probe.protocolReached) return lastResult;
        }
      }
      return lastResult;
    } catch (error) {
      if (abortScope.externallyAborted && !(error instanceof ApplicationError)) throw emailValidationAborted(error);
      throw error;
    } finally {
      abortScope.cleanup();
    }
  }
}

export async function probeSmtpServer(options) {
  let socket;
  try {
    socket = await connectSocket(options);
    const reader = new SmtpResponseReader(socket, options.signal);
    const greeting = await reader.read(remaining(options.deadline, options.commandTimeoutMs));
    if (greeting.code !== 220) return smtpProbe("Unknown", "greeting-not-ready", true);
    const ehlo = await smtpCommand(socket, reader, `EHLO ${options.heloDomain}`, options);
    if (ehlo.code !== 250) return smtpProbe("Unknown", "ehlo-rejected", true);
    const sender = await smtpCommand(socket, reader, "MAIL FROM:<>", options);
    if (sender.code !== 250) return smtpProbe("Unknown", "null-sender-rejected", true);
    const target = await smtpCommand(socket, reader, `RCPT TO:<${options.recipient}>`, options);
    if (target.code === 250) {
      const reset = await smtpCommand(socket, reader, "RSET", options);
      if (reset.code !== 250) return smtpProbe("Risky", "catch-all-reset-unavailable", true);
      const probeSender = await smtpCommand(socket, reader, "MAIL FROM:<>", options);
      if (probeSender.code !== 250) return smtpProbe("Risky", "catch-all-sender-unavailable", true);
      const randomLocal = `outreach-probe-${options.randomBytes(12).toString("hex")}`;
      const catchAll = await smtpCommand(
        socket,
        reader,
        `RCPT TO:<${randomLocal}@${options.recipientDomain}>`,
        options
      );
      if (catchAll.code === 250) return smtpProbe("Risky", "catch-all-accepted", true);
      if (catchAll.code >= 500 && catchAll.code <= 599) return smtpProbe("Valid", "recipient-250-catch-all-5xx", true);
      return smtpProbe("Risky", `catch-all-${responseClass(catchAll.code)}`, true);
    }
    if (target.code >= 500 && target.code <= 599) return smtpProbe("Invalid", "recipient-5xx", true);
    if (target.code >= 400 && target.code <= 499) return smtpProbe("Unknown", "recipient-4xx", true);
    return smtpProbe("Unknown", `recipient-${responseClass(target.code)}`, true);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return smtpProbe("Unknown", error?.code === "SMTP_TIMEOUT" ? "smtp-timeout" : "smtp-unavailable", false);
  } finally {
    if (socket && !socket.destroyed) {
      if (options.signal?.aborted) socket.destroy();
      else {
        socket.once("error", () => {});
        socket.write("QUIT\r\n", () => socket.end());
        const destroyTimer = setTimeout(() => socket.destroy(), 100);
        destroyTimer.unref?.();
      }
    }
  }
}

class SmtpResponseReader {
  constructor(socket, signal) {
    this.socket = socket;
    this.signal = signal;
    this.buffer = "";
    this.bytes = 0;
  }

  async read(timeoutMs) {
    const first = await this.readLine(timeoutMs);
    const match = /^(\d{3})([ -])/u.exec(first);
    if (!match) throw smtpError("SMTP_RESPONSE_INVALID", "SMTP response line is invalid");
    const code = Number(match[1]);
    if (match[2] === " ") return Object.freeze({ code });
    for (let lines = 1; lines < 100; lines += 1) {
      const next = await this.readLine(timeoutMs);
      if (next.startsWith(`${match[1]} `)) return Object.freeze({ code });
    }
    throw smtpError("SMTP_RESPONSE_INVALID", "SMTP multiline response exceeded its line limit");
  }

  async readLine(timeoutMs) {
    const buffered = this.takeLine();
    if (buffered !== undefined) return buffered;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(smtpError("SMTP_TIMEOUT", "SMTP response timed out")), timeoutMs);
      const onAbort = () => finish(smtpError("SMTP_ABORTED", "SMTP validation aborted"));
      const onData = (chunk) => {
        this.bytes += chunk.length;
        if (this.bytes > SMTP_RESPONSE_BYTES_LIMIT) {
          finish(smtpError("SMTP_RESPONSE_TOO_LARGE", "SMTP response exceeded its byte limit"));
          return;
        }
        this.buffer += chunk.toString("utf8");
        const line = this.takeLine();
        if (line !== undefined) finish(undefined, line);
      };
      const onError = (error) => finish(error);
      const onClose = () => finish(smtpError("SMTP_CONNECTION_CLOSED", "SMTP connection closed"));
      const finish = (error, line) => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
        this.socket.off("close", onClose);
        this.signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve(line);
      };
      this.socket.on("data", onData);
      this.socket.once("error", onError);
      this.socket.once("close", onClose);
      if (this.signal?.aborted) onAbort();
      else this.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  takeLine() {
    const index = this.buffer.indexOf("\r\n");
    if (index < 0) return undefined;
    const line = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + 2);
    return line;
  }
}

async function connectSocket(options) {
  return new Promise((resolve, reject) => {
    let socket;
    const timer = setTimeout(() => finish(smtpError("SMTP_TIMEOUT", "SMTP connection timed out")), options.connectTimeoutMs);
    const finish = (error) => {
      clearTimeout(timer);
      socket?.off("connect", onConnect);
      socket?.off("error", onError);
      options.signal?.removeEventListener("abort", onAbort);
      if (error) {
        socket?.destroy();
        reject(error);
      } else {
        socket.setNoDelay?.(true);
        resolve(socket);
      }
    };
    const onConnect = () => finish();
    const onError = (error) => finish(error);
    const onAbort = () => finish(smtpError("SMTP_ABORTED", "SMTP validation aborted"));
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    socket = options.createConnection({ host: options.address, family: options.family, port: options.port });
    socket.once("connect", onConnect);
    socket.once("error", onError);
    options.signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function smtpCommand(socket, reader, command, options) {
  if (/\r|\n/u.test(command)) throw smtpError("SMTP_COMMAND_INVALID", "SMTP command contains a line break");
  throwIfAborted(options.signal);
  await new Promise((resolve, reject) => {
    const onAbort = () => finish(smtpError("SMTP_ABORTED", "SMTP validation aborted"));
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    if (options.signal?.aborted) onAbort();
    else {
      options.signal?.addEventListener("abort", onAbort, { once: true });
      socket.write(`${command}\r\n`, (error) => finish(error));
    }
  });
  return reader.read(remaining(options.deadline, options.commandTimeoutMs));
}

function normalizeMxRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => Number.isInteger(record?.priority) && validHost(record?.exchange))
    .sort((left, right) => left.priority - right.priority || left.exchange.localeCompare(right.exchange));
}

function normalizeAddresses(records) {
  const values = Array.isArray(records) ? records : records ? [records] : [];
  return values
    .map((record) => typeof record === "string" ? { address: record, family: isIP(record) } : record)
    .filter((record) => isIP(record?.address) === Number(record?.family));
}

function validHost(value) {
  return typeof value === "string"
    && value.length <= 253
    && /^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.?$/iu.test(value);
}

export function isPublicDestination(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 0)
      || (a === 192 && b === 0 && c === 2)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113)
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return isPublicDestination(normalized.slice(7));
    return /^[23]/u.test(normalized) && !normalized.startsWith("2001:db8:");
  }
  return false;
}

function recipientDomain(email) {
  if (typeof email !== "string" || /[\r\n]/u.test(email)) return undefined;
  const separator = email.lastIndexOf("@");
  if (separator <= 0) return undefined;
  const domain = email.slice(separator + 1).toLowerCase();
  return validHost(domain) ? domain.replace(/\.$/u, "") : undefined;
}

function smtpResult(status, checkedAt, reason, mxHost) {
  const mxDigest = mxHost ? createHash("sha256").update(mxHost).digest("hex").slice(0, 16) : "none";
  return Object.freeze({ status, checkedAt, providerReference: `smtp:${mxDigest}:${reason}`, method: "smtp" });
}

function smtpProbe(status, reason, protocolReached) {
  return Object.freeze({ status, reason, protocolReached });
}

function responseClass(code) {
  return Number.isInteger(code) ? `${Math.floor(code / 100)}xx` : "invalid";
}

function remaining(deadline, maximum) {
  const value = Math.min(maximum, deadline - Date.now());
  if (value <= 0) throw smtpError("SMTP_TIMEOUT", "SMTP validation exceeded its total timeout");
  return value;
}

async function bounded(promise, timeoutMs, message, signal) {
  let timer;
  let onAbort;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(smtpError("SMTP_TIMEOUT", message)), timeoutMs);
      }),
      new Promise((_, reject) => {
        onAbort = () => reject(smtpError("SMTP_ABORTED", "SMTP validation aborted"));
        if (signal?.aborted) onAbort();
        else signal?.addEventListener("abort", onAbort, { once: true });
      })
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw smtpError("SMTP_ABORTED", "SMTP validation aborted");
}

function emailValidationAborted(cause) {
  return new ApplicationError("Email validation aborted", {
    code: "EMAIL_VALIDATION_ABORTED",
    statusCode: 503,
    retryable: true,
    cause
  });
}

function smtpError(code, message) {
  return Object.assign(new Error(message), { code });
}

async function readJson(response) {
  try {
    const bytes = await readBoundedBody(response, 64 * 1_024);
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError("Email validation provider returned non-JSON", {
      code: "EMAIL_VALIDATION_RESPONSE_INVALID", statusCode: 503, retryable: false
    });
  }
}

async function readBoundedBody(response, maximumBytes) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw responseTooLarge();
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximumBytes) throw responseTooLarge();
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw responseTooLarge();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function responseTooLarge() {
  return new ApplicationError("Email validation provider response is too large", {
    code: "EMAIL_VALIDATION_RESPONSE_TOO_LARGE", statusCode: 503, retryable: false
  });
}
