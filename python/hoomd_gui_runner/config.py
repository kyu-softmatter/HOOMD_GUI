"""Configuration for the Local Runner service."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787

#: Host header values accepted by the runner. A loopback bind alone does not
#: stop DNS rebinding, because a public hostname can resolve to 127.0.0.1.
DEFAULT_ALLOWED_HOSTS: frozenset[str] = frozenset(
    {
        "127.0.0.1",
        "localhost",
        "[::1]",
        "::1",
    }
)


def default_web_root() -> Path:
    """Return the repository ``web`` directory that holds the static interface."""
    return Path(__file__).resolve().parents[2] / "web"


@dataclass(frozen=True)
class RunnerSettings:
    """Immutable settings for a Local Runner instance.

    The runner binds to a loopback address by default so that a simulation
    workstation is never exposed to the local network without an explicit
    decision by the user.
    """

    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    web_root: Path = field(default_factory=default_web_root)
    allowed_hosts: frozenset[str] = DEFAULT_ALLOWED_HOSTS

    def __post_init__(self) -> None:
        if not 1 <= self.port <= 65535:
            message = f"Port must be between 1 and 65535, received {self.port}."
            raise ValueError(message)

    @property
    def binds_to_loopback(self) -> bool:
        """Return whether the configured host is a loopback address."""
        return self.host in {"127.0.0.1", "::1", "localhost"}

    @property
    def base_url(self) -> str:
        """Return the address a browser should open for this runner."""
        host = f"[{self.host}]" if ":" in self.host else self.host
        return f"http://{host}:{self.port}"
