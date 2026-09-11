"""Command line entry point for the Local Runner.

Usage:
    python -m hoomd_gui_runner [--host HOST] [--port PORT] [--web-root PATH]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import uvicorn

from hoomd_gui_runner.app import create_app
from hoomd_gui_runner.config import DEFAULT_HOST, DEFAULT_PORT, RunnerSettings, default_web_root


def build_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the runner command."""
    parser = argparse.ArgumentParser(
        prog="hoomd-gui-runner",
        description="Serve the HOOMD GUI web interface and local API.",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Interface to bind. Defaults to {DEFAULT_HOST}.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to bind. Defaults to {DEFAULT_PORT}.",
    )
    parser.add_argument(
        "--web-root",
        type=Path,
        default=None,
        help="Directory holding the static web interface.",
    )
    parser.add_argument(
        "--log-level",
        default="info",
        choices=("critical", "error", "warning", "info", "debug", "trace"),
        help="Uvicorn log level. Defaults to info.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Start the Local Runner and return a process exit code."""
    arguments = build_parser().parse_args(argv)

    try:
        settings = RunnerSettings(
            host=arguments.host,
            port=arguments.port,
            web_root=arguments.web_root or default_web_root(),
        )
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    if not settings.binds_to_loopback:
        print(
            f"Warning: binding to {settings.host} exposes the runner beyond this computer. "
            "The Local Runner is designed for loopback use only.",
            file=sys.stderr,
        )

    if not settings.web_root.is_dir():
        print(
            f"Error: web interface directory not found at {settings.web_root}.",
            file=sys.stderr,
        )
        return 2

    print(f"HOOMD GUI Local Runner is starting at {settings.base_url}")
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        log_level=arguments.log_level,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
