"""Verify the initial development environment and package skeleton."""

from __future__ import annotations

import sys

import hoomd

from hoomd_gui_core import __version__


def test_python_version_is_3_12() -> None:
    """The locked environment uses the supported Python minor version."""
    assert sys.version_info[:2] == (3, 12)


def test_project_package_is_importable() -> None:
    """The editable scientific-core package exposes its version."""
    assert __version__ == "0.1.0"


def test_cpu_simulation_can_be_created() -> None:
    """The environment can construct the first required HOOMD object."""
    device = hoomd.device.CPU(notice_level=0)
    simulation = hoomd.Simulation(device=device, seed=1)

    assert simulation.device is device
