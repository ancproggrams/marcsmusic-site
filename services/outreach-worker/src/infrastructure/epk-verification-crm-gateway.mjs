import { ApplicationError } from "../errors.mjs";
import { MUSIC_RELEASE_EPK_SELECT } from "../domain/epk-verification.mjs";

const ELIGIBLE_STATUSES = Object.freeze(["Draft", "Paused"]);
const ATTESTATION_FIELDS = Object.freeze([
  "epkAttestationState", "epkEvidenceReference", "epkManifestSha256", "epkVerifiedAt"
]);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;

export class EpkVerificationCrmGateway {
  constructor(client) {
    this.client = client;
  }

  async getRelease(id) {
    assertId(id);
    return this.client.get("MusicRelease", id, MUSIC_RELEASE_EPK_SELECT);
  }

  async listCandidateIds(limit) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw contractError("EPK_BATCH_LIMIT_INVALID");
    const candidates = [];
    for (const status of ELIGIBLE_STATUSES) {
      const searchParams = {
        maxSize: limit,
        where: [{ type: "equals", attribute: "status", value: status }],
        select: ["id", "status", "modifiedAt"],
        orderBy: "modifiedAt",
        order: "asc"
      };
      const response = await this.client.request(
        "GET",
        `MusicRelease?searchParams=${encodeURIComponent(JSON.stringify(searchParams))}`,
        undefined,
        { headers: { "X-No-Total": "true" }, attempts: 2 }
      );
      const records = response?.list ?? response?.records ?? [];
      if (!Array.isArray(records) || records.length > limit) throw contractError("EPK_CANDIDATE_RESPONSE_INVALID");
      for (const record of records) {
        assertId(record?.id);
        const modifiedAt = canonicalUtcTimestamp(record.modifiedAt);
        if (record.status !== status || !modifiedAt) throw contractError("EPK_CANDIDATE_RESPONSE_INVALID");
        candidates.push({ id: record.id, modifiedAt });
      }
    }
    candidates.sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt) || left.id.localeCompare(right.id));
    return Object.freeze([...new Set(candidates.map((candidate) => candidate.id))].slice(0, limit));
  }

  updateAttestation(id, payload, versionNumber) {
    assertId(id);
    const keys = Object.keys(payload).sort();
    if (keys.length !== ATTESTATION_FIELDS.length || keys.some((key, index) => key !== ATTESTATION_FIELDS[index])) {
      throw contractError("EPK_ATTESTATION_PAYLOAD_INVALID");
    }
    if (Object.hasOwn(payload, "status")) throw contractError("EPK_STATUS_MUTATION_FORBIDDEN");
    return this.client.updateConditional("MusicRelease", id, payload, versionNumber);
  }
}

function assertId(value) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw contractError("EPK_RELEASE_ID_INVALID");
}

function canonicalUtcTimestamp(value) {
  if (typeof value !== "string") return undefined;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value) ? `${value.replace(" ", "T")}Z` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(iso)) return undefined;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function contractError(code) {
  return new ApplicationError("EPK CRM gateway contract failed", {
    code,
    statusCode: 500,
    retryable: false
  });
}
