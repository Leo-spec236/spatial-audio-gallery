import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function roundedBox(w, h, d, radius = 0.7, segments = 3) { return new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w / 2, h / 2, d / 2)); }
export function roundedRect(w, d, radius) {
  const x = -w / 2, z = -d / 2, r = Math.min(radius, w / 2, d / 2);
  const s = new THREE.Shape(); s.moveTo(x + r, z); s.lineTo(x + w - r, z); s.quadraticCurveTo(x + w, z, x + w, z + r);
  s.lineTo(x + w, z + d - r); s.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
  s.lineTo(x + r, z + d); s.quadraticCurveTo(x, z + d, x, z + d - r); s.lineTo(x, z + r); s.quadraticCurveTo(x, z, x + r, z);
  return s;
}
export function flatShape(shape, thickness, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  return g;
}
export function rectangleHole(x, z, w, d) {
  const h = new THREE.Path(); h.moveTo(x - w / 2, z - d / 2); h.lineTo(x - w / 2, z + d / 2); h.lineTo(x + w / 2, z + d / 2); h.lineTo(x + w / 2, z - d / 2); h.closePath(); return h;
}
export function ringGeometry(w, d, innerW, innerD, thickness, radius = 0.5) {
  const s = roundedRect(w, d, radius); s.holes.push(rectangleHole(0, 0, innerW, innerD)); return flatShape(s, thickness, 0.08);
}
/** Rounded tapered shell, cylindrical dish, open underside and internal rim. */
export function keycapGeometry(widthUnits = 1) {
  const w = widthUnits * 19.05 - 1.6, d = 17.45;
  const segments = 8, count = 4 * (segments + 1);
  const positions = [], indices = [];
  function ring(rw, rd, y, radius, dish = false) {
    for (let corner = 0; corner < 4; corner++) for (let s = 0; s <= segments; s++) {
      const a = (-Math.PI / 2 + corner * Math.PI / 2) + s / segments * Math.PI / 2;
      const sx = corner === 0 || corner === 1 ? 1 : -1, sz = corner === 0 || corner === 3 ? -1 : 1;
      const x = sx * (rw / 2 - radius) + radius * Math.cos(a), z = sz * (rd / 2 - radius) + radius * Math.sin(a);
      positions.push(x, y + (dish ? 0.8 * (z / ((d - 3.5) / 2)) ** 2 : 0), z);
    }
  }
  ring(w - 0.7, d - 0.7, 0, 1.5); ring(w, d, 0.6, 1.7); ring(w - 2.5, d - 2.7, 7.1, 2.2); ring(w - 3.3, d - 3.5, 7.5, 2.4, true);
  // Contracting rings cover the dish, avoiding a planar triangle fan.
  for (let scale of [0.8, 0.6, 0.4, 0.2, 0.01]) ring((w - 3.3) * scale, (d - 3.5) * scale, 7.5, Math.min(2.4 * scale, 0.45 * (d - 3.5) * scale), true);
  const rings = positions.length / 3 / count;
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < count; j++) {
    const a = i * count + j, b = i * count + (j + 1) % count, c = a + count, e = b + count;
    indices.push(a, c, b, b, c, e);
  }
  const centre = positions.length / 3; positions.push(0, 7.5, 0);
  for (let j = 0; j < count; j++) indices.push((rings - 1) * count + j, centre, (rings - 1) * count + (j + 1) % count);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
const labelCache = new Map();
export function legendMaterial(label, light = false) {
  if (typeof document === 'undefined') return null;
  const cacheKey = `${label}:${light}`; if (labelCache.has(cacheKey)) return labelCache.get(cacheKey);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 256, 128); ctx.fillStyle = light ? '#fff5e5' : '#263442';
  ctx.font = `500 ${label.length > 5 ? 36 : label.length > 3 ? 42 : label.length > 1 ? 54 : 72}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 128, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }); labelCache.set(cacheKey, material); return material;
}
export function wireCurve(points, radius = 0.4, material, detail = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, detail, radius, 7, false), material);
}
export function disposeObject(group, disposeMaterials = true) {
  const geometries = new Set(), materials = new Set();
  group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); });
  const cachedMaterials = [...labelCache.values()], cachedTextures = cachedMaterials.map(m => m.map);
  for (const g of geometries) g.dispose(); if (disposeMaterials) for (const m of materials) { if (m.map && !cachedTextures.includes(m.map)) m.map.dispose(); if (!cachedMaterials.includes(m)) m.dispose(); }
}
