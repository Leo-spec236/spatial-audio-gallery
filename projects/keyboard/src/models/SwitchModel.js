import * as THREE from 'three';
import { CoilGeometry } from './CoilGeometry.js';
import { roundedBox, roundedRect, flatShape, keycapGeometry, disposeObject } from './geometry.js';
import { leafProfile } from '../physics/SwitchPhysics.js';

export const MODEL_DEFAULTS = Object.freeze({ wireDiameter: 0.00022, meanDiameter: 0.0035, activeCoils: 8, freeLength: 0.015, preload: 0.0044, travel: 0.004 });
const PARTS = { cap: '键帽 · PBT', stem: '十字轴心 · POM', upper: '上盖 · PC 剖面', lower: '下座 · PA66', spring: '压缩弹簧 · 弹簧钢', moving: '动触片 · 磷青铜', fixed: '静触片 · 磷青铜', pin: '接线引脚', cam: '段落凸轮', contact: '触点 · 银合金' };
const GUIDE_BORE_RADIUS = 0.76;
function plateWithGuideBore(width, thickness) {
  const shape = roundedRect(width, width, 0.4), bore = new THREE.Path();
  bore.absarc(0, 0, GUIDE_BORE_RADIUS, 0, Math.PI * 2, true); shape.holes.push(bore);
  return flatShape(shape, thickness);
}
function hollowGuideGeometry(outerRadius, height) {
  return new THREE.LatheGeometry([
    new THREE.Vector2(GUIDE_BORE_RADIUS, -height / 2), new THREE.Vector2(outerRadius, -height / 2),
    new THREE.Vector2(outerRadius, height / 2), new THREE.Vector2(GUIDE_BORE_RADIUS, height / 2),
    new THREE.Vector2(GUIDE_BORE_RADIUS, -height / 2),
  ], 24);
}

/** A stem-fixed cam: a stationary leaf at y=15.75 samples q as the stem falls.
 * The outward X profile is the exact δ(q) used by the energy/force model.
 * Shape is extruded across Z, without exaggerating the 0.2 mm tactile bump. */
export function camProfileGeometry(params, type = 'linear') {
  const p = { ...MODEL_DEFAULTS, ...params };
  const restStemY = 8.4 + (p.freeLength - p.preload) * 1000;
  const y0 = 15.75 - restStemY, shape = new THREE.Shape();
  const samples = [];
  shape.moveTo(2.35, y0);
  for (let i = 0; i <= 64; i++) {
    const q = p.travel * i / 64;
    const deflection = leafProfile(q, p, type, 1).deflection;
    const x = 3.6 + deflection * 1000, y = y0 + q * 1000;
    shape.lineTo(x, y); samples.push({ displacement: q, deflection, x, y });
  }
  shape.lineTo(2.35, y0 + p.travel * 1000); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, 2.2);
  geometry.userData.profile = samples;
  geometry.computeBoundingBox();
  return geometry;
}

export class SwitchModel extends THREE.Group {
  constructor(params = {}, type = 'linear', { detail = true, labels = true } = {}) {
    super(); this.name = 'Switch cutaway'; this.params = { ...MODEL_DEFAULTS, ...params }; this.type = type; this.detail = detail; this.labels = labels;
    this.exploded = false; this.state = {}; this.partAnchors = {}; this.build();
  }
  mesh(geo, material, name, parent = this, position = [0, 0, 0]) {
    const o = new THREE.Mesh(geo, material); o.position.set(...position); o.castShadow = o.receiveShadow = true; o.userData.partName = name; o.name = name; parent.add(o); return o;
  }
  box(size, material, name, parent, position, bevel = 0.2) { return this.mesh(roundedBox(...size, bevel), material, name, parent, position); }
  build() {
    const plastic = new THREE.MeshStandardMaterial({ color: '#252c33', roughness: 0.33, metalness: 0.08 });
    const pale = new THREE.MeshStandardMaterial({ color: '#e6e1d4', roughness: 0.3 });
    const stemMaterial = new THREE.MeshStandardMaterial({ color: this.type === 'tactile' ? '#a3774e' : '#ed704f', roughness: 0.29 });
    const shell = new THREE.MeshPhysicalMaterial({ color: '#d4e4e9', roughness: 0.17, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, transmission: 0.15, thickness: 0.4 });
    const steel = new THREE.MeshStandardMaterial({ color: '#c4cbd0', metalness: 0.88, roughness: 0.22 });
    const copper = new THREE.MeshStandardMaterial({ color: '#d6ad62', metalness: 0.78, roughness: 0.27, side: THREE.DoubleSide });
    const silver = new THREE.MeshStandardMaterial({ color: '#dde6e6', metalness: 0.93, roughness: 0.18 });
    this.bottom = new THREE.Group(); this.bottom.userData.partName = PARTS.lower; this.add(this.bottom);
    this.basePlate = this.mesh(plateWithGuideBore(13.7, 1.25), plastic, PARTS.lower, this.bottom, [0, 6.725, 0]);
    // Front half deliberately open. The cut exposes spring and leaf assembly.
    for (const x of [-6.3, 6.3]) this.box([1.1, 4.4, 7.1], plastic, PARTS.lower, this.bottom, [x, 9.8, -3.2]);
    this.box([13.7, 4.4, 1], plastic, PARTS.lower, this.bottom, [0, 9.8, -6.3]);
    this.seat = this.mesh(plateWithGuideBore(6.8, 0.55), plastic, '弹簧底部座', this.bottom, [0, 7.875, 0]);
    this.guideSleeve = this.mesh(hollowGuideGeometry(0.92, 2.7), plastic, '轴心导向孔 · 中空', this.bottom, [0, 9.7, 0]);
    for (const x of [-4.8, 4.8]) this.box([1.7, 2, 2.5], pale, '定位卡扣', this.bottom, [x, 9, -5]);
    for (const [x, z] of [[-3, 2.9], [4.2, 2.9]]) this.box([0.8, 5.4, 0.55], copper, PARTS.pin, this.bottom, [x, 4.6, z], 0.1);
    this.pcbBoss = this.mesh(hollowGuideGeometry(1.6, 3.2), plastic, 'PCB 定位柱 · 中空', this.bottom, [0, 5.2, 0]);
    this.top = new THREE.Group(); this.top.userData.partName = PARTS.upper; this.add(this.top);
    for (const x of [-6.05, 6.05]) this.box([1.05, 7.5, 7.8], shell, PARTS.upper, this.top, [x, 15.25, -2.9]);
    this.box([13.1, 7.5, 1], shell, PARTS.upper, this.top, [0, 15.25, -6.2]);
    this.box([13.1, 0.9, 3.2], shell, PARTS.upper, this.top, [0, 19.1, -4.75]);
    for (const x of [-4.65, 4.65]) this.box([3.0, 0.9, 3.6], shell, PARTS.upper, this.top, [x, 19.1, -0.1]);
    this.moving = new THREE.Group(); this.moving.userData.partName = PARTS.stem; this.add(this.moving);
    this.box([5.4, 1.35, 5.4], stemMaterial, PARTS.stem, this.moving, [0, 0.675, 0]);
    this.box([1.22, 4.8, 4.1], stemMaterial, PARTS.stem, this.moving, [0, 2.8, 0]);
    this.box([4.1, 4.8, 1.22], stemMaterial, PARTS.stem, this.moving, [0, 2.8, 0]);
    this.guidePost = this.mesh(new THREE.CylinderGeometry(0.65, 0.65, 5.3, 16), stemMaterial, '轴心导柱', this.moving, [0, -3.0, 0]);
    for (const x of [-2.25, 2.25]) this.box([0.85, 2.2, 0.8], stemMaterial, '导轨', this.moving, [x, -0.8, -2.1]);
    this.cam = this.mesh(camProfileGeometry(this.params, this.type), stemMaterial, this.type === 'tactile' ? PARTS.cam : '线性导向面', this.moving);
    const profileTop = this.cam.geometry.boundingBox.max.y;
    if (profileTop < -0.4) this.box([0.8, -profileTop + 0.5, 1.4], stemMaterial, '凸轮连接筋', this.moving, [2.55, profileTop / 2, 2.9], 0.1);
    this.spring = this.mesh(new CoilGeometry(this.params, { detail: this.detail }), steel, PARTS.spring, this, [0, 8.4, 0]);
    this.leaf = new THREE.Group(); this.add(this.leaf);
    // Thin flexible strip; upper sections move with contact/cam deflection.
    this.leafBase = this.box([0.22, 2.8, 1.6], copper, PARTS.moving, this.leaf, [4.2, 9.65, 2.9], 0.07);
    this.leafUpper = this.box([0.22, 5.5, 1.6], copper, PARTS.moving, this.leaf, [4.2, 13.65, 2.9], 0.07);
    this.fixedContact = this.box([0.22, 7.6, 1.6], copper, PARTS.fixed, this.leaf, [5.25, 12, 2.9], 0.07);
    this.contactDot = this.mesh(new THREE.SphereGeometry(0.42, 16, 10), silver, PARTS.contact, this.leaf, [4.4, 15.75, 2.9]);
    this.mesh(new THREE.SphereGeometry(0.42, 16, 10), silver, PARTS.contact, this.leaf, [5.05, 15.75, 2.9]);
    this.cap = new THREE.Group(); this.add(this.cap);
    const capMaterial = new THREE.MeshStandardMaterial({ color: '#ece5d6', roughness: 0.33, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });
    this.capMesh = this.mesh(keycapGeometry(), capMaterial, PARTS.cap, this.cap);
    this.partAnchors = { '键帽': new THREE.Vector3(8, 27, 0), '上盖剖面': new THREE.Vector3(-6.5, 16, 0), '十字轴心': new THREE.Vector3(2.5, 22, 0), '压缩弹簧': new THREE.Vector3(-1.8, 13, 0), '动静触片': new THREE.Vector3(5, 14, 3), '下座': new THREE.Vector3(-6.5, 8, 0), '引脚': new THREE.Vector3(4.2, 3, 2.9) };
    this.update(this.state);
  }
  update(state = {}) {
    this.state = state;
    const q = (state.displacement || 0) * 1000;
    const length = state.length ?? this.params.freeLength - this.params.preload - q / 1000;
    const top = 8.4 + length * 1000;
    this.moving.position.y = top + (this.exploded ? 10 : 0);
    this.cap.position.y = top + 4 + (this.exploded ? 25 : 0);
    this.spring.geometry.setLength(length);
    this.top.position.y = this.exploded ? 17 : 0;
    this.bottom.position.y = this.exploded ? -5 : 0;
    this.leaf.position.x = this.exploded ? 6 : 0;
    const closed = Boolean(state.triggered ?? state.contactClosed ?? state.contact ?? false);
    const deflect = Math.min(0.6, Math.max(0, (state.leafDeflection || 0) * 1000));
    this.leafUpper.rotation.z = closed ? -0.09 : 0.02 + deflect * 0.04;
    this.contactDot.position.x = closed ? 4.25 : 4.05 - deflect * 0.15;
    this.partAnchors['键帽']?.set(8, this.cap.position.y + 5, 0);
    this.partAnchors['十字轴心']?.set(2.5, this.moving.position.y + 3, 0);
    this.partAnchors['压缩弹簧']?.set(-1.8, 8.4 + length * 500, 0);
    this.partAnchors['上盖剖面']?.set(-6.5, 16 + this.top.position.y, 0);
    this.partAnchors['下座']?.set(-6.5, 8 + this.bottom.position.y, 0);
    this.partAnchors['引脚']?.set(4.2, 3 + this.bottom.position.y, 2.9);
    this.partAnchors['动静触片']?.set(5 + this.leaf.position.x, 14, 3);
    return this;
  }
  setParameters(params, type = this.type) { this.params = { ...MODEL_DEFAULTS, ...params }; this.type = type; disposeObject(this); this.clear(); this.build(); return this; }
  setExploded(value) { this.exploded = Boolean(value); this.update(this.state); return this; }
  dispose() { disposeObject(this); this.clear(); }
}
