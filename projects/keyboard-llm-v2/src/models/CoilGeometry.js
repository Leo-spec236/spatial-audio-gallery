import * as THREE from 'three';

/** The circular-section, moving-frame construction reuses Spring.js's method.
 * Input is SI; output is mm. Closed end turns have a wire-diameter pitch.
 * Compression rebuilds centres and frames; it never scales the wire section. */
export class CoilGeometry extends THREE.BufferGeometry {
  constructor(params, { detail = true } = {}) {
    super();
    this.params = { ...params };
    this.turns = params.activeCoils + 2;
    this.segments = Math.ceil(this.turns * (detail ? 48 : 14));
    this.radialSegments = detail ? 10 : 5;
    const n = (this.segments + 1) * (this.radialSegments + 1);
    this.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let i = 0; i < this.segments; i++) for (let j = 0; j < this.radialSegments; j++) {
      const a = i * (this.radialSegments + 1) + j, b = a + this.radialSegments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    this.setIndex(indices);
    this.setLength(params.freeLength - params.preload);
  }
  centerAt(t, length = this.length) {
    const d = this.params.wireDiameter * 1000;
    const radius = this.params.meanDiameter * 500;
    const height = length * 1000 - d;
    const turn = t * this.turns;
    // One closed turn at either end, active coils between them.
    let y;
    if (turn < 1) y = turn * d;
    else if (turn > this.turns - 1) y = height - (this.turns - turn) * d;
    else y = d + (turn - 1) * (height - 2 * d) / this.params.activeCoils;
    const angle = turn * Math.PI * 2;
    return new THREE.Vector3(radius * Math.cos(angle), y + d / 2, radius * Math.sin(angle));
  }
  setLength(length) {
    if (this.length !== undefined && Math.abs(this.length - length) < 1e-8) return;
    this.length = length;
    const pos = this.attributes.position, normal = this.attributes.normal;
    const r = this.params.wireDiameter * 500;
    const radial = new THREE.Vector3(), tangent = new THREE.Vector3(), binormal = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const centre = this.centerAt(t);
      tangent.copy(this.centerAt(Math.min(1, t + 0.00001))).sub(this.centerAt(Math.max(0, t - 0.00001))).normalize();
      radial.set(centre.x, 0, centre.z).normalize();
      binormal.crossVectors(tangent, radial).normalize();
      for (let j = 0; j <= this.radialSegments; j++) {
        const angle = j / this.radialSegments * Math.PI * 2;
        n.copy(radial).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
        const k = i * (this.radialSegments + 1) + j;
        pos.setXYZ(k, centre.x + r * n.x, centre.y + r * n.y, centre.z + r * n.z);
        normal.setXYZ(k, n.x, n.y, n.z);
      }
    }
    pos.needsUpdate = normal.needsUpdate = true;
    this.computeBoundingBox(); this.computeBoundingSphere();
  }
}
