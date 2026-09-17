import { IANAZone } from "luxon";

export const SUPPORTED_COPY_LANGUAGES = Object.freeze(["en", "nl", "de", "fr", "es", "pt"]);
export const SUPPORTED_COUNTRY_CODES = Object.freeze([
  "AR", "AT", "AU", "BE", "BR", "CA", "CH", "CL", "CO", "DE", "ES", "FR", "GB", "IE", "LI",
  "LU", "MC", "MX", "NL", "NZ", "PE", "PT", "SR", "US", "UY"
]);

const LANGUAGE_ALIASES = aliasMap([
  ["en", "en", "english", "engels", "englisch", "anglais", "ingles", "inglés", "inglês"],
  ["nl", "nl", "dutch", "nederlands", "niederlandisch", "niederländisch", "neerlandais", "neerlandes", "neerlandês", "holandes", "holandés"],
  ["de", "de", "german", "deutsch", "duits", "allemand", "aleman", "alemán", "alemao", "alemão"],
  ["fr", "fr", "french", "francais", "français", "frans", "franzosisch", "französisch", "frances", "francés", "francês"],
  ["es", "es", "spanish", "espanol", "español", "spaans", "spanisch", "espagnol", "espanhol"],
  ["pt", "pt", "portuguese", "portugues", "português", "portugees", "portugiesisch", "portugais"]
]);

const COUNTRY_ALIASES = aliasMap([
  ["NL", "nl", "netherlands", "the netherlands", "nederland", "holland", "pays bas", "niederlande", "paises bajos", "países bajos", "paises baixos", "países baixos"],
  ["BE", "be", "belgium", "belgie", "belgië", "belgique", "belgien", "belgica", "bélgica"],
  ["LU", "lu", "luxembourg", "luxemburg", "luxemburgo"],
  ["GB", "gb", "uk", "u k", "united kingdom", "great britain", "britain", "engeland", "royaume uni", "vereinigtes konigreich", "vereinigtes königreich", "reino unido"],
  ["IE", "ie", "ireland", "ierland", "irlande", "irland", "irlanda"],
  ["US", "us", "usa", "u s a", "united states", "united states of america", "verenigde staten", "etats unis", "états unis", "vereinigte staaten", "estados unidos", "eua"],
  ["CA", "ca", "canada", "canadá", "kanada"],
  ["AU", "au", "australia", "australie", "australië", "australien"],
  ["NZ", "nz", "new zealand", "nieuw zeeland", "nouvelle zelande", "nouvelle zélande", "neuseeland", "nueva zelanda", "nova zelandia", "nova zelândia", "aotearoa"],
  ["DE", "de", "germany", "duitsland", "deutschland", "allemagne", "alemania", "alemanha"],
  ["AT", "at", "austria", "oostenrijk", "osterreich", "österreich", "autriche", "áustria"],
  ["CH", "ch", "switzerland", "zwitserland", "schweiz", "suisse", "suiza", "suica", "suíça"],
  ["LI", "li", "liechtenstein"],
  ["FR", "fr", "france", "frankrijk", "frankreich", "francia", "frança"],
  ["MC", "mc", "monaco"],
  ["ES", "es", "spain", "spanje", "spanien", "espagne", "espana", "españa", "espanha"],
  ["PT", "pt", "portugal"],
  ["BR", "br", "brazil", "brazilie", "brazilië", "brasilien", "bresil", "brésil", "brasil"],
  ["MX", "mx", "mexico", "méxico"],
  ["AR", "ar", "argentina", "argentinie", "argentinië", "argentinien", "argentine", "argentinë"],
  ["CL", "cl", "chile", "chili"],
  ["CO", "co", "colombia", "colombie", "kolumbien", "colômbia"],
  ["PE", "pe", "peru", "perú", "pérou"],
  ["UY", "uy", "uruguay"],
  ["SR", "sr", "suriname"]
]);

const SUPPORTED_LANGUAGE_SET = new Set(SUPPORTED_COPY_LANGUAGES);
const SUPPORTED_COUNTRY_SET = new Set(SUPPORTED_COUNTRY_CODES);

export function canonicalLanguage(value) {
  const raw = firstValue(value);
  if (!raw) return undefined;
  const normalized = aliasKey(raw);
  const alias = LANGUAGE_ALIASES.get(normalized);
  if (alias) return alias;

  // Canonicalize the complete BCP-47 tag, including registered three-letter
  // aliases and extensions, then allow only an explicitly supported primary
  // language. This avoids the former `slice(0, 2)` bug where, for example,
  // "Esperanto" silently became Spanish.
  try {
    const [tag] = Intl.getCanonicalLocales(raw.trim().replaceAll("_", "-"));
    const primary = tag?.split("-")[0].toLowerCase();
    return SUPPORTED_LANGUAGE_SET.has(primary) ? primary : undefined;
  } catch {
    return undefined;
  }
}

export function isSupportedCopyLanguage(value) {
  return canonicalLanguage(value) !== undefined;
}

export function canonicalCountry(value) {
  const raw = firstValue(value);
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (/^[A-Z]{2}$/u.test(upper) && SUPPORTED_COUNTRY_SET.has(upper)) return upper;
  return COUNTRY_ALIASES.get(aliasKey(raw));
}

export function canonicalIanaTimezone(value) {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (!candidate || candidate.length > 80) return undefined;
  // Fixed offsets and process-local aliases are deliberately excluded. An
  // explicit tzdb identifier is required so daylight-saving behavior remains
  // recipient-local and reproducible across deployments.
  if (candidate !== "Etc/UTC" && !/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)+$/u.test(candidate)) {
    return undefined;
  }
  return IANAZone.isValidZone(candidate) ? candidate : undefined;
}

export function resolveRecipientTimezone({ contactTimezone, outletTimezone } = {}) {
  const contact = canonicalIanaTimezone(contactTimezone);
  if (contact) return contact;
  return canonicalIanaTimezone(outletTimezone);
}

function firstValue(value) {
  if (Array.isArray(value)) return value.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" && value.trim() ? value : undefined;
}

function aliasMap(definitions) {
  const result = new Map();
  for (const [canonical, ...aliases] of definitions) {
    for (const alias of aliases) result.set(aliasKey(alias), canonical);
  }
  return result;
}

function aliasKey(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}
