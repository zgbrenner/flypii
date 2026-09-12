/** A literal all-node state map: one backing-store pixel per neuron. */
export class CircuitView{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.ids=null;this.result=null;this.selected=0;this.timer=null;
  canvas.addEventListener('pointerdown',e=>{if(!this.ids)return;const b=canvas.getBoundingClientRect();this.selected=Math.min(this.ids.length-1,Math.floor((e.clientY-b.top)/b.height*canvas.height)*canvas.width+Math.floor((e.clientX-b.left)/b.width*canvas.width));canvas.focus();this.draw(this.frame);});
  canvas.addEventListener('keydown',e=>{const d={ArrowRight:1,ArrowLeft:-1,ArrowDown:canvas.width,ArrowUp:-canvas.width}[e.key];if(d&&this.ids){e.preventDefault();this.selected=Math.max(0,Math.min(this.ids.length-1,this.selected+d));this.draw(this.frame);}});
 }
 metadata(ids){this.ids=ids;this.canvas.width=512;this.canvas.height=Math.ceil(ids.length/512);this.ctx.fillStyle='#1b1d25';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);}
 clear(message='Analyze text to see its computed response.'){
  clearTimeout(this.timer);this.result=null;this.frame=null;this.ctx.fillStyle='#1b1d25';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
  document.querySelector('#circuit-empty').hidden=false;document.querySelector('#circuit-empty').textContent=message;document.querySelector('#replay').disabled=true;
  document.querySelector('#signal-state').textContent='AWAITING INPUT';document.querySelector('#step-label').textContent='MODEL STEP / —';document.querySelector('#neuron-detail').textContent='No neural response for the current input.';
 }
 show(result){
  if(!result.final){this.clear('Encoder-only baseline. No neural simulation was run.');return;}
  this.result=result;document.querySelector('#circuit-empty').hidden=true;document.querySelector('#replay').disabled=false;
  document.querySelector('#signal-state').textContent='SIGNAL COMPUTED';this.draw(result.final,result.trace.length);
 }
 draw(state,step){
  if(!state)return;this.frame=state;const image=this.ctx.createImageData(this.canvas.width,this.canvas.height),p=image.data;
  for(let i=0;i<state.length;i++){const a=Math.min(1,1.6*Math.sqrt(Math.abs(state[i]))),c=state[i]>=0?[188,161,255]:[121,201,186],k=i*4;p[k]=27+(c[0]-27)*a;p[k+1]=29+(c[1]-29)*a;p[k+2]=37+(c[2]-37)*a;p[k+3]=255;}
  this.ctx.putImageData(image,0,0);const x=this.selected%512,y=Math.floor(this.selected/512);this.ctx.strokeStyle='#fff';this.ctx.lineWidth=.6;this.ctx.strokeRect(x-2,y-2,5,5);
  document.querySelector('#neuron-detail').textContent=`Neuron ${this.ids[this.selected]} · state ${state[this.selected].toFixed(4)}. Arrow keys explore.`;
  if(step)document.querySelector('#step-label').textContent=`MODEL STEP / ${String(step).padStart(2,'0')} OF ${this.result.trace.length}`;
 }
 replay(){
  if(!this.result)return;clearTimeout(this.timer);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.draw(this.result.final,this.result.trace.length);return;}
  let i=0;const run=()=>{if(!this.result)return;this.draw(this.result.trace[i],i+1);if(++i<this.result.trace.length)this.timer=setTimeout(run,220);};run();
 }
}
