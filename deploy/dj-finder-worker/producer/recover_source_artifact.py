"""Explicit, audited dead-letter recovery for the DJ source outbox."""

from __future__ import annotations

import json
import os
import re

from source_artifact_publisher import load_config, recover_dead_letter_file


def main() -> int:
    semantic_digest = os.environ.get("OUTREACH_SOURCE_RECOVERY_DIGEST", "").strip()
    operator = os.environ.get("OUTREACH_SOURCE_RECOVERY_OPERATOR", "").strip()
    reason = os.environ.get("OUTREACH_SOURCE_RECOVERY_REASON", "").strip()
    if not re.fullmatch(r"[a-f0-9]{64}", semantic_digest):
        raise ValueError("OUTREACH_SOURCE_RECOVERY_DIGEST must be a lowercase 64-character semantic digest")
    result = recover_dead_letter_file(
        load_config(),
        semantic_digest=semantic_digest,
        operator=operator,
        reason=reason,
    )
    print(json.dumps({"recovered": True, **result}, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
