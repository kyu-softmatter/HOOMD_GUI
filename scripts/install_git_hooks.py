from __future__ import annotations

import subprocess
from pathlib import Path


def main() -> int:
    """Configure Git to use the repository-managed hooks."""
    root = Path(__file__).resolve().parents[1]
    subprocess.run(
        ["git", "config", "core.hooksPath", ".githooks"],
        cwd=root,
        check=True,
    )
    print("Configured Git to use hooks from .githooks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
