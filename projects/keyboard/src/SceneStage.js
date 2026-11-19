import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class SceneStage {
  constructor(host,{detail=false}={}){
    this.host=host;this.detail=detail;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(detail?'#e9e7e1':'#eae8e2');
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
    this.renderer.shadowMap.enabled=!detail;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label',detail?'当前按键的内部机械结构，可拖动旋转':'87 键机械键盘，点击按压按键，拖动空白处旋转');
    host.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(detail?34:36,1,detail?.1:1,detail?1000:8000);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;
    this.controls.minDistance=detail?24:180;this.controls.maxDistance=detail?140:1050;this.controls.maxPolarAngle=Math.PI*.495;this.controls.enablePan=!detail;
    const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);
    this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;environment.dispose();pmrem.dispose();this.scene.environmentIntensity=detail?.85:.65;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0xb8ac98,.8));
    const key=new THREE.DirectionalLight(0xfff4e7,2);key.position.set(detail?25:100,detail?55:350,detail?30:140);key.castShadow=!detail;
    key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-270;key.shadow.camera.right=270;key.shadow.camera.top=220;key.shadow.camera.bottom=-220;key.shadow.camera.far=1000;key.shadow.bias=-.0004;key.shadow.normalBias=.2;key.shadow.radius=4;this.scene.add(key);
    const rim=new THREE.DirectionalLight(0xd2deff,.7);rim.position.set(-200,160,-190);this.scene.add(rim);
    if(!detail){const floor=new THREE.Mesh(new THREE.PlaneGeometry(8000,8000),new THREE.MeshStandardMaterial({color:0xe3e0d7,roughness:.96,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-4.5;floor.receiveShadow=true;this.floor=floor;this.scene.add(floor);this.scene.fog=new THREE.Fog(0xeae8e2,950,2300);}
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.model=null;this.resetView();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.tooltip=document.createElement('div');this.tooltip.className='part-tooltip';this.tooltip.hidden=true;host.append(this.tooltip);
  }
  setModel(model){if(this.model)this.scene.remove(this.model);this.model=model;this.scene.add(model);}
  resetView(){if(this.detail){this.setExpanded(this.model?.exploded??false);}else{const expanded=this.model?.view==='exploded',targetY=expanded?28:0,fit=(expanded?1.36:1.16)*Math.max(1,2.25/(this.host.clientWidth/this.host.clientHeight));this.controls.target.set(0,targetY,0);this.camera.position.set(45*fit,targetY+160*fit,220*fit);}this.controls.update();}
  setExpanded(expanded){if(!this.detail)return;this.controls.target.set(0,expanded?28:17,0);this.camera.position.set(expanded?45:31,expanded?46:30,expanded?89:47);this.controls.update();}
  resize(){const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  pick(event,objects,recursive=true){const bounds=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return this.raycaster.intersectObjects(objects,recursive)[0]??null;}
  showPart(event){if(!this.model)return;const hit=this.pick(event,[this.model]);let object=hit?.object,name;while(object&&!name){name=object.userData.partName;object=object.parent;}this.tooltip.hidden=!name;if(name){this.tooltip.textContent=name;const box=this.host.getBoundingClientRect();this.tooltip.style.left=Math.min(box.width-140,event.clientX-box.left+10)+'px';this.tooltip.style.top=Math.max(6,event.clientY-box.top-32)+'px';}}
  render(){if(this.floor)this.floor.position.y=this.model?.view==='exploded'?-16.5:-4.5;this.controls.update();this.renderer.render(this.scene,this.camera);}
  dispose(){this.observer.disconnect();this.controls.dispose();this.environment.dispose();this.scene.traverse(o=>{if(!this.model||!this.model.getObjectById(o.id)){o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer.dispose();this.tooltip.remove();}
}
