/** Visual spring only. The world still drops vertically at its exact aim. */
export class AimPreview {
  velocity=0;
  angle=0;
  private angularVelocity=0;
  private drops=0;
  private age=1;
  constructor(public x:number) {}
  get scale() { const t=Math.min(1,this.age/0.24);return 0.85+0.15*(1+2.7*(t-1)**3+1.7*(t-1)**2); }
  step(aim:number,drops:number,dt:number,reduced=false) {
    if(drops!==this.drops){this.drops=drops;this.x=aim;this.velocity=0;this.angle=0;this.angularVelocity=0;this.age=0;}
    this.age+=dt;
    if(reduced){this.x=aim;this.velocity=0;this.angle=0;this.age=1;return;}
    const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
    for(let i=0;i<steps;i++) {
      this.velocity+=((aim-this.x)*360-this.velocity*29)*h;
      this.x+=this.velocity*h;
      this.x=Math.max(aim-18,Math.min(aim+18,this.x));
      const tilt=Math.max(-0.29,Math.min(0.29,this.velocity/1100));
      this.angularVelocity+=((tilt-this.angle)*180-this.angularVelocity*16)*h;
      this.angle+=this.angularVelocity*h;
    }
  }
}
