import { sampleForceCurve } from './physics/SwitchPhysics.js';

export class ForceChart {
  constructor(canvas){this.canvas=canvas;this.context=canvas.getContext('2d');this.points=[];this.history=[];this.maxForce=85;this.signature='';this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();}
  resize(){const r=this.canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio,2);this.canvas.width=Math.max(1,r.width*scale);this.canvas.height=Math.max(1,r.height*scale);this.width=r.width;this.height=r.height;this.scale=scale;}
  configure(parameters,type){const sig=JSON.stringify([parameters,type]);if(this.signature===sig)return;this.signature=sig;this.parameters=parameters;this.type=type;this.points=sampleForceCurve(parameters,type,121);this.history=[];this.maxForce=Math.ceil(Math.max(75,...this.points.map(p=>p.pressForce*100))*1.12/10)*10;}
  draw(state){
    const ctx=this.context,w=this.width,h=this.height;if(!w||!h||!this.points.length)return;
    ctx.setTransform(this.scale,0,0,this.scale,0,0);ctx.clearRect(0,0,w,h);
    const left=40,top=18,bottom=h-30,right=w-16,x=q=>left+q/this.parameters.travel*(right-left),y=f=>bottom-f*100/this.maxForce*(bottom-top);
    ctx.font='10px "Segoe UI",sans-serif';ctx.fillStyle='#89918d';ctx.strokeStyle='#deded5';ctx.lineWidth=1;
    for(let n=0;n<=4;n++){const force=this.maxForce*n/4,yy=y(force/100);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();ctx.textAlign='right';ctx.fillText(force.toFixed(0),left-7,yy+3);}
    ctx.textAlign='center';for(let i=0;i<=4;i++)ctx.fillText((this.parameters.travel*1000*i/4).toFixed(1),x(this.parameters.travel*i/4),h-12);
    ctx.textAlign='left';ctx.fillText('cN',6,12);ctx.textAlign='right';ctx.fillText('mm',w-3,12);
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    const threshold=x(this.parameters.actuation);ctx.setLineDash([3,4]);ctx.strokeStyle='#b99a79';ctx.beginPath();ctx.moveTo(threshold,top);ctx.lineTo(threshold,bottom);ctx.stroke();ctx.setLineDash([]);
    for(const [field,stroke,dash] of [['releaseForce','#a8aca6',[4,4]],['pressForce','#c4643f',[]]]){ctx.strokeStyle=stroke;ctx.setLineDash(dash);ctx.lineWidth=field==='pressForce'?2:1.3;ctx.beginPath();this.points.forEach((p,i)=>{const xx=x(p.displacement),yy=y(p[field]);if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);});ctx.stroke();}
    ctx.setLineDash([]);
    const nearest=this.points[Math.min(this.points.length-1,Math.round(state.displacement/this.parameters.travel*(this.points.length-1)))];
    if(nearest){ctx.strokeStyle='#273e4d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(state.displacement),bottom);ctx.lineTo(x(state.displacement),y(nearest.pressForce));ctx.stroke();ctx.fillStyle='#273e4d';ctx.beginPath();ctx.arc(x(state.displacement),y(nearest.pressForce),4,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  dispose(){this.observer.disconnect();}
}
