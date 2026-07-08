const SUPPRESSED_STATUSES = new Set(["unsubscribed", "bounced", "complained", "suppressed", "inactive"]);

export function createContactSegmentService({ espocrmClient }) {
  if (!espocrmClient || typeof espocrmClient.listContacts !== "function") {
    throw new TypeError("contact segment service requires espocrmClient.listContacts()");
  }

  return Object.freeze({
    async selectRecipients(filters = {}) {
      const contacts = await espocrmClient.listContacts();
      const skipped = [];
      const selected = [];
      const seenEmails = new Set();

      for (const contact of contacts) {
        const skipReason = getSkipReason(contact, filters, seenEmails);

        if (skipReason) {
          skipped.push({ contact, reason: skipReason });
          continue;
        }

        seenEmails.add(contact.email);
        selected.push(contact);
      }

      return Object.freeze({
        recipients: Object.freeze(selected),
        skipped: Object.freeze(skipped),
        count: selected.length,
        languageBreakdown: countBy(selected, "language"),
        typeBreakdown: countBy(selected, "type")
      });
    }
  });
}

function getSkipReason(contact, filters, seenEmails) {
  if (!contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.email)) return "invalid_email";
  if (seenEmails.has(contact.email)) return "duplicate_email";
  if (SUPPRESSED_STATUSES.has(contact.status)) return contact.status;
  if (!matchesSet(contact.type, filters.selectedTypes)) return "type_filter";
  if (!matchesSet(contact.language, filters.selectedLanguages)) return "language_filter";
  if (!matchesSet(contact.country, filters.selectedCountries)) return "country_filter";
  if (!matchesSet(contact.priority, filters.selectedPriorities)) return "priority_filter";
  if (!matchesAny(contact.tags, filters.selectedTags)) return "tag_filter";
  if (!matchesAny(contact.genres, filters.selectedGenres)) return "genre_filter";
  if (filters.artistSlug && !matchesAny(contact.artistAudiences, [filters.artistSlug])) return "artist_filter";
  return undefined;
}

function matchesSet(value, selected) {
  if (!Array.isArray(selected) || selected.length === 0) return true;
  return selected.map(normalize).includes(normalize(value));
}

function matchesAny(values, selected) {
  if (!Array.isArray(selected) || selected.length === 0) return true;
  const normalizedValues = new Set((values ?? []).map(normalize));
  return selected.map(normalize).some((value) => normalizedValues.has(value));
}

function countBy(items, field) {
  const counts = {};
  for (const item of items) {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

