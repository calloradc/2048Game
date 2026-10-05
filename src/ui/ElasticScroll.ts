const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
type Options={axis?:'x'|'y';onSettled?:()=>void;onInterrupt?:()=>void};

/** Native scroll coordinates with shared inertia and springy edges on either axis. */
export class ElasticScroll {
  private position=0;
  private velocity=0;
  private target:number|null=null;
  private frame=0;
  private lastFrame=0;
  private written=0;
  private edges={left:false,right:false};
  private drag:{id:number;x:number;y:number;startX:number;startY:number;time:number;moved:boolean}|null=null;
  private observer:ResizeObserver;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private suppressClick=false;
  private get vertical(){return this.options.axis==='y';}
  private get size(){return this.vertical?this.viewport.clientHeight:this.viewport.clientWidth;}
  private get offset(){return this.vertical?this.viewport.scrollTop:this.viewport.scrollLeft;}
  private get max(){return Math.max(0,(this.vertical?this.viewport.scrollHeight:this.viewport.scrollWidth)-this.size);}

  constructor(private viewport:HTMLDivElement,private track:HTMLDivElement,private onEdges:(edges:{left:boolean;right:boolean})=>void,private options:Options={}) {
    this.position=this.offset;
    viewport.addEventListener('pointerdown',this.down);
    viewport.addEventListener('pointermove',this.move);
    viewport.addEventListener('pointerup',this.up);
    viewport.addEventListener('pointercancel',this.cancel);
    viewport.addEventListener('lostpointercapture',this.cancel);
    viewport.addEventListener('click',this.click,true);
    viewport.addEventListener('scroll',this.scrolled,{passive:true});
    viewport.addEventListener('wheel',this.wheel,{passive:false});
    viewport.addEventListener('keydown',this.key);
    this.observer=new ResizeObserver(()=>{if(!this.drag&&!this.frame)this.position=clamp(this.offset,0,this.max);this.paint();});
    this.observer.observe(viewport);this.observer.observe(track);this.paint();
  }
  private stop(){cancelAnimationFrame(this.frame);this.frame=0;this.lastFrame=0;this.target=null;}
  private paint(){
    const bounded=clamp(this.position,0,this.max),excess=this.position-bounded;
    const stretch=this.reduced?0:excess*.55/(1+Math.abs(excess)*.55/Math.max(1,this.size));
    if(this.vertical)this.viewport.scrollTop=bounded;else this.viewport.scrollLeft=bounded;
    this.written=this.offset;
    this.track.style.transform=this.vertical?`translate3d(0,${-stretch}px,0)`:`translate3d(${-stretch}px,0,0)`;
    const edges={left:bounded>1,right:bounded<this.max-1};
    if(edges.left!==this.edges.left||edges.right!==this.edges.right){this.edges=edges;this.onEdges(edges);}
  }
  scrollTo(value:number,immediate=false){
    this.stop();this.velocity=0;this.position=this.offset;this.target=clamp(value,0,this.max);
    if(immediate||this.reduced){this.position=this.target;this.target=null;this.paint();this.options.onSettled?.();return;}
    this.animate();
  }
  scrollBy(value:number){this.scrollTo((this.target??this.position)+value);}
  private down=(event:PointerEvent)=>{
    if(!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
    this.stop();this.velocity=0;this.position=this.offset;this.suppressClick=false;this.options.onInterrupt?.();
    this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,time:event.timeStamp,moved:false};
  };
  private move=(event:PointerEvent)=>{
    const drag=this.drag;if(!drag||drag.id!==event.pointerId)return;
    const dx=drag.startX-event.clientX,dy=drag.startY-event.clientY;
    if(!drag.moved){
      if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
      if(this.vertical?Math.abs(dx)>Math.abs(dy):Math.abs(dy)>Math.abs(dx)){this.drag=null;return;}
      drag.moved=true;this.viewport.dataset.dragging='true';this.viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const rect=this.viewport.getBoundingClientRect(),scale=this.size/(this.vertical?rect.height:rect.width);
    const delta=(this.vertical?drag.y-event.clientY:drag.x-event.clientX)*scale,dt=Math.max(.008,(event.timeStamp-drag.time)/1000);
    this.position=clamp(this.position+delta,-this.size*2,this.max+this.size*2);
    this.velocity=this.velocity*.35+clamp(delta/dt,-1800,1800)*.65;
    drag.x=event.clientX;drag.y=event.clientY;drag.time=event.timeStamp;this.paint();
  };
  private release(event:PointerEvent,cancelled:boolean){
    const drag=this.drag;if(!drag||drag.id!==event.pointerId)return;
    this.velocity=cancelled?0:this.velocity*Math.exp(-Math.max(0,event.timeStamp-drag.time-40)/70);
    this.suppressClick=drag.moved;this.drag=null;delete this.viewport.dataset.dragging;
    if(this.viewport.hasPointerCapture(event.pointerId))this.viewport.releasePointerCapture(event.pointerId);
    if(drag.moved)this.animate();
  }
  private up=(event:PointerEvent)=>this.release(event,false);
  private cancel=(event:PointerEvent)=>{
    if(event.type==='lostpointercapture'&&event.target!==this.viewport)return;
    this.release(event,true);
  };
  private click=(event:MouseEvent)=>{if(this.suppressClick){event.preventDefault();event.stopPropagation();this.suppressClick=false;}};
  private scrolled=()=>{
    if(Math.abs(this.offset-this.written)<1)return;
    this.stop();this.position=this.offset;this.velocity=0;this.paint();this.options.onInterrupt?.();
  };
  private wheel=(event:WheelEvent)=>{
    if(event.defaultPrevented)return;
    if(this.vertical&&Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    event.preventDefault();this.options.onInterrupt?.();
    const delta=(this.vertical?event.deltaY:event.deltaX||event.deltaY)*(event.deltaMode===1?18:event.deltaMode===2?this.size:1);
    const destination=(this.target??this.position)+delta;
    if(this.reduced){this.scrollTo(destination,true);return;}
    if(destination<0||destination>this.max){this.stop();this.velocity=0;this.position=clamp(destination,-80,this.max+80);this.paint();}
    else this.target=destination;
    this.animate();
  };
  private key=(event:KeyboardEvent)=>{
    if(this.vertical&&(event.target as HTMLElement).closest('.snap-viewport,.offer-viewport'))return;
    const amount=event.key===(this.vertical?'ArrowUp':'ArrowLeft')?-90:event.key===(this.vertical?'ArrowDown':'ArrowRight')?90:event.key==='PageUp'?-this.size*.8:event.key==='PageDown'?this.size*.8:null;
    if(amount!==null){event.preventDefault();this.options.onInterrupt?.();this.scrollBy(amount);}
    if(event.key==='Home'||event.key==='End'){event.preventDefault();this.options.onInterrupt?.();this.scrollTo(event.key==='Home'?0:this.max);}
  };
  private animate(){if(!this.frame)this.frame=requestAnimationFrame(this.tick);}
  private tick=(now:number)=>{
    this.frame=0;
    const dt=this.lastFrame?Math.min((now-this.lastFrame)/1000,1/30):1/60;this.lastFrame=now;
    const edge=clamp(this.position,0,this.max);
    if(this.target===null&&this.position!==edge)this.target=edge;
    const goal=this.target??edge;
    if(this.target!==null||this.position!==edge){this.velocity+=(goal-this.position)*170*dt;this.velocity*=Math.exp(-21*dt);}
    else this.velocity*=Math.exp(-4.8*dt);
    this.position+=this.velocity*dt;
    if(Math.abs(this.velocity)<2&&Math.abs(this.position-goal)<.5){this.position=goal;this.velocity=0;this.lastFrame=0;this.target=null;this.paint();this.options.onSettled?.();return;}
    this.paint();this.animate();
  };
  destroy(){
    this.stop();this.observer.disconnect();this.track.style.removeProperty('transform');
    this.viewport.removeEventListener('pointerdown',this.down);this.viewport.removeEventListener('pointermove',this.move);
    this.viewport.removeEventListener('pointerup',this.up);this.viewport.removeEventListener('pointercancel',this.cancel);
    this.viewport.removeEventListener('lostpointercapture',this.cancel);this.viewport.removeEventListener('click',this.click,true);
    this.viewport.removeEventListener('scroll',this.scrolled);this.viewport.removeEventListener('wheel',this.wheel);this.viewport.removeEventListener('keydown',this.key);
  }
}
