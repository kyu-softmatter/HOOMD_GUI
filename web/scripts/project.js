/**
 * Project data model for the HOOMD GUI interface.
 *
 * This module mirrors the schema that the Python scientific core will own.
 * It holds physical values only. Selection, camera, and panel state live in
 * the UI state so that project files stay free of view-only fields.
 */

export const SCHEMA_VERSION = 1;

/** Built-in particle fields that a custom attribute may not shadow. */
export const RESERVED_ATTRIBUTE_KEYS = Object.freeze([
  'id',
  'type',
  'position',
  'x',
  'y',
  'diameter',
  'mass',
  'layer',
  'fixed',
]);

/** Custom attribute keys must be valid identifiers. */
export const ATTRIBUTE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Boundary modes available for one pair of opposite box faces. */
export const BOUNDARY_MODES = Object.freeze(['periodic', 'walls']);

/** Simulation modes. Hard and soft particles use different algorithms. */
export const SIMULATION_MODES = Object.freeze([
  { id: 'md', label: 'Soft disks (MD)' },
  { id: 'hpmc', label: 'Hard disks (HPMC)' },
]);

/** Create a wall definition for a single face. */
export function createWall() {
  return { kind: 'soft', potential: 'lj', padding: 2.0 };
}

/** Create a boundary pair definition in the given mode. */
export function createBoundary(mode) {
  if (mode === 'walls') {
    return { mode: 'walls', minimum: createWall(), maximum: createWall() };
  }
  return { mode: 'periodic' };
}

/** Create an empty two-dimensional project. */
export function createDefaultProject() {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: 'Untitled Project',
    box: { dimensions: 2, lx: 30, ly: 30 },
    boundaries: { x: createBoundary('periodic'), y: createBoundary('periodic') },
    particleTypes: [
      { name: 'A', color: '#5aa9ff', diameter: 1.0, mass: 1.0 },
      { name: 'B', color: '#ff9f5a', diameter: 1.5, mass: 2.0 },
    ],
    attributeDefinitions: {},
    layers: [{ id: 'default', name: 'Default', visible: true }],
    particles: [],
    potentialWells: [],
    run: { mode: 'md', dt: 0.005, kT: 1.0, steps: 10000, seed: 1 },
  };
}

/** Return the next stable particle identifier for a project. */
export function nextParticleId(project) {
  let highest = 0;
  for (const particle of project.particles) {
    const match = /^p-(\d+)$/.exec(particle.id);
    if (match) {
      highest = Math.max(highest, Number.parseInt(match[1], 10));
    }
  }
  return `p-${String(highest + 1).padStart(3, '0')}`;
}

/** Create a particle at a simulation-space position. */
export function createParticle({ id, type, x, y, layer = 'default' }) {
  return { id, type, position: { x, y }, layer, fixed: false, customAttributes: {} };
}

/** Look up a particle type definition by name. */
export function findParticleType(project, name) {
  return project.particleTypes.find((type) => type.name === name) ?? project.particleTypes[0];
}

/** Return the display diameter of a particle, which its type defines. */
export function particleDiameter(project, particle) {
  return findParticleType(project, particle.type)?.diameter ?? 1.0;
}

/** Create a small sample project so the viewport is not empty on first load. */
export function createSampleProject() {
  const project = createDefaultProject();
  project.name = 'Binary Disk Mixture';
  project.attributeDefinitions = {
    a1: { type: 'number', default: 0.0, description: 'Example scalar attribute.' },
  };

  const spacing = 2.2;
  const columns = 8;
  const rows = 6;
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      index += 1;
      const x = (column - (columns - 1) / 2) * spacing;
      const y = (row - (rows - 1) / 2) * spacing;
      const type = (row + column) % 3 === 0 ? 'B' : 'A';
      project.particles.push(
        createParticle({ id: `p-${String(index).padStart(3, '0')}`, type, x, y }),
      );
    }
  }
  return project;
}

/**
 * Return a canonically ordered copy of a project.
 *
 * Key order is fixed and attribute maps are sorted so that identical projects
 * always produce identical JSON text.
 */
export function serializeProject(project) {
  return {
    schemaVersion: project.schemaVersion,
    name: project.name,
    box: { dimensions: project.box.dimensions, lx: project.box.lx, ly: project.box.ly },
    boundaries: {
      x: serializeBoundary(project.boundaries.x),
      y: serializeBoundary(project.boundaries.y),
    },
    particleTypes: project.particleTypes.map((type) => ({
      name: type.name,
      color: type.color,
      diameter: type.diameter,
      mass: type.mass,
    })),
    attributeDefinitions: sortedObject(project.attributeDefinitions),
    layers: project.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
    })),
    particles: project.particles.map((particle) => ({
      id: particle.id,
      type: particle.type,
      position: { x: particle.position.x, y: particle.position.y },
      layer: particle.layer,
      fixed: particle.fixed,
      customAttributes: sortedObject(particle.customAttributes),
    })),
    potentialWells: project.potentialWells,
    run: {
      mode: project.run.mode,
      dt: project.run.dt,
      kT: project.run.kT,
      steps: project.run.steps,
      seed: project.run.seed,
    },
  };
}

function serializeBoundary(boundary) {
  if (boundary.mode !== 'walls') {
    return { mode: 'periodic' };
  }
  return {
    mode: 'walls',
    minimum: serializeWall(boundary.minimum),
    maximum: serializeWall(boundary.maximum),
  };
}

function serializeWall(wall) {
  return { kind: wall.kind, potential: wall.potential, padding: wall.padding };
}

function sortedObject(source) {
  const result = {};
  for (const key of Object.keys(source ?? {}).sort()) {
    result[key] = source[key];
  }
  return result;
}

/** Render a project as deterministic JSON text. */
export function projectToJson(project) {
  return `${JSON.stringify(serializeProject(project), null, 2)}\n`;
}
