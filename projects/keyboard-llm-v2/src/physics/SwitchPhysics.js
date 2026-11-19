/**
 * One-dimensional switch mechanics. All public quantities use SI units.
 * Downward displacement/force is positive. No rendering dependency.
 */
export const GRAVITY = 9.80665;
export const FIXED_STEP = 0.00025;
export const MAX_FRAME_TIME = 0.1;
const FRICTION_SPEED = 0.025;
const COIL_CLEARANCE = 0.0002;
export const LEAF_STIFFNESS_RATIO = 17;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const DEFAULT_PARAMETERS = Object.freeze({
  wireDiameter: 0.00022,
  meanDiameter: 0.0035,
  activeCoils: 8,
  freeLength: 0.015,
  preload: 0.0044,
  mass: 0.003,
  damping: 0.25,
  travel: 0.004,
  actuation: 0.002,
  resetPoint: 0.0018,
  shearModulus: 79e9,
  friction: 0.012,
});

const limit = (min, max, step, label, unit) => Object.freeze({ min, max, step, label, unit });
export const PARAMETER_LIMITS = Object.freeze({
  wireDiameter: limit(0.00012, 0.00035, 0.000005, '线径', 'm'),
  meanDiameter: limit(0.0025, 0.0055, 0.0001, '平均圈径', 'm'),
  activeCoils: limit(4, 14, 0.5, '有效圈数', ''),
  freeLength: limit(0.008, 0.022, 0.0001, '自由长度', 'm'),
  preload: limit(0.0002, 0.009, 0.0001, '预压量', 'm'),
  mass: limit(0.001, 0.03, 0.0001, '运动质量', 'kg'),
  damping: limit(0, 1.5, 0.01, '阻尼', 'N·s/m'),
  travel: limit(0.001, 0.005, 0.0001, '总行程', 'm'),
  actuation: limit(0.0001, 0.0049, 0.0001, '触发行程', 'm'),
  resetPoint: limit(0.00005, 0.0048, 0.0001, '复位行程', 'm'),
  shearModulus: limit(35e9, 90e9, 1e9, '剪切模量', 'Pa'),
  friction: limit(0, 0.06, 0.001, '摩擦力', 'N'),
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label}必须是有限数值。`);
  }
  return value;
}

export function springStiffness(p) {
  return p.shearModulus * p.wireDiameter ** 4 /
    (8 * p.meanDiameter ** 3 * p.activeCoils);
}

/** Atomic validation: no input object is modified, no value silently clamped. */
export function validateParameters(partial = {}, current = DEFAULT_PARAMETERS) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    throw new TypeError('参数必须是对象。');
  }
  for (const name of Object.keys(partial)) {
    if (!Object.hasOwn(PARAMETER_LIMITS, name)) throw new RangeError(`未知参数：${name}`);
  }
  const p = { ...DEFAULT_PARAMETERS, ...current, ...partial };
  for (const [name, range] of Object.entries(PARAMETER_LIMITS)) {
    finite(p[name], range.label);
    if (p[name] < range.min || p[name] > range.max) {
      throw new RangeError(`${range.label}超出范围 [${range.min}, ${range.max}] ${range.unit}。`);
    }
  }
  if (!(p.resetPoint < p.actuation && p.actuation < p.travel)) {
    throw new RangeError('需要满足：复位行程 < 触发行程 < 总行程。');
  }
  if (p.meanDiameter / p.wireDiameter < 6) {
    throw new RangeError('平均圈径至少为线径的 6 倍。');
  }
  if (p.meanDiameter + p.wireDiameter > 0.006) {
    throw new RangeError('弹簧外径不能超过轴座的 6 mm 容纳空间。');
  }
  const installedLength = p.freeLength - p.preload;
  const solidLength = (p.activeCoils + 2) * p.wireDiameter;
  if (installedLength < 0.008 - 1e-12 || installedLength > 0.013 + 1e-12) {
    throw new RangeError('安装长度（自由长度 − 预压量）必须在 8–13 mm 之间，才能适配固定轴座。');
  }
  if (installedLength - p.travel <= solidLength + COIL_CLEARANCE) {
    throw new RangeError('触底时弹簧将压实：增加自由长度，或减小预压、行程、圈数或线径。');
  }
  if (springStiffness(p) * p.preload <= p.mass * GRAVITY + 0.001) {
    throw new RangeError('弹簧预压力必须大于运动部件重力，才能可靠回顶。');
  }
  return p;
}

function validateType(type) {
  if (type !== 'linear' && type !== 'tactile') {
    throw new RangeError('轴体类型应为 linear 或 tactile。');
  }
  return type;
}

/**
 * δ(q) is the deflection of a reference contact leaf from its unstressed state.
 * U_leaf = 1/2 k_leaf δ²; F_leaf = dU_leaf/dq = k_leaf δ δ'.
 * Geometry scales with travel and k_leaf = 17 k_coil; these are model choices,
 * not measured properties of any commercial switch.
 */
export function leafProfile(q, p, type = 'linear', stiffness = springStiffness(p)) {
  const baseline = 0.1 * p.travel;
  let deflection = baseline + 0.02 * q;
  let slope = 0.02;
  if (type === 'tactile') {
    const width = 0.125 * p.travel;
    const r = (q - 0.46 * p.travel) / width;
    const bump = 0.05 * p.travel * Math.exp(-0.5 * r * r);
    deflection += bump;
    slope -= bump * r / width;
  }
  const leafStiffness = LEAF_STIFFNESS_RATIO * stiffness;
  return {
    deflection,
    slope,
    stiffness: leafStiffness,
    force: leafStiffness * deflection * slope,
    potential: 0.5 * leafStiffness * deflection * deflection,
  };
}

export function sampleForceCurve(parameters = DEFAULT_PARAMETERS, type = 'linear', count = 161) {
  const p = validateParameters(parameters);
  validateType(type);
  if (!Number.isInteger(count) || count < 2 || count > 10001) throw new RangeError('采样数量应为 2–10001 的整数。');
  const k = springStiffness(p);
  return Array.from({ length: count }, (_, i) => {
    const q = p.travel * i / (count - 1);
    const springForce = k * (p.preload + q);
    const leafForce = leafProfile(q, p, type, k).force;
    const force = springForce + leafForce - p.mass * GRAVITY;
    return { displacement: q, force, holdingForce: force, springForce, leafForce,
      pressForce: force + p.friction, releaseForce: force - p.friction };
  });
}

export class SwitchPhysics {
  constructor(parameters = {}, type = 'linear') {
    this._parameters = validateParameters(parameters);
    this._type = validateType(type);
    this._k = springStiffness(this._parameters);
    this._q = 0;
    this._v = 0;
    this._force = 0;
    this._held = false;
    this._contact = false;
    this._time = 0;
    this._accumulator = 0;
    this._events = [];
  }

  get parameters() { return this.getParameters(); }
  get type() { return this._type; }
  getParameters() { return { ...this._parameters }; }

  setParameters(partial) {
    const next = validateParameters(partial, this._parameters);
    this._parameters = next;
    this._k = springStiffness(next);
    this.reset();
    return this;
  }

  setType(type) {
    validateType(type);
    if (type !== this._type) { this._type = type; this.reset(); }
    return this;
  }

  setForce(force) {
    finite(force, '外加压力');
    if (force < 0 || force > 20) throw new RangeError('外加压力范围为 0–20 N。');
    this._force = force;
    this._held = false;
    return this;
  }

  setDisplacement(displacement, { hold = true } = {}) {
    finite(displacement, '位移');
    this._q = clamp(displacement, 0, this._parameters.travel);
    this._v = 0;
    this._force = 0;
    this._held = Boolean(hold);
    this._accumulator = 0;
    this._updateContact();
    return this;
  }

  release() {
    this._held = false;
    this._force = 0;
    return this;
  }

  reset() {
    const wasContact = this._contact;
    this._q = this._v = this._force = this._accumulator = 0;
    this._held = this._contact = false;
    this._events.length = 0;
    if (wasContact) this._events.push({ type: 'reset', displacement: 0, velocity: 0, time: this._time });
    return this;
  }

  getForces(q = this._q, velocity = this._v) {
    finite(q, '位移');
    finite(velocity, '速度');
    const p = this._parameters;
    const springForce = this._k * (p.preload + q);
    const leaf = leafProfile(q, p, this._type, this._k);
    const frictionForce = p.friction * Math.tanh(velocity / FRICTION_SPEED);
    const dampingForce = p.damping * velocity;
    const gravityForce = p.mass * GRAVITY;
    const totalResistance = springForce + leaf.force + frictionForce + dampingForce - gravityForce;
    return {
      springForce, leafForce: leaf.force, frictionForce, dampingForce, gravityForce,
      externalForce: this._force, holdingForce: totalResistance, totalResistance,
      netForce: this._force - totalResistance, leafDeflection: leaf.deflection,
    };
  }

  getState() {
    const p = this._parameters;
    const forces = this.getForces();
    const leaf = leafProfile(this._q, p, this._type, this._k);
    const leafAtTop = leafProfile(0, p, this._type, this._k);
    const springEnergy = 0.5 * this._k * ((p.preload + this._q) ** 2 - p.preload ** 2);
    const energy = 0.5 * p.mass * this._v ** 2 + springEnergy +
      leaf.potential - leafAtTop.potential - p.mass * GRAVITY * this._q;
    const constrained = this._held ||
      (this._q === 0 && this._v === 0 && forces.netForce < 0) ||
      (this._q === p.travel && this._v === 0 && forces.netForce > 0);
    return {
      displacement: this._q, velocity: this._v, ...forces,
      rawNetForce: forces.netForce, netForce: constrained ? 0 : forces.netForce,
      constraintForce: constrained ? -forces.netForce : 0,
      contact: this._contact, held: this._held, type: this._type,
      energy, stiffness: this._k, length: p.freeLength - p.preload - this._q,
      solidLength: (p.activeCoils + 2) * p.wireDiameter,
      leafStiffness: leaf.stiffness, time: this._time,
    };
  }

  _updateContact() {
    const wasContact = this._contact;
    if (!wasContact && this._q >= this._parameters.actuation) this._contact = true;
    else if (wasContact && this._q <= this._parameters.resetPoint) this._contact = false;
    if (this._contact !== wasContact) {
      this._events.push({ type: this._contact ? 'actuate' : 'reset',
        displacement: this._q, velocity: this._v, time: this._time });
    }
  }

  _acceleration(q, v) {
    const p = this._parameters;
    return (this._force + p.mass * GRAVITY - this._k * (p.preload + q) -
      leafProfile(q, p, this._type, this._k).force - p.damping * v -
      p.friction * Math.tanh(v / FRICTION_SPEED)) / p.mass;
  }

  _integrate(h) {
    this._time += h;
    if (this._held) return;
    const q = this._q;
    const v = this._v;
    const a = this._acceleration(q, v);
    if (v === 0 && ((q === 0 && a <= 0) || (q === this._parameters.travel && a >= 0))) return;
    const k1q = v;
    const k1v = a;
    const k2q = v + h * k1v * 0.5;
    const k2v = this._acceleration(q + h * k1q * 0.5, k2q);
    const k3q = v + h * k2v * 0.5;
    const k3v = this._acceleration(q + h * k2q * 0.5, k3q);
    const k4q = v + h * k3v;
    const k4v = this._acceleration(q + h * k3q, k4q);
    this._q += h * (k1q + 2 * k2q + 2 * k3q + k4q) / 6;
    this._v += h * (k1v + 2 * k2v + 2 * k3v + k4v) / 6;
    if (this._q <= 0) { this._q = 0; this._v = Math.max(0, this._v); }
    if (this._q >= this._parameters.travel) {
      this._q = this._parameters.travel;
      this._v = Math.min(0, this._v);
    }
    this._updateContact();
  }

  /**
   * Advance fixed 0.25 ms steps, cap long frames to 100 ms.
   * Returns a copy of newly generated events without draining the event queue.
   * consumeEvents() also includes immediate crossings from setDisplacement().
   */
  step(dt) {
    finite(dt, '时间步长');
    if (dt < 0) throw new RangeError('时间步长不能为负数。');
    const initialEvents = this._events.length;
    this._accumulator += Math.min(dt, MAX_FRAME_TIME);
    while (this._accumulator >= FIXED_STEP - 1e-12) {
      this._integrate(FIXED_STEP);
      this._accumulator = Math.max(0, this._accumulator - FIXED_STEP);
    }
    return this._events.slice(initialEvents);
  }

  consumeEvents() {
    const events = this._events;
    this._events = [];
    return events;
  }
}
