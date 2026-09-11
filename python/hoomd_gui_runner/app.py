"""FastAPI application for the Local Runner.

The runner serves the web interface and the local API from the same loopback
origin. Same-origin delivery keeps the browser security model simple: no CORS
headers are emitted, so no other web origin can call this API.
"""

from __future__ import annotations

import platform
import sys
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.base import RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from hoomd_gui_core import __version__ as core_version
from hoomd_gui_runner import __version__ as runner_version
from hoomd_gui_runner.config import RunnerSettings

#: Feature names the interface may rely on. The web client uses this list to
#: decide which panels can leave static demo mode.
IMPLEMENTED_CAPABILITIES: tuple[str, ...] = ("health", "version")


class HealthResponse(BaseModel):
    """Liveness payload polled by the web interface."""

    status: Literal["ok"] = "ok"
    service: Literal["hoomd-gui-runner"] = "hoomd-gui-runner"
    version: str = Field(description="Local Runner package version.")
    capabilities: list[str] = Field(description="API features this runner implements.")


class DeviceAvailability(BaseModel):
    """Execution devices HOOMD-blue can use on this machine."""

    cpu: bool = Field(description="Whether a CPU device can be created.")
    gpu: bool = Field(description="Whether a GPU device is available.")


class VersionResponse(BaseModel):
    """Version and capability report for the local installation."""

    runner: str = Field(description="Local Runner package version.")
    core: str = Field(description="Scientific core package version.")
    hoomd: str | None = Field(description="Installed HOOMD-blue version, if importable.")
    python: str = Field(description="Interpreter version running the runner.")
    platform: str = Field(description="Operating system and CPU architecture.")
    devices: DeviceAvailability


@lru_cache(maxsize=1)
def _hoomd_report() -> tuple[str | None, bool, bool]:
    """Return the HOOMD-blue version and device availability.

    The import is deferred and cached because loading HOOMD-blue is slow and
    the runner must start quickly even when the scientific stack is missing.
    """
    try:
        import hoomd
    except ImportError:
        return None, False, False

    try:
        gpu_available = bool(hoomd.device.GPU.is_available())
    except Exception:  # noqa: BLE001 - device probing must never break the API.
        gpu_available = False

    return str(hoomd.version.version), True, gpu_available


def _is_allowed_host(header_value: str | None, allowed_hosts: frozenset[str]) -> bool:
    """Return whether a request ``Host`` header targets this local runner.

    Binding to a loopback interface does not prevent DNS rebinding, because an
    attacker-controlled hostname can resolve to ``127.0.0.1``. Comparing the
    ``Host`` header against a fixed allowlist closes that path.
    """
    if header_value is None:
        return False

    host = header_value.strip()
    if host.startswith("["):
        closing_bracket = host.find("]")
        if closing_bracket == -1:
            return False
        host = host[: closing_bracket + 1]
    elif ":" in host:
        host = host.split(":", maxsplit=1)[0]

    return host in allowed_hosts


def create_app(settings: RunnerSettings | None = None) -> FastAPI:
    """Build the Local Runner application for the given settings."""
    active_settings = settings or RunnerSettings()

    app = FastAPI(
        title="HOOMD GUI Local Runner",
        description="Local API and web interface host for HOOMD-blue projects.",
        version=runner_version,
    )
    app.state.settings = active_settings

    @app.middleware("http")
    async def enforce_allowed_host(
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        """Reject requests whose ``Host`` header is not a known loopback name."""
        if not _is_allowed_host(request.headers.get("host"), active_settings.allowed_hosts):
            return JSONResponse(
                status_code=421,
                content={
                    "code": "host_not_allowed",
                    "message": "The Local Runner only answers requests addressed to localhost.",
                },
            )
        return await call_next(request)

    @app.get("/api/health", response_model=HealthResponse, tags=["status"])
    async def read_health() -> HealthResponse:
        """Report that the runner is reachable and which features it implements."""
        return HealthResponse(
            version=runner_version,
            capabilities=list(IMPLEMENTED_CAPABILITIES),
        )

    @app.get("/api/version", response_model=VersionResponse, tags=["status"])
    async def read_version() -> VersionResponse:
        """Report package versions and available execution devices."""
        hoomd_version, cpu_available, gpu_available = _hoomd_report()
        return VersionResponse(
            runner=runner_version,
            core=core_version,
            hoomd=hoomd_version,
            python=platform.python_version(),
            platform=f"{platform.system()} {platform.release()} {platform.machine()}",
            devices=DeviceAvailability(cpu=cpu_available, gpu=gpu_available),
        )

    web_root = active_settings.web_root
    if web_root.is_dir():
        app.mount("/", StaticFiles(directory=web_root, html=True), name="web")
    else:
        print(
            f"Warning: web interface directory not found at {web_root}. "
            "Only the API is being served.",
            file=sys.stderr,
        )

    return app
