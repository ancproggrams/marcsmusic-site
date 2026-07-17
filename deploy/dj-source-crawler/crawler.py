#!/usr/bin/env python3
"""Bounded live discovery for the configured public DJ/media sources.

The crawler only reads public HTTPS pages, honors robots.txt and per-host
delays, and never sends business mail.  It emits a signed ``dj-finder`` source
artifact containing only contacts whose public page labels the address as a
music-submission, promotional, or press route.  Everything else is counted as
held and is deliberately unavailable to outreach.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import ipaddress
import json
import os
import re
import socket
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


SOURCE_ID = "dj-finder"
EMAIL_RE = re.compile(r"\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b", re.I)
GENERIC_LOCAL_PARTS = {"admin", "contact", "hello", "info", "mail", "office", "support", "team", "webmaster"}
MAX_REDIRECTS = 3
MAX_REPORT_BYTES = 4 * 1024 * 1024
MAX_OUTBOX_BYTES = 16 * 1024 * 1024
ALLOWED_CONTENT_TYPES = ("text/html", "application/xhtml+xml", "application/xml", "text/xml", "application/json")

SUBMISSION_RE = re.compile(
    r"\b(?:music|track|tracks|song|songs|demo|demos|release|releases)\b.{0,100}\b(?:submission|submissions|submit|send|email|contact|inquir(?:y|ies))\b"
    r"|\b(?:submission|submissions|submit|send|email|contact)\b.{0,100}\b(?:music|track|tracks|song|songs|demo|demos|release|releases)\b",
    re.I,
)
PROMO_RE = re.compile(
    r"\b(?:promo|promos|promotional)\b.{0,80}\b(?:contact|email|submission|submissions|inquir(?:y|ies)|send)\b"
    r"|\b(?:contact|email|send)\b.{0,80}\b(?:promo|promos|promotional)\b",
    re.I,
)
PRESS_RE = re.compile(
    r"\b(?:press|media|publicity)\b.{0,80}\b(?:contact|email|inquir(?:y|ies)|submission|submissions)\b"
    r"|\b(?:contact|email)\b.{0,80}\b(?:press|media|publicity)\b",
    re.I,
)
NO_SUBMISSIONS_RE = re.compile(
    r"\b(?:no|not|never|don't|do not|does not)\b.{0,80}\b(?:accept|send|submit|email)\b.{0,80}\b(?:music|tracks?|songs?|demos?|promos?|submissions?)\b"
    r"|\b(?:submissions?|unsolicited music|demos?|promos?)\b.{0,50}\b(?:closed|disabled|not accepted|unwelcome)\b",
    re.I,
)
TRACKING_KEYS = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "msclkid"}


@dataclass(frozen=True)
class Source:
    name: str
    type: str
    website: str
    source_url: str


@dataclass(frozen=True)
class FetchResult:
    requested_url: str
    final_url: str | None
    status: int | None
    body: str
    content_type: str
    reason: str | None = None


@dataclass(frozen=True)
class Config:
    enabled: bool
    registry_path: Path
    data_dir: Path
    request_timeout_seconds: float
    max_bytes: int
    max_pages_per_source: int
    max_link_fetches_per_source: int
    delay_seconds: float
    max_attempts: int
    max_sources: int
    user_agent: str
    publish_enabled: bool
    ingestion_base_url: str | None
    signing_key_id: str | None
    signing_key: str | None


def load_config(env: dict[str, str] | os._Environ[str] = os.environ) -> Config:
    def integer(name: str, fallback: int, lower: int, upper: int) -> int:
        value = int(env.get(name, str(fallback)))
        if not lower <= value <= upper:
            raise ValueError(f"{name} is outside its safe bound")
        return value

    def number(name: str, fallback: float, lower: float, upper: float) -> float:
        value = float(env.get(name, str(fallback)))
        if not lower <= value <= upper:
            raise ValueError(f"{name} is outside its safe bound")
        return value

    enabled = env.get("SOURCE_CRAWL_ENABLED", "false").lower() == "true"
    publish_enabled = env.get("OUTREACH_SOURCE_PUBLISH_ENABLED", "false").lower() == "true"
    base_url = env.get("OUTREACH_SOURCE_INGESTION_BASE_URL", "").strip().rstrip("/") or None
    key_id = env.get("OUTREACH_SOURCE_SIGNING_KEY_ID", "").strip() or None
    key = env.get("OUTREACH_SOURCE_SIGNING_KEY", "").strip() or None
    if publish_enabled:
        if not base_url or urllib.parse.urlparse(base_url).scheme != "https":
            raise ValueError("OUTREACH_SOURCE_INGESTION_BASE_URL must be HTTPS when publishing is enabled")
        if not key_id or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,31}", key_id):
            raise ValueError("OUTREACH_SOURCE_SIGNING_KEY_ID is invalid")
        if not key or not 32 <= len(key) <= 512:
            raise ValueError("OUTREACH_SOURCE_SIGNING_KEY must be 32-512 characters")
    return Config(
        enabled=enabled,
        registry_path=Path(env.get("SOURCE_CRAWL_REGISTRY", "data/dj-source-registry.json")),
        data_dir=Path(env.get("SOURCE_CRAWL_DATA_DIR", "/data")),
        request_timeout_seconds=number("SOURCE_CRAWL_TIMEOUT_SECONDS", 12, 2, 60),
        max_bytes=integer("SOURCE_CRAWL_MAX_BYTES", 4 * 1024 * 1024, 32 * 1024, 4 * 1024 * 1024),
        max_pages_per_source=integer("SOURCE_CRAWL_MAX_PAGES_PER_SOURCE", 5, 1, 12),
        max_link_fetches_per_source=integer("SOURCE_CRAWL_MAX_LINK_FETCHES_PER_SOURCE", 3, 0, 8),
        delay_seconds=number("SOURCE_CRAWL_DELAY_SECONDS", 1.0, 0.1, 30),
        max_attempts=integer("OUTREACH_SOURCE_MAX_ATTEMPTS", 3, 1, 8),
        max_sources=integer("SOURCE_CRAWL_MAX_SOURCES", 100, 1, 100),
        user_agent=env.get("SOURCE_CRAWL_USER_AGENT", "MarcsMusicSourceCrawler/1.0 (+https://marcsmusic.nl/)"),
        publish_enabled=publish_enabled,
        ingestion_base_url=base_url,
        signing_key_id=key_id,
        signing_key=key,
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_timestamp(value: datetime | None = None) -> str:
    return (value or utc_now()).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_url(raw: str) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("empty URL")
    parsed = urllib.parse.urlsplit(raw.strip())
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("only absolute HTTPS URLs are allowed")
    if parsed.username or parsed.password or parsed.fragment:
        raise ValueError("URL credentials and fragments are not allowed")
    if parsed.port not in (None, 443):
        raise ValueError("only HTTPS port 443 is allowed")
    host = parsed.hostname.encode("idna").decode("ascii").lower().rstrip(".")
    query = urllib.parse.urlencode(
        sorted((key, value) for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
               if key.lower() not in TRACKING_KEYS),
        doseq=True,
    )
    path = parsed.path or "/"
    return urllib.parse.urlunsplit(("https", host, path, query, ""))


def assert_public_host(host: str) -> None:
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses:
        raise ValueError("host did not resolve")
    for address in {item[4][0] for item in addresses}:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise ValueError("host resolves to a non-public address")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: urllib.request.Request, fp: Any, code: int, msg: str, headers: Any, newurl: str):
        return None


class RobotsCache:
    def __init__(self, http: "SafeHttp") -> None:
        self.http = http
        self.rules: dict[str, tuple[bool, list[str], list[str], float | None]] = {}

    def allowed(self, url: str) -> tuple[bool, float | None, str | None]:
        parsed = urllib.parse.urlsplit(url)
        origin = f"https://{parsed.hostname}"
        if origin not in self.rules:
            robots_url = f"{origin}/robots.txt"
            result = self.http._fetch_once(robots_url, check_robots=False)
            if result.status in (None, 401, 403, 429) or result.status >= 500:
                self.rules[origin] = (False, [], [], None)
            elif result.status == 404:
                self.rules[origin] = (True, [], [], None)
            else:
                self.rules[origin] = (True, *_parse_robots(result.body))
        usable, disallow, allow, delay = self.rules[origin]
        if not usable:
            return False, delay, "robots_unavailable"
        path = parsed.path or "/"
        allowed = True
        best = -1
        for rule in allow:
            if path.startswith(rule) and len(rule) > best:
                allowed, best = True, len(rule)
        for rule in disallow:
            if rule and path.startswith(rule) and len(rule) > best:
                allowed, best = False, len(rule)
        return allowed, delay, None if allowed else "robots_disallowed"


def _parse_robots(body: str) -> tuple[list[str], list[str], float | None]:
    groups: list[tuple[list[str], list[str], list[str], float | None]] = []
    agents: list[str] = []
    disallow: list[str] = []
    allow: list[str] = []
    delay: float | None = None
    active = False
    for raw in body.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            if agents:
                groups.append((agents, disallow, allow, delay))
                agents, disallow, allow, delay = [], [], [], None
            active = False
            continue
        key, value = (part.strip().lower() for part in line.split(":", 1))
        if key == "user-agent":
            if disallow or allow or delay is not None:
                groups.append((agents, disallow, allow, delay))
                agents, disallow, allow, delay = [], [], [], None
            agents.append(value)
            active = True
        elif active and key == "disallow":
            disallow.append(value)
        elif active and key == "allow":
            allow.append(value)
        elif active and key == "crawl-delay":
            try:
                delay = min(float(value), 60.0)
            except ValueError:
                pass
    if agents:
        groups.append((agents, disallow, allow, delay))
    selected = [group for group in groups if "*" in group[0] or any("marcsmusic" in agent for agent in group[0])]
    if not selected:
        return [], [], None
    disallow = [rule for group in selected for rule in group[1]]
    allow = [rule for group in selected for rule in group[2]]
    delays = [group[3] for group in selected if group[3] is not None]
    return disallow, allow, min(delays) if delays else None


class SafeHttp:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.robots = RobotsCache(self)
        self.opener = urllib.request.build_opener(NoRedirect())
        self.next_host_request: dict[str, float] = {}

    def fetch(self, url: str) -> FetchResult:
        return self._fetch_once(url, check_robots=True)

    def _fetch_once(self, url: str, *, check_robots: bool) -> FetchResult:
        current = canonical_url(url)
        seen: set[str] = set()
        for _ in range(MAX_REDIRECTS + 1):
            if current in seen:
                return FetchResult(url, current, None, "", "", "redirect_loop")
            seen.add(current)
            parsed = urllib.parse.urlsplit(current)
            try:
                assert_public_host(parsed.hostname or "")
            except (OSError, ValueError) as error:
                return FetchResult(url, current, None, "", "", "non_public_host")
            delay = self.config.delay_seconds
            if check_robots:
                allowed, robots_delay, reason = self.robots.allowed(current)
                if not allowed:
                    return FetchResult(url, current, None, "", "", reason or "robots_disallowed")
                delay = max(delay, robots_delay or 0)
            wait_until = self.next_host_request.get(parsed.hostname or "", 0.0)
            if wait_until > time.monotonic():
                time.sleep(min(wait_until - time.monotonic(), 60.0))
            self.next_host_request[parsed.hostname or ""] = time.monotonic() + delay
            request = urllib.request.Request(
                current,
                headers={"User-Agent": self.config.user_agent, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.1"},
                method="GET",
            )
            try:
                response = self.opener.open(request, timeout=self.config.request_timeout_seconds)
                status = int(response.status)
                headers = response.headers
                location = headers.get("Location")
                content_type = headers.get_content_type().lower()
                if 300 <= status < 400 and location:
                    current = canonical_url(urllib.parse.urljoin(current, location))
                    continue
                body = response.read(self.config.max_bytes + 1)
                if len(body) > self.config.max_bytes:
                    return FetchResult(url, current, status, "", content_type, "response_too_large")
                if not any(content_type.startswith(allowed_type) for allowed_type in ALLOWED_CONTENT_TYPES):
                    return FetchResult(url, current, status, "", content_type, "unsupported_content_type")
                charset = headers.get_content_charset() or "utf-8"
                return FetchResult(url, current, status, body.decode(charset, errors="replace"), content_type, None)
            except urllib.error.HTTPError as error:
                location = error.headers.get("Location") if error.headers else None
                if 300 <= error.code < 400 and location:
                    current = canonical_url(urllib.parse.urljoin(current, location))
                    continue
                return FetchResult(url, current, error.code, "", "", f"http_{error.code}")
            except (urllib.error.URLError, TimeoutError, socket.timeout, ssl.SSLError, OSError, ValueError):
                return FetchResult(url, current, None, "", "", "request_failed")
        return FetchResult(url, current, None, "", "", "too_many_redirects")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.mailto: list[tuple[str, str]] = []
        self._in_title = False
        self._skip_depth = 0
        self._anchor: tuple[str, list[str]] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "template"}:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "a":
            href = next((value for key, value in attrs if key.lower() == "href" and value), "")
            self._anchor = (href or "", [])

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "template"} and self._skip_depth:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag == "a" and self._anchor is not None:
            href, label_parts = self._anchor
            label = " ".join(label_parts).strip()
            self.links.append((href, label))
            if href.lower().startswith("mailto:"):
                self.mailto.append((href[7:].split("?", 1)[0], label))
            self._anchor = None

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        clean = " ".join(data.split())
        if not clean:
            return
        self.text_parts.append(clean)
        if self._in_title:
            self.title_parts.append(clean)
        if self._anchor is not None:
            self._anchor[1].append(clean)

    @property
    def title(self) -> str:
        return " ".join(self.title_parts).strip()[:180]

    @property
    def text(self) -> str:
        return " ".join(self.text_parts)[:50_000]


def normalize_email(value: str) -> str | None:
    candidate = html.unescape(value).strip().lower()
    if len(candidate) > 254 or not EMAIL_RE.fullmatch(candidate):
        return None
    if candidate.endswith((".png", ".jpg", ".gif", ".webp")):
        return None
    return candidate


def classify_context(context: str) -> str | None:
    if NO_SUBMISSIONS_RE.search(context):
        return None
    if SUBMISSION_RE.search(context):
        return "Explicit Music Submission"
    if PROMO_RE.search(context):
        return "Promo Contact"
    if PRESS_RE.search(context):
        return "Press Contact"
    return None


def context_for(text: str, value: str, radius: int = 180) -> str:
    index = text.lower().find(value.lower())
    if index < 0:
        return text[: radius * 2]
    return text[max(0, index - radius): index + len(value) + radius]


def classify_page(page: PageParser, result: FetchResult) -> tuple[dict[str, str], list[dict[str, str]], int]:
    candidates: dict[str, dict[str, str]] = {}
    held = 0
    text = page.text
    mailto_values = {normalize_email(raw) for raw, _label in page.mailto}
    for raw in EMAIL_RE.findall(text):
        email = normalize_email(raw)
        if not email:
            continue
        if email not in mailto_values and email.split("@", 1)[0] in GENERIC_LOCAL_PARTS:
            held += 1
            continue
        context = context_for(text, raw)
        purpose = classify_context(context)
        if not purpose:
            held += 1
            continue
        candidates[email] = {"email": email, "purpose": purpose, "evidence": context[:500]}
    for raw, label in page.mailto:
        email = normalize_email(raw)
        if not email:
            continue
        context = f"{label} {context_for(text, label)}".strip()
        purpose = classify_context(context)
        if not purpose:
            held += 1
            continue
        candidates[email] = {"email": email, "purpose": purpose, "evidence": context[:500]}
    forms: list[dict[str, str]] = []
    for href, label in page.links:
        if not href or href.lower().startswith(("mailto:", "javascript:", "tel:")):
            continue
        combined = f"{label} {href}".lower()
        if not re.search(r"\b(?:submit|submission|demo|promo|press|music)\b", combined):
            continue
        try:
            form_url = canonical_url(urllib.parse.urljoin(result.final_url or result.requested_url, href))
        except ValueError:
            continue
        forms.append({"url": form_url, "label": (label or href)[:160]})
    return candidates, forms[:3], held


def type_for_source(source_type: str) -> str:
    return {
        "radio_directory": "Radio Station",
        "curated_radio": "Radio Station",
        "scene_directory": "DJ",
        "music_discovery": "Playlist Curator",
        "profile_platform": "DJ",
        "submission_platform": "Submission Platform",
    }.get(source_type, "Music Blog")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def build_records(source: Source, pages: list[tuple[FetchResult, PageParser]], captured_at: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
    outlet_id = f"dj-outlet-{digest(source.name + "\n" + source.website)[:24]}"
    accepted: dict[str, dict[str, str]] = {}
    form_url: str | None = None
    held = 0
    for result, page in pages:
        contacts, forms, page_held = classify_page(page, result)
        held += page_held
        for email, candidate in contacts.items():
            accepted.setdefault(email, candidate)
        if forms and form_url is None:
            form_url = forms[0]["url"]
    evidence_url = canonical_url(source.source_url)
    evidence_text = f"Public source page fetched from {source.name}; contact routes are accepted only when the page labels the route for music submission, promotion, or press."
    policy = "Explicit" if accepted or form_url else "General Contact"
    outlet: dict[str, Any] = {
        "kind": "mediaOutlet",
        "externalId": outlet_id,
        "name": source.name[:180],
        "type": type_for_source(source.type),
        "website": canonical_url(source.website),
        "genres": [],
        "subGenres": [],
        "formatGenres": [],
        "submissionPolicy": policy,
        "acceptsEmail": bool(accepted),
        "acceptsForms": bool(form_url),
        "acceptsUnreleased": False,
        "qualityScore": 40 if pages else 0,
        # The outlet evidence was fetched live from its public HTTPS page.
        # This is source-evidence verification, not email deliverability.
        "verified": True,
        "evidence": {"url": evidence_url, "text": evidence_text, "capturedAt": captured_at},
    }
    if form_url:
        outlet["submissionUrl"] = form_url
    records: list[dict[str, Any]] = [outlet]
    for email, candidate in sorted(accepted.items()):
        records.append({
            "kind": "mediaContact",
            "externalId": f"dj-contact-{digest(email)[:24]}",
            "outletExternalId": outlet_id,
            # EspoCRM's personName field requires both components even for an
            # organizational route.  Keep the source name as the salutation
            # component and use a neutral team label; never invent a person.
            "fullName": f"{source.name} Team"[:180],
            "firstName": source.name[:100],
            "lastName": "Team",
            "email": email,
            "role": f"{candidate['purpose']} route"[:160],
            # The route is explicitly labelled on the fetched page. Mailgun
            # validation remains the independent gate for outreach eligibility.
            "verified": True,
            "purpose": candidate["purpose"],
            "basis": "Explicit Submission Address",
            "evidence": {"url": evidence_url, "text": evidence_text + " Page context: " + candidate["evidence"][:1_200], "capturedAt": captured_at},
        })
    return records, {"accepted": len(accepted), "held": held, "forms": int(bool(form_url))}


def stable_record(record: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(record))
    if isinstance(clone.get("evidence"), dict):
        clone["evidence"].pop("capturedAt", None)
    return clone


def artifact_for(records: list[dict[str, Any]], generated_at: str, partition: int, total: int) -> tuple[dict[str, Any], str]:
    semantic = digest([stable_record(record) for record in records])
    artifact = {
        "schemaVersion": "1.0",
        "sourceId": SOURCE_ID,
        "artifactId": f"snapshot-{generated_at.replace('-', '').replace(':', '').replace('.', '')}-{partition}-of-{total}-{semantic[:12]}",
        "generatedAt": generated_at,
        "records": records,
    }
    return artifact, semantic


def request_signature(source_id: str, key_id: str, timestamp: str, nonce: str, body: bytes, key: str) -> str:
    body_digest = hashlib.sha256(body).hexdigest()
    canonical = f"v2\n{source_id}\n{key_id}\n{timestamp}\n{nonce}\n{body_digest}".encode("utf-8")
    return hmac.new(key.encode("utf-8"), canonical, hashlib.sha256).hexdigest()


def atomic_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = canonical_json(value)
    if len(payload) > MAX_REPORT_BYTES and path.name.endswith("report.json"):
        raise ValueError("report exceeds bounded size")
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "sentSemanticDigests": [], "items": [], "audit": []}
    if path.stat().st_size > MAX_OUTBOX_BYTES:
        raise ValueError("source outbox exceeds bounded size")
    state = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(state, dict) or state.get("version") != 1:
        raise ValueError("source outbox has an invalid contract")
    return state


def stage_artifacts(state: dict[str, Any], records: list[dict[str, Any]], generated_at: str, max_attempts: int) -> int:
    sent = set(state.setdefault("sentSemanticDigests", []))
    active = {str(item.get("semanticDigest")) for item in state.setdefault("items", []) if item.get("status") != "sent"}
    chunks = [records[index:index + 500] for index in range(0, len(records), 500)]
    staged = 0
    for index, chunk in enumerate(chunks, 1):
        artifact, semantic = artifact_for(chunk, generated_at, index, len(chunks))
        if semantic in sent or semantic in active:
            continue
        state["items"].append({
            "artifactId": artifact["artifactId"],
            "semanticDigest": semantic,
            "rawBody": canonical_json(artifact).decode("utf-8"),
            "status": "pending",
            "attempts": 0,
            "maxAttempts": max_attempts,
            "nextAttemptAt": generated_at,
        })
        staged += 1
    return staged


def park_legacy_contact_items(state: dict[str, Any]) -> int:
    """Dead-letter pre-personName artifacts instead of retrying known 400s.

    The first canary emitted contact records without first/last name fields.
    EspoCRM rejects those records because ``MediaContact.name`` is a required
    personName.  The durable outbox may still contain one of those artifacts;
    parking it is safer than repeatedly retrying a permanent provider error.
    """
    parked = 0
    for item in state.get("items", []):
        if item.get("status") not in {"pending", "retrying"}:
            continue
        try:
            artifact = json.loads(str(item.get("rawBody", "")))
            records = artifact.get("records", [])
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if not isinstance(records, list):
            continue
        missing_person_name = any(
            record.get("kind") == "mediaContact"
            and (not str(record.get("firstName", "")).strip() or not str(record.get("lastName", "")).strip())
            for record in records
            if isinstance(record, dict)
        )
        if not missing_person_name:
            continue
        item["status"] = "dead_letter"
        item["errorCode"] = "SOURCE_CONTACT_PERSON_NAME_FIELDS_MISSING"
        parked += 1
    return parked


def publish_due(state: dict[str, Any], config: Config, now: datetime) -> dict[str, int]:
    counts = {"sent": 0, "retrying": 0, "dead_letter": 0}
    if not config.publish_enabled:
        counts["retrying"] = sum(item.get("status") == "pending" for item in state.get("items", []))
        return counts
    assert config.ingestion_base_url and config.signing_key_id and config.signing_key
    counts["dead_letter"] += park_legacy_contact_items(state)
    for item in state.get("items", []):
        if item.get("status") not in {"pending", "retrying"}:
            continue
        attempts = int(item.get("attempts", 0))
        if attempts >= int(item.get("maxAttempts", config.max_attempts)):
            item["status"] = "dead_letter"
            counts["dead_letter"] += 1
            continue
        item["attempts"] = attempts + 1
        body = str(item["rawBody"]).encode("utf-8")
        timestamp = str(int(now.timestamp()))
        nonce = hashlib.sha256(f"{item['artifactId']}:{attempts}:{timestamp}".encode()).hexdigest()[:32]
        headers = {
            "Content-Type": "application/json",
            "X-Source-Key-Id": config.signing_key_id,
            "X-Source-Timestamp": timestamp,
            "X-Source-Nonce": nonce,
            "X-Source-Signature": "v2=" + request_signature(SOURCE_ID, config.signing_key_id, timestamp, nonce, body, config.signing_key),
        }
        request = urllib.request.Request(
            f"{config.ingestion_base_url}/api/v1/source-ingestion/{SOURCE_ID}",
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=config.request_timeout_seconds) as response:
                status = int(response.status)
                response.read(16_384)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError, ssl.SSLError):
            status = 599
        if 200 <= status < 300:
            item["status"] = "sent"
            state.setdefault("sentSemanticDigests", []).append(item["semanticDigest"])
            state["sentSemanticDigests"] = state["sentSemanticDigests"][-1_000:]
            counts["sent"] += 1
        elif status == 429 or status >= 500:
            item["status"] = "retrying"
            counts["retrying"] += 1
        else:
            item["status"] = "dead_letter"
            counts["dead_letter"] += 1
    return counts


def crawl_source(source: Source, http: SafeHttp, config: Config) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    urls: list[str] = []
    for value in (source.website, source.source_url):
        try:
            value = canonical_url(value)
        except ValueError:
            continue
        if value not in urls:
            urls.append(value)
    queue = urls[:2]
    pages: list[tuple[FetchResult, PageParser]] = []
    fetched_urls: set[str] = set()
    blocked = 0
    reasons: dict[str, int] = {}
    links_added = 0
    source_hosts = {urllib.parse.urlsplit(url).hostname for url in urls}
    while queue and len(pages) < config.max_pages_per_source:
        url = queue.pop(0)
        if url in fetched_urls:
            continue
        fetched_urls.add(url)
        result = http.fetch(url)
        if result.status is None or not (200 <= result.status < 300) or not result.body:
            reason = result.reason or f"http_{result.status or 'unknown'}"
            reasons[reason] = reasons.get(reason, 0) + 1
            if reason.startswith("robots"):
                blocked += 1
            continue
        parser = PageParser()
        try:
            parser.feed(result.body)
            parser.close()
        except Exception:
            reasons["html_parse_failed"] = reasons.get("html_parse_failed", 0) + 1
            continue
        pages.append((result, parser))
        if links_added >= config.max_link_fetches_per_source:
            continue
        for href, label in parser.links:
            if links_added >= config.max_link_fetches_per_source:
                break
            if not href or href.lower().startswith(("mailto:", "javascript:", "tel:", "#")):
                continue
            combined = f"{label} {href}".lower()
            if not re.search(r"\b(?:contact|submit|submission|demo|promo|press|music|programming)\b", combined):
                continue
            try:
                linked = canonical_url(urllib.parse.urljoin(result.final_url or url, href))
            except ValueError:
                continue
            if urllib.parse.urlsplit(linked).hostname not in source_hosts:
                continue
            if linked not in fetched_urls and linked not in queue:
                queue.append(linked)
                links_added += 1
    captured_at = iso_timestamp()
    records, stats = build_records(source, pages, captured_at)
    status = "ok" if pages else ("blocked" if blocked and not reasons.get("request_failed") else "unavailable")
    report = {
        "source": source.name,
        "type": source.type,
        "status": status,
        "pagesFetched": len(pages),
        "pagesAttempted": len(fetched_urls),
        "acceptedContacts": stats["accepted"],
        "heldAddresses": stats["held"],
        "submissionForms": stats["forms"],
        "reasonCounts": reasons,
    }
    return records, report


def load_sources(path: Path, max_sources: int) -> list[Source]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not raw:
        raise ValueError("source registry must be a non-empty array")
    sources: list[Source] = []
    names: set[str] = set()
    for item in raw[:max_sources]:
        source = Source(str(item["name"]), str(item["type"]), str(item["website"]), str(item["sourceUrl"]))
        if source.name in names:
            raise ValueError("source registry contains duplicate names")
        canonical_url(source.website)
        canonical_url(source.source_url)
        names.add(source.name)
        sources.append(source)
    return sources


def run(config: Config) -> dict[str, Any]:
    if not config.enabled:
        return {"enabled": False, "sources": 0, "staged": 0, "sent": 0, "retrying": 0, "deadLetter": 0}
    sources = load_sources(config.registry_path, config.max_sources)
    if len(sources) < 27:
        raise ValueError("production source registry must contain all 27 sources")
    http = SafeHttp(config)
    all_records: list[dict[str, Any]] = []
    source_reports: list[dict[str, Any]] = []
    seen_records: set[tuple[str, str]] = set()
    for source in sources:
        records, report = crawl_source(source, http, config)
        for record in records:
            key = (str(record["kind"]), str(record["externalId"]))
            if key in seen_records:
                continue
            seen_records.add(key)
            all_records.append(record)
        source_reports.append(report)
    generated_at = iso_timestamp()
    state_path = config.data_dir / "dj_source_crawler_outbox.json"
    report_path = config.data_dir / "dj_source_crawl_report.json"
    state = load_state(state_path)
    staged = stage_artifacts(state, all_records, generated_at, config.max_attempts)
    publication = publish_due(state, config, utc_now())
    atomic_write(state_path, state)
    report = {
        "schemaVersion": "1.0",
        "generatedAt": generated_at,
        "sourceCount": len(sources),
        "recordCount": len(all_records),
        "acceptedContactCount": sum(int(item["acceptedContacts"]) for item in source_reports),
        "heldAddressCount": sum(int(item["heldAddresses"]) for item in source_reports),
        "sourceReports": source_reports,
        "publication": {"enabled": config.publish_enabled, "staged": staged, **publication},
    }
    atomic_write(report_path, report)
    return {
        "enabled": True,
        "sources": len(sources),
        "records": len(all_records),
        "acceptedContacts": report["acceptedContactCount"],
        "heldAddresses": report["heldAddressCount"],
        "staged": staged,
        "sent": publication["sent"],
        "retrying": publication["retrying"],
        "deadLetter": publication["dead_letter"],
        "sourceStatuses": {item["status"]: sum(1 for row in source_reports if row["status"] == item["status"]) for item in source_reports},
    }


def main() -> int:
    try:
        outcome = run(load_config())
        print(json.dumps(outcome, sort_keys=True, separators=(",", ":")))
        return 0
    except Exception as error:
        print(json.dumps({"enabled": True, "success": False, "reasonCode": type(error).__name__}, separators=(",", ":")))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
