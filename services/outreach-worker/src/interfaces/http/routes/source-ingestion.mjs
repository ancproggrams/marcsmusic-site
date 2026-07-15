import { verifySourceRequestSignature } from "../../../domain/source-artifact.mjs";
import { HttpError } from "../http-error.mjs";

export function registerSourceIngestionRoute(server, { config, sourceIngestionRepository, sourceIngestionService }) {
  server.post("/api/v1/source-ingestion/:sourceId", async (request, reply) => {
    const rawBody = request.rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      throw new HttpError(400, "SOURCE_ARTIFACT_BODY_REQUIRED", "A JSON source artifact is required.");
    }
    const sourceId = request.params.sourceId;
    let authentication;
    try {
      authentication = verifySourceRequestSignature({
        sourceId,
        keyId: singleHeader(request.headers["x-source-key-id"]),
        timestamp: singleHeader(request.headers["x-source-timestamp"]),
        nonce: singleHeader(request.headers["x-source-nonce"]),
        signature: singleHeader(request.headers["x-source-signature"]),
        rawBody
      }, config.sourceIngestion);
    } catch (error) {
      if (error.code?.startsWith("SOURCE_") && Number.isInteger(error.statusCode)) {
        throw new HttpError(error.statusCode, error.code, "Source request authentication failed.");
      }
      throw error;
    }
    const nonceReserved = await sourceIngestionRepository.reserveNonce({
      ...authentication,
      ttlSeconds: config.sourceIngestion.maxSkewSeconds * 2
    });
    if (!nonceReserved) {
      throw new HttpError(409, "SOURCE_REQUEST_REPLAYED", "Source request nonce was already used.");
    }
    let result;
    try {
      result = await sourceIngestionService.ingest({ sourceId, artifact: request.body, rawBody });
    } catch (error) {
      if (error.code?.startsWith("SOURCE_") && Number.isInteger(error.statusCode) && error.statusCode < 500) {
        throw new HttpError(error.statusCode, error.code, "Source artifact was rejected.");
      }
      throw error;
    }
    return reply.code(result.replayed ? 200 : 201).send({ ok: true, result });
  });
}

function singleHeader(value) {
  return Array.isArray(value) ? undefined : value;
}
