import { z } from "zod";
import { ApplicationError } from "../errors.mjs";
import { createAbortScope } from "./abort-signal.mjs";
import { readBoundedResponseText, ResponseSizeLimitError } from "./bounded-response.mjs";

const MAX_RESPONSE_BYTES = 64 * 1_024;

const copySchema = z.object({
  evidenceId: z.string().min(1).max(80),
  genre: z.string().min(1).max(80),
  tone: z.enum(["direct", "warm", "concise"]),
  confidence: z.number().min(0).max(1)
}).strict();

export class HttpCopyProvider {
  constructor(config, options = {}) {
    this.config = config;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.signal = options.signal;
  }

  async generate(payload) {
    if (!this.config.enabled) return undefined;
    const abortScope = createAbortScope({ signals: [this.signal], timeoutMs: this.config.timeoutMs });
    try {
      const response = await this.fetch(this.config.url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {})
        },
        body: JSON.stringify({ model: this.config.model, input: payload, responseFormat: "json" }),
        signal: abortScope.signal
      });
      if (!response.ok) {
        throw new ApplicationError(`Copy provider returned HTTP ${response.status}`, {
          code: `COPY_PROVIDER_HTTP_${response.status}`,
          statusCode: 502,
          retryable: response.status >= 500 || response.status === 429
        });
      }
      let raw;
      try {
        raw = JSON.parse(await readBoundedResponseText(response, MAX_RESPONSE_BYTES));
      } catch (error) {
        if (error instanceof ResponseSizeLimitError) {
          throw new ApplicationError("Copy provider response exceeded the configured byte limit", {
            code: "COPY_PROVIDER_RESPONSE_TOO_LARGE",
            statusCode: 502,
            retryable: false
          });
        }
        if (error instanceof ApplicationError) throw error;
        throw new ApplicationError("Copy provider returned non-JSON", {
          code: "COPY_PROVIDER_RESPONSE_INVALID",
          statusCode: 502,
          retryable: false
        });
      }
      const output = raw.output ?? raw.result ?? raw;
      let candidate = output;
      if (typeof output === "string") {
        try {
          candidate = JSON.parse(output);
        } catch {
          candidate = undefined;
        }
      }
      const parsed = copySchema.safeParse(candidate);
      if (!parsed.success) {
        throw new ApplicationError("Copy provider response violated the JSON contract", {
          code: "COPY_PROVIDER_SCHEMA_INVALID",
          statusCode: 502,
          retryable: false
        });
      }
      return Object.freeze({ ...parsed.data, source: "copy-provider" });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError(abortScope.externallyAborted ? "Copy provider request aborted during shutdown" : abortScope.timedOut ? "Copy provider timed out" : "Copy provider request failed", {
        code: abortScope.externallyAborted ? "COPY_PROVIDER_ABORTED" : abortScope.timedOut ? "COPY_PROVIDER_TIMEOUT" : "COPY_PROVIDER_NETWORK_ERROR",
        statusCode: 502,
        retryable: true,
        cause: error
      });
    } finally {
      abortScope.cleanup();
    }
  }
}
