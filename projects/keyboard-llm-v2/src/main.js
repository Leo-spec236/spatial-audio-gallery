import {attachKeyboardAudio} from './keyboardAudio.js';
let keyboardAudio;
import { KeyboardController } from './KeyboardController.js';
import { SceneStage } from './SceneStage.js';
import { ForceChart } from './ForceChart.js';
import { KEY_LAYOUT } from './models/layout.js';
import { KeyboardModel } from './models/KeyboardModel.js';
import { SwitchModel } from './models/SwitchModel.js';
import { PARAMETER_LIMITS } from './physics/SwitchPhysics.js';

const $=id=>document.getElementById(id),keyByCode=new Map(KEY_LAYOUT.map(k=>[k.code,k]));
let controller,boardStage,detailStage,board,detail,chart,selected='KeyA',view='assembled',last=0,raf=0,disposed=false,fpsFrames=0,fpsTime=0,statsTime=0,pressedTotal=0,caps=false;
const pointers=new Map(),hardware=new Set();
const status=text=>{$('status').textContent=text;};
function guarded(callback){return(...args)=>{try{return callback(...args);}catch(error){status(error.message);$('parameter-error').textContent=error.message;}};}
function syncParameters(){
  const sw=controller.getSwitch(selected),p=sw.getParameters();
  for(const input of document.querySelectorAll('[data-param]')){const key=input.dataset.param,scale=Number(input.dataset.unitScale)||1,limit=PARAMETER_LIMITS[key];if(limit){input.min=limit.min/scale;input.max=limit.max/scale;if(limit.step)input.step=limit.step/scale;}input.value=Number((p[key]/scale).toPrecision(7));}
  $('switch-type').value=sw.type;$('hold-displacement').max=(p.travel*1000).toFixed(2);$('travel-value').textContent=(p.travel*1000).toFixed(2)+' mm';$('stiffness-value').textContent=controller.getKeyState(selected).stiffness.toFixed(2)+' N/m';chart.configure(p,sw.type);$('parameter-error').textContent='';
}
function select(code){controller.getSwitch(code);if(selected!==code)controller.releaseHold(selected);selected=code;const key=keyByCode.get(code),sw=controller.getSwitch(code);$('selected-key').textContent=key.label||'SPACE';if($('selected-type'))$('selected-type').textContent=sw.type==='tactile'?'段落轴':'线性轴';board.setSelected(code);detail.setParameters(sw.getParameters(),sw.type);syncParameters();status(`已选中 ${key.label||'SPACE'} · 按住试压，或拖动行程保持位置`);}
function refreshModels(codes){for(const code of codes){const sw=controller.getSwitch(code);board.setParameters(code,sw.getParameters(),sw.type);}detail.setParameters(controller.getSwitch(selected).getParameters(),controller.getSwitch(selected).type);syncParameters();}
function scope(){return $('scope').value==='all'?'all':selected;}
function setParameters(code,partial){const codes=controller.setParameters(code,partial);refreshModels(codes);return controller.getSwitch(code==='all'?selected:code).getParameters();}
function setSwitchType(code,type){const codes=controller.setSwitchType(code,type);refreshModels(codes);if($('selected-type'))$('selected-type').textContent=controller.getSwitch(selected).type==='tactile'?'段落轴':'线性轴';return type;}
function setView(mode){if(!['assembled','transparent','exploded'].includes(mode))throw new TypeError('视图应为 assembled、transparent 或 exploded');view=mode;board.setView(mode);boardStage.resetView();for(const button of document.querySelectorAll('[data-view]')){const active=button.dataset.view===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}status(mode==='exploded'?'分层拆解 · 展示偏移不改变按键物理':mode==='transparent'?'透明观察 · 可以看到各键弹簧压缩与触点动作':'整机模式 · 鼠标按压，拖动空白处旋转');return mode;}
function setPause(value=!controller.paused){const paused=controller.pause(value);const label=$('pause').querySelector('span');if(label)label.textContent=paused?'继续':'暂停';else $('pause').textContent=paused?'继续':'暂停';$('pause').setAttribute('aria-pressed',String(paused));status(paused?'已暂停物理 · 仍可旋转和拆解观察':'物理模拟运行中');return paused;}
function releaseInteractions(){hardware.clear();pointers.clear();controller.releaseAll();if(boardStage)boardStage.controls.enabled=true;}
function reset(){releaseInteractions();controller.reset();pressedTotal=0;setPause(false);$('typing-output').value='';caps=false;status('全部按键已复位 · 保留当前结构参数');}
function inputForce(){return Number($('press-force').value);}
function down(code,source){controller.press(code,{force:inputForce()},source);}
function insertCharacter(code){
  const output=$('typing-output'),shift=hardware.has('ShiftLeft')||hardware.has('ShiftRight')||controller.getKeyState('ShiftLeft').contact||controller.getKeyState('ShiftRight').contact;
  if(code==='CapsLock'){caps=!caps;return;}
  if(code==='Backspace'){output.value=Array.from(output.value).slice(0,-1).join('');return;}
  if(code==='Delete'){output.value='';return;}
  let text='';if(code.startsWith('Key')){const letter=code.slice(3);text=shift!==caps?letter:letter.toLowerCase();}
  else if(code.startsWith('Digit'))text=shift?')!@#$%^&*('[Number(code.slice(5))]:code.slice(5);
  else if(code==='Space')text=' ';else if(code==='Enter')text='\n';else if(code==='Tab')text='  ';
  else {const pairs={Backquote:['`','~'],Minus:['-','_'],Equal:['=','+'],BracketLeft:['[','{'],BracketRight:[']','}'],Backslash:['\\','|'],Semicolon:[';',':'],Quote:["'",'"'],Comma:[',','<'],Period:['.','>'],Slash:['/','?']};if(pairs[code])text=pairs[code][shift?1:0];}
  output.value=(output.value+text).slice(-2000);output.scrollTop=output.scrollHeight;
}
function connectInputs(){
  const canvas=boardStage.renderer.domElement;
  canvas.addEventListener('pointerdown',guarded(event=>{if(event.button!==0)return;const hit=boardStage.pick(event,board.pickMeshes);let obj=hit?.object;while(obj&&!obj.userData.keyCode)obj=obj.parent;if(!obj)return;const code=obj.userData.keyCode;event.preventDefault();boardStage.controls.enabled=false;canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});pointers.set(event.pointerId,code);select(code);down(code,'pointer:'+event.pointerId);}),true);
  function endPointer(event){const code=pointers.get(event.pointerId);if(code){controller.release(code,'pointer:'+event.pointerId);pointers.delete(event.pointerId);}if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(!pointers.size)boardStage.controls.enabled=true;}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endPointer);
  canvas.addEventListener('pointermove',event=>{if(pointers.size)return;canvas.style.cursor=boardStage.pick(event,board.pickMeshes)?'pointer':'grab';});
  detailStage.renderer.domElement.addEventListener('pointermove',e=>detailStage.showPart(e));detailStage.renderer.domElement.addEventListener('pointerleave',()=>{detailStage.tooltip.hidden=true;});
  const press=$('press-test');
  press.addEventListener('pointerdown',guarded(e=>{e.preventDefault();press.setPointerCapture(e.pointerId);pointers.set('test'+e.pointerId,selected);down(selected,'test:'+e.pointerId);}));
  const releaseTest=e=>{const code=pointers.get('test'+e.pointerId);if(code){controller.release(code,'test:'+e.pointerId);pointers.delete('test'+e.pointerId);}if(press.hasPointerCapture(e.pointerId))press.releasePointerCapture(e.pointerId);};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])press.addEventListener(name,releaseTest);
  press.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)down(selected,'test-key');}});press.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();controller.release(selected,'test-key');}});press.addEventListener('blur',()=>controller.releaseSource('test-key'));
  $('capture-input').addEventListener('change',e=>{if(e.target.checked){canvas.focus({preventScroll:true});status('实体键盘映射已开启 · 在三维视图中试打');}else{for(const code of hardware)controller.release(code,'hardware');hardware.clear();}});
  document.addEventListener('keydown',guarded(e=>{if(!$('capture-input').checked||document.activeElement!==canvas||!keyByCode.has(e.code))return;e.preventDefault();if(e.repeat||hardware.has(e.code))return;hardware.add(e.code);select(e.code);down(e.code,'hardware');}));
  document.addEventListener('keyup',e=>{if(hardware.has(e.code)){controller.release(e.code,'hardware');hardware.delete(e.code);}});
  canvas.addEventListener('blur',()=>{for(const code of hardware)controller.release(code,'hardware');hardware.clear();});
  window.addEventListener('blur',releaseInteractions);document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)releaseInteractions();});
  $('hold-displacement').addEventListener('input',guarded(e=>{controller.hold(selected,Number(e.target.value)/1000);$('hold-displacement-value').textContent=Number(e.target.value).toFixed(2)+' mm';status('位移保持中 · 释放后按当前弹力回弹');}));
  $('release-hold').addEventListener('click',()=>{controller.releaseHold(selected);status('已解除位移保持');});
}
function updateReadouts(state){
  $('displacement-value').textContent=(state.displacement*1000).toFixed(2);$('velocity-value').textContent=(state.velocity*1000).toFixed(1);$('spring-force-value').textContent=(state.springForce*100).toFixed(1);$('external-force-value').textContent=(state.externalForce*100).toFixed(1);$('contact-state').textContent=state.contact?'已触发':'未触发';$('contact-state').classList.toggle('is-active',state.contact);$('contact-state').dataset.active=state.contact;
  $('pressed-count').textContent=String([...controller.switches.values()].filter(sw=>sw.getState().contact).length);
  if(document.activeElement!==$('hold-displacement'))$('hold-displacement').value=(state.displacement*1000).toFixed(3);
  $('hold-displacement-value').textContent=(state.displacement*1000).toFixed(2)+' mm';
}
function loop(now){if(disposed)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;controller.step(dt);const states=controller.getStates(),state=states.get(selected);board.update(states,selected);detail.update(state);boardStage.render();keyboardAudio.update();detailStage.render();statsTime+=dt;fpsTime+=dt;fpsFrames++;if(statsTime>.04){statsTime=0;updateReadouts(state);chart.draw(state);}if(fpsTime>.7){$('fps-value').textContent=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;}raf=requestAnimationFrame(loop);}
try{
  controller=new KeyboardController();boardStage=new SceneStage($('viewport'));detailStage=new SceneStage($('switch-viewport'),{detail:true});const initial=controller.getSwitch(selected).getParameters();board=new KeyboardModel(initial);detail=new SwitchModel(initial,'linear',{detail:true});boardStage.setModel(board);detailStage.setModel(detail);chart=new ForceChart($('force-chart'));
  controller.subscribe(event=>{if(event.type==='actuate'){pressedTotal++;insertCharacter(event.code);}window.dispatchEvent(new CustomEvent('keyboardlab:'+event.type,{detail:event}));});
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
  $('pause').addEventListener('click',()=>setPause());$('reset').addEventListener('click',reset);$('view-reset').addEventListener('click',()=>{boardStage.resetView();detailStage.resetView();});
  $('slow').addEventListener('click',()=>{controller.speed=controller.speed===1?.2:1;$('slow').setAttribute('aria-pressed',String(controller.speed!==1));$('slow').classList.toggle('active',controller.speed!==1);status(controller.speed!==1?'慢动作 · 按五分之一速度观察机构':'实时速度');});
  $('switch-type').addEventListener('change',guarded(e=>{setSwitchType(scope(),e.target.value);status(e.target.value==='tactile'?'已装配段落轴 · 比较曲线中的阻力峰与回落':'已装配线性轴 · 阻力随压缩平滑增加');}));
  $('apply-parameters').addEventListener('click',guarded(()=>{const patch={};for(const input of document.querySelectorAll('[data-param]'))patch[input.dataset.param]=Number(input.value)*(Number(input.dataset.unitScale)||1);setParameters(scope(),patch);status('结构参数已应用 · 对应按键已复位');}));
  $('press-force').addEventListener('input',()=>{$('press-force-value').textContent=(inputForce()*100).toFixed(0)+' cN';});$('press-force-value').textContent='70 cN';
  $('clear-typing').addEventListener('click',()=>{$('typing-output').value='';});
  $('detail-explode')?.addEventListener('change',e=>{detail.setExploded(e.target.checked);detailStage.setExpanded(e.target.checked);});
  $('show-method').addEventListener('click',()=>{$('method-dialog').showModal();releaseInteractions();});$('close-method').addEventListener('click',()=>$('method-dialog').close());$('method-dialog').addEventListener('click',e=>{if(e.target===$('method-dialog'))$('method-dialog').close();});
  keyboardAudio = attachKeyboardAudio(board, boardStage, controller);
  connectInputs();select(selected);setView('assembled');
  window.keyboardLab=Object.freeze({press:(code,options)=>controller.press(code,options),release:code=>controller.release(code),setSwitchType,setParameters,getKeyState:code=>controller.getKeyState(code),getParameters:code=>controller.getSwitch(code).getParameters(),setView,pause:setPause,reset,selectKey:select,holdKey:(code,q)=>controller.hold(code,q),releaseHold:code=>controller.releaseHold(code),getState:()=>({selected,view,paused:controller.paused,time:controller.time,speed:controller.speed,actuations:pressedTotal,keys:87}),on:(listener)=>controller.subscribe(listener)});
  status('87 个独立键轴已就绪 · 选中按键，开始试压');raf=requestAnimationFrame(loop);
}catch(error){console.error(error);status('启动失败：'+error.message);const alert=document.createElement('div');alert.className='startup-error';alert.textContent='无法初始化三维键盘：'+error.message;$('viewport').append(alert);}
window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;cancelAnimationFrame(raf);controller?.releaseAll();chart?.dispose();board?.dispose();detail?.dispose();boardStage?.dispose();detailStage?.dispose();});

