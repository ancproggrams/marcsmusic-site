export function allocateBestMatches(candidates, constraints = {}) {
  const maxContactsPerOutlet = constraints.maxContactsPerOutlet ?? 2;
  const activeContactIds = new Set(constraints.activeContactIds ?? []);
  const recentlyContactedOutletIds = new Set(constraints.recentlyContactedOutletIds ?? []);
  const alreadySentPairs = new Set(constraints.alreadySentPairs ?? []);
  const outletCounts = new Map();
  const allocations = [];
  const skipped = [];

  const ordered = [...candidates].sort((a, b) =>
    b.score - a.score || (b.releasePriority ?? 0) - (a.releasePriority ?? 0) || String(a.releaseId).localeCompare(String(b.releaseId))
  );

  for (const candidate of ordered) {
    const pair = `${candidate.releaseId}:${candidate.contactId}`;
    const reason = skipReason(candidate, { activeContactIds, recentlyContactedOutletIds, alreadySentPairs, outletCounts, maxContactsPerOutlet });
    if (reason) {
      skipped.push(Object.freeze({ ...candidate, reason }));
      continue;
    }

    allocations.push(Object.freeze(candidate));
    activeContactIds.add(candidate.contactId);
    alreadySentPairs.add(pair);
    if (candidate.outletId) outletCounts.set(candidate.outletId, (outletCounts.get(candidate.outletId) ?? 0) + 1);
  }

  return Object.freeze({ allocations: Object.freeze(allocations), skipped: Object.freeze(skipped) });
}

function skipReason(candidate, state) {
  if (!candidate.eligible) return "not_eligible";
  if (state.activeContactIds.has(candidate.contactId)) return "contact_has_active_sequence";
  if (state.alreadySentPairs.has(`${candidate.releaseId}:${candidate.contactId}`)) return "release_already_sent_to_contact";
  if (candidate.outletId && state.recentlyContactedOutletIds.has(candidate.outletId)) return "outlet_cooldown_active";
  if (candidate.outletId && (state.outletCounts.get(candidate.outletId) ?? 0) >= state.maxContactsPerOutlet) return "outlet_contact_limit_reached";
  return undefined;
}
