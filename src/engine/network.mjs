import {rng,shuffle} from './random.mjs';
import {INPUT_DIM} from './features.mjs';
export const STEPS=6;
export const READOUT_NODES=512;
export const NETWORK_VERSION='all-edges-rate-v2';
/** Full-node, all-edge recurrent rate model. Counts are positive connection
 * strengths, not biological transmitter signs. Artificial text stimulation is
 * delivered to every node. No claims of spikes or cellular biophysics are made.
 */
export function createNetwork(graph,seed=42){
 if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw new Error('Invalid network seed.');
 const {n,m,targets,counts}=graph,sums=new Float64Array(n),weights=new Float32Array(m);
 for(let e=0;e<m;e++)sums[targets[e]]+=counts[e];
 for(let e=0;e<m;e++)weights[e]=.85*counts[e]/sums[targets[e]];
 const random=rng(seed^0x6172),channels=new Uint16Array(n*4),signs=new Int8Array(n*4);
 for(let i=0;i<channels.length;i++){channels[i]=Math.floor(random()*INPUT_DIM);signs[i]=random()<.5?-1:1;}
 const order=Uint32Array.from({length:n},(_,i)=>i),r=rng(seed^0x4271);
 for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const network={graph,seed,weights,channels,signs,readIndices:order.slice(0,Math.min(n,READOUT_NODES)),scratch:Array.from({length:5},()=>new Float32Array(n)),rewiredSources:null};
 network.ensureRewired=()=>{
  if(network.rewiredSources)return;
  const sources=new Uint32Array(m),rnd=rng(seed^0xABC18);
  for(let s=0;s<n;s++)sources.fill(s,graph.ptr[s],graph.ptr[s+1]);
  for(let e=m-1;e>0;e--){const j=Math.floor(rnd()*(e+1));[sources[e],sources[j]]=[sources[j],sources[e]];}
  network.rewiredSources=sources;
 };
 return network;
}
export function makeDrive(network,input){
 if(input.length!==INPUT_DIM||Array.from(input).some(x=>!Number.isFinite(x)))throw new Error('Invalid text feature vector.');
 const drive=network.scratch[4],{channels,signs}=network;
 for(let i=0;i<drive.length;i++){const j=i*4;drive[i]=2*(signs[j]*input[channels[j]]+signs[j+1]*input[channels[j+1]]+signs[j+2]*input[channels[j+2]]+signs[j+3]*input[channels[j+3]]);}
 return drive;
}
export function simulate(network,drive,mode='fly',withTrace=false){
 const {graph,weights,readIndices}=network,{n,m,ptr,targets}=graph;
 if(!['fly','rewired','disconnected'].includes(mode))throw new Error('Unknown circuit mode.');
 if(drive.length!==n)throw new Error('Drive dimension does not match the full graph.');
 if(mode==='rewired')network.ensureRewired();
 let [state,next,recurrent,mean]=network.scratch;state.fill(0);next.fill(0);mean.fill(0);const trace=[];
 for(let t=0;t<STEPS;t++){
  recurrent.fill(0);
  if(mode==='fly'){
   for(let s=0;s<n;s++){const value=state[s];for(let e=ptr[s];e<ptr[s+1];e++)recurrent[targets[e]]+=weights[e]*value;}
  }else if(mode==='rewired'){
   const sources=network.rewiredSources;for(let e=0;e<m;e++)recurrent[targets[e]]+=weights[e]*state[sources[e]];
  }
  for(let i=0;i<n;i++){next[i]=.45*state[i]+.55*Math.tanh(drive[i]+recurrent[i]);mean[i]+=next[i]/STEPS;}
  [state,next]=[next,state];if(withTrace)trace.push(state.slice());
 }
 const k=readIndices.length,features=new Float32Array(k*2);
 for(let i=0;i<k;i++){features[i]=state[readIndices[i]];features[k+i]=mean[readIndices[i]];}
 return {features,trace,final:withTrace?state.slice():null,nodeUpdates:STEPS*n,edgeUpdates:mode==='disconnected'?0:STEPS*m};
}
export function response(network,input,mode='fly',withTrace=false){return simulate(network,makeDrive(network,input),mode,withTrace);}
