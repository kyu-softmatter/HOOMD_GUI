from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

MARKER_PATTERN = re.compile(r"<!-- plan\.ko\.md sha256: [0-9a-f]{64} -->")


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Record that plan.md was reviewed against plan.ko.md."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirm that the public English plan matches the local Korean plan.",
    )
    return parser.parse_args()


def main() -> int:
    """Update the synchronization marker after an explicit review."""
    arguments = parse_arguments()
    if not arguments.confirm:
        print("No change made. Review both plans and pass --confirm.")
        return 2

    root = Path(__file__).resolve().parents[1]
    local_plan = root / "plan.ko.md"
    public_plan = root / "plan.md"

    if not local_plan.exists():
        print("ERROR: plan.ko.md is missing.")
        return 1
    if not public_plan.exists():
        print("ERROR: plan.md is missing.")
        return 1

    digest = hashlib.sha256(local_plan.read_bytes()).hexdigest()
    new_marker = f"<!-- plan.ko.md sha256: {digest} -->"
    public_text = public_plan.read_text(encoding="utf-8")

    if MARKER_PATTERN.search(public_text) is None:
        print("ERROR: plan.md does not contain a synchronization marker.")
        return 1

    updated_text = MARKER_PATTERN.sub(new_marker, public_text, count=1)
    public_plan.write_text(updated_text, encoding="utf-8")
    print("Recorded the reviewed plan.ko.md digest in plan.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
