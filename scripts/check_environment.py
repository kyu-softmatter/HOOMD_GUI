#!/usr/bin/env python3
"""Validate the local HOOMD GUI development environment."""

from __future__ import annotations

import importlib
import importlib.metadata
import platform
import sys
from types import ModuleType
from typing import Final

EXPECTED_PYTHON: Final = (3, 12)
REQUIRED_DISTRIBUTIONS: Final = (
    "numpy",
    "pydantic",
    "fastapi",
    "uvicorn",
    "httpx",
    "pytest",
    "ruff",
    "mypy",
    "hoomd-gui-core",
)


class EnvironmentCheckError(RuntimeError):
    """Report a required environment check failure."""


def distribution_version(distribution: str) -> str:
    """Return an installed distribution version or raise a clear error."""
    try:
        return importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError as error:
        raise EnvironmentCheckError(
            f"Required distribution '{distribution}' is not installed."
        ) from error


def import_required_module(module_name: str) -> ModuleType:
    """Import a required module or raise a concise environment error."""
    try:
        return importlib.import_module(module_name)
    except ImportError as error:
        message = f"Required module '{module_name}' cannot be imported."
        raise EnvironmentCheckError(message) from error


def check_python() -> None:
    """Validate and report the Python runtime."""
    current = sys.version_info[:2]
    print(f"Python: {platform.python_version()}")
    if current != EXPECTED_PYTHON:
        expected = ".".join(str(part) for part in EXPECTED_PYTHON)
        actual = ".".join(str(part) for part in current)
        raise EnvironmentCheckError(f"Python {expected} is required; found Python {actual}.")


def check_platform() -> None:
    """Report the operating system and CPU architecture."""
    print(f"Platform: {platform.system()} {platform.machine()}")


def check_distributions() -> None:
    """Report versions for required distributions."""
    print("Installed distributions:")
    for distribution in REQUIRED_DISTRIBUTIONS:
        print(f"  {distribution}: {distribution_version(distribution)}")


def check_project_package() -> None:
    """Verify that the project core package is importable."""
    project_core = import_required_module("hoomd_gui_core")
    version = getattr(project_core, "__version__", "unknown")
    print(f"Project core import: available ({version})")


def check_hoomd_devices() -> None:
    """Create a required CPU simulation and probe optional GPU support."""
    hoomd = import_required_module("hoomd")
    print(f"HOOMD-blue: {hoomd.version.version}")

    try:
        cpu_device = hoomd.device.CPU(notice_level=0)
        hoomd.Simulation(device=cpu_device, seed=1)
    except Exception as error:
        raise EnvironmentCheckError("Unable to create a HOOMD-blue CPU Simulation.") from error
    print("HOOMD-blue CPU Simulation: available")

    try:
        hoomd.device.GPU(notice_level=0)
    except Exception:
        print("HOOMD-blue GPU device: unavailable (optional)")
    else:
        print("HOOMD-blue GPU device: available")


def main() -> int:
    """Run all environment checks and return a process exit code."""
    print("HOOMD GUI environment check")
    try:
        check_python()
        check_platform()
        check_distributions()
        check_project_package()
        check_hoomd_devices()
    except EnvironmentCheckError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        print("Environment check: FAILED", file=sys.stderr)
        return 1

    print("Environment check: PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
