"""Local Runner service that serves the HOOMD GUI web interface and API.

This package is the only place allowed to depend on the web framework. The
scientific core in :mod:`hoomd_gui_core` must stay free of API imports.
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
