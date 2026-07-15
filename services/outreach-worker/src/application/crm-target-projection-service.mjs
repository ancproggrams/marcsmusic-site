import { evaluateEligibility } from "../domain/eligibility-policy.mjs";

const ELIGIBILITY_POLICY_VERSION = "outreach-eligibility-v1";

/**
 * Owns the eventually consistent Campaign/TargetList projection. The only
 * caller-visible operation is idempotent and safe to replay after any write.
 */
export function createCrmTargetProjectionService({ espocrm, repository, metrics }) {
  async function ensureTargetProjection({ release, projectedAt, candidate }) {
    const stableProjectedAt = toEspoDateTime(projectedAt);
    const targetList = await ensureTargetList({ release });
    let eligibility = Object.freeze({ eligible: false, reasons: Object.freeze([]) });

    if (candidate) {
      const { contact, outlet } = candidate;
      const [suppressed, genreDenied] = await Promise.all([
        repository.isSuppressed({
          contactId: contact.id,
          outletId: outlet.id,
          email: contact.email,
          domain: outlet.domain
        }),
        repository.hasContactGenreDenial(contact.id, release.genres)
      ]);
      eligibility = evaluateEligibility({
        contact,
        outlet,
        release,
        activeSequence: false,
        now: new Date(projectedAt),
        suppressed,
        genreDenied
      });
      if (eligibility.eligible) {
        await espocrm.relateUnique("TargetList", targetList.id, "mediaContacts", contact.id);
      }
      metrics.increment("outreach_target_membership_total", {
        outcome: eligibility.eligible ? "included" : "excluded"
      });
    }

    let membershipCount = await espocrm.countLinked("TargetList", targetList.id, "mediaContacts");
    const reasonCode = candidate
      ? eligibility.eligible ? "eligible_membership_projected" : "eligibility_exclusion_applied"
      : membershipCount > 0 ? "membership_count_reconciled" : "no_delivery_members_projected";
    let campaign = await ensureCampaign({
      release,
      targetList,
      membershipCount,
      projectedAt: stableProjectedAt,
      reasonCode
    });
    await espocrm.relateUnique("Campaign", campaign.id, "targetLists", targetList.id);
    await linkTargetListToCampaign({ targetList, campaign, release, projectedAt: stableProjectedAt });

    ({ campaign, membershipCount } = await reconcileCampaignMembership({
      campaign,
      release,
      targetList,
      projectedAt: stableProjectedAt,
      reasonCode
    }));

    return Object.freeze({ targetList, campaign, membershipCount, eligibility });
  }

  async function ensureTargetList({ release }) {
    const projectionKey = `music-release:${release.id}`;
    const select = [
      "id",
      "versionNumber",
      "outreachProjectionKey",
      "outreachManaged",
      "musicReleaseId",
      "outreachCampaignId",
      "eligibilityPolicyVersion",
      "membershipProjectedAt",
      "name"
    ];
    const createPayload = {
      name: `${release.artistName ?? "Artist"} – ${release.name ?? "Release"} / eligible outreach`.slice(0, 180),
      outreachProjectionKey: projectionKey,
      outreachManaged: true,
      musicReleaseId: release.id,
      eligibilityPolicyVersion: ELIGIBILITY_POLICY_VERSION
    };

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const existing = await espocrm.findOne("TargetList", "outreachProjectionKey", projectionKey, select);
      if (!existing) {
        try {
          return await espocrm.create("TargetList", createPayload);
        } catch (error) {
          if (!isVersionConflict(error) && !error.deliveryUnknown) throw error;
          const reconciled = await espocrm.findOne("TargetList", "outreachProjectionKey", projectionKey, select);
          if (reconciled) return validateTargetListIdentity(reconciled, release);
          if (error.deliveryUnknown) throw retryableError("CRM_TARGET_LIST_CREATE_UNCONFIRMED");
          continue;
        }
      }
      validateTargetListIdentity(existing, release);
      const patch = {};
      if (existing.name !== createPayload.name) patch.name = createPayload.name;
      if (existing.eligibilityPolicyVersion !== ELIGIBILITY_POLICY_VERSION) {
        patch.eligibilityPolicyVersion = ELIGIBILITY_POLICY_VERSION;
      }
      if (!Object.keys(patch).length) return existing;
      try {
        return await updateConditional("TargetList", existing, patch);
      } catch (error) {
        if (!isVersionConflict(error)) throw error;
      }
    }
    throw retryableError("CRM_TARGET_LIST_CONCURRENT_UPDATE_EXHAUSTED");
  }

  async function ensureCampaign({ release, targetList, membershipCount, projectedAt, reasonCode }) {
    const projectionKey = `music-release:${release.id}`;
    const createPayload = campaignPayload({
      release,
      targetList,
      membershipCount,
      projectedAt,
      reasonCode
    });
    const select = ["id", "versionNumber", ...Object.keys(createPayload)];

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      let existing = await espocrm.findOne("Campaign", "outreachProjectionKey", projectionKey, select);
      if (!existing) {
        try {
          return await espocrm.create("Campaign", createPayload);
        } catch (error) {
          if (!isVersionConflict(error) && !error.deliveryUnknown) throw error;
          const reconciled = await espocrm.findOne("Campaign", "outreachProjectionKey", projectionKey, select);
          if (reconciled) existing = reconciled;
          if (error.deliveryUnknown && !existing) throw retryableError("CRM_CAMPAIGN_CREATE_UNCONFIRMED");
          if (!existing) continue;
        }
      }
      validateCampaignIdentity(existing, release, targetList, { allowLegacyTargetList: true });
      const patch = changedPayload(existing, {
        ...createPayload,
        targetMembershipReasonCode: latestProjectionReason(existing, projectedAt, reasonCode),
        targetMembershipCheckedAt: latestEspoDateTime(existing.targetMembershipCheckedAt, projectedAt),
        targetMembershipProjectedAt: latestEspoDateTime(existing.targetMembershipProjectedAt, projectedAt)
      });
      if (!Object.keys(patch).length) return existing;
      try {
        return await updateConditional("Campaign", existing, patch);
      } catch (error) {
        if (!isVersionConflict(error)) throw error;
      }
    }
    throw retryableError("CRM_CAMPAIGN_CONCURRENT_UPDATE_EXHAUSTED");
  }

  async function linkTargetListToCampaign({ targetList, campaign, release, projectedAt }) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const current = await espocrm.get("TargetList", targetList.id, [
        "id",
        "versionNumber",
        "outreachProjectionKey",
        "outreachManaged",
        "musicReleaseId",
        "outreachCampaignId",
        "eligibilityPolicyVersion",
        "membershipProjectedAt"
      ]);
      validateTargetListIdentity(current, release);
      if (current.outreachCampaignId && current.outreachCampaignId !== campaign.id) {
        throw permanentError("CRM_TARGET_LIST_CAMPAIGN_IDENTITY_MISMATCH");
      }
      const patch = changedPayload(current, {
        outreachCampaignId: campaign.id,
        eligibilityPolicyVersion: ELIGIBILITY_POLICY_VERSION,
        membershipProjectedAt: latestEspoDateTime(current.membershipProjectedAt, projectedAt)
      });
      if (!Object.keys(patch).length) return current;
      try {
        return await updateConditional("TargetList", current, patch);
      } catch (error) {
        if (!isVersionConflict(error)) throw error;
      }
    }
    throw retryableError("CRM_TARGET_LIST_CAMPAIGN_LINK_EXHAUSTED");
  }

  async function reconcileCampaignMembership({ campaign, release, targetList, projectedAt, reasonCode }) {
    let current = campaign;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const observedCount = await espocrm.countLinked("TargetList", targetList.id, "mediaContacts");
      current = await espocrm.get("Campaign", campaign.id, [
        "id",
        "versionNumber",
        "outreachProjectionKey",
        "outreachManaged",
        "musicReleaseId",
        "outreachTargetListId",
        "targetMembershipProjectionState",
        "targetMembershipReasonCode",
        "targetMembershipCheckedAt",
        "targetMembershipProjectedAt",
        "targetMembershipCount"
      ]);
      validateCampaignIdentity(current, release, targetList);
      const patch = changedPayload(current, {
        targetMembershipProjectionState: "Projected",
        targetMembershipReasonCode: latestProjectionReason(current, projectedAt, reasonCode),
        targetMembershipCheckedAt: latestEspoDateTime(current.targetMembershipCheckedAt, projectedAt),
        targetMembershipProjectedAt: latestEspoDateTime(current.targetMembershipProjectedAt, projectedAt),
        targetMembershipCount: observedCount
      });
      if (Object.keys(patch).length) {
        try {
          current = await updateConditional("Campaign", current, patch);
        } catch (error) {
          if (isVersionConflict(error)) continue;
          throw error;
        }
      }
      const postconditionCount = await espocrm.countLinked("TargetList", targetList.id, "mediaContacts");
      if (postconditionCount === observedCount) {
        return { campaign: current, membershipCount: postconditionCount };
      }
    }
    throw retryableError("CRM_TARGET_MEMBERSHIP_RECONCILIATION_EXHAUSTED");
  }

  async function updateConditional(entityType, record, payload) {
    if (typeof espocrm.updateConditional === "function") {
      return espocrm.updateConditional(entityType, record.id, payload, record.versionNumber);
    }
    return espocrm.update(entityType, record.id, payload);
  }

  return Object.freeze({ ensureTargetProjection });
}

function campaignPayload({ release, targetList, membershipCount, projectedAt, reasonCode }) {
  return {
    name: `${release.artistName ?? "Artist"} – ${release.name ?? "Release"}`.slice(0, 180),
    status: campaignStatus(release.status),
    type: "Email",
    startDate: validEspoDate(release.campaignStartDate),
    endDate: validEspoDate(release.campaignEndDate),
    description: `Route-B individual outreach grouping for MusicRelease ${release.id}.`,
    musicReleaseId: release.id,
    outreachTargetListId: targetList.id,
    outreachProjectionKey: `music-release:${release.id}`,
    outreachManaged: true,
    targetMembershipProjectionState: "Projected",
    targetMembershipReasonCode: reasonCode,
    targetMembershipCheckedAt: toEspoDateTime(projectedAt),
    targetMembershipProjectedAt: toEspoDateTime(projectedAt),
    targetMembershipCount: membershipCount
  };
}

function validateTargetListIdentity(record, release) {
  if (
    !record ||
    record.outreachProjectionKey !== `music-release:${release.id}` ||
    record.musicReleaseId !== release.id ||
    record.outreachManaged !== true
  ) {
    throw permanentError("CRM_TARGET_LIST_IDENTITY_MISMATCH");
  }
  return record;
}

function validateCampaignIdentity(record, release, targetList, { allowLegacyTargetList = false } = {}) {
  const targetListMatches = record?.outreachTargetListId === targetList.id ||
    (allowLegacyTargetList && !record?.outreachTargetListId);
  if (
    !record ||
    record.outreachProjectionKey !== `music-release:${release.id}` ||
    record.musicReleaseId !== release.id ||
    record.outreachManaged !== true ||
    !targetListMatches
  ) {
    throw permanentError("CRM_CAMPAIGN_IDENTITY_MISMATCH");
  }
  return record;
}

function changedPayload(record, desired) {
  return Object.fromEntries(Object.entries(desired).filter(([key, expected]) => {
    if (expected === undefined) return false;
    const actual = record?.[key];
    if (expected === null) return actual !== null && actual !== undefined;
    if (Array.isArray(expected) || (expected && typeof expected === "object")) {
      return JSON.stringify(actual) !== JSON.stringify(expected);
    }
    return actual !== expected;
  }));
}

function latestEspoDateTime(current, candidate) {
  const incoming = toEspoDateTime(candidate);
  if (!current) return incoming;
  const existing = toEspoDateTime(current);
  return existing > incoming ? existing : incoming;
}

function latestProjectionReason(record, projectedAt, candidateReason) {
  if (!record?.targetMembershipCheckedAt) return candidateReason;
  return toEspoDateTime(projectedAt) >= toEspoDateTime(record.targetMembershipCheckedAt)
    ? candidateReason
    : record.targetMembershipReasonCode;
}

function campaignStatus(status) {
  if (status === "Active") return "Active";
  if (status === "Completed") return "Complete";
  if (status === "Paused") return "Inactive";
  return "Planning";
}

function validEspoDate(value) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
}

function permanentError(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

function retryableError(code) {
  return Object.assign(new Error(code), { code, retryable: true });
}

function isVersionConflict(error) {
  return error?.statusCode === 409 || error?.code === "ESPOCRM_VERSION_CONFLICT" || error?.code === "ESPOCRM_HTTP_409";
}

function toEspoDateTime(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(text)
    ? new Date(`${text.replace(" ", "T")}Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) throw permanentError("CRM_DATETIME_INVALID");
  return date.toISOString().slice(0, 19).replace("T", " ");
}
