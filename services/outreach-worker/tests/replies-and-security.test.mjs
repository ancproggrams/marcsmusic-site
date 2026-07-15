import { createHmac } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import { classifyReply, extractReplyText, replyAction } from "../src/domain/reply-classifier.mjs";
import { verifyEspoWebhook, verifyMailgunWebhook } from "../src/domain/signatures.mjs";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "../src/domain/unsubscribe-token.mjs";
import { CryptoBox, sha256 } from "../src/infrastructure/crypto-box.mjs";

test("reply classification uses deterministic, safety-first rules", () => {
  const cases = [
    ["Please unsubscribe me, even though I love this", "Unsubscribe"],
    ["We are not accepting music submissions", "Not Accepting Music"],
    ["Automatic reply: I am out of the office", "Out Of Office"],
    ["Automatic reply: your message was received", "Auto Reply"],
    ["I am the wrong person, contact Alex instead", "Wrong Person"],
    ["Could you send a clean radio edit?", "Send Clean Version"],
    ["Please send the WAV download", "Send MP3/WAV"],
    ["The track was added to rotation", "Placement Confirmed"],
    ["This is not a fit for us", "Not Suitable"],
    ["Keep me posted about future releases", "Future Releases"],
    ["Great track, I am interested", "Interested"],
    ["We will take a listen", "Will Consider"],
    ["Thanks for writing", "Ambiguous"]
  ];

  for (const [body, expected] of cases) {
    const result = classifyReply({ body });
    assert.equal(result.classification, expected, body);
    assert.equal(result.automated, ["Unsubscribe", "Out Of Office", "Auto Reply"].includes(expected));
    assert.equal(result.confidence, expected === "Unsubscribe" ? 1 : expected === "Ambiguous" ? 0 : undefined);
  }
});

test("asset responses require an explicit non-negated request intent", () => {
  const cases = [
    ["clean", "Ambiguous"],
    ["instrumental", "Ambiguous"],
    ["WAV", "Ambiguous"],
    ["The clean version is not suitable for our station.", "Not Suitable"],
    ["We do not need you to send a clean version.", "Ambiguous"],
    ["Could you send a clean radio edit as a WAV?", "Send Clean Version"],
    ["Where can I download the WAV?", "Send MP3/WAV"],
    ["Great track. Please send us the MP3 file.", "Send MP3/WAV"],
    ["Please send the WAV, but this is not suitable for us.", "Ambiguous"],
    ["Great track, but please do not send any files.", "Ambiguous"],
    ["Please send the WAV and unsubscribe me from all future email.", "Unsubscribe"],
    ["Automatic reply: I am out of the office. Please send files to Alex.", "Out Of Office"],
    ["Automatic reply: out of office. We are not accepting submissions this week.", "Out Of Office"],
    ["We have not added the track to rotation.", "Ambiguous"],
    ["It isn't not suitable, if you know what I mean.", "Ambiguous"],
    ["I am not interested.", "Not Suitable"]
  ];
  for (const [body, expected] of cases) {
    const result = classifyReply({ body });
    assert.equal(result.classification, expected, body);
    if (expected === "Ambiguous") assert.equal(replyAction(result.classification).response, undefined);
  }

  assert.equal(
    classifyReply({ subject: "Re: Please unsubscribe me", body: "Thanks for the note." }).classification,
    "Ambiguous",
    "quoted subject wording is not newly-authored opt-out evidence"
  );
  assert.equal(classifyReply({ subject: "Unsubscribe", body: "" }).classification, "Unsubscribe");
  assert.equal(
    classifyReply({ body: "Thanks for writing.\nUnsubscribe" }).classification,
    "Ambiguous",
    "an un-attributed signature/footer label is not an explicit opt-out"
  );
});

test("multilingual explicit opt-outs deny-win over every positive or asset signal", () => {
  for (const body of [
    "Meld mij af, hoewel ik dit een geweldige track vind.",
    "Bitte abmelden. Der Track gefällt mir.",
    "Désabonnez-moi, mais envoyez le WAV.",
    "Por favor, darme de baja. Puedes enviar el MP3.",
    "Não me enviem mais e-mails; a faixa é ótima."
  ]) {
    assert.deepEqual(classifyReply({ body }), {
      classification: "Unsubscribe",
      confidence: 1,
      automated: true
    }, body);
  }
});

test("common opt-outs are body-evidenced while negated opt-outs never suppress", () => {
  for (const body of [
    "Take me off your mailing list.",
    "I don't want to receive any more emails.",
    "Verwijder mij van de mailinglijst.",
    "Nehmen Sie mich vom Verteiler.",
    "Désinscrivez-moi de votre liste.",
    "No quiero recibir más correos.",
    "Cancelar a minha subscrição."
  ]) {
    assert.equal(classifyReply({ body }).classification, "Unsubscribe", body);
  }

  for (const body of [
    "I don't want to unsubscribe.",
    "Do not remove me from your list.",
    "Meld mij niet af.",
    "Bitte nicht abmelden.",
    "Ne me désabonnez pas.",
    "No quiero darme de baja.",
    "Não quero cancelar a minha subscrição."
  ]) {
    const result = classifyReply({ body });
    assert.equal(result.classification, "Ambiguous", body);
    assert.equal(result.automated, false, body);
  }

  assert.equal(
    classifyReply({ body: "Don't unsubscribe me. Actually, please unsubscribe me." }).classification,
    "Unsubscribe",
    "a later standalone affirmative request must still deny-win"
  );
});

test("semantic intent is body-only except exact subject commands and out-of-office subjects", () => {
  assert.equal(
    classifyReply({ subject: "Re: The track was added to rotation", body: "Thanks for writing." }).classification,
    "Ambiguous"
  );
  assert.equal(classifyReply({ subject: "Not suitable", body: "Love this track." }).classification, "Interested");
  assert.equal(classifyReply({ subject: "Automatic Reply: away", body: "Thanks." }).classification, "Out Of Office");
  assert.equal(classifyReply({ subject: "Automatic Reply", body: "Your message was received." }).classification, "Auto Reply");
  assert.equal(classifyReply({ subject: "Unsubscribe", body: "" }).classification, "Unsubscribe");
});

test("placement and positive signals require affirmative non-negated body evidence", () => {
  const cases = [
    ["The track was added to rotation.", "Placement Confirmed"],
    ["Airplay is scheduled.", "Placement Confirmed"],
    ["I added a note to our CRM.", "Ambiguous"],
    ["We won't be adding this to rotation.", "Ambiguous"],
    ["The track is no longer on rotation.", "Ambiguous"],
    ["We removed it from rotation.", "Ambiguous"],
    ["I was interested but not anymore.", "Ambiguous"],
    ["Do not keep me posted about future releases.", "Ambiguous"],
    ["Please send the WAV. Actually, no WAV.", "Ambiguous"],
    ["Great track, but no files.", "Ambiguous"]
  ];
  for (const [body, expected] of cases) {
    assert.equal(classifyReply({ body }).classification, expected, body);
  }
});

test("reply extraction ignores quoted unsubscribe footers but preserves an explicit new opt-out", () => {
  const quotedOriginal = [
    "Sounds good, I will take a listen.",
    "",
    "On Tue, 14 Jul 2026, Marc Rene wrote:",
    "> Hi, here is the release.",
    "> Unsubscribe: https://outreach.example.test/unsubscribe?token=secret"
  ].join("\n");
  const authored = extractReplyText({ plainText: quotedOriginal });
  assert.equal(authored, "Sounds good, I will take a listen.");
  assert.equal(classifyReply({ body: authored }).classification, "Interested");

  const preferred = extractReplyText({
    strippedText: "Love this track.\nUnsubscribe: https://outreach.example.test/unsubscribe?token=quoted",
    plainText: `Love this track.\n\n${quotedOriginal}`
  });
  assert.equal(preferred, "Love this track.");
  assert.equal(classifyReply({ body: preferred }).classification, "Interested");

  const explicit = extractReplyText({
    plainText: `Please unsubscribe me.\n\n${quotedOriginal}`
  });
  assert.equal(classifyReply({ body: explicit }).classification, "Unsubscribe");

  const signatureAndOutlookQuote = extractReplyText({
    plainText: [
      "Could you send the WAV file?",
      "",
      "--",
      "Sam Editor",
      "Unsubscribe",
      "From: Marc Rene <music@example.test>",
      "Please send a clean version"
    ].join("\n")
  });
  assert.equal(signatureAndOutlookQuote, "Could you send the WAV file?");
  assert.equal(classifyReply({ body: signatureAndOutlookQuote }).classification, "Send MP3/WAV");

  const footerOnly = extractReplyText({
    plainText: "Thanks for writing.\nClick here to unsubscribe https://mailer.example.test/u/abc"
  });
  assert.equal(footerOnly, "Thanks for writing.");
  assert.equal(classifyReply({ body: footerOnly }).classification, "Ambiguous");
});

test("reply actions stop active sequences and only include known release URLs", () => {
  const download = replyAction("Send MP3/WAV", { downloadUrl: "https://artist.example.test/download" });
  const missingClean = replyAction("Send Clean Version", {});
  const unsubscribe = replyAction("Unsubscribe");
  const ambiguous = replyAction("not-a-classification");
  const outletProposal = replyAction("Not Accepting Music");

  assert.equal(download.stopSequence, true);
  assert.match(download.response, /https:\/\/artist\.example\.test\/download/u);
  assert.equal(missingClean.response, undefined);
  assert.equal(unsubscribe.suppressContact, true);
  assert.equal(unsubscribe.matchStatus, "Unsubscribed");
  assert.equal(ambiguous.matchStatus, "Needs Attention");
  assert.equal(ambiguous.stopSequence, true);
  assert.equal(ambiguous.response, undefined);
  assert.equal(ambiguous.reviewType, "ambiguous_reply");
  assert.equal(outletProposal.suppressOutlet, undefined);
  assert.equal(outletProposal.reviewType, "outlet_suppression_proposal");
  assert.equal(outletProposal.matchStatus, "Needs Attention");
});

test("AES-256-GCM round-trips JSON and binds ciphertext to associated data", () => {
  const box = new CryptoBox({ encryptionKey: Buffer.alloc(32, 7), keyVersion: "v1", hashKey: "hash-key-for-test-only-32-characters" });
  const value = { email: "person@example.test", nested: { purpose: "submission" } };
  const encrypted = box.encryptJson(value, "event:event-1");

  assert.deepEqual(box.decryptJson(encrypted, "event:event-1"), value);
  assert.equal(encrypted.ciphertext.includes(Buffer.from(value.email)), false);
  assert.throws(() => box.decryptJson(encrypted, "event:event-2"));
  assert.throws(() => box.decryptJson({ ...encrypted, keyVersion: "v2" }), (error) => error.code === "ENCRYPTION_KEY_VERSION_UNSUPPORTED");
});

test("tampering with AES-GCM ciphertext is detected", () => {
  const box = new CryptoBox({ encryptionKey: Buffer.alloc(32, 9), keyVersion: "v1", hashKey: "another-hash-key-for-test-only-32" });
  const encrypted = box.encryptJson({ event: "delivered" }, "event:event-2");
  const tampered = Buffer.from(encrypted.ciphertext);
  tampered[0] ^= 1;

  assert.throws(() => box.decryptJson({ ...encrypted, ciphertext: tampered }, "event:event-2"));
});

test("privacy hashes normalize case and whitespace but never expose the source", () => {
  const box = new CryptoBox({ encryptionKey: Buffer.alloc(32, 1), keyVersion: "v1", hashKey: "privacy-hash-key-for-test-only-32" });

  const first = box.privacyHash(" Person@Example.Test ");
  const second = box.privacyHash("person@example.test");

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.ok(!first.includes("person"));
  assert.equal(sha256("stable"), sha256("stable"));
  assert.notEqual(sha256("stable"), sha256("changed"));
});

test("EspoCRM webhook verification accepts the documented HMAC envelope", () => {
  const rawBody = Buffer.from('[{"id":"record-1"}]', "utf8");
  const webhookId = "webhook-1";
  const secret = "espo-webhook-secret-at-least-16";
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const signature = Buffer.from(`${webhookId}:${digest}`, "utf8").toString("base64");

  const result = verifyEspoWebhook({ rawBody, signature, secrets: { [webhookId]: secret } });

  assert.deepEqual(result, { valid: true, webhookId, reason: undefined });
  assert.equal(verifyEspoWebhook({ rawBody, signature: undefined, secrets: {} }).reason, "signature_missing");
  assert.equal(verifyEspoWebhook({ rawBody, signature: Buffer.from(`unknown:${digest}`).toString("base64"), secrets: {} }).reason, "webhook_unknown");
  assert.equal(verifyEspoWebhook({ rawBody, signature: Buffer.from(`constructor:${digest}`).toString("base64"), secrets: {} }).reason, "webhook_unknown");
  assert.equal(verifyEspoWebhook({ rawBody, signature: `${signature}!`, secrets: { [webhookId]: secret } }).reason, "signature_invalid_encoding");
  assert.equal(verifyEspoWebhook({ rawBody: Buffer.from("changed"), signature, secrets: { [webhookId]: secret } }).reason, "signature_mismatch");
});

test("Mailgun signatures require a fresh timestamp and exact HMAC", () => {
  const now = Date.parse("2026-07-15T12:00:00.000Z");
  const timestamp = String(Math.floor(now / 1000));
  const token = "mailgun-event-token";
  const signingKey = "mailgun-signing-key-for-tests";
  const signature = createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");

  assert.equal(verifyMailgunWebhook({ timestamp, token, signature, signingKey, now }).valid, true);
  assert.equal(verifyMailgunWebhook({ timestamp, token, signature: "wrong", signingKey, now }).reason, "signature_mismatch");
  assert.equal(verifyMailgunWebhook({ timestamp: String(Number(timestamp) - 901), token, signature, signingKey, now }).reason, "timestamp_outside_tolerance");
  assert.equal(verifyMailgunWebhook({ timestamp, token: "", signature: "", signingKey, now }).reason, "signature_fields_missing");
});

test("unsubscribe v2 tokens bind a bounded kid and verify active or historical keys", () => {
  const signingKey = "unsubscribe-signing-key-for-tests-32-chars";
  const historicalKey = "historical-unsubscribe-key-for-tests-32-chars";
  const activeRing = unsubscribeRing("unsub-2026-07", signingKey);
  const now = Date.parse("2026-07-15T12:00:00.000Z");
  const token = createUnsubscribeToken({
    contactId: "contact-1",
    matchId: "match-1",
    keyring: activeRing,
    issuedAt: new Date(now),
    expiresAt: new Date(now + 60_000)
  });

  assert.deepEqual(verifyUnsubscribeToken(token, activeRing, now), {
    valid: true,
    data: {
      v: 2,
      kid: "unsub-2026-07",
      contactId: "contact-1",
      matchId: "match-1",
      iat: Math.floor(now / 1_000),
      exp: Math.floor((now + 60_000) / 1_000)
    },
    version: 2,
    kid: "unsub-2026-07"
  });
  assert.equal(verifyUnsubscribeToken(token, activeRing, now + 61_000).reason, "token_expired_or_incomplete");
  const [version, kid, payload] = token.split(".");
  assert.equal(verifyUnsubscribeToken(`${version}.${kid}.${payload}.${"A".repeat(43)}`, activeRing, now).reason, "token_signature_invalid");
  assert.equal(verifyUnsubscribeToken(token.replace(kid, "unsub-unknown"), activeRing, now).reason, "token_key_id_unknown");
  assert.equal(verifyUnsubscribeToken("missing-separator", activeRing, now).reason, "token_invalid_shape");

  const historicalToken = createUnsubscribeToken({
    contactId: "contact-1",
    matchId: "match-1",
    keyring: unsubscribeRing("unsub-2026-06", historicalKey),
    issuedAt: new Date(now),
    expiresAt: new Date(now + 60_000)
  });
  const rotatedRing = unsubscribeRing("unsub-2026-07", signingKey, [{ kid: "unsub-2026-06", key: historicalKey }]);
  assert.equal(verifyUnsubscribeToken(historicalToken, rotatedRing, now).kid, "unsub-2026-06");
});

test("unsubscribe legacy v1 is off by default and only an explicit temporary key enables verification", () => {
  const signingKey = "unsubscribe-signing-key-for-tests-32-chars";
  const legacyKey = "legacy-unsubscribe-key-for-tests-32-chars";
  const now = Date.parse("2026-07-15T12:00:00.000Z");
  const legacyPayload = Buffer.from(JSON.stringify({
    contactId: "contact-1",
    matchId: "match-1",
    exp: Math.floor((now + 60_000) / 1_000)
  })).toString("base64url");
  const legacySignature = createHmac("sha256", legacyKey).update(legacyPayload).digest("base64url");
  const legacyToken = `${legacyPayload}.${legacySignature}`;
  assert.equal(verifyUnsubscribeToken(legacyToken, unsubscribeRing("unsub-2026-07", signingKey), now).reason, "token_version_unsupported");
  assert.equal(verifyUnsubscribeToken(legacyToken, {
    ...unsubscribeRing("unsub-2026-07", signingKey),
    legacyV1VerifyKey: legacyKey,
    legacyV1VerifyUntil: "2026-07-16T12:00:00.000Z"
  }, now).version, 1);
  assert.equal(verifyUnsubscribeToken(legacyToken, {
    ...unsubscribeRing("unsub-2026-07", signingKey),
    legacyV1VerifyKey: legacyKey,
    legacyV1VerifyUntil: "2026-07-15T11:59:59.000Z"
  }, now).reason, "token_version_unsupported");
});

test("unsubscribe tokens reject malformed payloads and lifetimes beyond two UTC years", () => {
  const signingKey = "unsubscribe-signing-key-for-tests-32-chars";
  const ring = unsubscribeRing("unsub-2026-07", signingKey);
  const kid = ring.active.kid;
  const payload = Buffer.from("not-json", "utf8").toString("base64url");
  const signature = createHmac("sha256", signingKey).update(`v2.${kid}.${payload}`).digest("base64url");

  assert.equal(verifyUnsubscribeToken(`v2.${kid}.${payload}.${signature}`, ring).reason, "token_payload_invalid");
  const issuedAt = new Date("2026-07-15T12:00:00.000Z");
  assert.throws(() => createUnsubscribeToken({
    contactId: "contact-1",
    matchId: "match-1",
    keyring: ring,
    issuedAt,
    expiresAt: new Date("2028-07-15T12:00:01.000Z")
  }), /within two years/u);
});

function unsubscribeRing(kid, key, verifyOnly = []) {
  return Object.freeze({
    schemaVersion: 2,
    active: Object.freeze({ kid, key }),
    verifyOnly: Object.freeze(verifyOnly.map((entry) => Object.freeze({ ...entry })))
  });
}
