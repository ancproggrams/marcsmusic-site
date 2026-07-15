const SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
});

export function sendUnsubscribeConfirmation(reply, token) {
  setSecurityHeaders(reply);
  return reply.type("text/html; charset=utf-8").send(documentTemplate(`
    <h1>Uitschrijven bevestigen</h1>
    <p>Bevestig dat je geen outreach-e-mails van Marc's Music meer wilt ontvangen.</p>
    <form method="post" action="/unsubscribe">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <button type="submit">Uitschrijven</button>
    </form>`));
}

export function sendUnsubscribeSuccess(reply) {
  setSecurityHeaders(reply);
  return reply.type("text/html; charset=utf-8").send(documentTemplate(`
    <h1>Je bent uitgeschreven</h1>
    <p>De blokkering is direct actief. Er worden geen verdere outreach-e-mails verstuurd.</p>`));
}

export function sendUnsubscribeInvalid(reply) {
  setSecurityHeaders(reply);
  return reply.code(400).type("text/html; charset=utf-8").send(documentTemplate(`
    <h1>Deze link is niet geldig</h1>
    <p>De link is ongeldig of verlopen.</p>`));
}

function setSecurityHeaders(reply) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) reply.header(name, value);
}

function documentTemplate(content) {
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Marc's Music — uitschrijven</title>
  <style>body{font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:12vh auto;padding:0 1.25rem;color:#181818}button{font:inherit;padding:.7rem 1rem;cursor:pointer}</style>
</head>
<body>${content}</body>
</html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
