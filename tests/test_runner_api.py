"""Verify the Local Runner API surface and its loopback protections."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from hoomd_gui_runner.app import create_app
from hoomd_gui_runner.config import RunnerSettings, default_web_root

LOOPBACK_BASE_URL = "http://127.0.0.1:8787"


@pytest.fixture(name="client")
def fixture_client() -> TestClient:
    """Return a client that addresses the runner through a loopback host."""
    return TestClient(create_app(RunnerSettings()), base_url=LOOPBACK_BASE_URL)


def test_health_reports_ok(client: TestClient) -> None:
    """The health endpoint confirms the runner is reachable."""
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "hoomd-gui-runner"
    assert "health" in payload["capabilities"]


def test_version_reports_core_and_hoomd(client: TestClient) -> None:
    """The version endpoint reports package versions and device availability."""
    response = client.get("/api/version")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runner"] == "0.1.0"
    assert payload["core"] == "0.1.0"
    assert payload["hoomd"] == "7.1.0"
    assert payload["devices"]["cpu"] is True


def test_web_interface_is_served_at_the_root(client: TestClient) -> None:
    """The runner serves the editor from the same origin as the API."""
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "HOOMD GUI" in response.text


def test_requests_from_an_unknown_host_are_rejected() -> None:
    """A non-loopback Host header is refused, which blocks DNS rebinding."""
    client = TestClient(create_app(RunnerSettings()), base_url="http://attacker.example")

    response = client.get("/api/health")

    assert response.status_code == 421
    assert response.json()["code"] == "host_not_allowed"


def test_no_cors_headers_are_emitted(client: TestClient) -> None:
    """Same-origin delivery means no other web origin may read the API."""
    response = client.get("/api/health", headers={"origin": "https://example.com"})

    assert "access-control-allow-origin" not in {key.lower() for key in response.headers}


def test_api_only_mode_when_the_web_root_is_missing(tmp_path: Path) -> None:
    """A missing interface directory leaves the API usable."""
    settings = RunnerSettings(web_root=tmp_path / "absent")
    client = TestClient(create_app(settings), base_url=LOOPBACK_BASE_URL)

    assert client.get("/api/health").status_code == 200
    assert client.get("/").status_code == 404


def test_settings_reject_an_out_of_range_port() -> None:
    """An invalid port is refused before the server starts."""
    with pytest.raises(ValueError, match="Port must be between 1 and 65535"):
        RunnerSettings(port=0)


def test_settings_expose_the_browser_address() -> None:
    """The runner reports the address a user should open."""
    settings = RunnerSettings()

    assert settings.base_url == "http://127.0.0.1:8787"
    assert settings.binds_to_loopback is True


def test_default_web_root_contains_the_interface() -> None:
    """The packaged default points at the checked-in web interface."""
    assert (default_web_root() / "index.html").is_file()
