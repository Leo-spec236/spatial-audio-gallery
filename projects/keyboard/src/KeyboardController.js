import { SwitchPhysics, DEFAULT_PARAMETERS, validateParameters } from './physics/SwitchPhysics.js';
import { KEY_LAYOUT } from './models/layout.js';

/** Physics and input ownership remain independent of Three.js and view modes. */
export class KeyboardController {
  constructor(){
    this.switches=new Map(KEY_LAYOUT.map(key=>[key.code,new SwitchPhysics({...DEFAULT_PARAMETERS},'linear')]));
    this.inputs=new Map();this.listeners=new Set();this.paused=false;this.speed=1;this.time=0;
  }
  getSwitch(code){const sw=this.switches.get(code);if(!sw)throw new RangeError(`没有此按键：${code}`);return sw;}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  flush(code){const sw=this.getSwitch(code);for(const event of sw.consumeEvents())for(const listener of this.listeners)listener({...event,code,time:this.time});}
  press(code,{force=.7}={},source='api'){
    this.getSwitch(code);
    if(!Number.isFinite(force)||force<0||force>1.5)throw new RangeError('按压力应在 0–1.5 N 之间');
    if(!this.inputs.has(code))this.inputs.set(code,new Map());
    this.inputs.get(code).set(source,force);this.applyInput(code);return this.getKeyState(code);
  }
  applyInput(code){const inputs=this.inputs.get(code);this.getSwitch(code).setForce(inputs?.size?Math.max(...inputs.values()):0);}
  release(code,source='api'){
    const sw=this.getSwitch(code),inputs=this.inputs.get(code);inputs?.delete(source);
    if(inputs?.size)this.applyInput(code);else{this.inputs.delete(code);sw.release();}
    return sw.getState();
  }
  releaseSource(source){for(const [code,sources] of [...this.inputs])if(sources.has(source))this.release(code,source);}
  releaseAll(){this.inputs.clear();for(const sw of this.switches.values())sw.release();}
  hold(code,displacement){const sw=this.getSwitch(code);if(!Number.isFinite(displacement))throw new TypeError('位移必须为有限数值');sw.setDisplacement(displacement,{hold:true});this.inputs.delete(code);this.flush(code);}
  releaseHold(code){this.getSwitch(code).release();if(this.inputs.has(code))this.applyInput(code);}
  setParameters(code,partial){
    const codes=code==='all'?[...this.switches.keys()]:[code];
    // Validate every target before mutating any switch: a mixed keyboard can
    // contain different installed lengths and travel constraints.
    const next=codes.map(c=>[c,validateParameters(partial,this.getSwitch(c).getParameters())]);
    for(const [c,parameters] of next){this.inputs.delete(c);this.getSwitch(c).setParameters(parameters);this.flush(c);}
    return codes;
  }
  setSwitchType(code,type){
    if(!['linear','tactile'].includes(type))throw new TypeError('轴体应为 linear 或 tactile');
    const codes=code==='all'?[...this.switches.keys()]:[code];for(const c of codes)this.getSwitch(c);
    for(const c of codes){this.inputs.delete(c);const sw=this.getSwitch(c);sw.release();if(sw.type===type)sw.reset();else sw.setType(type);this.flush(c);}return codes;
  }
  getKeyState(code){const sw=this.getSwitch(code);return {...sw.getState(),type:sw.type,code};}
  getStates(){return new Map([...this.switches].map(([code])=>[code,this.getKeyState(code)]));}
  pause(value=!this.paused){this.paused=Boolean(value);return this.paused;}
  reset(){this.releaseAll();this.time=0;for(const [code,sw] of this.switches){sw.reset();this.flush(code);}}
  step(dt){if(this.paused)return;const elapsed=Math.max(0,Math.min(dt,.05))*this.speed;this.time+=elapsed;for(const [code,sw] of this.switches){sw.step(elapsed);this.flush(code);}}
}
