import { sha256 } from "../infrastructure/crypto-box.mjs";
import { canonicalLanguage } from "./recipient-locale.mjs";

const FORBIDDEN_CLAIMS = [
  /i(?:'|’)ve been (?:a )?(?:long[- ]time )?(?:fan|listener)/iu,
  /i listen to (?:you|your show) (?:every|all the)\s/iu,
  /millions? of (?:listeners|followers|streams)/iu,
  /guaranteed (?:hit|success|airplay)/iu
];

export function buildCopyFacts({ release, contact, outlet }) {
  return Object.freeze({
    release: Object.freeze({
      artist: release.artistName,
      title: release.name,
      genres: release.genres,
      subGenres: release.subGenres,
      description: release.description,
      epkUrl: release.epkUrl,
      privateStreamUrl: release.privateStreamUrl,
      releaseDate: release.releaseDate
    }),
    contact: Object.freeze({
      firstName: contact.firstName,
      lastName: contact.lastName,
      showName: contact.showName,
      role: contact.role,
      language: contact.preferredLanguage
    }),
    outlet: Object.freeze({
      name: outlet.name,
      type: outlet.type,
      genres: outlet.genres,
      evidence: Object.freeze([
        Object.freeze({ id: "contact-source", text: contact.contactEvidence, url: contact.contactSourceUrl }),
        ...(outlet.submissionUrl && outlet.submissionPolicy === "Explicit"
          ? [Object.freeze({ id: "submission-policy", text: outlet.submissionPolicy, url: outlet.submissionUrl })]
          : [])
      ])
    })
  });
}

export function safeTemplate({ facts, sequenceStep, unsubscribeUrl, selection }) {
  const language = templateLanguage(facts.contact.language);
  const messages = TEMPLATE_MESSAGES[language];
  const salutation = facts.contact.firstName || facts.outlet.name || "team";
  const listenUrl = facts.release.epkUrl || facts.release.privateStreamUrl;
  const genre = selection?.genre || facts.release.genres?.[0] || "independent music";
  const evidenceId = selection?.evidenceId ?? (facts.outlet.evidence.some((item) => item.id === "submission-policy") ? "submission-policy" : "contact-source");
  const context = Object.freeze({
    artist: facts.release.artist,
    title: facts.release.title,
    outlet: facts.outlet.name,
    genre,
    salutation,
    listenUrl,
    evidenceLine: evidenceId === "submission-policy"
      ? messages.submissionEvidence(facts.outlet.name, genre)
      : messages.contactEvidence(facts.contact.role)
  });
  const variant = messages.variants[sequenceStep];
  if (!variant) throw new RangeError("sequenceStep must be 0, 1, or 2");

  const body = `${variant(context)}\n\n${messages.unsubscribe}: ${unsubscribeUrl}`;
  return Object.freeze({
    subject: sequenceStep === 0
      ? messages.initialSubject(context)
      : messages.followUpSubject(context),
    bodyText: body,
    bodyHtml: undefined,
    evidenceUsed: [evidenceId],
    confidence: 1,
    source: "safe-template"
  });
}

export function validateGeneratedCopy({ copy, facts, unsubscribeUrl, maxWords = 120 }) {
  const errors = [];
  const allText = `${copy.subject ?? ""}\n${copy.bodyText ?? ""}`;
  const evidenceIds = new Set(facts.outlet.evidence.map((item) => item.id));
  const used = Array.isArray(copy.evidenceUsed) ? copy.evidenceUsed : [];

  if (!copy.subject || copy.subject.length > 160 || /[\r\n]/u.test(copy.subject)) errors.push("subject_invalid");
  if (!copy.bodyText) errors.push("body_missing");
  if (!allText.includes(facts.release.artist) || !allText.includes(facts.release.title)) errors.push("release_identity_missing");
  if (wordCount(copy.bodyText) > maxWords) errors.push("body_too_long");
  if (!copy.bodyText?.includes(unsubscribeUrl)) errors.push("unsubscribe_missing");
  if (FORBIDDEN_CLAIMS.some((pattern) => pattern.test(allText))) errors.push("unsupported_claim");
  if (used.length === 0) errors.push("evidence_required");
  if (used.some((id) => !evidenceIds.has(id))) errors.push("unknown_evidence_id");
  if (extractUrls(copy.bodyText).some((url) => !allowedUrl(url, facts, unsubscribeUrl))) errors.push("url_not_allowed");
  const proseWithoutUrls = String(copy.bodyText ?? "").replace(/https?:\/\/[^\s<>()]+/gu, "");
  if ((proseWithoutUrls.match(/\?/gu) ?? []).length !== 1) errors.push("call_to_action_count_invalid");

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    contentHash: sha256({ subject: copy.subject, bodyText: copy.bodyText, evidenceUsed: used })
  });
}

export function buildProviderPayload(facts, sequenceStep) {
  return Object.freeze({
    task: "Select only an allowed evidence id, exact supplied genre, and approved tone. Do not write prose. Return JSON only.",
    outputContract: Object.freeze({ evidenceId: "one facts.outlet.evidence[].id", genre: "one exact facts.release.genres[] value", tone: ["direct", "warm", "concise"], confidence: "0..1" }),
    sequenceStep,
    facts
  });
}

export function validateProviderSelection(selection, facts) {
  const evidenceIds = new Set(facts.outlet.evidence.map((item) => item.id));
  const genres = new Map((facts.release.genres ?? []).map((genre) => [String(genre).toLowerCase(), genre]));
  const evidenceId = evidenceIds.has(selection?.evidenceId) ? selection.evidenceId : undefined;
  const genre = genres.get(String(selection?.genre ?? "").toLowerCase());
  const tone = ["direct", "warm", "concise"].includes(selection?.tone) ? selection.tone : undefined;
  return Object.freeze({
    valid: Boolean(evidenceId && genre && tone),
    selection: evidenceId && genre && tone ? Object.freeze({ evidenceId, genre, tone }) : undefined
  });
}

function wordCount(value) {
  return String(value ?? "").trim().split(/\s+/u).filter(Boolean).length;
}

function extractUrls(value) {
  return String(value ?? "").match(/https?:\/\/[^\s<>()]+/gu) ?? [];
}

function allowedUrl(value, facts, unsubscribeUrl) {
  const allowed = [facts.release.epkUrl, facts.release.privateStreamUrl, unsubscribeUrl].filter(Boolean);
  return allowed.includes(value.replace(/[.,;]+$/u, ""));
}

function templateLanguage(value) {
  const language = canonicalLanguage(value);
  if (!language || !Object.hasOwn(TEMPLATE_MESSAGES, language)) {
    throw Object.assign(new Error("A supported explicit preferred language is required for automatic copy"), {
      code: "COPY_LANGUAGE_UNSUPPORTED",
      retryable: false
    });
  }
  return language;
}

const TEMPLATE_MESSAGES = Object.freeze({
  en: Object.freeze({
    unsubscribe: "Unsubscribe",
    initialSubject: ({ artist, title, outlet }) => `${artist} – ${title} for ${outlet}`,
    followUpSubject: ({ artist, title }) => `Follow-up: ${artist} – ${title}`,
    submissionEvidence: (outlet, genre) => `The published submission information for ${outlet} says that ${genre} music is accepted.`,
    contactEvidence: () => "The published contact information identifies this address for music or press enquiries.",
    variants: Object.freeze({
      0: ({ salutation, evidenceLine, artist, title, genre, listenUrl }) => `Hi ${salutation},\n\n${evidenceLine} ${artist} is releasing “${title}”, a ${genre} track that fits that described format.\n\nListen, metadata and download: ${listenUrl}\n\nWould this fit your programming?\n\nBest,\nMarc Rene\nMarcsMusic`,
      1: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Hi ${salutation},\n\nA short follow-up on “${title}” by ${artist}. ${evidenceLine}\n\nListen and download: ${listenUrl}\n\nWould it be useful for your programming?\n\nBest,\nMarc Rene\nMarcsMusic`,
      2: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Hi ${salutation},\n\nThis is my final follow-up about “${title}” by ${artist}. ${evidenceLine}\n\nListen and download: ${listenUrl}\n\nCould this still suit your programming?\n\nBest,\nMarc Rene\nMarcsMusic`
    })
  }),
  nl: Object.freeze({
    unsubscribe: "Afmelden",
    initialSubject: ({ artist, title, outlet }) => `${artist} – ${title} voor ${outlet}`,
    followUpSubject: ({ artist, title }) => `Opvolging: ${artist} – ${title}`,
    submissionEvidence: (outlet, genre) => `Volgens de gepubliceerde inzendinformatie van ${outlet} is ${genre}-muziek welkom.`,
    contactEvidence: () => "De gepubliceerde contactinformatie noemt dit adres voor muziek- of persvragen.",
    variants: Object.freeze({
      0: ({ salutation, evidenceLine, artist, title, genre, listenUrl }) => `Hallo ${salutation},\n\n${evidenceLine} ${artist} brengt “${title}” uit, een ${genre}-track die past bij dat beschreven format.\n\nLuisteren, metadata en download: ${listenUrl}\n\nPast dit binnen jullie programmering?\n\nGroet,\nMarc Rene\nMarcsMusic`,
      1: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Hallo ${salutation},\n\nEen korte opvolging over “${title}” van ${artist}. ${evidenceLine}\n\nLuisteren en downloaden: ${listenUrl}\n\nIs dit bruikbaar voor jullie programmering?\n\nGroet,\nMarc Rene\nMarcsMusic`,
      2: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Hallo ${salutation},\n\nDit is mijn laatste opvolging over “${title}” van ${artist}. ${evidenceLine}\n\nLuisteren en downloaden: ${listenUrl}\n\nPast dit mogelijk toch binnen jullie programmering?\n\nGroet,\nMarc Rene\nMarcsMusic`
    })
  }),
  de: Object.freeze({
    unsubscribe: "Abmelden",
    initialSubject: ({ artist, title, outlet }) => `${artist} – ${title} für ${outlet}`,
    followUpSubject: ({ artist, title }) => `Nachfrage: ${artist} – ${title}`,
    submissionEvidence: (outlet, genre) => `Laut den veröffentlichten Einsendehinweisen von ${outlet} wird ${genre}-Musik angenommen.`,
    contactEvidence: () => "Die veröffentlichten Kontaktdaten nennen diese Adresse für Musik- oder Presseanfragen.",
    variants: Object.freeze({
      0: ({ salutation, evidenceLine, artist, title, genre, listenUrl }) => `Guten Tag ${salutation},\n\n${evidenceLine} ${artist} veröffentlicht „${title}“, einen ${genre}-Track, der zu diesem beschriebenen Format passt.\n\nAnhören, Metadaten und Download: ${listenUrl}\n\nPasst der Titel in Ihr Programm?\n\nViele Grüße,\nMarc Rene\nMarcsMusic`,
      1: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Guten Tag ${salutation},\n\nEine kurze Nachfrage zu „${title}“ von ${artist}. ${evidenceLine}\n\nAnhören und Download: ${listenUrl}\n\nWäre der Titel für Ihr Programm interessant?\n\nViele Grüße,\nMarc Rene\nMarcsMusic`,
      2: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Guten Tag ${salutation},\n\nDies ist meine letzte Nachfrage zu „${title}“ von ${artist}. ${evidenceLine}\n\nAnhören und Download: ${listenUrl}\n\nKönnte der Titel noch zu Ihrem Programm passen?\n\nViele Grüße,\nMarc Rene\nMarcsMusic`
    })
  }),
  fr: Object.freeze({
    unsubscribe: "Se désabonner",
    initialSubject: ({ artist, title, outlet }) => `${artist} – ${title} pour ${outlet}`,
    followUpSubject: ({ artist, title }) => `Suivi : ${artist} – ${title}`,
    submissionEvidence: (outlet, genre) => `Les informations de soumission publiées par ${outlet} indiquent que les titres ${genre} sont acceptés.`,
    contactEvidence: () => "Les coordonnées publiées désignent cette adresse pour les demandes musicales ou presse.",
    variants: Object.freeze({
      0: ({ salutation, evidenceLine, artist, title, genre, listenUrl }) => `Bonjour ${salutation},\n\n${evidenceLine} ${artist} sort « ${title} », un titre ${genre} adapté à ce format décrit.\n\nÉcoute, métadonnées et téléchargement : ${listenUrl}\n\nCe titre conviendrait-il à votre programmation ?\n\nCordialement,\nMarc Rene\nMarcsMusic`,
      1: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Bonjour ${salutation},\n\nUn bref suivi concernant « ${title} » de ${artist}. ${evidenceLine}\n\nÉcoute et téléchargement : ${listenUrl}\n\nCe titre serait-il utile à votre programmation ?\n\nCordialement,\nMarc Rene\nMarcsMusic`,
      2: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Bonjour ${salutation},\n\nVoici mon dernier suivi concernant « ${title} » de ${artist}. ${evidenceLine}\n\nÉcoute et téléchargement : ${listenUrl}\n\nCe titre pourrait-il encore convenir à votre programmation ?\n\nCordialement,\nMarc Rene\nMarcsMusic`
    })
  }),
  es: Object.freeze({
    unsubscribe: "Cancelar suscripción",
    initialSubject: ({ artist, title, outlet }) => `${artist} – ${title} para ${outlet}`,
    followUpSubject: ({ artist, title }) => `Seguimiento: ${artist} – ${title}`,
    submissionEvidence: (outlet, genre) => `La información de envíos publicada por ${outlet} indica que acepta música ${genre}.`,
    contactEvidence: () => "La información de contacto publicada identifica esta dirección para consultas de música o prensa.",
    variants: Object.freeze({
      0: ({ salutation, evidenceLine, artist, title, genre, listenUrl }) => `Hola ${salutation},\n\n${evidenceLine} ${artist} publica «${title}», un tema ${genre} que encaja con ese formato descrito.\n\nEscucha, metadatos y descarga: ${listenUrl}\n\n¿Encajaría en vuestra programación?\n\nUn saludo,\nMarc Rene\nMarcsMusic`,
      1: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Hola ${salutation},\n\nUn breve seguimiento sobre «${title}» de ${artist}. ${evidenceLine}\n\nEscucha y descarga: ${listenUrl}\n\n¿Sería útil para vuestra programación?\n\nUn saludo,\nMarc Rene\nMarcsMusic`,
      2: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Hola ${salutation},\n\nEste es mi último seguimiento sobre «${title}» de ${artist}. ${evidenceLine}\n\nEscucha y descarga: ${listenUrl}\n\n¿Podría encajar todavía en vuestra programación?\n\nUn saludo,\nMarc Rene\nMarcsMusic`
    })
  }),
  pt: Object.freeze({
    unsubscribe: "Cancelar subscrição",
    initialSubject: ({ artist, title, outlet }) => `${artist} – ${title} para ${outlet}`,
    followUpSubject: ({ artist, title }) => `Seguimento: ${artist} – ${title}`,
    submissionEvidence: (outlet, genre) => `A informação de submissão publicada por ${outlet} indica que aceita música ${genre}.`,
    contactEvidence: () => "A informação de contacto publicada identifica este endereço para questões de música ou imprensa.",
    variants: Object.freeze({
      0: ({ salutation, evidenceLine, artist, title, genre, listenUrl }) => `Olá ${salutation},\n\n${evidenceLine} ${artist} lança «${title}», uma faixa ${genre} adequada a esse formato descrito.\n\nOuvir, metadados e download: ${listenUrl}\n\nEsta faixa enquadra-se na vossa programação?\n\nCumprimentos,\nMarc Rene\nMarcsMusic`,
      1: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Olá ${salutation},\n\nUm breve seguimento sobre «${title}» de ${artist}. ${evidenceLine}\n\nOuvir e descarregar: ${listenUrl}\n\nSeria útil para a vossa programação?\n\nCumprimentos,\nMarc Rene\nMarcsMusic`,
      2: ({ salutation, evidenceLine, artist, title, listenUrl }) => `Olá ${salutation},\n\nEste é o meu último seguimento sobre «${title}» de ${artist}. ${evidenceLine}\n\nOuvir e descarregar: ${listenUrl}\n\nAinda poderá enquadrar-se na vossa programação?\n\nCumprimentos,\nMarc Rene\nMarcsMusic`
    })
  })
});
