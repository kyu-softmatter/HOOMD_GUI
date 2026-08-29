# HOOMD GUI

> [!IMPORTANT]
> **IDEA SKETCH / CONCEPT DOCUMENT**
>
> This repository presents an early product idea and technical design proposal. It does not contain a functional application yet, and all features, architecture choices, and roadmap items are subject to change.

> A CAD-inspired visual environment for building, running, and analyzing HOOMD-blue particle simulations.

## Project Status

This repository currently describes a product concept and implementation roadmap. The application has not been implemented yet.

The first planned deliverable is a lightweight public web demonstration that runs in a standard browser without installation. The scientific core will remain a reusable Python package and will be connected to the web interface through an API in a later milestone.

The initial compatibility target is HOOMD-blue 7.x. Each application release should pin and test an exact HOOMD-blue version so that generated scripts remain reproducible.

## Overview

HOOMD GUI is intended to make particle simulation setup feel closer to working in CAD software such as Rhino or SolidWorks. Instead of manually writing every HOOMD-blue Python script, a user should be able to:

- Create or import geometry in a visual scene.
- Position, rotate, scale, duplicate, and organize objects.
- Generate particles on surfaces, inside volumes, or on lattices.
- Assign particle types, physical roles, and named selections.
- Define pair interactions and bonded interactions through property panels.
- Configure the simulation box, dimensionality, temperature, pressure, timestep, and run length.
- Validate the model before consuming compute time.
- Run HOOMD-blue on a CPU or GPU.
- Inspect logs and play back trajectories inside the same application.
- Export the generated Python script and GSD files for reproducibility and expert customization.

HOOMD GUI is not intended to turn HOOMD-blue into a continuum finite-element solver. HOOMD-blue simulates particle systems, so imported CAD geometry must be converted into particles, analytic walls, rigid bodies, HPMC shapes, deformable meshes, or custom external fields before it can participate in a simulation.

## Product Vision

The application should provide two complementary experiences:

1. **Visual modeling for accessibility** — common simulations can be assembled without writing code.
2. **Transparent code generation for scientific control** — every project can produce a readable, executable HOOMD-blue Python script.

The GUI should never hide the physical model behind purely visual abstractions. Every scene object must clearly show how it will be represented by HOOMD-blue.

## Target Users

- Soft-matter and colloid researchers.
- Polymer and coarse-grained molecular simulation users.
- Active-matter researchers.
- Students learning particle simulation.
- Engineers exploring particle-based models.
- Existing HOOMD-blue users who want faster setup, inspection, and parameter management.

## Web-First Demonstration Strategy

The first product goal is not a complete simulation platform. It is a simple, shareable web demonstration that communicates the interaction model and allows potential users to understand the idea from a URL.

The project should provide two modes that use the same project schema:

### Static Demo Mode

Static Demo Mode should run entirely in the browser and be deployable to a static host such as GitHub Pages.

It should allow visitors to:

- Open the demo without installing Python or HOOMD-blue.
- Create a box and place a small number of particle objects.
- Move, rotate, duplicate, select, hide, and recolor objects.
- Create particle types and display layers.
- Edit basic box, temperature, timestep, and run-length fields.
- Configure a small built-in or custom `U(r)` interaction.
- Preview the potential and force curves.
- Inspect a generated HOOMD-blue Python script.
- Play a bundled sample trajectory or a lightweight illustrative animation.
- Download the project as JSON.

This mode does not execute HOOMD-blue. Its purpose is UI demonstration, model editing, code preview, and feedback collection.

### Python-Connected Mode

Python-Connected Mode should use the same HTML interface while connecting to a local or hosted Python service.

The Python core should provide:

- Authoritative project-schema validation.
- Geometry and particle generation.
- Custom-interaction parsing and table generation.
- HOOMD-blue Python code generation.
- Simulation worker management.
- GSD and log-file processing.
- Analysis utilities.

The browser should communicate with this service through a small versioned JSON API and WebSocket or server-sent events for run progress. Keeping these responsibilities in Python makes the scientific code independently testable and usable from the command line, notebooks, or a future desktop application.

HOOMD-blue should not be treated as a browser dependency. A real HOOMD run requires the Python-connected mode or an external execution service; the static demo should clearly label illustrative or prerecorded results.

## Intended Workflow

```text
Create or import geometry
          |
          v
Choose a physical representation
(particles, wall, rigid body, HPMC shape, or membrane)
          |
          v
Assign types, selections, and topology
          |
          v
Define interactions and simulation parameters
          |
          v
Validate the complete model
          |
          v
Generate Python + initial-state GSD
          |
          v
Run HOOMD-blue in an isolated worker process
          |
          v
Replay trajectories and analyze logged quantities
```

## Core Modeling Concepts

The application should keep visual organization separate from physical meaning.

| Concept | Purpose | Example |
| --- | --- | --- |
| Scene object | A transformable item in the viewport | Imported sphere, particle generator, wall |
| Display layer | Visibility, color, and editing organization | `Hidden Geometry`, `Solvent` |
| Particle type | A HOOMD particle type used by interactions | `A`, `B`, `wall_bead` |
| Named selection | A reusable group targeted by an operation | `mobile_particles`, `fixed_boundary` |
| Physical representation | How geometry is converted for HOOMD | Volume fill, fixed particles, analytic wall |
| Topology | Bonds, angles, dihedrals, constraints, and bodies | Polymer chain, rigid cluster |
| Run stage | One phase of a multi-stage simulation | Minimize, equilibrate, produce |

This distinction prevents a display layer from accidentally becoming a force-field definition and allows one particle type to appear in multiple scene objects.

## User Interface Concept

```text
+--------------------------------------------------------------------------------+
| File  Edit  Create  Import  Simulation  Run  Analyze                           |
+----------------------+--------------------------------------+------------------+
| Scene / Layer Tree   |                                      | Inspector        |
|                      |                                      |                  |
| Simulation Box       |            3D Viewport               | Transform        |
| Objects              |                                      | Representation   |
| Particle Types       |                                      | Particle Type    |
| Named Selections     |                                      | Interactions     |
| Run Stages           |                                      | Display          |
+----------------------+--------------------------------------+------------------+
| Timeline | Run Progress | Temperature | Energy | Pressure | Console             |
+--------------------------------------------------------------------------------+
```

### Viewport Tools

- Perspective and orthographic cameras.
- Front, top, side, and isometric views.
- Translate, rotate, and scale manipulators.
- Point, box, lasso, object, and type-based selection.
- Layer visibility and locking.
- Particle instancing for large systems.
- Simulation-box and periodic-image display.
- Slice planes and clipping boxes.
- Color by type, object, body, velocity, or scalar result.
- Initial-overlap and out-of-bounds visualization.

## Functional Requirements

### 1. Project and Schema System

The source of truth should be a versioned project document rather than generated Python code. A deterministic compiler should translate this document into HOOMD-blue input files.

Suggested top-level schema:

```text
Project
|- metadata
|- compatibility
|- unit_system
|- simulation_box
|- scene_objects
|- particle_types
|- named_selections
|- topology
|- custom_interaction_definitions
|- interactions
|- integration
|- run_stages
|- outputs
`- visualization
```

Schema migrations will be required when either the GUI project format or the supported HOOMD-blue API changes.

### 2. Geometry Creation

The first release should support procedural geometry that maps cleanly to particle simulations:

- Point and single-particle placement.
- Line, grid, and lattice generators.
- Rectangular and spherical particle regions.
- Plane, sphere, and cylinder wall primitives.
- Random packing with minimum-distance constraints.
- Surface sampling and volume filling.
- Array, mirror, and duplicate operations.

Later releases can add boolean geometry, curves, more lattice types, and CAD-assisted modeling tools.

### 3. Geometry Import and Conversion

Importing a file is only the first step. The user must choose how the geometry becomes a physical HOOMD model.

| Imported geometry use | Conversion strategy |
| --- | --- |
| Visual reference only | Render the mesh without adding simulation entities |
| Static obstacle | Sample the surface into fixed particles |
| Solid particle region | Fill the closed volume with particles |
| Moving solid | Build a rigid body from constituent particles |
| Individual hard shape | Convert to a supported HPMC polygon or polyhedron |
| Flexible membrane | Convert vertices and faces into a particle-based triangular mesh |
| Arbitrary smooth boundary | Generate a signed-distance field and apply a custom force |

Recommended import order:

1. OBJ and STL triangle meshes.
2. PLY and common point-cloud formats.
3. STEP/IGES through an OpenCascade-based conversion service.

The importer should detect scale, units, closed versus open meshes, non-manifold edges, inverted normals, and self-intersections.

### 4. Particle Generation

Particle generators should remain parametric so that users can edit density or spacing without manually rebuilding a model.

Required generation modes:

- Simple cubic and user-defined lattices.
- Uniform random placement.
- Poisson-disk placement.
- Surface sampling.
- Closed-volume filling.
- Replication along periodic box vectors.
- Import from an existing GSD configuration.

Generators should provide an estimated particle count and memory requirement before committing a large operation.

### 5. Particle Types and Properties

Each particle type should expose:

- Name and display color.
- Diameter.
- Mass.
- Charge.
- Moment of inertia when applicable.
- Orientation and rotational degrees of freedom.
- Default physical representation.
- Optional metadata and user notes.

Per-particle overrides may be supported later, but type-level defaults should cover the initial workflow.

### 6. Interaction Editor

Pair interactions should be edited through a symmetric type-pair matrix.

```text
          A           B           Wall
A         LJ          Custom U(r) Wall LJ
B         Custom U(r) Yukawa      Wall Gaussian
Wall      Wall LJ     Wall Gauss  Disabled
```

Selecting a matrix cell should open a parameter form specific to that potential. The initial set should include:

- Lennard-Jones.
- Gaussian.
- Morse.
- Yukawa.
- DPD.
- Tabulated pair potential.
- User-defined pair potential.
- Wall potentials for supported wall geometry.

#### Custom Interaction Builder

Custom interactions should be a first-class workflow rather than requiring users to leave the application and manually modify generated code. The first implementation should focus on isotropic pair interactions and later expand to anisotropic, many-body, bonded, wall, and external interactions.

The editor should support four authoring levels:

| Level | Authoring method | Intended use | Execution target |
| --- | --- | --- | --- |
| Formula | Enter an analytic potential `U(r)` | Rapid development of radial pair potentials | Sampled HOOMD table |
| Table | Import or edit `r`, `U(r)`, and `F(r)` values | Published or externally calculated potentials | HOOMD tabulated potential |
| Python | Implement a generated custom-force interface | Complex research prototypes | Python custom force in the worker |
| Compiled plugin | Supply a versioned native extension | Production-scale or GPU-critical models | C++/GPU HOOMD plugin |

A formula-based interaction workflow should allow the user to:

1. Name and describe the interaction.
2. Declare parameters such as `epsilon`, `sigma`, or user-defined coefficients.
3. Assign defaults, valid ranges, and physical dimensions to each parameter.
4. Enter `U(r)` and optionally `F(r)` in a restricted mathematical expression language.
5. Automatically calculate `F(r) = -dU/dr` when only the potential is supplied.
6. Set `r_min`, `r_cut`, sampling resolution, shifting, and smoothing behavior.
7. Preview potential and force curves interactively.
8. Evaluate the interaction at test distances and inspect numerical values.
9. Assign different parameter sets to each particle-type pair.
10. Export the generated table, Python implementation, metadata, and validation report.

The expression language should support documented mathematical functions and named parameters without using unrestricted Python `eval`. The editor should provide syntax highlighting, parameter autocomplete, inline errors, and a list of permitted variables.

The preview should plot both `U(r)` and `F(r)` and visibly mark:

- `r_min` and `r_cut`.
- Singular or undefined regions.
- Discontinuities in potential or force.
- The effect of shifting or smoothing.
- The sampled points used by a tabulated backend.
- Different parameter sets for selected type pairs.

Custom-interaction validation should include:

- Dimensional consistency of expressions and parameters.
- Finite potential and force values across the active domain.
- Detection of `NaN`, infinity, overflow, and unintended singularities.
- Agreement between a supplied force and the numerical derivative of the potential.
- Potential and force continuity at the cutoff when the selected mode requires it.
- Strictly increasing, non-duplicated distances in imported tables.
- Coverage of the complete requested distance range.
- Completion of parameters for every assigned particle-type pair.
- Availability of the selected execution backend on CPU or GPU.
- A two-particle test that compares generated energy and force with reference values.

Every custom interaction should be stored as a versioned project resource containing its formula or source, parameter schema, unit metadata, execution backend, tests, and content checksum. A shared project containing executable Python or a native plugin must be treated as untrusted until the user explicitly approves it. Custom code should execute only in the isolated simulation worker, never in the UI process.

Advanced interaction types can extend the same system with additional inputs:

- Anisotropic interactions using relative orientation and patch vectors.
- Many-body interactions using local-neighbor information.
- Custom bond, angle, dihedral, and improper potentials.
- Custom wall and signed-distance interactions.
- Time-dependent interactions driven by variants.
- External fields based on position, orientation, or simulation state.

Topology editors should eventually support:

- Harmonic and FENE bonds.
- Angle potentials.
- Dihedrals and impropers.
- Distance constraints.
- Rigid bodies.
- Mesh bending and conservation potentials.
- Long-range electrostatics.
- Active and external forces.

The validator must report every missing type-pair parameter before execution.

### 7. System Box and Dimensionality

The box editor should support:

- 2D and 3D modes.
- `Lx`, `Ly`, and `Lz`.
- Triclinic tilt factors `xy`, `xz`, and `yz`.
- Orthorhombic presets.
- Box resizing and deformation stages.
- Periodic-boundary visualization.

For HOOMD-blue, `Lz = 0` defines a 2D box. The GUI should disable incompatible controls in 2D and prevent dimensionality changes during an active simulation.

### 8. Units

HOOMD-blue uses a self-consistent unit system rather than imposing SI units. The GUI should therefore support:

- Reduced units such as `sigma = 1`, `epsilon = 1`, and `mass = 1`.
- User-defined base units for length, energy, and mass.
- Optional physical-unit entry with conversion to simulation units.
- Clear display of derived time, velocity, force, pressure, and charge units.
- Temperature entry as `kT`, with optional Kelvin conversion when the unit system is fully defined.

The application should never present a value as Kelvin unless the conversion is physically defined.

### 9. Integration and Run Stages

The initial molecular-dynamics workflow should expose:

- Timestep `dt`.
- Number of steps.
- Calculated simulated time: `dt * steps`.
- Random seed.
- CPU or GPU device selection.
- NVE, constant-volume thermostatted, Langevin, and Brownian methods.
- Temperature and temperature ramps.
- Pressure where supported.
- Translational and rotational integration options.
- Energy minimization.

A project should support multiple ordered run stages, for example:

```text
1. Resolve overlaps with displacement-capped integration
2. Minimize energy
3. Equilibrate at kT = 1.0
4. Ramp kT from 1.0 to 0.5
5. Run production and write trajectory frames
```

HPMC and MPCD should be added as separate simulation modes because they require different controls and mental models.

### 10. Preflight Validation

The application should classify findings as errors, warnings, or informational estimates.

Required checks include:

- Particles outside the simulation box.
- Initial overlaps or invalid hard-particle configurations.
- Missing type-pair interactions.
- Invalid mass, diameter, cutoff, or topology parameters.
- Bonds or bodies referencing nonexistent particles.
- Nonzero out-of-plane coordinates in a 2D model.
- Conflicting integration selections.
- A timestep that is suspicious for the selected scales and potentials.
- A trajectory interval likely to produce an excessively large file.
- Imported geometry that crosses a periodic boundary unexpectedly.
- Unsupported combinations of features or devices.
- Estimated particle count, output size, and GPU memory use.

Validation rules should explain the problem and point to the relevant UI control.

### 11. Code Generation

Code generation is a first-class feature, not an implementation detail.

The generated package should contain:

- A readable `run.py` script.
- An initial-state GSD file when needed.
- A machine-readable project manifest.
- Dependency and HOOMD-blue version information.
- A copy or checksum of external geometry inputs.
- Versioned custom-interaction definitions and their validation tests.
- Comments connecting generated code sections to GUI settings.

The GUI should include a read-only code preview and an explicit export action. Advanced users may add custom Python through defined extension hooks, but generated regions should not be modified in place and silently overwritten.

### 12. Execution Engine

Simulations should run outside the UI process so that a crash or long GPU job does not freeze the editor.

Required execution features:

- Start, stop, and monitor a local worker process.
- Stream standard output and errors.
- Display timestep, wall time, timesteps per second, and estimated completion.
- Show live temperature, energy, pressure, and other selected log values.
- Save checkpoints and resume interrupted runs.
- Record the exact command, environment, hardware, and application version.
- Detect available CPU/GPU support.
- Keep completed runs immutable unless the user explicitly creates a continuation.

Future execution targets may include SSH hosts, Slurm/PBS schedulers, containers, and parameter sweeps.

### 13. Results and Analysis

The first result viewer should provide:

- GSD trajectory playback.
- Timeline scrubbing and frame stepping.
- Type- and selection-based visibility.
- Particle trails and periodic-image display.
- Charts for temperature, potential energy, kinetic energy, pressure, and volume.
- Particle inspection at a selected frame.
- CSV and image export.
- Movie rendering.

Later analysis can integrate tools such as `freud` for radial distribution functions, mean-squared displacement, clustering, order parameters, and other structural measurements.

## Proposed Architecture

```text
+--------------------------------------+
| Web browser                          |
| HTML + CSS + JavaScript modules      |
| Three.js viewport                    |
+------------------+-------------------+
                   |
        +----------+----------+
        |                     |
        v                     v  HTTP / WebSocket
+------------------+   +--------------------------+
| Static Demo Mode |   | Python API service       |
| Project JSON     |   | FastAPI                   |
| Sample results   |   +-------------+------------+
| No backend       |                 |
+------------------+                 v
                          +--------------------------+
                          | Reusable Python core     |
                          | Schema + validation      |
                          | Geometry + compiler      |
                          | Interaction builder      |
                          +-------------+------------+
                                        |
                                        v
                          +--------------------------+
                          | Isolated HOOMD worker    |
                          | GSD + HDF5/CSV outputs   |
                          +--------------------------+
```

The web interface should depend only on the versioned project/API contract, not on HOOMD-specific Python objects. The Python core should not import web-server or UI code.

### Suggested Technology Stack

| Area | Suggested technology |
| --- | --- |
| Initial UI | HTML5, CSS, modern JavaScript modules |
| 3D rendering | Three.js with GPU instancing |
| Initial application state | Plain JavaScript store using the project schema |
| Later UI scaling option | TypeScript and React if component complexity requires it |
| Schema and validation | Pydantic |
| Python API | FastAPI with JSON and WebSocket endpoints |
| Simulation | HOOMD-blue |
| Trajectory storage | GSD |
| Numerical data | NumPy, HDF5, CSV |
| Mesh processing | trimesh, NumPy, optional OpenCascade |
| Analysis | freud, NumPy, SciPy |
| Static deployment | GitHub Pages |
| Python-backed deployment | Containerized service or local Python process |
| Testing | Pytest and Playwright, with lightweight JavaScript unit tests |

The initial demo should avoid a mandatory frontend build system. A visitor or contributor should be able to serve the `web/` directory with a basic static HTTP server. A framework can be introduced later if the UI grows beyond what small JavaScript modules can manage cleanly.

## Suggested Project Layout

```text
hoomd-gui/
|- web/
|  |- index.html
|  |- styles/
|  |  `- app.css
|  |- js/
|  |  |- app.js
|  |  |- project-store.js
|  |  |- viewport.js
|  |  |- inspectors.js
|  |  |- interaction-editor.js
|  |  `- api-client.js
|  `- assets/
|- python/
|  |- hoomd_gui_core/
|  |  |- schema/
|  |  |- geometry/
|  |  |- validation/
|  |  |- interactions/
|  |  |- compiler/
|  |  |- runner/
|  |  `- analysis/
|  `- tests/
|- server/
|  |- app.py
|  `- tests/
|- examples/
|- docs/
`- pyproject.toml
```

## Project File Layout

A saved project may use the following structure:

```text
example-project/
|- project.hoomd-gui.json
|- geometry/
|  `- imported-part.stl
|- generated/
|  |- initial_state.gsd
|  `- run.py
`- runs/
   `- 2026-08-29T120000Z/
      |- manifest.json
      |- trajectory.gsd
      |- checkpoint.gsd
      |- log.h5
      `- console.log
```

Each run directory should preserve a snapshot of the settings used for that run.

## Development Roadmap

### Phase 0 — Interface Contract and Experiments

- Define the versioned project schema.
- Define the JSON API boundary between the web interface and Python core.
- Pin the first supported HOOMD-blue version.
- Prototype Python code generation.
- Prototype the safe expression parser, symbolic derivative, and table compiler for custom pair interactions.
- Benchmark Three.js particle instancing.
- Create a minimal HTML/CSS/JavaScript viewport experiment.
- Define scientific validation cases.

### Phase 1 — Public Static Web Demo

- Single-page HTML interface with no mandatory build step.
- Responsive scene tree, viewport, inspector, and bottom timeline layout.
- Three.js box, particle, wall, camera, and selection visualization.
- Browser-side project store following the versioned schema.
- Basic object transforms, layers, particle types, and property editing.
- Built-in and expression-based custom-potential forms.
- Potential and force graph preview.
- Generated HOOMD-blue code preview using a demo template.
- Bundled example projects and prerecorded trajectories.
- JSON import and export.
- Clear visual labeling that simulations are illustrative in Static Demo Mode.
- Public deployment through GitHub Pages.

### Phase 2 — Python Core and Molecular Dynamics MVP

- Project creation, save, load, and migration framework.
- 2D/3D orthorhombic box editor.
- Sphere particles and procedural particle generators.
- Object tree, display layers, particle types, and named selections.
- LJ, Gaussian, Morse, Yukawa, and expression-based custom pair interactions.
- Interactive potential/force preview and custom-interaction validation.
- NVE, thermostatted constant-volume, and Langevin integration.
- Preflight validation.
- Python/GSD generation.
- FastAPI endpoints matching the project/API contract.
- Worker-process control and live logging.
- Local CPU/GPU execution.
- GSD trajectory playback and basic charts.

### Phase 3 — Molecular Topology and Geometry Import

- Bonds, angles, dihedrals, constraints, and rigid bodies.
- STL/OBJ import.
- Surface sampling and closed-volume particle filling.
- Fixed-particle boundary generation.
- Advanced selection and editing tools.
- Checkpoint continuation and reusable simulation templates.
- CSV/table import and reusable custom-interaction library entries.

### Phase 4 — Advanced HOOMD Modes

- HPMC shape and interaction editors.
- Flexible particle meshes.
- Long-range electrostatics.
- Active forces and external fields.
- Python-authored custom forces and custom bonded interactions.
- Anisotropic and time-dependent custom-interaction definitions.
- Triclinic and deforming boxes.
- MPCD workflows.
- Parameter sweeps and comparison views.

### Phase 5 — Production and Remote Computing

- STEP/IGES import through a CAD kernel.
- Signed-distance custom boundaries.
- Remote execution over SSH.
- Slurm/PBS job submission.
- Containerized reproducible environments.
- Compiled CPU/GPU plugin API for custom potentials, generators, validators, and analyses.

## First Web Demo Acceptance Scenario

The first public demonstration is successful when a visitor can complete the following from a URL without installing any software:

1. Create a 3D simulation box.
2. Add or generate particles of two different types.
3. Assign different colors and diameters.
4. Configure A-A and B-B built-in interactions and define a custom `U(r)` interaction for A-B.
5. Inspect the corresponding potential and force curves.
6. Set `kT`, `dt`, and the number of steps.
7. See browser-side validation feedback.
8. Preview the proposed HOOMD-blue script.
9. Play a clearly labeled sample trajectory.
10. Download the project JSON and share the demo URL.

The next Python-connected milestone adds authoritative validation, real code generation, local CPU/GPU execution, live thermodynamic values, and GSD result playback without changing the project format or main web interface.

## Non-Goals for the Initial Release

- Full parametric mechanical CAD modeling.
- Finite-element stress or structural analysis.
- General computational fluid dynamics.
- Arbitrary triangle meshes as native collision walls without conversion.
- Support for every HOOMD-blue operation in the first release.
- Running HOOMD-blue directly inside the static browser demo.
- Requiring a Python installation merely to view the public demonstration.
- Silent conversion between physical and reduced units.
- Hiding generated code or preventing expert users from leaving the GUI.

## Major Technical Risks

### Large-System Visualization

Rendering millions of particles as individual scene nodes will not work. The viewport must use GPU instancing, level-of-detail strategies, culling, subsampling, and asynchronous frame loading.

### Geometry-to-Physics Ambiguity

The same CAD mesh could mean a visual reference, a wall, a rigid body, a particle-filled solid, or a membrane. Import must therefore include an explicit representation wizard.

### Scientific Validity

A syntactically valid HOOMD script can still define a poor physical model. The application needs conservative defaults, dimensional checks, clear warnings, and validated example projects.

### API Evolution

HOOMD-blue APIs evolve. Generated code must be version-aware, and compatibility adapters should be tested against pinned environments.

### Custom Interaction Correctness and Performance

An expression can be mathematically valid yet unstable, discontinuous, dimensionally inconsistent, or too slow for the intended system. Custom interactions therefore require curve previews, derivative and cutoff checks, small reference tests, backend-specific performance estimates, and explicit warnings when a Python implementation replaces a GPU-capable built-in interaction.

### Packaging GPU Environments

HOOMD-blue GPU support depends on platform and build configuration. The application should inspect the active environment instead of assuming that GPU support is present.

## Testing Strategy

- Unit tests for project-schema validation and migration.
- Golden-file tests for generated Python scripts.
- Energy and force comparisons against hand-written HOOMD reference cases.
- Symbolic-versus-numerical derivative tests for formula-based interactions.
- Cutoff continuity, table interpolation, singularity, and unit-consistency tests.
- Reference two-particle tests for every bundled custom-interaction example.
- Small deterministic trajectory regression tests.
- Geometry conversion tests for open, closed, malformed, and scaled meshes.
- UI tests for the complete MVP acceptance scenario.
- Performance tests for particle counts representative of intended use.
- CPU-only and GPU-enabled integration tests.
- Save, resume, cancel, and crash-recovery tests.

Generated scripts should remain understandable enough to review as part of a scientific workflow.

## Design Principles

1. **Reproducibility first** — every run records its input, generated code, environment, and outputs.
2. **Physics remains explicit** — visual objects always show their HOOMD representation.
3. **Safe defaults, visible assumptions** — the GUI explains units and model choices.
4. **Validate before running** — prevent expensive failures when possible.
5. **Progressive complexity** — beginners can use templates while experts can inspect and extend code.
6. **Non-destructive editing** — generators and imported geometry retain their editable source parameters.
7. **Version-aware output** — code generation targets a known HOOMD-blue API version.

## References

- [HOOMD-blue documentation](https://hoomd-blue.readthedocs.io/en/latest/index.html)
- [HOOMD-blue feature overview](https://hoomd-blue.readthedocs.io/en/latest/features.html)
- [Simulation API](https://hoomd-blue.readthedocs.io/en/latest/hoomd/simulation.html)
- [Snapshot API](https://hoomd-blue.readthedocs.io/en/latest/hoomd/snapshot.html)
- [Box API](https://hoomd-blue.readthedocs.io/en/latest/hoomd/box.html)
- [HOOMD-blue units](https://hoomd-blue.readthedocs.io/en/latest/units.html)
- [Molecular dynamics integrator](https://hoomd-blue.readthedocs.io/en/latest/hoomd/md/integrator.html)
- [GSD trajectory writer](https://hoomd-blue.readthedocs.io/en/latest/hoomd/write/gsd.html)
- [Barrier tutorial](https://hoomd-blue.readthedocs.io/en/latest/tutorial/08-Placing-Barriers-in-the-Simulation-Box/00-index.html)
- [Flexible interface tutorial](https://hoomd-blue.readthedocs.io/en/latest/tutorial/10-Modelling-Flexible-Active-Interfaces/00-index.html)

## License

No license has been selected for HOOMD GUI yet. Add a project license before distributing source code or accepting external contributions.
