import {encodeText,FEATURE_VERSION} from './features.mjs';
import {makeDataset,validateExamples,DATASET_VERSION,LABELS} from './dataset.mjs';
import {response,NETWORK_VERSION,READOUT_NODES} from './network.mjs';
import {fitReadout,predictReadout,metrics} from './learning.mjs';
export const MODEL_NAMES={fly:'Full fly connectome',rewired:'Source-shuffled control',disconnected:'Disconnected control',encoder:'Encoder only'};
const check=signal=>{if(signal?.aborted)throw new DOMException('Cancelled; the previous model is unchanged.','AbortError');};
const breathe=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function trainExperiment(network,{count=400,seed=42,epochs=32,custom=[]}={},progress=()=>{},signal){
 check(signal);if(seed!==network.seed)throw new Error('Network and training seeds differ.');
 if(!Number.isInteger(epochs)||epochs<1||epochs>100)throw new Error('Epochs must be 1 to 100.');
 const data=makeDataset(count,seed),extras=validateExamples(custom,data.test),rows=[...data.train,...extras];
 const tables={fly:[],rewired:[],disconnected:[],encoder:[]};const start=performance.now();
 for(let i=0;i<rows.length;i++){
  check(signal);const row=rows[i],x=encodeText(row.text);
  for(const key of Object.keys(tables))tables[key].push({features:key==='encoder'?x:response(network,x,key).features,labels:row.labels});
  progress({phase:'encode',done:i+1,total:rows.length});await breathe();
 }
 const models={},history={};
 for(const key of Object.keys(tables)){
  check(signal);history[key]=[];
  models[key]=fitReadout(tables[key],{epochs,onEpoch:e=>{check(signal);history[key].push(e);progress({phase:'train',model:key,...e,epochs});}});
  await breathe();
 }
 check(signal);
 return {format:'flypii-full',version:2,graphSha:network.graph.sha256,neurons:network.graph.n,edges:network.graph.m,networkVersion:NETWORK_VERSION,featureVersion:FEATURE_VERSION,datasetVersion:DATASET_VERSION,seed,config:{count,epochs},customCount:extras.length,models,history,trainingMs:performance.now()-start,trainedAt:new Date().toISOString()};
}
export function validateBundle(b,graph){
 if(!b||b.format!=='flypii-full'||b.version!==2||b.graphSha!==graph.sha256||b.neurons!==graph.n||b.edges!==graph.m||b.networkVersion!==NETWORK_VERSION||b.featureVersion!==FEATURE_VERSION||b.datasetVersion!==DATASET_VERSION)throw new Error('Model is incompatible with this full connectome or engine.');
 if(!Number.isInteger(b.seed)||b.seed<0||b.seed>2147483647||!b.config||!Number.isInteger(b.config.count)||b.config.count<200||b.config.count>2400||!Number.isInteger(b.config.epochs)||b.config.epochs<1||b.config.epochs>100)throw new Error('Invalid model configuration.');
 for(const key of Object.keys(MODEL_NAMES)){
  const dim=key==='encoder'?512:2*Math.min(READOUT_NODES,graph.n),m=b.models?.[key];
  if(!m||m.dim!==dim)throw new Error('Invalid readout dimensions.');
  for(const [field,len] of Object.entries({mean:dim,scale:dim,weights:3*(dim+1)}))if(!Array.isArray(m[field])||m[field].length!==len||m[field].some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e6||(field==='scale'&&v<=0)))throw new Error('Invalid model parameters.');
 }
 return true;
}
export function makePredictor(network,bundle){
 validateBundle(bundle,network.graph);if(network.seed!==bundle.seed)throw new Error('Model seed mismatch.');
 return (text,mode='fly',trace=false)=>{
  if(!Object.hasOwn(MODEL_NAMES,mode))throw new Error('Unknown detector.');
  const start=performance.now(),x=encodeText(text),r=mode==='encoder'?null:response(network,x,mode,trace);
  const scores=predictReadout(bundle.models[mode],r?r.features:x);
  return {scores,score:Math.max(...scores),trace:r?.trace||[],final:r?.final||null,nodeUpdates:r?.nodeUpdates||0,edgeUpdates:r?.edgeUpdates||0,latency:performance.now()-start,mode};
 };
}
/** Explicit comparator only. Never called in the fly prediction path. */
export function regexBaseline(text){
 return [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text),/(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(text),/\b\d{3}-\d{2}-\d{4}\b/.test(text)].map(Number);
}
export async function benchmark(network,bundle,threshold=.5,progress=()=>{},signal){
 if(!Number.isFinite(threshold)||threshold<.1||threshold>.9)throw new Error('Invalid threshold.');
 const test=makeDataset(bundle.config.count,bundle.seed).test,predict=makePredictor(network,bundle),results=[];
 for(const key of [...Object.keys(MODEL_NAMES),'regex']){
  check(signal);const scores=[],times=[];if(key!=='regex')predict(test[0].text,key);
  for(let i=0;i<test.length;i++){
   check(signal);const start=performance.now(),p=key==='regex'?regexBaseline(test[i].text):predict(test[i].text,key).scores;
   scores.push(p);times.push(performance.now()-start);progress({phase:'benchmark',model:key,done:i+1,total:test.length});await breathe();
  }
  const truth=test.map(x=>x.labels.some(Boolean)),pred=scores.map(x=>Math.max(...x)>=threshold),m=metrics(truth,pred);
  const errors=test.map((row,i)=>({text:row.text,expected:truth[i],predicted:pred[i],score:Math.max(...scores[i]),categories:LABELS.filter((_,c)=>row.labels[c])})).filter(x=>x.expected!==x.predicted);
  const sorted=[...times].sort((a,b)=>a-b);
  results.push({key,name:MODEL_NAMES[key]||'Regex baseline',...m,perClass:LABELS.map((label,c)=>({label,...metrics(test.map(x=>Boolean(x.labels[c])),scores.map(x=>x[c]>=threshold))})),errors:errors.slice(0,20),errorCount:errors.length,latency:times.reduce((a,b)=>a+b,0)/times.length,p95Latency:sorted[Math.floor(sorted.length*.95)]});
 }
 return {trainedAt:bundle.trainedAt,graphSha:network.graph.sha256,neurons:network.graph.n,edges:network.graph.m,synapses:network.graph.synapses,datasetVersion:DATASET_VERSION,count:test.length,threshold,seed:bundle.seed,customCount:bundle.customCount,trainingMs:bundle.trainingMs,createdAt:new Date().toISOString(),results,limitations:'Synthetic English development holdout, not blind external evaluation. Uncalibrated text-level pattern scores. Not verified PII, entity spans, or production privacy protection.'};
}
