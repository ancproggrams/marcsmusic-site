import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from crawler import (
    Config,
    FetchResult,
    PageParser,
    Source,
    build_records,
    canonical_url,
    classify_context,
    load_sources,
    park_legacy_contact_items,
    request_signature,
)


class CrawlerContractTests(unittest.TestCase):
    def test_registry_contains_all_sources(self):
        sources = load_sources(Path(__file__).with_name("sources.json"), 100)
        self.assertEqual(len(sources), 27)
        self.assertEqual(len({source.name for source in sources}), 27)

    def test_only_explicit_purpose_is_accepted(self):
        self.assertEqual(classify_context("Music submissions: email demos here"), "Explicit Music Submission")
        self.assertEqual(classify_context("Press contact and media enquiries"), "Press Contact")
        self.assertEqual(classify_context("Promo email for promotional submissions"), "Promo Contact")
        self.assertIsNone(classify_context("General contact: info@example.test"))
        self.assertIsNone(classify_context("We do not accept music submissions"))

    def test_page_extracts_labelled_email_and_holds_generic_email(self):
        parser = PageParser()
        parser.feed("<h1>Demo submissions</h1><a href='mailto:demo@example.com'>Music submission email</a><p>info@example.com</p>")
        records, stats = build_records(
            Source("Test Radio", "curated_radio", "https://radio.example", "https://radio.example/contact"),
            [(FetchResult("https://radio.example/contact", "https://radio.example/contact", 200, parser.text, "text/html"), parser)],
            "2026-07-17T00:00:00Z",
        )
        self.assertEqual(stats["accepted"], 1)
        contacts = [record for record in records if record["kind"] == "mediaContact"]
        self.assertEqual(len(contacts), 1)
        self.assertTrue(records[0]["verified"])
        self.assertTrue(contacts[0]["verified"])
        self.assertEqual(contacts[0]["firstName"], "Test Radio")
        self.assertEqual(contacts[0]["lastName"], "Team")

    def test_legacy_contact_artifacts_are_parked(self):
        state = {
            "items": [{
                "status": "retrying",
                "rawBody": json.dumps({"records": [{"kind": "mediaContact"}]})
            }]
        }
        self.assertEqual(park_legacy_contact_items(state), 1)
        self.assertEqual(state["items"][0]["status"], "dead_letter")
        self.assertEqual(state["items"][0]["errorCode"], "SOURCE_CONTACT_PERSON_NAME_FIELDS_MISSING")

    def test_https_url_rejects_credentials_and_non_https(self):
        with self.assertRaises(ValueError):
            canonical_url("http://example.com")
        with self.assertRaises(ValueError):
            canonical_url("https://user:pass@example.com")

    def test_signature_is_deterministic(self):
        first = request_signature("dj-finder", "kid", "1", "nonce", b"{}", "a" * 32)
        second = request_signature("dj-finder", "kid", "1", "nonce", b"{}", "a" * 32)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 64)


if __name__ == "__main__":
    unittest.main()
