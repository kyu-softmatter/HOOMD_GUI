/**
 * Browser-side geometry checks for the editor.
 *
 * These checks give immediate feedback while editing. They are intentionally
 * conservative: the Python core remains the authoritative validator, and the
 * interface must never present these results as a completed validation pass.
 */

import { findParticleType, particleDiameter } from './project.js';

/** Fraction of the contact distance below which two disks count as overlapping. */
const OVERLAP_TOLERANCE = 0.999;

/** Return the shortest separation along one axis for the given periodicity. */
export function minimumImageDelta(delta, length, periodic) {
  if (!periodic) {
    return delta;
  }
  return delta - length * Math.round(delta / length);
}

/** Return the set of particle identifiers that overlap another particle. */
export function computeOverlaps(project) {
  const overlapping = new Set();
  const particles = project.particles;
  if (particles.length < 2) {
    return overlapping;
  }

  const periodicX = project.boundaries.x.mode === 'periodic';
  const periodicY = project.boundaries.y.mode === 'periodic';
  const { lx, ly } = project.box;

  const diameters = particles.map((particle) => particleDiameter(project, particle));
  const largestDiameter = Math.max(...diameters);
  const cellSize = Math.max(largestDiameter, 1e-6);

  // Bucket particles into a uniform grid so the pair scan stays local.
  const buckets = new Map();
  const cellKey = (column, row) => `${column}|${row}`;
  particles.forEach((particle, index) => {
    const column = Math.floor(particle.position.x / cellSize);
    const row = Math.floor(particle.position.y / cellSize);
    const key = cellKey(column, row);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      buckets.set(key, [index]);
    }
  });

  particles.forEach((particle, index) => {
    const column = Math.floor(particle.position.x / cellSize);
    const row = Math.floor(particle.position.y / cellSize);
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        const bucket = buckets.get(cellKey(column + dc, row + dr));
        if (!bucket) {
          continue;
        }
        for (const other of bucket) {
          if (other <= index) {
            continue;
          }
          const dx = minimumImageDelta(
            particle.position.x - particles[other].position.x,
            lx,
            periodicX,
          );
          const dy = minimumImageDelta(
            particle.position.y - particles[other].position.y,
            ly,
            periodicY,
          );
          const contact = (diameters[index] + diameters[other]) / 2;
          if (dx * dx + dy * dy < (contact * OVERLAP_TOLERANCE) ** 2) {
            overlapping.add(particle.id);
            overlapping.add(particles[other].id);
          }
        }
      }
    }
  });

  return overlapping;
}

/**
 * Return the accessible interval along one axis.
 *
 * A periodic axis spans the whole box because positions wrap. A walled axis
 * loses the padding band at each end, which is where the wall potential acts.
 */
export function accessibleInterval(boundary, boxLength) {
  const half = boxLength / 2;
  if (boundary.mode !== 'walls') {
    return { minimum: -half, maximum: half, periodic: true };
  }
  return {
    minimum: -half + boundary.minimum.padding,
    maximum: half - boundary.maximum.padding,
    periodic: false,
  };
}

/**
 * Return particles that sit outside the accessible region.
 *
 * A periodic axis wraps, so only a centre outside the box counts. A walled
 * axis must keep the whole disk inside the region the walls leave open.
 */
export function computeOutOfBounds(project) {
  const outside = new Set();
  const intervalX = accessibleInterval(project.boundaries.x, project.box.lx);
  const intervalY = accessibleInterval(project.boundaries.y, project.box.ly);

  for (const particle of project.particles) {
    const radius = particleDiameter(project, particle) / 2;
    const { x, y } = particle.position;
    const marginX = intervalX.periodic ? 0 : radius;
    const marginY = intervalY.periodic ? 0 : radius;
    if (
      x - marginX < intervalX.minimum ||
      x + marginX > intervalX.maximum ||
      y - marginY < intervalY.minimum ||
      y + marginY > intervalY.maximum
    ) {
      outside.add(particle.id);
    }
  }
  return outside;
}

/** Return the area fraction covered by disks, ignoring overlap. */
export function packingFraction(project) {
  const boxArea = project.box.lx * project.box.ly;
  if (boxArea <= 0) {
    return 0;
  }
  const diskArea = project.particles.reduce((total, particle) => {
    const radius = particleDiameter(project, particle) / 2;
    return total + Math.PI * radius * radius;
  }, 0);
  return diskArea / boxArea;
}

/**
 * Run the editor-side checks and return a list of issues.
 *
 * Each issue carries a stable code so that the Python validator can later
 * replace or confirm an entry without changing the interface.
 */
export function validateProject(project) {
  const issues = [];

  if (!project.name.trim()) {
    issues.push({
      severity: 'error',
      code: 'project.name_empty',
      message: 'The project needs a name.',
    });
  }

  if (!(project.box.lx > 0) || !(project.box.ly > 0)) {
    issues.push({
      severity: 'error',
      code: 'box.non_positive_length',
      message: 'Box lengths must be positive.',
    });
  }

  if (project.particles.length === 0) {
    issues.push({
      severity: 'info',
      code: 'particles.empty',
      message: 'The project has no particles yet. Use the Add Particle tool or a generator.',
    });
  }

  const overlapping = computeOverlaps(project);
  if (overlapping.size > 0) {
    issues.push({
      severity: 'error',
      code: 'particles.overlap',
      message:
        `${overlapping.size} ${plural(overlapping.size, 'particle', 'particles')} `
        + `${plural(overlapping.size, 'overlaps', 'overlap')} a neighbour.`,
      targets: [...overlapping],
    });
  }

  const outside = computeOutOfBounds(project);
  if (outside.size > 0) {
    issues.push({
      severity: 'error',
      code: 'particles.out_of_bounds',
      message:
        `${outside.size} ${plural(outside.size, 'particle', 'particles')} `
        + `${plural(outside.size, 'lies', 'lie')} outside the accessible region.`,
      targets: [...outside],
    });
  }

  for (const axis of ['x', 'y']) {
    const boundary = project.boundaries[axis];
    if (boundary.mode !== 'walls') {
      continue;
    }
    const boxLength = axis === 'x' ? project.box.lx : project.box.ly;
    const padding = boundary.minimum.padding + boundary.maximum.padding;
    if (padding >= boxLength) {
      issues.push({
        severity: 'error',
        code: 'boundary.padding_exceeds_box',
        message: `Wall padding on ${axis.toUpperCase()} leaves no accessible region.`,
      });
    }
  }

  for (const particle of project.particles) {
    if (!findParticleType(project, particle.type)) {
      issues.push({
        severity: 'error',
        code: 'particles.unknown_type',
        message: `Particle ${particle.id} uses undefined type "${particle.type}".`,
        targets: [particle.id],
      });
    }
  }

  const fraction = packingFraction(project);
  if (fraction > 0.9) {
    issues.push({
      severity: 'warning',
      code: 'particles.dense_packing',
      message: `Packing fraction is ${fraction.toFixed(2)}, which is very dense for a start state.`,
    });
  }

  if (!(project.run.dt > 0)) {
    issues.push({
      severity: 'error',
      code: 'run.non_positive_timestep',
      message: 'The timestep must be positive.',
    });
  }

  if (!Number.isInteger(project.run.steps) || project.run.steps <= 0) {
    issues.push({
      severity: 'error',
      code: 'run.invalid_step_count',
      message: 'The step count must be a positive integer.',
    });
  }

  return issues;
}

/** Return the singular or plural word for a count. */
export function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}
