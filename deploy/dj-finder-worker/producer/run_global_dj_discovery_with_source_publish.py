"""In-process hook: discovery commit first, durable source publication second."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from source_artifact_publisher import load_config, run_after_successful_discovery


ROOT = Path(__file__).resolve().parents[1]
DISCOVERY_RUNNER = ROOT / "scripts" / "run_global_dj_discovery_once.py"


def main() -> int:
    discovery = subprocess.run([sys.executable, str(DISCOVERY_RUNNER), *sys.argv[1:]], cwd=ROOT, check=False)
    if discovery.returncode != 0:
        return discovery.returncode
    outcome = run_after_successful_discovery(load_config())
    print(json.dumps({"source_artifact_hook": outcome}, ensure_ascii=True))
    if outcome.get("enabled") and outcome.get("dead_letter"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
