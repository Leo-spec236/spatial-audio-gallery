import * as THREE from 'three';
import { KEY_LAYOUT, KEY_PITCH, BOARD_DIMENSIONS } from './layout.js';
import { CoilGeometry } from './CoilGeometry.js';
import { MODEL_DEFAULTS } from './SwitchModel.js';
import { roundedBox, roundedRect, rectangleHole, flatShape, ringGeometry, keycapGeometry, legendMaterial, wireCurve, disposeObject } from './geometry.js';

const PALETTE = { cream: '#ece5d7', gray: '#c3c9c8', orange: '#d76340', blue: '#648b9f', case: '#36444b', trim: '#e2ddd1', copper: '#c39b58' };
const dummy = new THREE.Object3D();
const ink = new THREE.Color();
function mesh(geometry, material, parent, position = [0, 0, 0], name = '') {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.castShadow = m.receiveShadow = true; m.name = name; m.userData.partName = name; parent.add(m); return m;
}
const standard = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, ...options });

/** Millimetre-scaled ANSI TKL with instanced mechanisms and individually pickable caps. */
export class KeyboardModel extends THREE.Group {
  constructor(params = {}, { labels = true } = {}) {
    super(); this.name = 'TKL 87 mechanism'; this.params = { ...MODEL_DEFAULTS, ...params };
    this.keys = new Map(); this.pickMeshes = []; this.selectedCode = 'KeyA'; this.view = 'assembled'; this.labels = labels;
    this.batchParts = []; this.capMaterials = []; this.internalMaterials = []; this.lastStates = new Map(); this.dirty = true;
    this.build(); this.setSelected(this.selectedCode); this.update(new Map(), this.selectedCode);
  }
  build() {
    const { width: w, depth: d } = BOARD_DIMENSIONS;
    const caseMat = standard(PALETTE.case, { roughness: 0.32, metalness: 0.35 });
    const trimMat = standard(PALETTE.trim, { roughness: 0.25, metalness: 0.45 });
    const dark = standard('#2d3439', { roughness: 0.38 });
    const steel = standard('#bec8ce', { roughness: 0.23, metalness: 0.92 });
    const copper = standard(PALETTE.copper, { roughness: 0.3, metalness: 0.8 });
    const stemMat = standard('#ffffff', { roughness: 0.28 });
    const shell = standard('#acc0c5', { roughness: 0.23, transparent: true, opacity: 0.75, depthWrite: false });
    this.internalMaterials.push(dark, shell);
    this.bottomCase = new THREE.Group(); this.add(this.bottomCase);
    mesh(roundedBox(w, 6.5, d, 3), caseMat, this.bottomCase, [0, 1, 0], 'CNC 铝合金底壳');
    mesh(ringGeometry(w - 0.2, d - 0.2, w - 12, d - 12, 7, 4), caseMat, this.bottomCase, [0, 3.5, 0], '底壳侧壁');
    mesh(ringGeometry(w + 0.3, d + 0.3, w - 1.1, d - 1.1, 0.45, 4), copper, this.bottomCase, [0, 3.2, 0], '黄铜装饰线');
    for (const x of [-w / 2 + 15, w / 2 - 15]) for (const z of [-d / 2 + 12, d / 2 - 12]) {
      mesh(roundedBox(24, 2.5, 8, 1), standard('#272c2c', { roughness: 0.95 }), this.bottomCase, [x, -3.2, z], '硅胶脚垫');
      const screw = mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.8, 18), steel, this.bottomCase, [x, 5.0, z], '装配螺丝');
      mesh(roundedBox(2.1, 0.15, 0.3, 0.02), dark, screw, [0, 0.45, 0]);
    }
    mesh(roundedBox(9, 3.5, 1.2, 1), dark, this.bottomCase, [-w / 2 + 28, 5.2, -d / 2 - 0.2], 'USB-C 接口');
    mesh(roundedBox(6.8, 1.25, 1.3, 0.4), steel, this.bottomCase, [-w / 2 + 28, 5.2, -d / 2 - 0.3]);
    this.pcb = new THREE.Group(); this.add(this.pcb);
    mesh(roundedBox(w - 15, 1.6, d - 15, 2), standard('#264f4b', { roughness: 0.65 }), this.pcb, [0, 5.6, 0], 'PCB 电路板');
    const traceMat = standard('#62886b', { roughness: 0.7, metalness: 0.3 });
    for (const z of [-42, -23, -4, 15, 34, 51]) mesh(new THREE.BoxGeometry(w - 22, 0.05, 0.25), traceMat, this.pcb, [0, 6.43, z], 'PCB 走线');
    const pad = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.09, 10), copper, KEY_LAYOUT.length * 2);
    KEY_LAYOUT.forEach((key, i) => { for (let j = 0; j < 2; j++) { dummy.position.set(key.x + (j ? 4.2 : -3), 6.48, key.z + 2.9); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pad.setMatrixAt(i * 2 + j, dummy.matrix); } });
    this.pcb.add(pad);
    this.plate = new THREE.Group(); this.add(this.plate);
    const plateShape = roundedRect(w - 9, d - 9, 3);
    for (const k of KEY_LAYOUT) {
      plateShape.holes.push(rectangleHole(k.x, -k.z, 14.1, 14.1));
      if (k.stabilized) for (const sign of [-1, 1]) plateShape.holes.push(rectangleHole(k.x + sign * this.stabilizerOffset(k), -k.z, 3.8, 5.5));
    }
    mesh(flatShape(plateShape, 1.4, 0), trimMat, this.plate, [0, 11, 0], '定位板 · 87 个开孔');
    this.topFrame = new THREE.Group(); this.add(this.topFrame);
    mesh(ringGeometry(w + 0.2, d + 0.2, w - 10, d - 10, 3, 4), caseMat, this.topFrame, [0, 10, 0], '上盖边框');
    // Badge lies in the empty navigation area rather than covering a switch.
    const badge = mesh(roundedBox(44, 0.65, 11, 1), caseMat, this.plate, [142, 12.3, 12], '87 / MECHANISM');
    if (this.labels) { const label = legendMaterial('M / 87', true); if (label) { const m = mesh(new THREE.PlaneGeometry(28, 9), label, badge, [0, 0.4, 0]); m.rotation.x = -Math.PI / 2; } }
    for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 10), standard(i === 0 ? '#d57a4e' : '#718681', { emissive: i === 0 ? '#63250c' : '#000000' }), this.plate, [157 + i * 3.4, 12.8, 12]);

    this.mechanisms = new THREE.Group(); this.add(this.mechanisms);
    this.addBatch(roundedBox(13.7, 1.3, 13.7, 0.4), dark, [0, 7.75, 0], 'base', '轴体下座');
    this.addBatch(ringGeometry(13.6, 13.6, 9.8, 9.8, 3.0), dark, [0, 8.4, 0], 'base', '轴体下座边框');
    this.addBatch(ringGeometry(13.2, 13.2, 6.0, 6.0, 6), shell, [0, 12.2, 0], 'upper', '半透明上盖');
    this.addBatch(roundedBox(5.4, 1.35, 5.4, 0.3), stemMat, [0, 0.675, 0], 'moving', '轴心底托');
    this.addBatch(roundedBox(1.22, 4.8, 4.1, 0.12), stemMat, [0, 2.8, 0], 'moving', '十字轴心');
    this.addBatch(roundedBox(4.1, 4.8, 1.22, 0.12), stemMat, [0, 2.8, 0], 'moving', '十字轴心');
    this.addBatch(roundedBox(0.3, 8, 1.8, 0.06), copper, [5.1, 12.6, 3], 'contact', '动静触片');
    this.addBatch(roundedBox(0.3, 7.7, 1.8, 0.06), copper, [4.3, 12.45, 3], 'leafMoving', '动触片');
    this.addBatch(roundedBox(0.8, 4.5, 0.5, 0.07), copper, [4.2, 5.4, 3], 'base', '引脚');
    this.addBatch(roundedBox(0.8, 4.5, 0.5, 0.07), copper, [-3, 5.4, 3], 'base', '引脚');

    const capGeometry = new Map();
    this.materials = { cream: standard(PALETTE.cream), gray: standard(PALETTE.gray), orange: standard(PALETTE.orange), blue: standard(PALETTE.blue) };
    this.capMaterials = Object.values(this.materials);
    this.selectedMaterial = standard('#edc49b', { roughness: 0.3, emissive: '#5a2915', emissiveIntensity: 0.1 });
    for (const k of KEY_LAYOUT) {
      if (!capGeometry.has(k.width)) capGeometry.set(k.width, keycapGeometry(k.width));
      const modifier = k.label.length > 1 && !/^F\d+$/.test(k.label);
      const color = k.code === 'Escape' ? 'orange' : k.code === 'Enter' ? 'blue' : modifier ? 'gray' : 'cream';
      const capGroup = new THREE.Group(); capGroup.position.set(k.x, 23, k.z); this.add(capGroup);
      const cap = mesh(capGeometry.get(k.width), this.materials[color], capGroup, [0, 0, 0], `键帽 ${k.code}`);
      cap.userData.keyCode = k.code; this.pickMeshes.push(cap);
      let labelMesh;
      if (this.labels && k.label) { const mat = legendMaterial(k.label, color === 'orange' || color === 'blue'); if (mat) { labelMesh = mesh(new THREE.PlaneGeometry(k.label.length > 4 ? Math.min(k.width * 15, 20) : 11, 5.5), mat, capGroup, [0, 8.12, -1.3], '键帽字符'); labelMesh.rotation.x = -Math.PI / 2; labelMesh.userData.keyCode = k.code; labelMesh.castShadow = false; } }
      const coil = mesh(new CoilGeometry(this.params, { detail: false }), steel, this, [k.x, 8.4, k.z], '压缩弹簧'); coil.visible = false; coil.castShadow = false;
      let stabilizer = null;
      if (k.stabilized) {
        stabilizer = new THREE.Group(); stabilizer.position.set(k.x, 0, k.z); this.add(stabilizer);
        const offset = this.stabilizerOffset(k);
        for (const sign of [-1, 1]) mesh(roundedBox(3.0, 6.5, 4, 0.4), dark, stabilizer, [sign * offset, 18.2, 0], '卫星轴 · 同步升降');
        const wire = wireCurve([[-offset, 17.0, -0.5], [-offset, 12.5, 3.2], [-offset + 2, 12, 4.3], [offset - 2, 12, 4.3], [offset, 12.5, 3.2], [offset, 17, -0.5]], 0.55, steel, 30); wire.userData.partName = '卫星轴平衡连杆'; stabilizer.add(wire);
      }
      this.keys.set(k.code, { ...k, keycap: cap, capGroup, label: labelMesh, coil, stabilizer, params: { ...this.params }, type: 'linear', material: this.materials[color], q: NaN });
    }
    this.selection = mesh(ringGeometry(19.0, 19.0, 18.1, 18.1, 0.17, 2), standard('#df8853', { emissive: '#8c3214', emissiveIntensity: 0.25 }), this, [0, 12.7, 0], '当前选中'); this.selection.castShadow = false;
  }
  stabilizerOffset(k) { return k.width > 6 ? 50 : (k.width * KEY_PITCH - 11) / 2; }
  addBatch(geometry, material, offset, layer, name) {
    const batch = new THREE.InstancedMesh(geometry, material, KEY_LAYOUT.length); batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.castShadow = batch.receiveShadow = true; batch.userData.partName = name; this.mechanisms.add(batch); this.batchParts.push({ mesh: batch, offset, layer }); return batch;
  }
  update(statesMap = this.lastStates, selectedCode = this.selectedCode) {
    this.lastStates = statesMap;
    if (selectedCode !== this.selectedCode) this.setSelected(selectedCode);
    const exploded = this.view === 'exploded', transparent = this.view === 'transparent';
    const get = code => statesMap instanceof Map ? statesMap.get(code) : statesMap?.[code];
    let changed = this.dirty;
    for (const [code, k] of this.keys) {
      const state = get(code) || {};
      const q = (state.displacement || 0) * 1000;
      if (q !== k.q) changed = true;
      k.q = q;
      const length = state.length ?? k.params.freeLength - k.params.preload - q / 1000;
      k.stemY = 8.4 + length * 1000;
      k.capGroup.position.y = k.stemY + 4 + (exploded ? 45 : 0);
      k.coil.visible = this.view !== 'assembled';
      if (k.coil.visible) k.coil.geometry.setLength(length);
      if (k.stabilizer) { k.stabilizer.position.y = -q + (exploded ? 15 : 0); k.stabilizer.visible = this.view !== 'assembled'; }
      if (state.type && state.type !== k.type) { k.type = state.type; changed = true; }
      k.closed = Boolean(state.triggered ?? state.contactClosed ?? state.contact ?? false);
    }
    if (changed) {
      for (const { mesh: batch, offset, layer } of this.batchParts) {
        let i = 0;
        for (const k of this.keys.values()) {
          const y = layer === 'moving' ? k.stemY + (exploded ? 10 : 0) : exploded && layer === 'upper' ? 25 : 0;
          dummy.position.set(k.x + offset[0] + (layer === 'leafMoving' && k.closed ? 0.5 : 0), y + offset[1], k.z + offset[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); batch.setMatrixAt(i, dummy.matrix);
          if (layer === 'moving') { ink.set(k.type === 'tactile' ? '#a77a4f' : '#ed7455'); batch.setColorAt(i, ink); }
          i++;
        }
        batch.instanceMatrix.needsUpdate = true; if (batch.instanceColor) batch.instanceColor.needsUpdate = true; batch.computeBoundingSphere();
      }
    }
    // Keep the instanced housings under opaque caps so the assembled board
    // remains a connected mechanism when inspected from the side.
    this.mechanisms.visible = true;
    const selected = this.keys.get(this.selectedCode);
    if (selected) { this.selection.position.set(selected.x, 12.7 + (exploded ? 15 : 0), selected.z); this.selection.scale.x = selected.width; }
    this.dirty = false; return this;
  }
  setView(view) {
    if (!['assembled', 'transparent', 'exploded'].includes(view)) throw new RangeError(`Unknown keyboard view: ${view}`);
    this.view = view; const transparent = view === 'transparent', exploded = view === 'exploded';
    for (const m of [...this.capMaterials, this.selectedMaterial]) { m.transparent = transparent; m.opacity = transparent ? 0.12 : 1; m.depthWrite = !transparent; m.needsUpdate = true; }
    for (const k of this.keys.values()) { k.keycap.castShadow = !transparent; if (k.label) k.label.visible = !transparent; }
    this.plate.position.y = exploded ? 15 : 0; this.topFrame.position.y = exploded ? 25 : 0; this.bottomCase.position.y = exploded ? -12 : 0;
    this.dirty = true; this.update(this.lastStates); return this;
  }
  setParameters(code, params, type = 'linear') {
    const k = this.keys.get(code); if (!k) throw new RangeError(`Unknown key: ${code}`);
    k.params = { ...MODEL_DEFAULTS, ...params }; k.type = type;
    k.coil.geometry.dispose(); k.coil.geometry = new CoilGeometry(k.params, { detail: false });
    this.dirty = true; return this;
  }
  setSelected(code) {
    if (!this.keys.has(code)) return this;
    this.selectedCode = code;
    for (const [id, k] of this.keys) k.keycap.material = id === code ? this.selectedMaterial : k.material;
    return this;
  }
  dispose() { disposeObject(this); this.clear(); this.keys.clear(); this.pickMeshes.length = 0; }
}

export { KEY_LAYOUT, BOARD_DIMENSIONS } from './layout.js';
