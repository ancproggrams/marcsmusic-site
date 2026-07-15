import { addYears } from "./date-utils.mjs";
import { buildCopyFacts, buildProviderPayload, safeTemplate, validateGeneratedCopy, validateProviderSelection } from "../domain/copy-policy.mjs";
import { sendAuthorizationSnapshotDigest } from "../domain/send-authorization-snapshot.mjs";
import { createUnsubscribeToken } from "../domain/unsubscribe-token.mjs";

export function createCopyService({ repository, copyProvider, releaseLinkChecker, config, logger, metrics }) {
  if (typeof releaseLinkChecker?.assertReachable !== "function") {
    throw new TypeError("releaseLinkChecker.assertReachable is required");
  }

  return Object.freeze({
    async prepare({ match, release, contact, outlet, sequenceStep }) {
      const tokenIssuedAt = new Date();
      const token = createUnsubscribeToken({
        contactId: contact.id,
        matchId: match.id,
        keyring: config.crypto.unsubscribeSigning,
        issuedAt: tokenIssuedAt,
        expiresAt: addYears(tokenIssuedAt, 2)
      });
      const unsubscribeUrl = `${config.publicBaseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
      const facts = buildCopyFacts({ release, contact, outlet });
      let copy;
      let providerSelection;
      let providerError;

      if (config.copyProvider.enabled) {
        try {
          providerSelection = await copyProvider.generate(buildProviderPayload(facts, sequenceStep));
        } catch (error) {
          providerError = error;
          logger.warn({ err: error, matchId: match.id, sequenceStep }, "copy provider failed; using deterministic fallback");
          metrics.increment("outreach_copy_provider_failures_total", { code: error.code ?? "unknown" });
        }
      }

      const structured = providerSelection ? validateProviderSelection(providerSelection, facts) : undefined;
      const providerAccepted = Boolean(structured?.valid && providerSelection.confidence >= config.copyProvider.minConfidence);
      if (providerAccepted) {
        copy = safeTemplate({ facts, sequenceStep, unsubscribeUrl, selection: structured.selection });
      }
      let validation = copy ? validateGeneratedCopy({ copy, facts, unsubscribeUrl }) : undefined;
      if (!providerAccepted) {
        copy = safeTemplate({ facts, sequenceStep, unsubscribeUrl });
        validation = validateGeneratedCopy({ copy, facts, unsubscribeUrl });
      }
      if (!validation.valid) {
        throw Object.assign(new Error(`Safe outreach copy failed validation: ${validation.errors.join(",")}`), {
          code: "SAFE_COPY_VALIDATION_FAILED",
          retryable: false
        });
      }

      try {
        await releaseLinkChecker.assertReachable(facts.release.epkUrl || facts.release.privateStreamUrl);
        metrics.increment("outreach_copy_link_checks_total", { outcome: "reachable" });
      } catch (error) {
        metrics.increment("outreach_copy_link_checks_total", {
          outcome: error.retryable ? "retryable_failure" : "permanent_failure"
        });
        throw error;
      }

      const templateVersion = providerAccepted ? "structured-template-v3" : "safe-template-v2";
      const artifactId = await repository.saveCopyArtifact({
        matchId: match.id,
        sequenceStep,
        templateVersion,
        promptVersion: providerAccepted ? "fact-slot-selection-v2" : undefined,
        copy,
        contentHash: validation.contentHash,
        authorizationSnapshotDigest: sendAuthorizationSnapshotDigest({
          match: { ...match, activeSequence: true },
          release,
          contact,
          outlet
        }),
        validationStatus: providerAccepted ? "valid" : "fallback",
        confidence: providerAccepted ? providerSelection.confidence : copy.confidence
      });
      metrics.increment("outreach_copy_artifacts_total", { source: providerAccepted ? "provider" : "fallback" });

      return Object.freeze({ artifactId, templateVersion, copy, providerAccepted, providerErrorCode: providerError?.code });
    }
  });
}
