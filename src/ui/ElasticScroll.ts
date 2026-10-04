const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** A small, event-driven scroller: native scroll coordinates with springy edges. */
export class ElasticScroll {
  private position = 0;
  private velocity = 0;
  private target: number | null = null;
  private frame = 0;
  private lastFrame = 0;
  private written = 0;
  private edges = {left:false,right:false};
  private drag: {id:number;x:number;time:number} | null = null;
  private observer: ResizeObserver;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private viewport: HTMLDivElement, private track: HTMLDivElement, private onEdges: (edges:{left:boolean;right:boolean})=>void) {
    viewport.addEventListener('pointerdown',this.down);
    viewport.addEventListener('pointermove',this.move);
    viewport.addEventListener('pointerup',this.up);
    viewport.addEventListener('pointercancel',this.cancel);
    viewport.addEventListener('lostpointercapture',this.cancel);
    viewport.addEventListener('scroll',this.scrolled,{passive:true});
    viewport.addEventListener('wheel',this.wheel,{passive:false});
    viewport.addEventListener('keydown',this.key);
    this.observer=new ResizeObserver(()=>{this.position=clamp(this.position,0,this.max);this.paint();});
    this.observer.observe(viewport);this.observer.observe(track);this.paint();
  }
  private get max() { return Math.max(0,this.track.scrollWidth-this.viewport.clientWidth); }
  private stop() { cancelAnimationFrame(this.frame);this.frame=0;this.lastFrame=0;this.target=null; }
  private paint() {
    const bounded=clamp(this.position,0,this.max),excess=this.position-bounded;
    const stretch=this.reduced?0:excess*0.55/(1+Math.abs(excess)*0.55/this.viewport.clientWidth);
    this.viewport.scrollLeft=bounded;this.written=this.viewport.scrollLeft;
    this.track.style.transform=`translate3d(${-stretch}px,0,0)`;
    const edges={left:bounded>1,right:bounded<this.max-1};
    if(edges.left!==this.edges.left||edges.right!==this.edges.right){this.edges=edges;this.onEdges(edges);}
  }
  scrollTo(value: number, immediate = false) {
    this.stop();this.velocity=0;this.target=clamp(value,0,this.max);
    if(immediate||this.reduced){this.position=this.target;this.target=null;this.paint();return;}
    this.animate();
  }
  scrollBy(value: number) { this.scrollTo(this.position+value); }
  private down = (event: PointerEvent) => {
    if(!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
    this.stop();this.velocity=0;
    this.drag={id:event.pointerId,x:event.clientX,time:event.timeStamp};
    this.viewport.dataset.dragging='true';this.viewport.setPointerCapture(event.pointerId);
  };
  private move = (event: PointerEvent) => {
    if(this.drag?.id!==event.pointerId)return;
    event.preventDefault();
    const scale=this.viewport.clientWidth/this.viewport.getBoundingClientRect().width;
    const dx=(this.drag.x-event.clientX)*scale,dt=Math.max(0.008,(event.timeStamp-this.drag.time)/1000);
    this.position=clamp(this.position+dx,-this.viewport.clientWidth*2,this.max+this.viewport.clientWidth*2);
    this.velocity=this.velocity*0.35+clamp(dx/dt,-1800,1800)*0.65;
    this.drag.x=event.clientX;this.drag.time=event.timeStamp;this.paint();
  };
  private release(event: PointerEvent, cancelled: boolean) {
    if(this.drag?.id!==event.pointerId)return;
    this.velocity=cancelled?0:this.velocity*Math.exp(-Math.max(0,event.timeStamp-this.drag.time-40)/70);
    this.drag=null;delete this.viewport.dataset.dragging;
    if(this.viewport.hasPointerCapture(event.pointerId))this.viewport.releasePointerCapture(event.pointerId);
    this.animate();
  }
  private up = (event: PointerEvent) => this.release(event,false);
  private cancel = (event: PointerEvent) => this.release(event,true);
  private scrolled = () => {
    if(Math.abs(this.viewport.scrollLeft-this.written)<1)return;
    this.stop();this.position=this.viewport.scrollLeft;this.velocity=0;this.paint();
  };
  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta=(event.deltaX||event.deltaY)*(event.deltaMode===1?18:event.deltaMode===2?this.viewport.clientWidth:1);
    const destination=(this.target??this.position)+delta;
    if(this.reduced){this.scrollTo(destination,true);return;}
    if(destination<0||destination>this.max){this.stop();this.velocity=0;this.position=clamp(destination,-80,this.max+80);this.paint();}
    else this.target=destination;
    this.animate();
  };
  private key = (event: KeyboardEvent) => {
    const amount=event.key==='ArrowLeft'?-90:event.key==='ArrowRight'?90:event.key==='PageUp'?-180:event.key==='PageDown'?180:null;
    if(amount!==null){event.preventDefault();this.scrollBy(amount);}
    if(event.key==='Home'||event.key==='End'){event.preventDefault();this.scrollTo(event.key==='Home'?0:this.max);}
  };
  private animate() { if(!this.frame)this.frame=requestAnimationFrame(this.tick); }
  private tick = (now: number) => {
    this.frame=0;
    const dt=this.lastFrame?Math.min((now-this.lastFrame)/1000,1/30):1/60;this.lastFrame=now;
    const edge=clamp(this.position,0,this.max);
    if(this.target===null&&this.position!==edge)this.target=edge;
    const goal=this.target??edge;
    if(this.target!==null||this.position!==edge) {
      this.velocity+=(goal-this.position)*170*dt;
      this.velocity*=Math.exp(-21*dt);
    } else this.velocity*=Math.exp(-4.8*dt);
    this.position+=this.velocity*dt;
    if(Math.abs(this.velocity)<2&&Math.abs(this.position-goal)<0.5){this.position=goal;this.velocity=0;this.lastFrame=0;this.target=null;this.paint();return;}
    this.paint();this.animate();
  };
  destroy() {
    this.stop();this.observer.disconnect();
    this.viewport.removeEventListener('pointerdown',this.down);this.viewport.removeEventListener('pointermove',this.move);
    this.viewport.removeEventListener('pointerup',this.up);this.viewport.removeEventListener('pointercancel',this.cancel);
    this.viewport.removeEventListener('lostpointercapture',this.cancel);this.viewport.removeEventListener('scroll',this.scrolled);
    this.viewport.removeEventListener('wheel',this.wheel);this.viewport.removeEventListener('keydown',this.key);
  }
}
