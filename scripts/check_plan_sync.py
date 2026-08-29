from __future__ import annotations

import hashlib
import re
import subprocess
import sys
from pathlib import Path


MARKER_PATTERN = re.compile(
    r"<!-- plan\.ko\.md sha256: ([0-9a-f]{64}) -->"
)


def calculate_digest(path: Path) -> str:
    """Return the SHA-256 digest for a file."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_git(root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    """Run a Git command without raising on a nonzero exit status."""
    return subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        check=False,
        text=True,
    )


def main() -> int:
    """Check whether the private Korean plan matches the public sync marker."""
    root = Path(__file__).resolve().parents[1]
    local_plan = root / "plan.ko.md"
    public_plan = root / "plan.md"

    if not public_plan.exists():
        print("ERROR: plan.md is missing.", file=sys.stderr)
        return 1

    if not local_plan.exists():
        print("plan.ko.md is not present; skipping the local plan sync check.")
        return 0

    tracked = run_git(root, "ls-files", "--error-unmatch", local_plan.name)
    if tracked.returncode == 0:
        print("ERROR: plan.ko.md must not be tracked by Git.", file=sys.stderr)
        return 1

    ignored = run_git(root, "check-ignore", "-q", local_plan.name)
    if ignored.returncode != 0:
        print("ERROR: plan.ko.md must be listed in .gitignore.", file=sys.stderr)
        return 1

    public_text = public_plan.read_text(encoding="utf-8")
    marker = MARKER_PATTERN.search(public_text)
    if marker is None:
        print(
            "ERROR: plan.md does not contain a plan.ko.md SHA-256 marker.",
            file=sys.stderr,
        )
        return 1

    actual_digest = calculate_digest(local_plan)
    recorded_digest = marker.group(1)
    if actual_digest != recorded_digest:
        print("ERROR: plan.ko.md and plan.md are not marked as synchronized.")
        print("Update plan.md to reflect the Korean plan, then run:")
        print("  python3 scripts/record_plan_sync.py --confirm")
        return 1

    print("The local Korean plan and public English plan are synchronized.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
