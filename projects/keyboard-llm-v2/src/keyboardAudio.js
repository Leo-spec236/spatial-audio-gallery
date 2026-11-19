import {createSpatialSound} from './spatialSound.js';
export function attachKeyboardAudio(board, stage, controller) {
  let sound, unsubscribe, disposed=false;
  const queue=[];
  const wrapper={update(){
    if (!sound || disposed) return;
    board.updateWorldMatrix(true,false);stage.camera.updateWorldMatrix(true,false);
    for(const [code,id] of queue.splice(0)) sound.play(code,id);
    sound.update();
  },dispose(){disposed=true;queue.length=0;unsubscribe?.();sound?.dispose();}};
  wrapper.ready=(async()=>{
    const response=await fetch(new URL('./keyboard_audio_config_v2.json',document.baseURI));
    if(!response.ok) throw Error('配置加载失败');
    const c=await response.json();
    if(c.schema_version!=='2.0'||c.runtime.listener_mode!=='camera_relative_sources'||c.runtime.reset_sound_enabled||c.runtime.enabled_events.join()!=='actuate') throw Error('不支持的配置');
    const effects=new Map(c.effects.map(e=>[e.id,e]));
    const files=Object.fromEntries(c.assets.map(a=>[a.id,a.target_path]));
    const mapping=new Map();
    for(const g of c.source_groups){
      const effect=effects.get(g.event_sounds.actuate);
      if(g.gain!==1||g.anchor_mode!=='assembled_switch'||effect?.playback!=='oneshot'||effect?.selection_policy!=='single'||effect.asset_ids.length!==1||!files[effect.asset_ids[0]]) throw Error('不支持的音效映射');
      for(const code of g.key_codes){if(mapping.has(code)||!board.keys.has(code))throw Error('重复或未知键 '+code);mapping.set(code,effect.asset_ids[0]);}
    }
    if(mapping.size!==board.keys.size)throw Error('按键覆盖不完整');
    if(disposed)return;
    const point=board.position.clone();
    sound=createSpatialSound(files,code=>{
      const key=board.keys.get(code);
      point.set(key.x,c.runtime.anchor_local_y_mm,key.z);
      board.localToWorld(point);stage.camera.worldToLocal(point);
      return point.multiplyScalar(c.runtime.scene_to_audio_scale);
    },new URL('./',document.baseURI));
    await sound.ready;
    if(disposed)return;
    unsubscribe=controller.subscribe(({type,code})=>{
      if(type==='actuate'&&mapping.has(code))queue.push([code,mapping.get(code)]);
    });
    document.getElementById('llm-audio-status').textContent='音效就绪 · 点击视图启用声音';
  })().catch(error=>{
    console.error(error);document.getElementById('llm-audio-status').textContent='音效加载失败：'+error.message;
    wrapper.dispose();
  });
  const label=document.createElement('div');label.id='llm-audio-status';label.textContent='加载 LLM 音效…';
  label.style.cssText='position:fixed;bottom:8px;left:12px;z-index:100;background:#183e37;color:white;padding:6px 12px;border-radius:6px;font-size:12px;pointer-events:none';document.body.append(label);
  window.addEventListener('pagehide',e=>{if(!e.persisted)wrapper.dispose();});
  return wrapper;
}
