const EXPLICIT_OPT_OUT = Object.freeze([
  /^\s*(?:unsubscribe|opt\s*out|afmelden|uitschrijven|abmelden)\s*[.!]?\s*$/iu,
  /\b(?:please|kindly)\s+(?:unsubscribe|opt\s+(?:me|us)\s+out|remove\s+(?:me|us)\s+from\s+(?:your|the)\s+(?:email\s+)?list)\b/iu,
  /\b(?:unsubscribe|opt\s+out)(?:\s+(?:me|us))?\s+(?:please|now|immediately)\b/iu,
  /\b(?:please\s+)?(?:unsubscribe|remove)\s+(?:me|us|my|our)\b/iu,
  /\b(?:i|we)\s+(?:want|wish|would like)\s+to\s+(?:unsubscribe|opt\s*out)\b/iu,
  /\b(?:opt\s+(?:me|us)\s*out|stop\s+(?:emailing|mailing|contacting)\s+(?:me|us))\b/iu,
  /\bstop\s+(?:sending|emailing|mailing|contacting)(?:\s+(?:me|us))?\s+(?:emails?|messages?|mail)\b/iu,
  /\b(?:no\s+more|stop\s+all)\s+(?:emails?|messages?)\b/iu,
  /\b(?:take|remove)\s+(?:me|us|my\s+email|our\s+email)\s+(?:off|from)\s+(?:your|the)\s+(?:mailing\s+)?list\b/iu,
  /\b(?:i|we)\s+(?:do\s+not|don['’]?t)\s+want\s+(?:to\s+receive\s+)?(?:any\s+)?(?:more\s+)?(?:emails?|messages?)\b/iu,
  /\b(?:do not|don['’]?t)\s+(?:email|mail|contact)\s+(?:me|us)\s+again\b/iu,
  /\b(?:do not|don['’]?t)\s+(?:email|mail|contact)\s+again\b/iu,
  /\b(?:meld\s+(?:mij|me|ons)\s+af|schrijf\s+(?:mij|me|ons)\s+uit|verwijder\s+(?:mij|me|ons)\s+van\s+(?:de\s+)?(?:mailing)?lijst|stop\s+met\s+(?:mij\s+)?mailen|stuur\s+(?:mij|me|ons)\s+geen\s+e-?mails\s+meer|(?:ik|wij)\s+wil(?:len)?\s+geen\s+e-?mails\s+meer|geen\s+(?:verdere\s+)?e-?mails\s+meer)\b/iu,
  /\b(?:bitte\s+(?:mich\s+)?(?:abmelden|austragen)|nehmen\s+sie\s+mich\s+vom\s+verteiler|schicken\s+sie\s+mir\s+keine\s+e-?mails\s+mehr|bitte\s+keine\s+e-?mails\s+mehr|keine\s+(?:weiteren\s+)?e-?mails\s+mehr)\b/iu,
  /\b(?:merci\s+de\s+me\s+d[ée]sabonner|je\s+ne\s+veux\s+plus\s+recevoir\s+(?:d['’]?)?e-?mails|je\s+souhaite\s+me\s+d[ée]sabonner|d[ée]sabonnez[- ]moi|d[ée]sinscrivez[- ]moi|retirez[- ]moi\s+de\s+(?:votre|la)\s+liste|ne\s+m['’]?envoyez\s+plus\s+(?:d['’]?)?e-?mails)\b/iu,
  /\b(?:por\s+favor\s+)?(?:darme\s+de\s+baja|elim[ií]name\s+de\s+la\s+lista|no\s+quiero\s+recibir\s+m[aá]s\s+correos|no\s+m[aá]s\s+correos|no\s+me\s+env[ií]en\s+m[aá]s\s+correos)\b/iu,
  /\b(?:remova[- ]me\s+da\s+lista|retire[- ]me\s+da\s+lista|cancelar\s+(?:a\s+)?(?:minha\s+)?(?:inscri[cç][aã]o|subscri[cç][aã]o)|n[aã]o\s+quero\s+receber\s+mais\s+e-?mails|n[aã]o\s+me\s+enviem\s+mais\s+e-?mails)\b/iu
]);
const NEGATED_OPT_OUT = Object.freeze([
  /\b(?:do\s+not|don['’]?t|never|no\s+need\s+to|(?:i|we)\s+(?:do\s+not|don['’]?t)\s+want\s+to)\s+.{0,30}\b(?:unsubscribe|opt\s+out|remove\s+(?:me|us)|stop\s+(?:emailing|mailing|contacting))\b/iu,
  /\b(?:meld|schrijf|verwijder)\s+(?:mij|me|ons)\s+.{0,12}\bniet\s+(?:af|uit|van\s+(?:de\s+)?lijst)\b/iu,
  /\b(?:niet|geen\s+behoefte\s+om)\s+.{0,25}\b(?:afmelden|uitschrijven)\b/iu,
  /\b(?:nicht|niemals)\s+.{0,25}\b(?:abmelden|austragen)\b/iu,
  /\b(?:ne|pas)\s+.{0,35}\b(?:d[ée]sabonnez|d[ée]sinscrivez|retirez).{0,20}\bpas\b/iu,
  /\b(?:no\s+quiero\s+(?:darme\s+de\s+baja|que\s+me\s+eliminen)|no\s+me\s+den\s+de\s+baja)\b/iu,
  /\b(?:n[aã]o\s+quero\s+(?:cancelar|ser\s+removido)|n[aã]o\s+me\s+removam\s+da\s+lista)\b/iu
]);

const NOT_ACCEPTING = /\b(?:not accepting|no (?:music )?submissions|do not send (?:music|promos)|don['’]?t send (?:music|promos)|geen inzendingen|accepteren geen inzendingen)\b/iu;
const OUT_OF_OFFICE = /\b(?:out of (?:the )?office|away from (?:the )?office|on vacation|vacation responder|afwezig|buiten kantoor|op vakantie|urlaubsabwesenheit|abwesend|im urlaub|hors du bureau|absent(?:e)?|en cong[ée]|fuera de la oficina|ausente|de vacaciones|fora do escrit[óo]rio|de f[ée]rias)\b/iu;
const GENERIC_AWAY = /\b(?:away|afwezig|abwesend|absent(?:e)?|ausente)\b/iu;
const AUTO_REPLY = /\b(?:automatic(?:ally generated)? reply|auto[- ]?reply|automated response|autoresponder|automatisch antwoord|automatische antwort|r[ée]ponse automatique|respuesta autom[aá]tica|resposta autom[aá]tica)\b/iu;
const WRONG_PERSON = /\b(?:wrong person|not the right person|contact .{1,100} instead|verkeerde persoon|niet de juiste persoon)\b/iu;
const NOT_SUITABLE = /\b(?:not (?:a )?fit|not suitable|not interested|pass(?:ing)? on this|doesn['’]?t fit|isn['’]?t (?:a )?fit|niet passend|past niet|geen interesse)\b/iu;

const ASSET_REQUEST = Object.freeze([
  /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:send|share|provide|forward|upload)\b/iu,
  /\b(?:please|kindly)\s+(?:send|share|provide|forward|upload)\b/iu,
  /\b(?:send|share|provide|forward)\s+(?:me|us)\b/iu,
  /\b(?:where|how)\s+can\s+(?:i|we)\s+(?:get|download)\b/iu,
  /\b(?:i|we)(?:['’]?d|\s+would)\s+like\s+(?:the|a|an|to receive)\b/iu,
  /\b(?:kun|kan|zou)\s+je\s+(?:de|het|een)?\s*.{0,50}\b(?:sturen|delen|aanleveren)\b/iu,
  /\b(?:stuur|deel)\s+(?:mij|me|ons)\b/iu,
  /\b(?:könntest|kannst|würdest)\s+du\s+.{0,50}\b(?:senden|schicken)\b/iu,
  /\b(?:pourriez-vous|peux-tu)\s+.{0,50}\b(?:envoyer|partager)\b/iu,
  /\b(?:puedes|podrías)\s+.{0,50}\b(?:enviar|compartir)\b/iu,
  /\b(?:pode|poderia)\s+.{0,50}\b(?:enviar|compartilhar)\b/iu
]);
const CLEAN_ASSET = /\b(?:clean (?:version|edit)|radio edit|instrumental(?: version| edit)?)\b/iu;
const FILE_ASSET = /\b(?:mp3|wav|download(?: link)?|audio file|lossless file)\b/iu;
const NEGATED_ASSET = /\b(?:(?:do not|don['’]?t|no need to|not asking (?:you )?to|not requesting|no longer)\s+.{0,80}(?:send|share|provide|need)|(?:do not|don['’]?t|no longer)\s+need\s+.{0,50}(?:clean|instrumental|mp3|wav|file)|(?:no|without)\s+(?:clean(?:\s+version)?|instrumental|mp3|wav|files?))\b/iu;

const PLACEMENT = /\b(?:(?:(?:we|i|our\s+team)\s+)?(?:have\s+|has\s+|['’]ve\s+)?added\s+(?:it|this|the\s+track|the\s+song|the\s+release)\s+(?:to|into)\s+(?:our\s+)?(?:playlist|rotation|program(?:me)?)|(?:it|this|the\s+track|the\s+song)\s+(?:is|was|has\s+been)\s+(?:added|playlisted)(?:\s+(?:to|on)\s+(?:our\s+)?(?:playlist|rotation))?|(?:we|i)\s+(?:will|are\s+going\s+to)\s+(?:play|playlist|add)\s+(?:it|this|the\s+track|the\s+song)|(?:it|this|the\s+track|the\s+song)\s+is\s+on\s+(?:our\s+)?rotation|airplay\s+(?:is\s+)?(?:confirmed|scheduled))\b/iu;
const NEGATED_PLACEMENT = /\b(?:(?:not|never|haven['’]?t|hasn['’]?t|won['’]?t|will\s+not|aren['’]?t|isn['’]?t|no\s+longer)\s+.{0,40}(?:added|adding|playlist|play|airplay|rotation)|(?:no|without)\s+airplay|(?:removed|taking)\s+.{0,30}(?:playlist|rotation))\b/iu;
const FUTURE_RELEASES = /\b(?:future releases|keep me posted|send more|stuur toekomstige)\b/iu;
const NEGATED_FUTURE = /\b(?:(?:do not|don['’]?t|no need to)\s+.{0,40}(?:(?:send|share).{0,40}(?:future|more)|keep\s+(?:me|us)\s+posted)|no\s+future\s+releases)\b/iu;
const INTERESTED = /\b(?:interested|love this|sounds good|tell me more|great track)\b/iu;
const WILL_CONSIDER = /\b(?:will consider|will listen|take a listen|in consideration)\b/iu;
const NEGATED_CONSIDERATION = /\b(?:(?:not|won['’]?t|wouldn['’]?t|will not|can['’]?t|cannot|no\s+longer)\s+.{0,35}(?:interested|consider|listen)|interested.{0,30}(?:not\s+anymore|no\s+longer))\b/iu;
const COMPLEX_NEGATION = /\b(?:isn['’]?t|is not|don['’]?t|do not|can['’]?t|cannot)\s+.{0,40}\bnot\s+(?:suitable|interested|a fit)\b/iu;

const QUOTED_REPLY_BOUNDARIES = Object.freeze([
  /^\s*>/u,
  /^\s*-{2,}\s*(?:original message|forwarded message)\s*-{2,}\s*$/iu,
  /^\s*begin forwarded message\s*:?\s*$/iu,
  /^\s*on .{1,500} wrote:\s*$/iu,
  /^\s*op .{1,500} schreef .{0,200}:\s*$/iu,
  /^\s*(?:from|van|de|von):\s*.{1,500}$/iu
]);

const SIGNATURE_BOUNDARY = /^\s*(?:--+|__+|sent from my\b.*|verzonden vanaf mijn\b.*)\s*$/iu;
const AUTOMATED_FOOTER_LINE = /^(?:(?:unsubscribe|afmelden|uitschrijven|privacy(?:\s+policy)?)\s*:|(?:click|klik)\s+.{0,40}\b(?:unsubscribe|afmelden)\b)\s*:?\s*https?:\/\/\S+/iu;

/**
 * Return only the newly authored part of an inbound reply.
 *
 * Mailgun's `stripped-text` is authoritative when present. The conservative
 * fallback stops before standard quote and signature boundaries and removes
 * URL-based unsubscribe/privacy footers. Natural-language opt-out requests
 * remain intact so deny-wins processing cannot be bypassed.
 */
export function extractReplyText({ strippedText, plainText, maxLength = 20_000 } = {}) {
  const stripped = normalizeReplyText(strippedText, maxLength);
  const plain = normalizeReplyText(plainText, maxLength);
  const candidate = stripped || plain;
  if (!candidate) return "";
  const authored = [];
  for (const line of candidate.split("\n")) {
    if (QUOTED_REPLY_BOUNDARIES.some((pattern) => pattern.test(line))) break;
    if (SIGNATURE_BOUNDARY.test(line)) break;
    if (AUTOMATED_FOOTER_LINE.test(line.trim())) continue;
    authored.push(line);
  }
  return authored.join("\n").trim().slice(0, maxLength);
}

export function classifyReply({ subject = "", body = "" }) {
  const bodyText = String(body).slice(0, 20_000);
  const subjectText = String(subject).slice(0, 500);
  const subjectCommand = subjectText.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/iu, "").trim();
  if (hasExplicitOptOut(bodyText) || matchesAny(subjectCommand, [EXPLICIT_OPT_OUT[0]])) {
    return decision("Unsubscribe", { confidence: 1, automated: true });
  }
  const combined = `${subjectText}\n${bodyText}`;
  if (OUT_OF_OFFICE.test(combined) || (AUTO_REPLY.test(combined) && GENERIC_AWAY.test(combined))) {
    return decision("Out Of Office", { automated: true });
  }
  if (AUTO_REPLY.test(combined)) return decision("Auto Reply", { automated: true });
  if (NOT_ACCEPTING.test(bodyText)) return decision("Not Accepting Music");
  if (WRONG_PERSON.test(bodyText)) return decision("Wrong Person");
  if (COMPLEX_NEGATION.test(bodyText)) return decision("Ambiguous", { confidence: 0 });

  const classifications = new Set();
  if (NOT_SUITABLE.test(bodyText)) classifications.add("Not Suitable");

  const assetNegated = NEGATED_ASSET.test(bodyText);
  const requestedAssets = explicitAssetRequest(bodyText);
  if (requestedAssets === "clean") classifications.add("Send Clean Version");
  else if (requestedAssets === "file") classifications.add("Send MP3/WAV");
  else if (requestedAssets === "complex") classifications.add("Ambiguous");

  const placementNegated = NEGATED_PLACEMENT.test(bodyText);
  const futureNegated = NEGATED_FUTURE.test(bodyText);
  const interestNegated = NEGATED_CONSIDERATION.test(bodyText);
  if (PLACEMENT.test(bodyText) && !placementNegated) classifications.add("Placement Confirmed");
  if (FUTURE_RELEASES.test(bodyText) && !futureNegated) classifications.add("Future Releases");
  if (INTERESTED.test(bodyText) && !NOT_SUITABLE.test(bodyText) && !interestNegated) classifications.add("Interested");
  if (WILL_CONSIDER.test(bodyText) && !interestNegated) classifications.add("Will Consider");
  const hasPositiveSignal = [...classifications].some((value) => value !== "Not Suitable");
  if ((assetNegated || placementNegated || futureNegated || interestNegated) && hasPositiveSignal) classifications.add("Ambiguous");

  const compatible = resolveCompatiblePositiveSignals(classifications);
  if (compatible) return decision(compatible);
  if (classifications.size !== 1 || classifications.has("Ambiguous")) return decision("Ambiguous", { confidence: 0 });
  return decision([...classifications][0]);
}

function hasExplicitOptOut(text) {
  if (!matchesAny(text, NEGATED_OPT_OUT) && EXPLICIT_OPT_OUT[0].test(text)) return true;
  return text
    .split(/(?:\n+|(?<=[.!?])\s+)/u)
    .some((sentence) => !matchesAny(sentence, NEGATED_OPT_OUT) && matchesAny(sentence, EXPLICIT_OPT_OUT.slice(1)));
}

function resolveCompatiblePositiveSignals(classifications) {
  if (classifications.has("Not Suitable") || classifications.has("Ambiguous")) return undefined;
  const positive = new Set([
    "Send Clean Version",
    "Send MP3/WAV",
    "Placement Confirmed",
    "Future Releases",
    "Interested",
    "Will Consider"
  ]);
  if (classifications.size < 2 || [...classifications].some((value) => !positive.has(value))) return undefined;
  if (classifications.has("Send Clean Version")) return "Send Clean Version";
  if (classifications.has("Send MP3/WAV")) return "Send MP3/WAV";
  if (classifications.has("Placement Confirmed")) return "Placement Confirmed";
  if (classifications.has("Future Releases")) return "Future Releases";
  if (classifications.has("Interested")) return "Interested";
  return "Will Consider";
}

function explicitAssetRequest(text) {
  let clean = false;
  let file = false;
  for (const sentence of text.split(/(?:\n+|(?<=[.!?])\s+)/u)) {
    if (!ASSET_REQUEST.some((pattern) => pattern.test(sentence)) || NEGATED_ASSET.test(sentence)) continue;
    clean ||= CLEAN_ASSET.test(sentence);
    file ||= FILE_ASSET.test(sentence);
  }
  // A requested clean/radio edit in a WAV/MP3 format is one specific clean
  // asset request, not two independent intents.
  if (clean) return "clean";
  if (file) return "file";
  return undefined;
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function decision(classification, { confidence, automated = false } = {}) {
  return Object.freeze({ classification, confidence, automated });
}

function normalizeReplyText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/\u0000/gu, "")
    .trim()
    .slice(0, maxLength);
}

export function replyAction(classification, release = {}) {
  const primaryLink = release.epkUrl || release.privateStreamUrl || release.downloadUrl;
  const actions = {
    Interested: { matchStatus: "Interested", stopSequence: true, response: primaryLink ? `Thanks for your interest. Release information and assets: ${primaryLink}` : "Thanks for your interest. I have recorded your response and will follow up separately." },
    "Send MP3/WAV": { matchStatus: "Interested", stopSequence: true, response: release.downloadUrl ? `Thanks for your message. Download: ${release.downloadUrl}` : undefined },
    "Send Clean Version": { matchStatus: "Interested", stopSequence: true, response: release.radioEditUrl ? `Thanks for your message. Radio edit: ${release.radioEditUrl}` : undefined },
    "Placement Confirmed": { matchStatus: "Placement Confirmed", stopSequence: true },
    "Will Consider": { matchStatus: "Warm", stopSequence: true },
    "Not Suitable": { matchStatus: "Rejected", stopSequence: true },
    "Not Accepting Music": {
      matchStatus: "Needs Attention",
      stopSequence: true,
      reviewType: "outlet_suppression_proposal",
      proposedAction: "review_outlet_and_domain_suppression"
    },
    "Wrong Person": { matchStatus: "Stopped", stopSequence: true },
    Unsubscribe: { matchStatus: "Unsubscribed", stopSequence: true, suppressContact: true },
    "Out Of Office": { matchStatus: "Paused", stopSequence: true },
    "Auto Reply": { matchStatus: "Paused", stopSequence: true },
    "Future Releases": { matchStatus: "Future Releases", stopSequence: true },
    Ambiguous: {
      matchStatus: "Needs Attention",
      stopSequence: true,
      reviewType: "ambiguous_reply",
      proposedAction: "review_reply_and_choose_response"
    }
  };
  return Object.freeze(actions[classification] ?? actions.Ambiguous);
}
