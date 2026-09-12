import {loadGraph} from './engine/graph.mjs';
import {createNetwork} from './engine/network.mjs';
import {trainExperiment,makePredictor,benchmark,validateBundle} from './engine/experiment.mjs';
let graph,network,bundle,predict,busy=false,controller;
self.onmessage=async({data})=>{
 const {op,id}=data;
 if(op==='cancel'){controller?.abort();return;}
 if(busy){self.postMessage({op:'error',id,message:'Another operation is still running.'});return;}
 busy=true;controller=new AbortController();
 const progress=p=>self.postMessage({op:'progress',id,progress:p});
 try{
  if(op==='init'){
   const local=['localhost','127.0.0.1'].includes(new URL(self.location.href).hostname);
   graph=await loadGraph(new URL('../data/',import.meta.url),progress,local&&data.fixture===true);
   const r=await fetch(new URL('../models/starter.json',import.meta.url),{credentials:'omit',signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw new Error('Starter model is missing. Run npm run train, then reload.');
   bundle=await r.json();validateBundle(bundle,graph);network=createNetwork(graph,bundle.seed);predict=makePredictor(network,bundle);
   const ids=graph.ids.slice();self.postMessage({op:'ready',id,manifest:graph.manifest,bundle,ids},[ids.buffer]);
  }else if(!predict){throw new Error('The full connectome is not ready.');}
  else if(op==='predict'){
   const result=predict(data.text,data.mode,true),transfer=result.trace.map(x=>x.buffer);if(result.final)transfer.push(result.final.buffer);
   self.postMessage({op:'prediction',id,result},transfer);
  }else if(op==='train'){
   const candidateNetwork=createNetwork(graph,data.config.seed),candidate=await trainExperiment(candidateNetwork,data.config,progress,controller.signal);
   bundle=candidate;network=candidateNetwork;predict=makePredictor(network,bundle);self.postMessage({op:'trained',id,bundle});
  }else if(op==='benchmark'){
   const report=await benchmark(network,bundle,data.threshold,progress,controller.signal);report.environment={runtime:'Browser',userAgent:self.navigator.userAgent};
   self.postMessage({op:'benchmarked',id,report});
  }else if(op==='import'){
   validateBundle(data.bundle,graph);const candidate=createNetwork(graph,data.bundle.seed),candidatePredict=makePredictor(candidate,data.bundle);
   bundle=data.bundle;network=candidate;predict=candidatePredict;self.postMessage({op:'imported',id,bundle});
  }else throw new Error('Unknown worker operation.');
 }catch(error){self.postMessage({op:error.name==='AbortError'?'cancelled':'error',id,message:error.message||'Computation failed.'});}
 finally{busy=false;controller=null;}
};
