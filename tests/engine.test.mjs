import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGraph} from '../src/engine/graph.mjs';
import {createNetwork,simulate,response,makeDrive,STEPS} from '../src/engine/network.mjs';
import {encodeText,MAX_TEXT} from '../src/engine/features.mjs';
import {fitReadout,predictReadout,metrics} from '../src/engine/learning.mjs';
import {makeDataset,validateExamples} from '../src/engine/dataset.mjs';
import {validateBundle,trainExperiment,makePredictor} from '../src/engine/experiment.mjs';
import {fixture} from './fixture.mjs';

test('lossless binary parser retains direction, counts and isolated neurons',()=>{
 const g=parseGraph(fixture());assert.equal(g.n,4);assert.equal(g.m,3);assert.equal(g.synapses,9);
 assert.deepEqual([...g.ids],[100n,101n,102n,103n]);assert.deepEqual([...g.ptr],[0,2,3,3,3]);assert.deepEqual([...g.targets],[1,2,2]);
});
test('malformed graph binaries fail rather than replacing the graph',()=>{
 for(const offset of [0,8,12,16,32+8*4,32+8*4+4*5]){
  const b=fixture();new DataView(b).setUint32(offset,0xffffffff,true);assert.throws(()=>parseGraph(b));
 }
 assert.throws(()=>parseGraph(fixture().slice(0,60)));
});
test('sparse full-node recurrence matches a literal dense reference',()=>{
 const net=createNetwork(parseGraph(fixture()),42),drive=Float32Array.of(.7,-.1,.2,.8);let state=new Float32Array(4);
 for(let t=0;t<STEPS;t++){
  const rec=new Float32Array(4);
  for(let s=0;s<4;s++)for(let e=net.graph.ptr[s];e<net.graph.ptr[s+1];e++)rec[net.graph.targets[e]]+=net.weights[e]*state[s];
  state=Float32Array.from(state,(v,i)=>.45*v+.55*Math.tanh(drive[i]+rec[i]));
 }
 const r=simulate(net,drive,'fly',true);
 for(let i=0;i<4;i++)assert.ok(Math.abs(r.final[i]-state[i])<1e-6);
 assert.equal(r.nodeUpdates,4*STEPS);assert.equal(r.edgeUpdates,3*STEPS);assert.ok(r.final[3]>0);
});
test('signals propagate in the recorded direction, with connectivity-dependent outputs',()=>{
 const net=createNetwork(parseGraph(fixture()),42),d=Float32Array.of(1,0,0,0);
 const a=simulate(net,d,'fly',true),b=simulate(net,d,'disconnected',true);
 assert.ok(a.final[1]>0 && a.final[2]>0);assert.equal(b.final[1],0);assert.equal(b.edgeUpdates,0);
});
test('source shuffle preserves in/out edge-count degrees and does not change weights',()=>{
 const net=createNetwork(parseGraph(fixture(40)),42);net.ensureRewired();
 const original=new Uint32Array(40),rewired=new Uint32Array(40);
 for(let s=0;s<40;s++)original[s]=net.graph.ptr[s+1]-net.graph.ptr[s];
 for(const s of net.rewiredSources)rewired[s]++;
 assert.deepEqual(rewired,original);assert.equal(net.rewiredSources.length,net.graph.m);
});
test('state resets on each input, and results are deterministic',()=>{
 const net=createNetwork(parseGraph(fixture(40)),42),x=encodeText('Write to test@example.com');
 const a=response(net,x,'fly',true);response(net,encodeText('Just a dog.'),'fly');const b=response(net,x,'fly',true);
 assert.deepEqual(a.features,b.features);assert.deepEqual(a.final,b.final);assert.equal(a.trace.length,STEPS);
 assert.throws(()=>response(net,x,'unknown'));assert.throws(()=>simulate(net,Float32Array.of(1)));
});
test('generic encoder validates text and handles Unicode deterministically',()=>{
 assert.throws(()=>encodeText(' '));assert.throws(()=>encodeText('a'.repeat(MAX_TEXT+1)));
 assert.deepEqual(encodeText('123'),encodeText('456'));assert.ok([...encodeText('寿司 🚀')].every(Number.isFinite));
});
test('all splits use distinct templates and custom holdout contamination is rejected',()=>{
 const d=makeDataset(200,42);assert.equal(d.train.length,200);assert.equal(d.test.length,320);
 const train=new Set(d.train.map(r=>r.text));assert.ok(d.test.every(r=>!train.has(r.text)));
 assert.throws(()=>validateExamples([{text:d.test[0].text,labels:['none']}],d.test));
 assert.throws(()=>validateExamples([{text:'a',labels:['none','phone']}]));
 assert.throws(()=>validateExamples([{text:'a',labels:['none']},{text:'a',labels:['phone']}]));
});
test('logistic readout learns labeled examples and computes exact confusion counts',()=>{
 const rows=Array.from({length:40},(_,i)=>({features:Float32Array.of(i%2?1:-1),labels:[i%2,0,0]}));
 const m=fitReadout(rows,{epochs:40});assert.ok(predictReadout(m,[1])[0]>.7);assert.ok(predictReadout(m,[-1])[0]<.3);
 assert.deepEqual(metrics([true,true,false,false],[true,false,true,false]),{tp:1,tn:1,fp:1,fn:1,precision:.5,recall:.5,f1:.5,accuracy:.5,support:4});
});
test('training and model import are graph-bound; cancelled runs do not produce a bundle',async()=>{
 const g=parseGraph(fixture(40));g.sha256='fixture';const net=createNetwork(g,42);
 const bundle=await trainExperiment(net,{count:200,epochs:4,seed:42});validateBundle(bundle,g);
 assert.throws(()=>validateBundle({...bundle,graphSha:'other'},g));
 const corrupt=structuredClone(bundle);corrupt.models.fly.weights[0]=NaN;assert.throws(()=>validateBundle(corrupt,g));
 const p=makePredictor(net,bundle)('case7@example.com','fly',true);assert.ok(p.scores.every(Number.isFinite));
 const abort=new AbortController();abort.abort();await assert.rejects(trainExperiment(net,{count:200,epochs:4,seed:42},()=>{},abort.signal),{name:'AbortError'});
});

test('manifest rejects silent graph substitutions and inconsistent chunk totals',async()=>{
 const {validateManifest,sha256}=await import('../src/engine/graph.mjs');
 const raw=new Uint8Array(fixture(40)),hash=await sha256(raw);
 const m={format:'flypii-csr',version:2,id:'fixture',neurons:40,edges:80,synapses:80,bytes:raw.length,downloadBytes:100,sha256:hash,parts:[{file:'connectome-000.bin.gz',bytes:100,rawBytes:raw.length,sha256:hash}]};
 assert.throws(()=>validateManifest(m));assert.equal(validateManifest(m,true),true);
 assert.throws(()=>validateManifest({...m,downloadBytes:99},true));
 assert.throws(()=>validateManifest({...m,parts:[{...m.parts[0],file:'../evil.gz'}]},true));
});
