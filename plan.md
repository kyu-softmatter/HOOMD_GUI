# HOOMD GUI Implementation Plan

> This public plan defines the initial implementation sequence for a web-based HOOMD-blue interface that executes simulations on the user's computer.

## 0. Project Conventions

The project will use English consistently in all implementation artifacts.

- All source code must be written in English.
- File, module, class, function, variable, and API field names must be English.
- All code comments and docstrings must be English.
- Error messages, log messages, test names, and assertion messages must be English.
- Default UI copy and accessibility labels must be English.
- Developer documentation and commit messages must be English.
- Generated HOOMD-blue scripts and comments must be English.
- Translations may be added as separate user-facing resources later.

Example:

```python
def calculate_pair_force(distance: float) -> float:
    """Return the radial force at the given distance."""
    return 0.0
```

## 1. Product Architecture

The application will use a local-first hybrid architecture.

```text
Public Web Demo
      |
      | Project JSON and connection status
      v
Local Runner on 127.0.0.1
      |
      |- Python core
      |- Validation and code generation
      |- HOOMD-blue CPU/GPU execution
      `- Local GSD and log files
```

The public website will provide the interface, documentation, examples, and an installation path. Real simulations will execute on the user's computer through a small local Python service.

### 1.1 Public Demo Mode

The public website must work without installing Python or HOOMD-blue.

It will provide:

- A two-dimensional particle editor.
- Built-in example projects.
- An interaction editor and potential preview.
- Browser-side validation for basic input errors.
- Generated-code previews.
- Clearly labeled illustrative motion and sample trajectories.
- Project JSON import and export.
- Local Runner installation and connection instructions.

The public demo must never represent illustrative motion as a real simulation result.

### 1.2 Local Simulation Mode

The Local Runner will provide:

- Authoritative project validation.
- HOOMD-blue code generation.
- CPU/GPU capability detection.
- Isolated simulation processes.
- Progress and thermodynamic data streaming.
- Local GSD, checkpoint, and log storage.
- Trajectory access for the web viewer.

The initial implementation should let the Local Runner serve the same web UI at a loopback address. This same-origin design avoids unnecessary browser permission and CORS complexity. Direct connections from the public website can be added later with explicit pairing and origin controls.

## 2. Development Environment

The first implementation task is to create a reproducible Python environment before building the web interface.

### 2.1 Environment Choice

- Environment manager: Pixi
- Initial Python candidate: Python 3.12
- Initial HOOMD-blue target: 7.1.2
- Package source: conda-forge
- First platform: macOS ARM64 CPU
- GPU environments: separate profiles after the CPU workflow is stable
- Python package metadata: `pyproject.toml`

HOOMD-blue and its native dependencies should be installed through conda-forge rather than relying on a plain `python -m venv` workflow.

Official installation reference:

- <https://hoomd-blue.readthedocs.io/en/latest/installation.html>

### 2.2 Initial Dependencies

Runtime:

- `python`
- `hoomd`
- `numpy`
- `pydantic`
- `fastapi`
- `uvicorn`

Development:

- `pytest`
- `ruff`
- `mypy`
- `httpx`

Frontend build tools are not required for the initial static demonstration.

### 2.3 Environment Deliverables

```text
HOOMD_GUI/
|- pixi.toml
|- pixi.lock
|- pyproject.toml
|- .gitignore
|- scripts/
|  `- check_environment.py
|- python/
|  `- hoomd_gui_core/
|     `- __init__.py
`- tests/
   `- test_environment.py
```

`scripts/check_environment.py` should report:

- Python version.
- Operating system and CPU architecture.
- HOOMD-blue version.
- CPU/GPU device availability.
- Core dependency versions.
- Import status for the project package.

The script must not dump complete environment variables or sensitive paths.

### 2.4 Environment Acceptance Criteria

- A new checkout can create the environment with one documented command.
- The lockfile is committed.
- `import hoomd` succeeds.
- A CPU `Simulation` object can be created.
- Pytest, Ruff, and Mypy run successfully.
- Environment failures produce clear English messages.

## 3. Python Core and Project Schema

The Python core will be independent of the browser and API layers.

### 3.1 Initial Package Structure

```text
python/hoomd_gui_core/
|- __init__.py
|- models/
|  |- project.py
|  |- box.py
|  |- particle.py
|  |- interaction.py
|  `- run.py
|- validation/
|  |- issues.py
|  `- project_validator.py
|- interactions/
|  |- builtins.py
|  |- expressions.py
|  `- tables.py
|- compiler/
|  `- hoomd_script.py
|- geometry/
|  `- generators.py
`- serialization/
   `- project_json.py
```

### 3.2 Initial Project Model

The first schema will include:

- Project name and schema version.
- A two-dimensional simulation box.
- Particle types.
- Circular particle positions and diameters.
- Display layers.
- Type-pair interactions.
- Simulation mode.
- `dt`, `kT`, step count, and random seed.
- Device preference.
- Trajectory and log periods.

### 3.3 Core Design Rules

- The scientific project model is the source of truth.
- Pydantic models provide a versioned JSON schema.
- Every saved project includes a schema version.
- Serialization is deterministic.
- HOOMD-blue objects are never stored directly in project files.
- The Python core does not import browser, UI, or FastAPI modules.
- UI-only properties are kept separate from physical properties.

### 3.4 Core Acceptance Criteria

- Example projects round-trip between Python objects and JSON.
- Invalid box, particle, interaction, and run values are rejected.
- Identical inputs produce identical serialized output.
- A minimal project generates a readable HOOMD-blue script.
- Models, validation, serialization, and code generation have tests.

## 4. Two-Dimensional Particle Editor

The first visual environment will be two-dimensional.

### 4.1 Technology

- HTML5
- CSS
- JavaScript ES modules
- Canvas 2D for the first viewport
- No mandatory Node.js or bundler
- Static-server and GitHub Pages compatibility

Three.js may be introduced later when three-dimensional editing becomes a real requirement.

### 4.2 Initial Viewport Features

- A rectangular simulation box.
- Simulation-to-screen coordinate conversion.
- Grid, zoom, and pan.
- Add circular particles by clicking.
- Select, drag, duplicate, and delete particles.
- Multi-selection.
- Direct coordinate input.
- Overlap and out-of-bounds highlighting.
- Undo and redo.
- Optional periodic-image preview.

All particle positions must be stored in simulation coordinates, not screen pixels.

### 4.3 Initial Layout

```text
+---------------------------------------------------------------+
| Project | Add Particle | Interactions | Preview Code | Export |
+-------------+----------------------------+--------------------+
| Scene Tree  | Simulation View            | Inspector          |
| Box         |                            | Transform          |
| Particles   |                            | Type / Diameter    |
| Layers      |                            | Box / Run Settings |
+-------------+----------------------------+--------------------+
| Potential Preview | Timeline | Validation Messages            |
+---------------------------------------------------------------+
```

## 5. Particle Types and Properties

The initial model will use type-level physical properties.

Example:

| Type | Diameter | Mass | Display Color |
| --- | ---: | ---: | --- |
| A | 1.0 | 1.0 | Blue |
| B | 1.5 | 2.0 | Orange |

The application must distinguish:

- Display radius.
- Hard-particle diameter.
- Pair-potential length scale such as `sigma`.

Initial properties:

- Stable particle ID.
- Particle type.
- Position.
- Diameter defined by type.
- Mass defined by type for MD.
- Display color and visibility.
- Fixed or mobile state.
- Display layer.

Per-particle physical overrides will be considered after the type-based compiler is stable.

## 6. Simulation Modes

Hard and soft particles must not be presented as interchangeable potential choices. They use different simulation algorithms.

### 6.1 Hard Disk Mode

- Backend: HPMC Sphere integrator in a 2D box.
- Physical object: hard disk.
- Primary parameters: type diameter, trial move size, move count, and random seed.
- Overlap is forbidden.
- There is no continuous force curve for the hard core.

### 6.2 Soft Disk Mode

- Backend: molecular dynamics.
- Primary parameters: mass, timestep, thermostat, temperature, and pair potential.
- Continuous potential energy and force curves are available.
- The first interaction should be a simple repulsive or Lennard-Jones model.

Soft Disk MD is the recommended first executable backend because it exercises the interaction editor, parameter validation, code generator, timestep settings, and result logging. Hard Disk HPMC should follow as a separate mode.

## 7. Interaction Editor

Interactions will be assigned through a symmetric particle-type matrix.

```text
          A                B
A         Soft Repulsion   Lennard-Jones
B         Lennard-Jones    None
```

Initial interaction choices:

1. None
2. Soft repulsion
3. Lennard-Jones
4. Hard disk in HPMC mode
5. Custom `U(r)` in a later milestone

The editor will expose potential-specific fields such as:

- `epsilon`
- `sigma`
- `r_cut`
- shift or smoothing mode
- potential curve
- force curve

Every required type pair must be complete before execution.

## 8. Particle Generators

In addition to manual placement, the editor will provide:

- Single-particle placement.
- Rectangular lattice generation.
- Uniform random placement.
- Type ratios.
- Particle spacing.
- Minimum-distance constraints.
- Random seed.
- Clear and regenerate actions.

The random seed must be saved to make initial configurations reproducible.

## 9. Run Parameters and Validation

### 9.1 Molecular Dynamics Parameters

- `dt`
- `kT`
- Total steps
- Computed simulated time
- Thermostat
- Random seed
- CPU/GPU preference
- Trajectory period
- Log period

### 9.2 Hard Particle Parameters

- Translation move size
- Trial moves per timestep
- `kT`
- Total steps
- Random seed
- Overlap count

MD time and Monte Carlo timesteps must be labeled as different concepts.

### 9.3 Preflight Validation

- Particle overlaps.
- Particles outside the box.
- Invalid diameter or mass.
- Missing type-pair interactions.
- Invalid cutoff values.
- Suspicious MD timesteps.
- Empty systems.
- Unsupported combinations of simulation mode and interaction.
- Estimated particle count, output size, and runtime limits.

Validation messages must point to the relevant particle or control.

## 10. Local Runner and API

The Local Runner will bind only to a loopback address.

```text
http://127.0.0.1:8787
```

Initial endpoints:

```text
GET    /api/health
GET    /api/version
GET    /api/schema
POST   /api/projects/validate
POST   /api/projects/compile
POST   /api/interactions/preview
POST   /api/runs
GET    /api/runs/{run_id}
DELETE /api/runs/{run_id}
WS     /api/runs/{run_id}/events
```

### 10.1 Security Requirements

- Bind to `127.0.0.1`, never `0.0.0.0` by default.
- Use explicit allowed origins.
- Do not use wildcard CORS for authenticated requests.
- Require a short-lived pairing token.
- Authenticate WebSocket connections.
- Accept project JSON, not arbitrary Python code.
- Generate executable code only inside the trusted local core.
- Require confirmation before starting a simulation.
- Use a separate output directory for every run.
- Limit particle count, step count, wall time, and output size.
- Keep project and result files local unless the user explicitly uploads them.

## 11. HOOMD-blue Execution

The first real run will support:

- Circular particles in a 2D orthorhombic box.
- Soft Disk MD.
- One built-in pair potential.
- Constant-volume thermostatted integration.
- CPU execution.
- GSD trajectories.
- Basic thermodynamic logging.
- Run cancellation and checkpoints.

### 11.1 Execution Acceptance Criteria

- A browser project can launch a real local HOOMD-blue run.
- Progress, timestep, temperature, and energy are visible.
- The web server remains responsive during the run.
- The result trajectory can be replayed.
- Failed runs produce clear English error messages.

## 12. Custom Interactions

Custom interactions will be added after one built-in soft interaction is fully validated.

The first version will support:

- A restricted expression language for `U(r)`.
- A documented allowlist of variables and functions.
- Calculation of `F(r) = -dU/dr`.
- `r_min`, `r_cut`, and table resolution.
- Potential and force previews.
- HOOMD table generation.
- Two-particle reference tests.

Validation will include:

- `NaN` and infinity detection.
- Singularity warnings.
- Cutoff continuity checks.
- Supplied-force versus numerical-derivative comparison.
- Dimensional consistency.
- Type-pair parameter completeness.

Later extensions may include table import, custom bonded interactions, anisotropic interactions, Python custom forces, and compiled CPU/GPU plugins.

Executable custom Python or native plugins must never run without explicit user approval.

## 13. Testing and Quality

Python tests:

- Model and serializer tests.
- Validator tests.
- Generated-code golden tests.
- Two-particle energy and force comparisons.
- API integration tests.
- Worker cancellation and timeout tests.

Web tests:

- Project-store tests.
- JSON import/export tests.
- Primary user-flow browser tests.
- Responsive-layout checks.
- Keyboard-accessibility checks.
- API-unavailable fallback tests.

Every new feature must include appropriate automated tests. Lint, type checking, and tests must pass before a milestone is complete.

## 14. Deployment Sequence

1. Publish the static demonstration.
2. Validate the Python core as a local CLI.
3. Serve the web UI and API from the Local Runner.
4. Add optional pairing from the public website.
5. Consider a resource-limited public Python backend only after local execution is stable.
6. Add GPU and remote HPC features after the local CPU workflow is reliable.

## 15. First Public Demo Acceptance Scenario

A visitor should be able to:

1. Open the project from a URL without installing software.
2. Create a two-dimensional simulation box.
3. Add and move circular particles.
4. Create particle types A and B.
5. Set type colors, diameters, and masses.
6. Configure A-A, A-B, and B-B interactions.
7. Inspect potential and force curves.
8. Set temperature, timestep, and step count.
9. Resolve overlap and configuration warnings.
10. Preview the generated HOOMD-blue script.
11. Export the project JSON.
12. Play a clearly labeled illustrative trajectory.

## 16. Immediate Next Milestone

The next implementation session will complete only the development-environment milestone.

1. Check Pixi availability.
2. Create `pixi.toml`.
3. Resolve and lock a HOOMD-blue 7.1.2 CPU environment.
4. Create `pyproject.toml` and the Python package skeleton.
5. Expand `.gitignore` for generated environment and runtime files.
6. Add `scripts/check_environment.py`.
7. Configure minimal Pytest, Ruff, and Mypy checks.
8. Verify installation and imports.
9. Document setup commands in `readme.md`.
10. Commit and push the verified environment.

Web UI implementation will not begin until this milestone passes.
