from __future__ import annotations

import csv
from concurrent.futures import ThreadPoolExecutor
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from source_artifact_publisher import (
    Config,
    build_records,
    canonicalize_source_https_url,
    load_config,
    recover_dead_letter_file,
    request_signature,
    run_after_successful_discovery,
    stage_artifacts,
)

KEY_ID = "dj-2026-07"


class SourceArtifactPublisherTest(unittest.TestCase):
    def test_source_mapping_requires_purpose_bound_evidence_and_no_submissions_denies(self) -> None:
        base = {
            "artist_name": "DJ Evidence",
            "full_name": "DJ Evidence",
            "website_url": "https://producer-evidence.example/",
            "source_url": "https://producer-evidence.example/directory",
            "contact_source_url": "https://producer-evidence.example/directory",
            "verification_status": "verified",
            "verification_timestamp": "2026-07-15T10:00:00Z",
        }

        generic_records, held = build_records([{
            **base,
            "general_business_email": "info@producer-evidence.example",
            "active_evidence": "The profile says to send promos to a separately listed promo desk.",
        }])
        self.assertEqual(held, 0)
        self.assertEqual([record["kind"] for record in generic_records], ["mediaOutlet"])
        self.assertEqual(generic_records[0]["submissionPolicy"], "General Contact")
        self.assertFalse(generic_records[0]["acceptsEmail"])
        self.assertNotIn("submissionUrl", generic_records[0])

        mislabeled_records, _ = build_records([{
            **base,
            "music_submission_email": "info@producer-evidence.example",
            "active_evidence": "A public directory lists this address without a stated destination.",
        }])
        self.assertEqual([record["kind"] for record in mislabeled_records], ["mediaOutlet"])
        self.assertEqual(mislabeled_records[0]["submissionPolicy"], "General Contact")

        promo_records, _ = build_records([{
            **base,
            "promo_email": "promos@producer-evidence.example",
            "active_evidence": "The official page says to send promos to this promo email.",
        }])
        self.assertEqual([record["kind"] for record in promo_records], ["mediaOutlet", "mediaContact"])
        self.assertEqual(promo_records[0]["submissionPolicy"], "Promo Contact")
        self.assertEqual(promo_records[1]["purpose"], "Promo Contact")

        denied_records, _ = build_records([{
            **base,
            "music_submission_email": "music@producer-evidence.example",
            "active_evidence": "No music submissions are accepted; please do not send promos.",
        }])
        self.assertEqual([record["kind"] for record in denied_records], ["mediaOutlet"])
        self.assertEqual(denied_records[0]["submissionPolicy"], "No Submissions")
        self.assertFalse(denied_records[0]["acceptsEmail"])
        self.assertFalse(denied_records[0]["acceptsForms"])
        self.assertFalse(denied_records[0]["acceptsUnreleased"])

    def test_likely_valid_is_never_published_as_verified(self) -> None:
        base = {
            "artist_name": "Likely DJ",
            "full_name": "Likely DJ",
            "website_url": "https://producer-likely.example/",
            "source_url": "https://producer-likely.example/submissions",
            "contact_source_url": "https://producer-likely.example/submissions",
            "music_submission_email": "music@producer-likely.example",
            "active_evidence": "The official page explicitly invites music submissions by email.",
            "verification_timestamp": "2026-07-15T10:00:00Z",
        }
        likely_records, held = build_records([{**base, "verification_status": "likely_valid"}])
        self.assertEqual(held, 0)
        self.assertEqual([record["kind"] for record in likely_records], ["mediaOutlet", "mediaContact"])
        self.assertEqual([record["verified"] for record in likely_records], [False, False])

        verified_records, _ = build_records([{**base, "verification_status": "verified"}])
        self.assertEqual([record["verified"] for record in verified_records], [True, True])

    def test_source_url_conformance_contract(self) -> None:
        fixture_path = Path(__file__).resolve().parents[3] / "docs" / "outreach" / "source-url-conformance-v1.json"
        fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
        for fixture in fixtures["valid"]:
            with self.subTest(fixture["name"]):
                self.assertEqual(canonicalize_source_https_url(fixture["input"]), fixture["output"])
        for fixture in fixtures["invalid"]:
            with self.subTest(fixture["name"]):
                with self.assertRaises(ValueError):
                    canonicalize_source_https_url(fixture["input"])
        with self.assertRaises(ValueError):
            canonicalize_source_https_url(
                f"https://source.example/?token={'x' * fixtures['limits']['maximumCharacters']}"
            )

    def test_source_urls_are_canonical_before_semantic_digesting(self) -> None:
        generated_at = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
        tracked_record = {
            "kind": "mediaOutlet",
            "externalId": "dj-url-test",
            "name": "DJ URL Test",
            "type": "DJ",
            "website": "https://DJ.example.:443/shows/../?view=full&utm_source=directory",
            "submissionUrl": "https://dj.example/submit?token=keep&fbclid=drop",
            "genres": ["Dance"],
            "submissionPolicy": "Explicit",
            "acceptsEmail": True,
            "verified": True,
            "evidence": {
                "url": "https://DJ.example.:443/source/../proof?revision=7&utm_campaign=drop",
                "text": "The current page explicitly invites unreleased music by email.",
                "capturedAt": "2026-07-15T09:59:00Z",
            },
        }
        canonical_record = {
            **tracked_record,
            "website": "https://dj.example/?view=full",
            "submissionUrl": "https://dj.example/submit?token=keep",
            "evidence": {
                **tracked_record["evidence"],
                "url": "https://dj.example/proof?revision=7",
            },
        }
        tracked_state: dict[str, object] = {}
        canonical_state: dict[str, object] = {}

        self.assertEqual(stage_artifacts(tracked_state, [tracked_record], 4, generated_at), 1)
        self.assertEqual(stage_artifacts(canonical_state, [canonical_record], 4, generated_at), 1)
        tracked_item = tracked_state["items"][0]  # type: ignore[index]
        canonical_item = canonical_state["items"][0]  # type: ignore[index]
        self.assertEqual(tracked_item["semanticDigest"], canonical_item["semanticDigest"])
        self.assertEqual(tracked_item["artifactId"], canonical_item["artifactId"])
        self.assertEqual(
            json.loads(tracked_item["rawBody"])["records"],  # type: ignore[arg-type,index]
            json.loads(canonical_item["rawBody"])["records"],  # type: ignore[arg-type,index]
        )

    def test_retry_preserves_bytes_rotates_nonce_and_excludes_general_business_email(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            contacts = root / "dj_contacts.csv"
            outbox = root / "outbox.json"
            fields = [
                "artist_name",
                "full_name",
                "website_url",
                "source_url",
                "contact_source_url",
                "music_submission_email",
                "general_business_email",
                "genres",
                "sub_genres",
                "format_genres",
                "languages",
                "active_evidence",
                "verification_status",
                "verification_timestamp",
                "confidence_score",
            ]
            with contacts.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerow(
                    {
                        "artist_name": "DJ Example",
                        "full_name": "DJ Example",
                        "website_url": "https://dj.example/",
                        "source_url": "https://dj.example/submissions",
                        "contact_source_url": "https://dj.example/submissions",
                        "music_submission_email": "music@dj.example",
                        "general_business_email": "business@dj.example",
                        "genres": "dance,electronic",
                        "sub_genres": "tropical,unknown",
                        "format_genres": "mainstream,unknown",
                        "languages": "",
                        "active_evidence": "The current page explicitly invites unreleased music by email.",
                        "verification_status": "verified",
                        "verification_timestamp": "2026-07-15T10:00:00Z",
                        "confidence_score": "92",
                    }
                )
            secret = "dj-source-secret-with-more-than-32-characters"
            config = Config(True, "https://outreach.example", KEY_ID, secret, contacts, outbox, 10, 4)
            clock = datetime(2026, 7, 15, 10, 1, tzinfo=timezone.utc)
            requests: list[tuple[str, bytes, dict[str, str], int]] = []

            def post(url: str, body: bytes, headers: dict[str, str], timeout: int) -> tuple[int, bytes]:
                requests.append((url, body, headers, timeout))
                if len(requests) == 1:
                    return 503, b'{"error":{"code":"TEMPORARY"}}'
                return 201, b'{"ok":true}'

            first = run_after_successful_discovery(config, now=lambda: clock, post=post)
            self.assertEqual(first["retrying"], 1)
            clock += timedelta(seconds=61)
            second = run_after_successful_discovery(config, now=lambda: clock, post=post)
            self.assertEqual(second["sent"], 1)
            self.assertEqual(requests[0][0], "https://outreach.example/api/v1/source-ingestion/dj-finder")
            self.assertEqual(requests[0][1], requests[1][1])
            self.assertNotEqual(requests[0][2]["x-source-nonce"], requests[1][2]["x-source-nonce"])
            expected = request_signature(
                "dj-finder",
                KEY_ID,
                requests[0][2]["x-source-timestamp"],
                requests[0][2]["x-source-nonce"],
                requests[0][1],
                secret,
            )
            self.assertEqual(requests[0][2]["x-source-key-id"], KEY_ID)
            self.assertEqual(requests[0][2]["x-source-signature"], f"v2={expected}")
            artifact = json.loads(requests[0][1])
            self.assertEqual([record["kind"] for record in artifact["records"]], ["mediaOutlet", "mediaContact"])
            self.assertEqual(artifact["records"][0]["subGenres"], ["Tropical"])
            self.assertEqual(artifact["records"][0]["formatGenres"], ["Mainstream"])
            self.assertNotIn("language", artifact["records"][0])
            self.assertNotIn("preferredLanguage", artifact["records"][1])
            self.assertEqual(artifact["records"][1]["email"], "music@dj.example")
            self.assertNotIn("business@dj.example", requests[0][1].decode("utf-8"))

    def test_disabled_hook_performs_no_file_or_network_io(self) -> None:
        config = Config(False, None, None, None, Path("/does/not/exist"), Path("/does/not/exist"), 10, 4)
        outcome = run_after_successful_discovery(config, post=lambda *_: self.fail("network must not run"))
        self.assertEqual(outcome, {"enabled": False, "staged": 0, "sent": 0, "retrying": 0, "dead_letter": 0})

    def test_enabled_config_requires_v2_key_id_and_bounded_key(self) -> None:
        base = {
            "OUTREACH_SOURCE_PUBLISH_ENABLED": "true",
            "OUTREACH_SOURCE_INGESTION_BASE_URL": "https://outreach.example",
        }
        with self.assertRaises(ValueError):
            load_config({**base, "OUTREACH_SOURCE_SIGNING_KEY": "x" * 40})
        with self.assertRaises(ValueError):
            load_config({
                **base,
                "OUTREACH_SOURCE_SIGNING_KEY_ID": KEY_ID,
                "OUTREACH_SOURCE_SIGNING_KEY": "too-short",
            })
        config = load_config({
            **base,
            "OUTREACH_SOURCE_SIGNING_KEY_ID": KEY_ID,
            "OUTREACH_SOURCE_SIGNING_KEY": "dj-source-secret-with-more-than-32-characters",
        })
        self.assertEqual(config.signing_key_id, KEY_ID)

    def test_outage_over_24_hours_reissues_same_semantics_with_fresh_envelope(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = fixture_config(Path(directory), max_reissues=2)
            clock = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
            requests: list[bytes] = []

            def post(_url: str, body: bytes, _headers: dict[str, str], _timeout: int) -> tuple[int, bytes]:
                requests.append(body)
                return (503, b'{"error":{"code":"TEMPORARY"}}') if len(requests) == 1 else (201, b'{"ok":true}')

            first = run_after_successful_discovery(config, now=lambda: clock, post=post)
            self.assertEqual(first["retrying"], 1)
            original = json.loads(requests[0])
            clock += timedelta(hours=25)
            second = run_after_successful_discovery(config, now=lambda: clock, post=post)
            refreshed = json.loads(requests[1])

            self.assertEqual(second["reissued"], 1)
            self.assertEqual(second["sent"], 1)
            self.assertNotEqual(original["artifactId"], refreshed["artifactId"])
            self.assertNotEqual(original["generatedAt"], refreshed["generatedAt"])
            self.assertEqual(refreshed["generatedAt"], "2026-07-16T11:00:00Z")
            self.assertEqual(original["records"], refreshed["records"])
            state = json.loads(config.outbox_path.read_text(encoding="utf-8"))
            item = state["items"][0]
            self.assertEqual(item["reissueCount"], 1)
            self.assertTrue(any(event["event"] == "envelope_reissued" for event in state["audit"]))

    def test_concurrent_publishers_issue_one_request_and_accept_replay_acknowledgement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = fixture_config(Path(directory))
            clock = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
            requests: list[bytes] = []

            def post(_url: str, body: bytes, _headers: dict[str, str], _timeout: int) -> tuple[int, bytes]:
                requests.append(body)
                return 200, b'{"ok":true,"result":{"replayed":true}}'

            with ThreadPoolExecutor(max_workers=2) as executor:
                outcomes = list(
                    executor.map(
                        lambda _: run_after_successful_discovery(config, now=lambda: clock, post=post),
                        range(2),
                    )
                )

            self.assertEqual(len(requests), 1)
            self.assertEqual(sum(int(outcome["sent"]) for outcome in outcomes), 1)
            state = json.loads(config.outbox_path.read_text(encoding="utf-8"))
            active = [
                item
                for item in state["items"]
                if item["status"] in {"pending", "retrying", "publishing"}
            ]
            self.assertEqual(active, [])
            published = next(event for event in state["audit"] if event["event"] == "envelope_published")
            self.assertTrue(published["replayed"])

    def test_downstream_rejection_dead_letters_until_explicit_audited_recovery(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = fixture_config(Path(directory), max_operator_recoveries=1)
            clock = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
            calls = 0

            def reject(_url: str, _body: bytes, _headers: dict[str, str], _timeout: int) -> tuple[int, bytes]:
                nonlocal calls
                calls += 1
                return 400, b'{"error":{"code":"SOURCE_ARTIFACT_INVALID"}}'

            outcome = run_after_successful_discovery(config, now=lambda: clock, post=reject)
            self.assertEqual(outcome["dead_letter"], 1)
            state = json.loads(config.outbox_path.read_text(encoding="utf-8"))
            item = state["items"][0]
            rejected_id = item["artifactId"]
            records = json.loads(item["rawBody"])["records"]
            digest = item["semanticDigest"]

            run_after_successful_discovery(config, now=lambda: clock, post=reject)
            self.assertEqual(calls, 1)
            clock += timedelta(seconds=1)
            recovered = recover_dead_letter_file(
                config,
                semantic_digest=digest,
                operator="marc.rene",
                reason="The rejected schema was reviewed and corrected upstream.",
                now=lambda: clock,
            )
            self.assertNotEqual(recovered["artifactId"], rejected_id)

            accepted = run_after_successful_discovery(
                config,
                now=lambda: clock,
                post=lambda *_: (201, b'{"ok":true}'),
            )
            self.assertEqual(accepted["sent"], 1)
            state = json.loads(config.outbox_path.read_text(encoding="utf-8"))
            self.assertEqual(json.loads(state["items"][0]["rawBody"])["records"], records)
            recovery = next(event for event in state["audit"] if event["event"] == "dead_letter_recovered")
            self.assertEqual(recovery["operator"], "marc.rene")

    def test_stale_rejections_exhaust_reissue_budget_without_infinite_retry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = fixture_config(Path(directory), max_reissues=1)
            clock = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
            requests: list[bytes] = []

            def stale(_url: str, body: bytes, _headers: dict[str, str], _timeout: int) -> tuple[int, bytes]:
                requests.append(body)
                return 400, b'{"error":{"code":"SOURCE_ARTIFACT_STALE"}}'

            first = run_after_successful_discovery(config, now=lambda: clock, post=stale)
            self.assertEqual(first["reissued"], 1)
            clock += timedelta(seconds=61)
            second = run_after_successful_discovery(config, now=lambda: clock, post=stale)
            self.assertEqual(second["dead_letter"], 1)
            third = run_after_successful_discovery(config, now=lambda: clock, post=stale)
            self.assertEqual(third["dead_letter"], 1)
            self.assertEqual(len(requests), 2)
            self.assertNotEqual(json.loads(requests[0])["artifactId"], json.loads(requests[1])["artifactId"])
            self.assertNotEqual(json.loads(requests[0])["generatedAt"], json.loads(requests[1])["generatedAt"])
            self.assertEqual(json.loads(requests[0])["records"], json.loads(requests[1])["records"])


def fixture_config(
    root: Path,
    *,
    max_reissues: int = 3,
    max_operator_recoveries: int = 3,
) -> Config:
    contacts = root / "dj_contacts.csv"
    with contacts.open("w", newline="", encoding="utf-8") as handle:
        fields = [
            "artist_name",
            "full_name",
            "website_url",
            "source_url",
            "contact_source_url",
            "music_submission_email",
            "genres",
            "active_evidence",
            "verification_status",
            "verification_timestamp",
            "confidence_score",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerow(
            {
                "artist_name": "DJ Example",
                "full_name": "DJ Example",
                "website_url": "https://dj.example/",
                "source_url": "https://dj.example/submissions",
                "contact_source_url": "https://dj.example/submissions",
                "music_submission_email": "music@dj.example",
                "genres": "dance,electronic",
                "active_evidence": "The current page explicitly invites unreleased music by email.",
                "verification_status": "verified",
                "verification_timestamp": "2026-07-15T10:00:00Z",
                "confidence_score": "92",
            }
        )
    return Config(
        True,
        "https://outreach.example",
        KEY_ID,
        "dj-source-secret-with-more-than-32-characters",
        contacts,
        root / "outbox.json",
        10,
        4,
        max_reissues,
        max_operator_recoveries,
        23 * 60 * 60,
    )


if __name__ == "__main__":
    unittest.main()
