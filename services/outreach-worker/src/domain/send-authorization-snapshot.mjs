import { createHash } from "node:crypto";

const SCHEMA_VERSION = 1;

export function sendAuthorizationSnapshotDigest({ match, release, contact, outlet }) {
  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    match: {
      id: match?.id,
      musicReleaseId: match?.musicReleaseId,
      mediaContactId: match?.mediaContactId,
      mediaOutletId: match?.mediaOutletId,
      activeSequence: match?.activeSequence === true,
      cooldownUntil: match?.cooldownUntil ?? null
    },
    release: {
      id: release?.id,
      name: release?.name,
      artistName: release?.artistName,
      releaseDate: release?.releaseDate,
      campaignStartDate: release?.campaignStartDate,
      campaignEndDate: release?.campaignEndDate,
      status: release?.status,
      genres: release?.genres,
      subGenres: release?.subGenres,
      languages: release?.languages,
      territories: release?.territories,
      description: release?.description,
      epkUrl: release?.epkUrl,
      privateStreamUrl: release?.privateStreamUrl,
      downloadUrl: release?.downloadUrl,
      radioEditUrl: release?.radioEditUrl,
      priority: release?.priority,
      dailySendLimit: release?.dailySendLimit
    },
    contact: {
      id: contact?.id,
      name: contact?.name,
      firstName: contact?.firstName,
      email: contact?.email,
      status: contact?.status,
      role: contact?.role,
      preferredLanguage: contact?.preferredLanguage,
      mediaOutletId: contact?.mediaOutletId,
      contactSourceUrl: contact?.contactSourceUrl,
      contactEvidence: contact?.contactEvidence,
      contactPurpose: contact?.contactPurpose,
      contactBasis: contact?.contactBasis,
      emailValidationStatus: contact?.emailValidationStatus,
      lastValidatedAt: contact?.lastValidatedAt,
      doNotContact: contact?.doNotContact,
      optedOut: contact?.optedOut,
      hardBounced: contact?.hardBounced,
      previousPositiveReply: contact?.previousPositiveReply,
      rejectedGenres: contact?.rejectedGenres
    },
    outlet: {
      id: outlet?.id,
      name: outlet?.name,
      type: outlet?.type,
      website: outlet?.website,
      domain: outlet?.domain,
      country: outlet?.country,
      language: outlet?.language,
      genres: outlet?.genres,
      subGenres: outlet?.subGenres,
      formatGenres: outlet?.formatGenres,
      submissionPolicy: outlet?.submissionPolicy,
      submissionUrl: outlet?.submissionUrl,
      acceptsEmail: outlet?.acceptsEmail,
      activityStatus: outlet?.activityStatus
    }
  };
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function sendAuthorizationSnapshotVersion() {
  return SCHEMA_VERSION;
}
