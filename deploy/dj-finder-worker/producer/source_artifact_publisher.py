"""Durable, signed DJ Finder facts for the central outreach worker.

This module is intentionally standard-library only so it can be copied into the
existing Python discovery image. It never sends business email. It persists the
exact artifact bytes before network I/O and rotates only nonce/timestamp on a
retry. An envelope nearing the consumer's 24-hour limit is re-issued with the
same semantic payload under a bounded, audited lifecycle.
"""

from __future__ import annotations

import csv
import fcntl
import hashlib
import hmac
import ipaddress
import json
import os
import re
import ssl
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable


SOURCE_ID = "dj-finder"
MAX_INPUT_BYTES = 50_000_000
MAX_ROWS = 50_000
MAX_RESPONSE_BYTES = 64_000
DEFAULT_MAX_REISSUES = 3
DEFAULT_MAX_OPERATOR_RECOVERIES = 3
DEFAULT_ENVELOPE_MAX_AGE_SECONDS = 23 * 60 * 60
MAX_OUTBOX_ITEMS = 10_000
MAX_AUDIT_EVENTS = 1_000
GENRES = {
    "ambient": "Ambient",
    "dance": "Dance",
    "electronic": "Electronic",
    "hip hop": "Hip Hop",
    "hip-hop": "Hip Hop",
    "indie": "Indie",
    "latin": "Latin",
    "pop": "Pop",
    "reggae": "Reggae",
    "rock": "Rock",
    "world": "World",
}
SUB_GENRES = {
    "afro": "Afro", "caribbean": "Caribbean", "club": "Club", "downtempo": "Downtempo",
    "indie dance": "Indie Dance", "indie-dance": "Indie Dance", "melodic": "Melodic",
    "reggaeton": "Reggaeton", "tropical": "Tropical", "world fusion": "World Fusion",
    "world-fusion": "World Fusion", "other": "Other",
}
FORMAT_GENRES = {
    "chr": "CHR", "college": "College", "community": "Community", "dance": "Dance",
    "electronic": "Electronic", "indie": "Indie", "latin": "Latin", "mainstream": "Mainstream",
    "specialist": "Specialist", "urban": "Urban", "world": "World", "other": "Other",
}
TRACKING_QUERY_KEYS = frozenset({"fbclid", "gclid", "msclkid"})
SOURCE_RECORD_URL_FIELDS = (
    "website",
    "submissionUrl",
    "instagramUrl",
    "spotifyUrl",
    "websiteUrl",
    "epkUrl",
    "privateStreamUrl",
    "downloadUrl",
    "artworkUrl",
    "radioEditUrl",
)
POLICY_EVIDENCE_FIELDS = (
    "active_evidence", "why_relevant", "notes", "contact_evidence", "verification_notes",
    "submission_policy", "submission_status", "accepts_submissions", "accepts_music_submissions",
)
NO_SUBMISSIONS_PATTERNS = tuple(re.compile(pattern, flags=re.IGNORECASE) for pattern in (
    r"\bno\s+(?:unsolicited\s+)?(?:(?:music|track|demo|promo)\s+)?submissions\b",
    r"\b(?:do\s+not|does\s+not|don['’]?t|not\s+currently)\s+accept(?:s|ing)?\s+"
    r"(?:(?:music|track|demo|promo)\s+)?submissions?\b",
    r"\bsubmissions?\s+(?:are\s+|is\s+)?(?:closed|disabled|not\s+accepted)\b",
    r"\b(?:do\s+not|don['’]?t|please\s+do\s+not)\s+(?:send|submit|email)\s+"
    r"(?:us\s+|me\s+)?(?:music|tracks?|songs?|demos?|promos?)\b",
    r"\bunsolicited\s+(?:music|tracks?|songs?|demos?|promos?)\s+(?:is\s+|are\s+)?not\s+accepted\b",
    r"\bgeen\s+(?:muziek\s+)?inzendingen\b",
    r"\b(?:accepteert|accepteren)\s+geen\s+(?:muziek|inzendingen|demo['’]?s|promo['’]?s)\b",
    r"\bstuur\s+geen\s+(?:muziek|tracks?|demo['’]?s|promo['’]?s)\b",
    r"\bkeine\s+(?:musik\s+)?einsendungen\b",
    r"\bkeine\s+(?:musik|tracks?|demos?|promos?)\s+(?:senden|einsenden)\b",
    r"\b(?:n['’]accepte\s+pas|ne\s+pas\s+envoyer)\b[^.\n]{0,80}\b"
    r"(?:soumissions?|musique|d[ée]mos?|promos?)\b",
    r"\b(?:no\s+acepta|no\s+enviar)\b[^.\n]{0,80}\b(?:env[ií]os?|m[uú]sica|demos?|promos?)\b",
    r"\b(?:n[aã]o\s+aceita|n[aã]o\s+enviar)\b[^.\n]{0,80}\b"
    r"(?:submiss(?:[õo]es)|m[uú]sica|demos?|promos?)\b",
))
PURPOSE_EVIDENCE_PATTERNS = {
    "submission": tuple(re.compile(pattern, flags=re.IGNORECASE) for pattern in (
        r"\b(?:music|track|song|demo|release)\s+submissions?\b",
        r"\bsubmit(?:ting)?\s+(?:your\s+|new\s+|unreleased\s+)?"
        r"(?:music|tracks?|songs?|demos?|releases?)\b",
        r"\b(?:send|email)\s+(?:us\s+|me\s+|your\s+)?(?:music|tracks?|songs?|demos?|releases?)\b",
        r"\b(?:invite|invites|inviting|accept|accepts|accepting)\b[^.\n]{0,80}\b"
        r"(?:music|tracks?|songs?|demos?|releases?)\b",
        r"\bunreleased\s+(?:music|tracks?|songs?)\b[^.\n]{0,80}\b(?:email|submit|send)\b",
    )),
    "promo": tuple(re.compile(pattern, flags=re.IGNORECASE) for pattern in (
        r"\b(?:send|submit|email)\s+(?:us\s+|me\s+|your\s+)?promos?\b",
        r"\bpromo(?:tional)?\s+(?:music\s+)?(?:submissions?|contact|email|inquiries|enquiries)\b",
        r"\bpromos?\s+(?:are\s+)?(?:accepted|welcome|invited)\b",
    )),
    "press": tuple(re.compile(pattern, flags=re.IGNORECASE) for pattern in (
        r"\bpress\s+(?:contact|email|inquiries|enquiries|submissions?)\b",
        r"\bmedia\s+(?:contact|email|inquiries|enquiries)\b",
        r"\bpublicity\s+(?:contact|email|inquiries|enquiries)\b",
    )),
}


@dataclass(frozen=True)
class Config:
    enabled: bool
    base_url: str | None
    signing_key_id: str | None
    signing_key: str | None
    contacts_path: Path
    outbox_path: Path
    timeout_seconds: int
    max_attempts: int
    max_reissues: int = DEFAULT_MAX_REISSUES
    max_operator_recoveries: int = DEFAULT_MAX_OPERATOR_RECOVERIES
    envelope_max_age_seconds: int = DEFAULT_ENVELOPE_MAX_AGE_SECONDS


def load_config(env: dict[str, str] | os._Environ[str] = os.environ) -> Config:
    enabled = env.get("OUTREACH_SOURCE_PUBLISH_ENABLED", "false") == "true"
    base_url = _optional(env.get("OUTREACH_SOURCE_INGESTION_BASE_URL"))
    signing_key_id = _optional(env.get("OUTREACH_SOURCE_SIGNING_KEY_ID"))
    signing_key = _optional(env.get("OUTREACH_SOURCE_SIGNING_KEY"))
    if enabled:
        if not base_url or urllib.parse.urlparse(base_url).scheme != "https":
            raise ValueError("OUTREACH_SOURCE_INGESTION_BASE_URL must use HTTPS")
        if not signing_key_id or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,31}", signing_key_id):
            raise ValueError("OUTREACH_SOURCE_SIGNING_KEY_ID must be a bounded key id")
        if not signing_key or not 32 <= len(signing_key) <= 512:
            raise ValueError("OUTREACH_SOURCE_SIGNING_KEY must contain 32-512 characters")
    contacts_path = Path(env.get("DJ_CONTACTS_PATH", "/data/dj_contacts.csv")).expanduser()
    outbox_path = Path(env.get("DJ_OUTREACH_SOURCE_OUTBOX_PATH", "/data/dj_source_artifact_outbox.json")).expanduser()
    return Config(
        enabled=enabled,
        base_url=base_url.rstrip("/") if base_url else None,
        signing_key_id=signing_key_id,
        signing_key=signing_key,
        contacts_path=contacts_path,
        outbox_path=outbox_path,
        timeout_seconds=_bounded_int(env.get("OUTREACH_SOURCE_TIMEOUT_SECONDS"), 10, 1, 60),
        max_attempts=_bounded_int(env.get("OUTREACH_SOURCE_MAX_ATTEMPTS"), 8, 1, 20),
        max_reissues=_bounded_int(env.get("OUTREACH_SOURCE_MAX_REISSUES"), DEFAULT_MAX_REISSUES, 0, 10),
        max_operator_recoveries=_bounded_int(
            env.get("OUTREACH_SOURCE_MAX_OPERATOR_RECOVERIES"), DEFAULT_MAX_OPERATOR_RECOVERIES, 0, 10
        ),
        envelope_max_age_seconds=_bounded_int(
            env.get("OUTREACH_SOURCE_ENVELOPE_MAX_AGE_SECONDS"),
            DEFAULT_ENVELOPE_MAX_AGE_SECONDS,
            3600,
            DEFAULT_ENVELOPE_MAX_AGE_SECONDS,
        ),
    )


def run_after_successful_discovery(
    config: Config,
    *,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    post: Callable[[str, bytes, dict[str, str], int], tuple[int, bytes]] | None = None,
) -> dict[str, object]:
    if not config.enabled:
        return {"enabled": False, "staged": 0, "sent": 0, "retrying": 0, "dead_letter": 0}
    lock_path = config.outbox_path.with_suffix(config.outbox_path.suffix + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        state = _load_state(config.outbox_path)
        current = now().astimezone(timezone.utc)
        records, held = build_records(read_rows(config.contacts_path))
        staged = stage_artifacts(
            state,
            records,
            config.max_attempts,
            current,
            max_reissues=config.max_reissues,
            max_operator_recoveries=config.max_operator_recoveries,
        )
        outcome = publish_due(
            state,
            config,
            now=lambda: current,
            post=post or _https_post,
            persist=lambda: _atomic_json_write(config.outbox_path, state),
        )
        _atomic_json_write(config.outbox_path, state)
        return {"enabled": True, "staged": staged, "held": held, **outcome}


def read_rows(path: Path) -> list[dict[str, str]]:
    if not path.is_file() or path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("DJ contacts export must be a bounded regular file")
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError("DJ contacts export requires unique CSV headers")
        rows = []
        for index, row in enumerate(reader):
            if index >= MAX_ROWS:
                raise ValueError("DJ contacts export exceeds the row limit")
            rows.append({str(key): str(value or "") for key, value in row.items()})
        return rows


def build_records(rows: list[dict[str, str]]) -> tuple[list[dict[str, object]], int]:
    records: list[dict[str, object]] = []
    held = 0
    seen: set[str] = set()
    for row in rows:
        mapped = _map_row(row)
        if not mapped:
            held += 1
            continue
        for record in mapped:
            key = f"{record['kind']}:{record['externalId']}"
            if key in seen:
                continue
            seen.add(key)
            records.append(record)
    return records, held


def stage_artifacts(
    state: dict[str, object],
    records: list[dict[str, object]],
    max_attempts: int,
    generated_at: datetime,
    *,
    max_reissues: int = DEFAULT_MAX_REISSUES,
    max_operator_recoveries: int = DEFAULT_MAX_OPERATOR_RECOVERIES,
) -> int:
    if not records:
        return 0
    canonical_records = [_canonicalize_source_record_urls(record) for record in records]
    state["version"] = 2
    items = state.setdefault("items", [])
    sent = set(state.setdefault("sentDigests", []))
    existing = {str(item.get("semanticDigest")) for item in items}
    timestamp = _format_timestamp(generated_at)
    chunks = [canonical_records[index : index + 500] for index in range(0, len(canonical_records), 500)]
    staged = 0
    for index, chunk in enumerate(chunks, start=1):
        semantic_digest = _sha256(_canonical_json(chunk))
        if semantic_digest in sent or semantic_digest in existing:
            continue
        artifact = _create_artifact(chunk, timestamp, semantic_digest, 1, index, len(chunks))
        raw_body = _canonical_json(artifact)
        item = {
            "artifactId": artifact["artifactId"],
            "semanticDigest": semantic_digest,
            "rawBody": raw_body,
            "status": "pending",
            "attempts": 0,
            "totalAttempts": 0,
            "maxAttempts": max_attempts,
            "reissueCount": 0,
            "maxReissues": max_reissues,
            "operatorRecoveryCount": 0,
            "maxOperatorRecoveries": max_operator_recoveries,
            "envelopeVersion": 1,
            "partitionIndex": index,
            "partitionCount": len(chunks),
            "nextAttemptAt": timestamp,
            "lockedBy": None,
            "lockedUntil": None,
            "leaseVersion": 0,
            "lastErrorCode": None,
        }
        items.append(item)
        _audit(state, "envelope_staged", item, generated_at)
        staged += 1
    return staged


def publish_due(
    state: dict[str, object],
    config: Config,
    *,
    now: Callable[[], datetime],
    post: Callable[[str, bytes, dict[str, str], int], tuple[int, bytes]],
    persist: Callable[[], None] = lambda: None,
) -> dict[str, int]:
    counts = {"sent": 0, "retrying": 0, "dead_letter": 0, "reissued": 0}
    current = now().astimezone(timezone.utc)
    _recover_stale_publication_leases(state, current)
    counts["reissued"] += _refresh_stale_envelopes(state, config, current)
    for item in state.get("items", []):
        if item.get("status") not in {"pending", "retrying"}:
            continue
        if _parse_timestamp(str(item.get("nextAttemptAt"))) > current:
            continue
        if not _item_integrity_valid(item):
            _dead_letter(state, item, "SOURCE_OUTBOX_INTEGRITY_FAILED", current)
            counts["dead_letter"] += 1
            persist()
            continue
        if int(item.get("attempts", 0)) >= int(item.get("maxAttempts", config.max_attempts)):
            _dead_letter(state, item, "SOURCE_PUBLISH_ATTEMPTS_EXHAUSTED", current)
            counts["dead_letter"] += 1
            persist()
            continue
        item["status"] = "publishing"
        item["attempts"] = int(item.get("attempts", 0)) + 1
        item["totalAttempts"] = int(item.get("totalAttempts", 0)) + 1
        item["lockedBy"] = str(uuid.uuid4())
        item["leaseVersion"] = int(item.get("leaseVersion", 0)) + 1
        item["lockedUntil"] = _format_timestamp(
            datetime.fromtimestamp(current.timestamp() + max(60, config.timeout_seconds * 2), timezone.utc)
        )
        persist()
        raw_body = str(item["rawBody"]).encode("utf-8")
        timestamp = str(int(current.timestamp()))
        nonce = str(uuid.uuid4())
        signature = request_signature(
            SOURCE_ID,
            str(config.signing_key_id),
            timestamp,
            nonce,
            raw_body,
            str(config.signing_key),
        )
        headers = {
            "content-type": "application/json",
            "x-source-key-id": str(config.signing_key_id),
            "x-source-timestamp": timestamp,
            "x-source-nonce": nonce,
            "x-source-signature": f"v2={signature}",
        }
        try:
            status, response = post(
                f"{config.base_url}/api/v1/source-ingestion/{SOURCE_ID}",
                raw_body,
                headers,
                config.timeout_seconds,
            )
            response_body = _json_response(response)
            if 200 <= status < 300:
                response_result = response_body.get("result")
                item["status"] = "sent"
                item["lastErrorCode"] = None
                _clear_lease(item)
                sent = state.setdefault("sentDigests", [])
                sent.append(item["semanticDigest"])
                state["sentDigests"] = sent[-1000:]
                _audit(
                    state,
                    "envelope_published",
                    item,
                    current,
                    {
                        "replayed": bool(response_result.get("replayed"))
                        if isinstance(response_result, dict)
                        else False
                    },
                )
                counts["sent"] += 1
                persist()
                continue
            code = str(response_body.get("error", {}).get("code") or f"SOURCE_PUBLISH_HTTP_{status}")[:120]
            retryable = status == 429 or status >= 500 or code == "SOURCE_ARTIFACT_IN_PROGRESS"
        except (OSError, TimeoutError, ssl.SSLError, ValueError) as error:
            code = type(error).__name__[:120]
            retryable = not isinstance(error, ValueError)
        item["lastErrorCode"] = code
        _clear_lease(item)
        if code == "SOURCE_ARTIFACT_STALE":
            if _automatic_reissue(state, item, current, code):
                item["nextAttemptAt"] = _format_timestamp(
                    datetime.fromtimestamp(current.timestamp() + 60, timezone.utc)
                )
                counts["reissued"] += 1
                counts["retrying"] += 1
            else:
                counts["dead_letter"] += 1
        elif retryable and item["attempts"] < int(item["maxAttempts"]):
            item["status"] = "retrying"
            delay = min(3600, 60 * (2 ** max(0, item["attempts"] - 1)))
            item["nextAttemptAt"] = _format_timestamp(
                datetime.fromtimestamp(current.timestamp() + delay, timezone.utc)
            )
            _audit(
                state,
                "retry_scheduled",
                item,
                current,
                {"errorCode": code, "nextAttemptAt": item["nextAttemptAt"]},
            )
            counts["retrying"] += 1
        else:
            _dead_letter(state, item, code, current)
            counts["dead_letter"] += 1
        persist()
    counts["retrying"] = sum(
        1
        for item in state.get("items", [])
        if item.get("status") in {"pending", "retrying", "publishing"}
    )
    counts["dead_letter"] = sum(
        1 for item in state.get("items", []) if item.get("status") == "dead_letter"
    )
    return counts


def recover_dead_letter_file(
    config: Config,
    *,
    semantic_digest: str,
    operator: str,
    reason: str,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
) -> dict[str, object]:
    lock_path = config.outbox_path.with_suffix(config.outbox_path.suffix + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        state = _load_state(config.outbox_path)
        result = recover_dead_letter(
            state,
            semantic_digest=semantic_digest,
            operator=operator,
            reason=reason,
            config=config,
            recovered_at=now(),
        )
        _atomic_json_write(config.outbox_path, state)
        return result


def recover_dead_letter(
    state: dict[str, object],
    *,
    semantic_digest: str,
    operator: str,
    reason: str,
    config: Config,
    recovered_at: datetime,
) -> dict[str, object]:
    actor = operator.strip()
    recovery_reason = reason.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9@._-]{1,79}", actor):
        raise ValueError("source recovery operator is invalid")
    if len(recovery_reason) < 12 or len(recovery_reason) > 240:
        raise ValueError("source recovery reason must contain 12-240 characters")
    matches = [item for item in state.get("items", []) if item.get("semanticDigest") == semantic_digest]
    if len(matches) != 1:
        raise ValueError("source recovery requires exactly one semantic digest match")
    item = matches[0]
    if item.get("status") != "dead_letter":
        raise ValueError("source recovery is allowed only for a dead-letter envelope")
    if int(item.get("operatorRecoveryCount", 0)) >= config.max_operator_recoveries:
        raise ValueError("source operator recovery budget is exhausted")
    if not _item_integrity_valid(item):
        raise ValueError("source recovery refused a corrupt semantic payload")
    old_artifact_id = str(item["artifactId"])
    item["operatorRecoveryCount"] = int(item.get("operatorRecoveryCount", 0)) + 1
    item["maxOperatorRecoveries"] = config.max_operator_recoveries
    item["maxAttempts"] = config.max_attempts
    item["maxReissues"] = config.max_reissues
    item["reissueCount"] = 0
    _replace_envelope(item, recovered_at, "SOURCE_OPERATOR_RECOVERY")
    _audit(
        state,
        "dead_letter_recovered",
        item,
        recovered_at,
        {"operator": actor, "reason": recovery_reason, "oldArtifactId": old_artifact_id},
    )
    return {
        "artifactId": item["artifactId"],
        "semanticDigest": item["semanticDigest"],
        "operatorRecoveryCount": item["operatorRecoveryCount"],
    }


def _recover_stale_publication_leases(state: dict[str, object], current: datetime) -> None:
    for item in state.get("items", []):
        if item.get("status") != "publishing":
            continue
        try:
            lease_active = _parse_timestamp(str(item.get("lockedUntil"))) > current
        except (TypeError, ValueError):
            lease_active = False
        if lease_active:
            continue
        _clear_lease(item)
        if int(item.get("attempts", 0)) >= int(item.get("maxAttempts", 1)):
            _dead_letter(state, item, "SOURCE_PUBLISH_STALE_LEASE", current)
            continue
        item["status"] = "retrying"
        item["nextAttemptAt"] = _format_timestamp(current)
        item["lastErrorCode"] = "SOURCE_PUBLISH_STALE_LEASE"
        _audit(state, "unknown_delivery_requeued", item, current)


def _refresh_stale_envelopes(state: dict[str, object], config: Config, current: datetime) -> int:
    reissued = 0
    cutoff = current.timestamp() - config.envelope_max_age_seconds
    for item in state.get("items", []):
        if item.get("status") not in {"pending", "retrying"}:
            continue
        try:
            artifact = json.loads(str(item.get("rawBody")))
            generated_at = _parse_timestamp(str(artifact.get("generatedAt")))
        except (TypeError, ValueError, json.JSONDecodeError):
            _dead_letter(state, item, "SOURCE_OUTBOX_INTEGRITY_FAILED", current)
            continue
        if generated_at.timestamp() >= cutoff:
            continue
        if _automatic_reissue(state, item, current, "SOURCE_ENVELOPE_EXPIRED"):
            reissued += 1
    return reissued


def _automatic_reissue(
    state: dict[str, object], item: dict[str, object], generated_at: datetime, reason: str
) -> bool:
    if not _item_integrity_valid(item):
        _dead_letter(state, item, "SOURCE_OUTBOX_INTEGRITY_FAILED", generated_at)
        return False
    if int(item.get("reissueCount", 0)) >= int(item.get("maxReissues", DEFAULT_MAX_REISSUES)):
        _dead_letter(state, item, "SOURCE_REISSUES_EXHAUSTED", generated_at)
        return False
    old_artifact_id = str(item["artifactId"])
    item["reissueCount"] = int(item.get("reissueCount", 0)) + 1
    _replace_envelope(item, generated_at, reason)
    _audit(
        state,
        "envelope_reissued",
        item,
        generated_at,
        {"oldArtifactId": old_artifact_id, "reason": reason},
    )
    return True


def _replace_envelope(item: dict[str, object], generated_at: datetime, reason: str) -> None:
    artifact = json.loads(str(item["rawBody"]))
    records = artifact["records"]
    try:
        previous = _parse_timestamp(str(artifact.get("generatedAt")))
        effective = max(
            generated_at.astimezone(timezone.utc),
            previous + timedelta(milliseconds=1),
        )
    except (TypeError, ValueError):
        effective = generated_at
    timestamp = _format_timestamp(effective)
    envelope_version = int(item.get("envelopeVersion", 1)) + 1
    partition_index = int(item.get("partitionIndex", 1))
    partition_count = int(item.get("partitionCount", 1))
    replacement = _create_artifact(
        records,
        timestamp,
        str(item["semanticDigest"]),
        envelope_version,
        partition_index,
        partition_count,
    )
    item["artifactId"] = replacement["artifactId"]
    item["rawBody"] = _canonical_json(replacement)
    item["envelopeVersion"] = envelope_version
    item["status"] = "pending"
    item["attempts"] = 0
    item["nextAttemptAt"] = timestamp
    item["lastErrorCode"] = reason
    _clear_lease(item)


def _dead_letter(
    state: dict[str, object], item: dict[str, object], code: str, current: datetime
) -> None:
    item["status"] = "dead_letter"
    item["lastErrorCode"] = str(code)[:120]
    item["nextAttemptAt"] = _format_timestamp(current)
    _clear_lease(item)
    _audit(state, "dead_lettered", item, current, {"errorCode": item["lastErrorCode"]})


def _clear_lease(item: dict[str, object]) -> None:
    item["lockedBy"] = None
    item["lockedUntil"] = None


def _item_integrity_valid(item: dict[str, object]) -> bool:
    try:
        raw_body = str(item["rawBody"])
        artifact = json.loads(raw_body)
        if artifact.get("sourceId") != SOURCE_ID or artifact.get("artifactId") != item.get("artifactId"):
            return False
        records = artifact.get("records")
        if not isinstance(records, list) or not records:
            return False
        if _sha256(_canonical_json(records)) != item.get("semanticDigest"):
            return False
        return _canonical_json(artifact) == raw_body
    except (KeyError, TypeError, json.JSONDecodeError):
        return False


def _create_artifact(
    records: list[dict[str, object]],
    timestamp: str,
    semantic_digest: str,
    envelope_version: int,
    partition_index: int,
    partition_count: int,
) -> dict[str, object]:
    compact_time = re.sub(r"[^0-9]", "", timestamp)[:14]
    return {
        "schemaVersion": "1.0",
        "sourceId": SOURCE_ID,
        "artifactId": (
            f"snapshot-{compact_time}-{partition_index}-of-{partition_count}"
            f"-e{envelope_version}-{semantic_digest[:16]}"
        ),
        "generatedAt": timestamp,
        "records": records,
    }


def _audit(
    state: dict[str, object],
    event: str,
    item: dict[str, object],
    occurred_at: datetime,
    details: dict[str, object] | None = None,
) -> None:
    events = state.setdefault("audit", [])
    events.append(
        {
            "id": str(uuid.uuid4()),
            "event": event,
            "at": _format_timestamp(occurred_at),
            "artifactId": item.get("artifactId"),
            "semanticDigest": item.get("semanticDigest"),
            "envelopeVersion": item.get("envelopeVersion"),
            "attempts": item.get("attempts"),
            "totalAttempts": item.get("totalAttempts"),
            **(details or {}),
        }
    )
    state["audit"] = events[-MAX_AUDIT_EVENTS:]


def _format_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def request_signature(
    source_id: str,
    key_id: str,
    timestamp: str,
    nonce: str,
    raw_body: bytes,
    key: str,
) -> str:
    body_digest = hashlib.sha256(raw_body).hexdigest()
    canonical = f"v2\n{source_id}\n{key_id}\n{timestamp}\n{nonce}\n{body_digest}".encode("utf-8")
    return hmac.new(key.encode("utf-8"), canonical, hashlib.sha256).hexdigest()


def _map_row(row: dict[str, str]) -> list[dict[str, object]] | None:
    name = _first(row, "artist_name", "dj_name", "full_name", "alias")
    website = _https(_first(row, "website_url", "website", "source_url", "contact_source_url"))
    evidence_url = _https(_first(row, "source_url", "contact_source_url", "website_url", "website"))
    evidence_text = _first(row, "active_evidence", "why_relevant", "notes")
    captured_at = _iso(_first(row, "verification_timestamp", "last_verified_on", "verification_date"))
    if not name or not website or not evidence_url or len(evidence_text) < 10 or not captured_at:
        return None
    evidence_corpus = _policy_evidence(row, evidence_text)
    denied = _has_no_submissions_evidence(row, evidence_corpus)
    selected = None if denied else _allowed_email(row, evidence_corpus)
    form_url = None if denied else _allowed_submission_form(row, evidence_corpus)
    outlet_id = f"dj-{_sha256(_first(row, 'source_id') or name + chr(10) + website)[:24]}"
    verified = _first(row, "verification_status").lower() == "verified"
    if denied:
        submission_policy = "No Submissions"
    elif selected:
        submission_policy = selected[2]
    elif form_url:
        submission_policy = "Explicit"
    else:
        submission_policy = "General Contact"
    language = _language(_first(row, "languages"))
    genres = []
    for value in re.split(r"[|,;]", _first(row, "genres", "genre_match")):
        mapped = GENRES.get(value.strip().lower(), "Other")
        if mapped not in genres:
            genres.append(mapped)
    outlet: dict[str, object] = {
        "kind": "mediaOutlet",
        "externalId": outlet_id,
        "name": name[:180],
        "type": "DJ",
        "website": website,
        "timezone": _first(row, "timezone") or "Europe/Amsterdam",
        "genres": genres[:20],
        "subGenres": _controlled_values(_first(row, "sub_genres", "subgenres", "subgenre"), SUB_GENRES),
        "formatGenres": _controlled_values(_first(row, "format_genres", "station_format", "format"), FORMAT_GENRES),
        "submissionPolicy": submission_policy,
        "acceptsEmail": bool(selected),
        "acceptsForms": bool(form_url),
        "acceptsUnreleased": not denied and bool(selected or form_url) and _truthy(row.get("accepts_unreleased", "")),
        "qualityScore": _bounded_score(row.get("confidence_score", "")),
        "verified": verified,
        "evidence": {"url": evidence_url, "text": evidence_text[:2000], "capturedAt": captured_at},
    }
    if language:
        outlet["language"] = language
    country = _first(row, "country")
    if country:
        outlet["country"] = country[:100]
    submission_url = form_url or (_https(_first(row, "contact_source_url", "source_url")) if selected else None)
    if submission_url:
        outlet["submissionUrl"] = submission_url
    records = [outlet]
    if selected:
        email, purpose, _policy = selected
        contact: dict[str, object] = {
            "kind": "mediaContact",
            "externalId": f"dj-contact-{_sha256(email)[:24]}",
            "outletExternalId": outlet_id,
            "fullName": (_first(row, "full_name", "dj_name", "artist_name") or name)[:180],
            "email": email,
            "role": (_first(row, "role", "dj_type") or "DJ / music contact")[:160],
            "verified": verified,
            "timezone": _first(row, "timezone") or "Europe/Amsterdam",
            "purpose": purpose,
            "basis": "Explicit Submission Address",
            "evidence": {"url": evidence_url, "text": evidence_text[:2000], "capturedAt": captured_at},
        }
        if language:
            contact["preferredLanguage"] = language
        records.append(contact)
    return records


def _allowed_email(row: dict[str, str], evidence_corpus: str) -> tuple[str, str, str] | None:
    for field, purpose, policy, evidence_type in (
        ("music_submission_email", "Explicit Music Submission", "Explicit", "submission"),
        ("promo_email", "Promo Contact", "Promo Contact", "promo"),
        ("press_email", "Press Contact", "Press Contact", "press"),
    ):
        value = row.get(field, "").strip().lower()
        if (
            re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value)
            and len(value) <= 254
            and _has_purpose_evidence(evidence_corpus, evidence_type)
        ):
            return value, purpose, policy
    return None


def _allowed_submission_form(row: dict[str, str], evidence_corpus: str) -> str | None:
    form_url = _https(_first(row, "music_submission_form_url", "submission_form_url", "music_submission_url"))
    if not form_url or not _has_purpose_evidence(evidence_corpus, "submission"):
        return None
    return form_url


def _has_no_submissions_evidence(row: dict[str, str], evidence_corpus: str) -> bool:
    accepts = _first(row, "accepts_submissions", "accepts_music_submissions").lower()
    if accepts in {"0", "false", "no", "closed", "blocked"}:
        return True
    return any(pattern.search(evidence_corpus) for pattern in NO_SUBMISSIONS_PATTERNS)


def _policy_evidence(row: dict[str, str], evidence_text: str) -> str:
    values = [evidence_text]
    values.extend(str(row.get(field, "")).strip() for field in POLICY_EVIDENCE_FIELDS)
    return "\n".join(unicodedata.normalize("NFKC", value) for value in values if value)


def _has_purpose_evidence(evidence_corpus: str, evidence_type: str) -> bool:
    return any(pattern.search(evidence_corpus) for pattern in PURPOSE_EVIDENCE_PATTERNS[evidence_type])


def _https(value: str) -> str | None:
    try:
        return canonicalize_source_https_url(value)
    except (TypeError, UnicodeError, ValueError):
        return None


def canonicalize_source_https_url(value: str) -> str:
    """Canonicalize one source-contract URL using conformance contract v1."""
    if not isinstance(value, str) or not value:
        raise ValueError("a non-empty URL string is required")
    try:
        value.encode("utf-8", errors="strict")
    except UnicodeEncodeError as error:
        raise ValueError("the URL contains malformed Unicode") from error
    if _utf16_length(value) > 512:
        raise ValueError("source URLs may contain at most 512 characters")
    if not re.match(r"^https://", value, flags=re.IGNORECASE):
        raise ValueError("an absolute HTTPS URL with authority is required")
    if any(_raw_url_character_is_unsafe(character) for character in value):
        raise ValueError("whitespace, controls and backslashes must be encoded safely")
    if "#" in value:
        raise ValueError("fragments are not accepted on source URLs")
    if re.search(r"%(?![0-9a-f]{2})", value, flags=re.IGNORECASE):
        raise ValueError("the URL contains a malformed percent escape")
    try:
        decoded = urllib.parse.unquote(value, encoding="utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError("the URL contains an invalid UTF-8 percent encoding") from error
    if any(_is_control_character(character) for character in decoded):
        raise ValueError("encoded control characters are not accepted")

    try:
        parsed = urllib.parse.urlsplit(value)
        hostname = urllib.parse.unquote(parsed.hostname or "", encoding="utf-8", errors="strict")
        port = parsed.port
    except (UnicodeDecodeError, ValueError) as error:
        raise ValueError("the URL is not absolute") from error
    authority = re.split(r"[/?]", value.split("://", 1)[1], maxsplit=1)[0]
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        raise ValueError("HTTPS with a hostname is required")
    if "@" in authority or parsed.username is not None or parsed.password is not None:
        raise ValueError("credentials are not accepted on source URLs")

    hostname = hostname.lower().rstrip(".")
    if not hostname:
        raise ValueError("a hostname is required")
    normalized_hostname = _normalized_hostname(hostname)
    netloc = f"[{normalized_hostname}]" if ":" in normalized_hostname else normalized_hostname
    if port is not None and port != 443:
        netloc = f"{netloc}:{port}"

    path = _canonical_url_path(parsed.path or "/")
    pairs = urllib.parse.parse_qsl(
        parsed.query,
        keep_blank_values=True,
        strict_parsing=False,
        encoding="utf-8",
        errors="strict",
        separator="&",
    )
    retained = [
        (key, query_value, position)
        for position, (key, query_value) in enumerate(pairs)
        if not _is_tracking_query_key(key)
    ]
    retained.sort(key=lambda item: (_utf16_sort_key(item[0]), _utf16_sort_key(item[1]), item[2]))
    query = "&".join(f"{_form_urlencode(key)}={_form_urlencode(query_value)}" for key, query_value, _ in retained)
    canonical = urllib.parse.urlunsplit(("https", netloc, path, query, ""))
    if _utf16_length(canonical) > 512:
        raise ValueError("canonical source URLs may contain at most 512 characters")
    return canonical


def _canonicalize_source_record_urls(record: dict[str, object]) -> dict[str, object]:
    canonical = dict(record)
    for field in SOURCE_RECORD_URL_FIELDS:
        if field in canonical:
            canonical[field] = canonicalize_source_https_url(canonical[field])  # type: ignore[arg-type]
    evidence = canonical.get("evidence")
    if isinstance(evidence, dict):
        canonical_evidence = dict(evidence)
        if "url" in canonical_evidence:
            canonical_evidence["url"] = canonicalize_source_https_url(canonical_evidence["url"])  # type: ignore[arg-type]
        canonical["evidence"] = canonical_evidence
    return canonical


def _normalized_hostname(hostname: str) -> str:
    try:
        address = ipaddress.ip_address(hostname)
        return address.compressed.lower()
    except ValueError:
        try:
            return hostname.encode("idna").decode("ascii").lower()
        except UnicodeError as error:
            raise ValueError("the URL hostname is invalid") from error


def _canonical_url_path(path: str) -> str:
    segments = path.split("/")
    output: list[str] = []
    final_index = len(segments) - 1
    for index, segment in enumerate(segments):
        decoded_segment = urllib.parse.unquote(segment, encoding="utf-8", errors="strict")
        if decoded_segment == ".":
            if index == final_index:
                output.append("")
            continue
        if decoded_segment == "..":
            if len(output) > 1:
                output.pop()
            if index == final_index:
                output.append("")
            continue
        output.append(segment)
    canonical = "/".join(output) or "/"
    if not canonical.startswith("/"):
        canonical = f"/{canonical}"
    canonical = urllib.parse.quote(canonical, safe="/:@-._~!$&'()*+,;=%")
    return re.sub(r"%[0-9a-f]{2}", lambda match: match.group(0).upper(), canonical, flags=re.IGNORECASE)


def _form_urlencode(value: str) -> str:
    output: list[str] = []
    for byte in value.encode("utf-8"):
        if 0x41 <= byte <= 0x5A or 0x61 <= byte <= 0x7A or 0x30 <= byte <= 0x39 or byte in b"*-._":
            output.append(chr(byte))
        elif byte == 0x20:
            output.append("+")
        else:
            output.append(f"%{byte:02X}")
    return "".join(output)


def _utf16_sort_key(value: str) -> bytes:
    return value.encode("utf-16-be")


def _utf16_length(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def _is_tracking_query_key(value: str) -> bool:
    key = value.lower()
    return key.startswith("utm_") or key in TRACKING_QUERY_KEYS


def _raw_url_character_is_unsafe(value: str) -> bool:
    return value == "\\" or value.isspace() or _is_control_character(value)


def _is_control_character(value: str) -> bool:
    codepoint = ord(value)
    return codepoint <= 0x1F or 0x7F <= codepoint <= 0x9F


def _iso(value: str) -> str | None:
    try:
        normalized = value.strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (ValueError, AttributeError):
        return None


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _first(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = str(row.get(key, "")).strip()
        if value:
            return value
    return ""


def _controlled_values(value: str, taxonomy: dict[str, str]) -> list[str]:
    values: list[str] = []
    for item in re.split(r"[|,;]", value):
        mapped = taxonomy.get(item.strip().lower())
        if mapped and mapped not in values:
            values.append(mapped)
    return values[:20]


def _language(value: str) -> str | None:
    raw = value.strip()
    if not raw:
        return None
    candidate = raw.lower()[:2]
    return candidate if candidate in {"nl", "en", "de", "fr", "es", "pt"} else "other"


def _truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes"}


def _bounded_score(value: str) -> int:
    try:
        return max(0, min(100, round(float(value))))
    except ValueError:
        return 0


def _load_state(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"version": 2, "items": [], "sentDigests": [], "audit": []}
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("DJ source outbox exceeds its byte limit")
    state = json.loads(path.read_text(encoding="utf-8"))
    if (
        not isinstance(state, dict)
        or state.get("version") not in {1, 2}
        or not isinstance(state.get("items"), list)
        or len(state["items"]) > MAX_OUTBOX_ITEMS
    ):
        raise ValueError("DJ source outbox has an invalid contract")
    state["version"] = 2
    state.setdefault("sentDigests", [])
    state.setdefault("audit", [])
    active: set[str] = set()
    for item in state["items"]:
        if not isinstance(item, dict):
            raise ValueError("DJ source outbox item has an invalid contract")
        _normalize_legacy_item(item)
        digest = str(item.get("semanticDigest"))
        if item.get("status") in {"pending", "retrying", "publishing"}:
            if digest in active:
                raise ValueError("DJ source outbox contains multiple active semantic envelopes")
            active.add(digest)
    return state


def _normalize_legacy_item(item: dict[str, object]) -> None:
    try:
        artifact = json.loads(str(item.get("rawBody")))
    except (TypeError, json.JSONDecodeError):
        artifact = {}
    item.setdefault("artifactId", artifact.get("artifactId"))
    item.setdefault("attempts", 0)
    item.setdefault("totalAttempts", item.get("attempts", 0))
    item.setdefault("maxAttempts", 8)
    item.setdefault("reissueCount", 0)
    item.setdefault("maxReissues", DEFAULT_MAX_REISSUES)
    item.setdefault("operatorRecoveryCount", 0)
    item.setdefault("maxOperatorRecoveries", DEFAULT_MAX_OPERATOR_RECOVERIES)
    item.setdefault("envelopeVersion", 1)
    item.setdefault("partitionIndex", 1)
    item.setdefault("partitionCount", 1)
    item.setdefault("nextAttemptAt", artifact.get("generatedAt"))
    item.setdefault("lockedBy", None)
    item.setdefault("lockedUntil", None)
    item.setdefault("leaseVersion", 0)
    item.setdefault("lastErrorCode", None)


def _atomic_json_write(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=True, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def _https_post(url: str, body: bytes, headers: dict[str, str], timeout: int) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    opener = urllib.request.build_opener(_NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.status, _bounded_read(response)
    except urllib.error.HTTPError as error:
        return error.code, _bounded_read(error)


def _bounded_read(response) -> bytes:  # noqa: ANN001
    body = response.read(MAX_RESPONSE_BYTES + 1)
    if len(body) > MAX_RESPONSE_BYTES:
        raise ValueError("outreach response exceeds its byte limit")
    return body


def _json_response(body: bytes) -> dict[str, object]:
    try:
        parsed = json.loads(body.decode("utf-8")) if body else {}
        return parsed if isinstance(parsed, dict) else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"))


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _optional(value: str | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _bounded_int(value: str | None, fallback: int, minimum: int, maximum: int) -> int:
    if value is None or not value.strip():
        return fallback
    parsed = int(value)
    if parsed < minimum or parsed > maximum:
        raise ValueError("source publisher numeric configuration is outside its bound")
    return parsed
