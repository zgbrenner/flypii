import {CircuitView} from './components/circuit.mjs';
import {validateText,MAX_TEXT} from './engine/features.mjs';
import {makeDataset,validateExamples} from './engine/dataset.mjs';
import {MODEL_NAMES} from './engine/experiment.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const examples={email:'Please send the signed agreement to alex.rivera@example.com before Friday.',phone:'Call the fictional office at (619) 555-0123 tomorrow.',ssn:'This synthetic record contains an SSN-shaped value: 900-12-3456.',mixed:'Email case7@example.org or call 858-555-0134 to review the form.',none:'A silver watch with a black bezel is sitting beside a sleeping dog.'};
const circuit=new CircuitView($('#circuit'));let worker,ready=false,busy=null,counter=0,bundle=null,manifest=null,last=null,report=null,custom=[],revision=0;const pending=new Map();
const fmt=n=>Number(n).toLocaleString('en-US');
function status(text){$('#status').textContent=text;}
function fail(error){$('#error').hidden=false;$('#error').textContent=error instanceof Error?error.message:String(error);}
function busyState(op){busy=op;$$('.compute').forEach(b=>b.disabled=!ready||Boolean(op));$('#cancel').hidden=!['train','benchmark'].includes(op);$('#import-examples').disabled=Boolean(op);$('#add-example').disabled=Boolean(op);$('#export-report').disabled=!report||Boolean(op);}
function clearResult(){revision++;last=null;$('#result').hidden=true;$('#result-empty').hidden=false;circuit.clear('Input changed. Analyze again to compute a new response.');}
function updateLength(){$('#length').textContent=`${fmt($('#text').value.length)} / 2,000`;}
function tab(name){
 $$('[data-tab]').forEach(b=>{const selected=b.dataset.tab===name;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('#'+b.dataset.tab).hidden=!selected;});
}
$$('[data-tab]').forEach((b,i)=>{b.addEventListener('click',()=>tab(b.dataset.tab));b.addEventListener('keydown',e=>{const tabs=$$('[data-tab]');let j;if(e.key==='ArrowRight')j=(i+1)%tabs.length;if(e.key==='ArrowLeft')j=(i+tabs.length-1)%tabs.length;if(e.key==='Home')j=0;if(e.key==='End')j=tabs.length-1;if(j!==undefined){e.preventDefault();tab(tabs[j].dataset.tab);tabs[j].focus();}});});
function request(op,data={}){
 if(busy)return Promise.reject(new Error('Wait for the current operation or cancel it.'));
 $('#error').hidden=true;busyState(op);const id=++counter;$('#progress').value=0;
 return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({op,id,...data});});
}
function progress(p){
 if(p.phase==='download'){status(`Downloading and verifying the full graph: ${(p.done/1048576).toFixed(1)} / ${(p.total/1048576).toFixed(1)} MiB`);$('#progress').value=p.done/p.total;}
 if(p.phase==='encode'){status(`Full-network training responses: ${p.done} / ${p.total}. All neurons and connections participate.`);$('#progress').value=p.done/p.total;}
 if(p.phase==='train'){status(`Training ${MODEL_NAMES[p.model]} readout: epoch ${p.epoch} / ${p.epochs}, loss ${p.loss.toFixed(4)}`);$('#progress').value=p.epoch/p.epochs;}
 if(p.phase==='benchmark'){status(`Testing ${MODEL_NAMES[p.model]||'Regex baseline'}: ${p.done} / ${p.total}`);$('#progress').value=p.done/p.total;}
}
function modelInfo(){if(bundle)$('#model-info').textContent=`Seed ${bundle.seed} · ${bundle.config.count} synthetic + ${bundle.customCount} custom examples · ${bundle.config.epochs} epochs`;
}
function renderResult(){
 if(!last)return;$('#result').hidden=false;$('#result-empty').hidden=true;const threshold=Number($('#threshold').value);
 $('#verdict').textContent=last.score>=threshold?'PII-like pattern detected':'No target pattern flagged';
 $('#score').textContent=last.score.toFixed(3);$('#score-bar').value=last.score;$('#latency').textContent=`${last.latency.toFixed(1)} ms`;
 $('#category-scores').replaceChildren();['Email','Phone','SSN shape'].forEach((label,i)=>{const row=document.createElement('div');row.className='category';const text=document.createElement('span');text.textContent=label;const bar=document.createElement('progress');bar.max=1;bar.value=last.scores[i];bar.setAttribute('aria-label',label+' pattern score');const value=document.createElement('span');value.className='mono';value.textContent=last.scores[i].toFixed(2);row.append(text,bar,value);$('#category-scores').append(row);});
 $('#compute-stats').textContent=last.mode==='encoder'?'No neural computation in this baseline.':`${fmt(last.nodeUpdates)} node updates · ${fmt(last.edgeUpdates)} edge visits · ${MODEL_NAMES[last.mode]}`;
 $('#threshold-value').textContent=threshold.toFixed(2);
}
function renderCustom(){
 $('#custom-count').textContent=`${custom.length} custom examples, kept in memory only.`;$('#custom-list').replaceChildren();
 custom.slice(-12).forEach((r,offset)=>{const li=document.createElement('li'),text=document.createElement('span'),labels=document.createElement('code'),button=document.createElement('button');text.textContent=r.text;labels.textContent=r.labels.join(' + ');text.append(labels);button.textContent='Remove';button.addEventListener('click',()=>{custom.splice(Math.max(0,custom.length-12)+offset,1);renderCustom();});li.append(text,button);$('#custom-list').append(li);});
}
function renderErrors(){
 $('#mistakes').replaceChildren();const r=report?.results.find(x=>x.key===$('#errors-mode').value);
 if(!r){$('#mistakes').textContent='No benchmark for the current model yet.';return;}
 if(!r.errors.length){$('#mistakes').textContent='No binary errors on this synthetic split. That is not a real-world guarantee.';return;}
 r.errors.forEach(e=>{const a=document.createElement('article'),title=document.createElement('b'),text=document.createElement('p');title.textContent=e.expected?'Missed pattern':'False positive';text.textContent=e.text;a.append(title,text);$('#mistakes').append(a);});
}
function renderReport(){
 $('#benchmark-rows').replaceChildren();$('#export-report').disabled=!report||Boolean(busy);
 if(!report){$('#benchmark-description').textContent='Run the benchmark to measure the current model on 320 synthetic holdout examples.';renderErrors();return;}
 $('#benchmark-description').textContent=`${report.count} synthetic holdout examples · threshold ${report.threshold.toFixed(2)} · seed ${report.seed} · measured in ${report.environment?.runtime||'the reported environment'}. Rerun here for this device’s timings.`;
 report.results.forEach(r=>{const row=document.createElement('tr');[r.name,r.f1.toFixed(3),r.precision.toFixed(3),r.recall.toFixed(3),String(r.fp),String(r.fn),r.latency.toFixed(1)+' ms'].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});$('#benchmark-rows').append(row);});renderErrors();
}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function readJSON(file,jsonl=false){if(!file)throw new Error('Choose a file.');if(file.size>2*1024*1024)throw new Error('Files must be at most 2 MiB.');const text=await file.text();return jsonl?text.split(/\r?\n/).filter(x=>x.trim()).map(x=>JSON.parse(x)):JSON.parse(text);}
$('#text').addEventListener('input',()=>{updateLength();clearResult();});$('#mode').addEventListener('change',clearResult);
$$('[data-example]').forEach(b=>b.addEventListener('click',()=>{$('#text').value=examples[b.dataset.example];$$('[data-example]').forEach(x=>x.classList.toggle('active',x===b));updateLength();clearResult();}));
$('#analyze').addEventListener('click',async()=>{try{const text=validateText($('#text').value),rev=revision;status('Computing the selected detector…');const data=await request('predict',{text,mode:$('#mode').value});if(revision===rev){last=data.result;renderResult();circuit.show(last);status('Analysis complete. Scores are uncalibrated research outputs.');}else status('Input changed during analysis. Run it again.');}catch(e){fail(e);}});
$('#threshold').addEventListener('input',renderResult);$('#replay').addEventListener('click',()=>circuit.replay());
$('#teach').addEventListener('click',()=>{$('#training-text').value=$('#text').value;tab('training');$('#training-text').focus();});
$('#add-example').addEventListener('click',()=>{try{const labels=$$('input[name=label]:checked').map(x=>x.value),next=[...custom,{text:$('#training-text').value,labels:labels.length?labels:['none']}];validateExamples(next,makeDataset(200,Number($('#seed').value)).test);custom=next;$('#training-text').value='';$('#error').hidden=true;renderCustom();}catch(e){fail(e);}});
$('#import-examples').addEventListener('click',()=>$('#examples-file').click());$('#examples-file').addEventListener('change',async e=>{try{const f=e.target.files[0],data=await readJSON(f,f?.name.toLowerCase().endsWith('.jsonl')),next=[...custom,...data];const checked=validateExamples(next,makeDataset(200,Number($('#seed').value)).test);custom=checked.map(r=>({text:r.text,labels:r.labels.some(Boolean)?['email','phone','ssn'].filter((_,i)=>r.labels[i]):['none']}));renderCustom();$('#error').hidden=true;}catch(error){fail(error);}finally{e.target.value='';}});
$('#train').addEventListener('click',async()=>{try{const config={count:Number($('#count').value),epochs:Number($('#epochs').value),seed:Number($('#seed').value),custom};makeDataset(config.count,config.seed);status('Preparing a full-brain training run…');const data=await request('train',{config});bundle=data.bundle;report=null;clearResult();renderReport();modelInfo();status('Training complete. Run the benchmark to measure the new model.');}catch(e){if(e.name!=='AbortError')fail(e);else status(e.message);}});
$('#run-benchmark').addEventListener('click',async()=>{try{status('Benchmarking the current model…');const data=await request('benchmark',{threshold:Number($('#threshold').value)});report=data.report;renderReport();status('Benchmark complete. False positives and missed patterns are listed below.');}catch(e){if(e.name!=='AbortError')fail(e);else status(e.message);}});
$('#cancel').addEventListener('click',()=>{worker.postMessage({op:'cancel'});status('Cancelling after the current sample. The previous model is retained.');});
$('#export-model').addEventListener('click',()=>{if(bundle)download('flypii-full-model.json',bundle);});$('#export-report').addEventListener('click',()=>{if(report)download('flypii-full-benchmark.json',report);});$('#errors-mode').addEventListener('change',renderErrors);
$('#import-model').addEventListener('click',()=>$('#model-file').click());$('#model-file').addEventListener('change',async e=>{try{const candidate=await readJSON(e.target.files[0]),data=await request('import',{bundle:candidate});bundle=data.bundle;report=null;clearResult();renderReport();modelInfo();status('Compatible model imported.');}catch(error){fail(error);}finally{e.target.value='';}});
$('#reset').addEventListener('click',()=>{if(confirm('Reset the lab and discard unsaved examples and trained weights?'))location.reload();});
Object.defineProperty(window,'__flypii',{value:{get snapshot(){return {ready,busy,graphSha:manifest?.sha256,neurons:manifest?.neurons,edges:manifest?.edges,seed:bundle?.seed,customCount:bundle?.customCount,score:last?.score,scores:last?.scores,latency:last?.latency,traceLength:last?.trace.length,finalLength:last?.final?.length,nodeUpdates:last?.nodeUpdates,edgeUpdates:last?.edgeUpdates,benchmarkCount:report?.count};}}});
async function start(){
 try{
  worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(data.op==='progress'){progress(data.progress);return;}const p=pending.get(data.id);if(!p)return;pending.delete(data.id);if(data.op==='ready')ready=true;busyState(null);$('#progress').value=1;if(data.op==='error'||data.op==='cancelled'){const e=new Error(data.message);if(data.op==='cancelled')e.name='AbortError';p.reject(e);}else p.resolve(data);};
  worker.onerror=()=>{ready=false;busyState(null);for(const p of pending.values())p.reject(new Error('The browser worker stopped. Try reloading or using a desktop browser.'));pending.clear();};
  const fixture=new URLSearchParams(location.search).get('fixture')==='1',data=await request('init',{fixture});
  manifest=data.manifest;bundle=data.bundle;circuit.metadata(data.ids);modelInfo();
  $('#graph-counts').textContent=`${fmt(manifest.neurons)} NEURONS · ${fmt(manifest.edges)} CONNECTIONS`;
  $('#integrity').textContent=`${fmt(manifest.neurons)} nodes; ${fmt(manifest.edges)} directed pairs; ${fmt(manifest.synapses)} synaptic contacts. SHA-256 ${manifest.sha256}. Every downloaded chunk and the complete graph were verified.`;
  status(manifest.id.startsWith('fixture')?'TEST FIXTURE ONLY. Not biological data.':`Ready. All ${fmt(manifest.neurons)} neurons and ${fmt(manifest.edges)} recorded connections loaded.`);
  try{const r=await fetch(new URL('../reports/full-benchmark.json',import.meta.url),{credentials:'omit'});if(r.ok){const saved=await r.json();if(saved.graphSha===manifest.sha256&&saved.seed===bundle.seed&&saved.trainedAt===bundle.trainedAt){report=saved;renderReport();}}}catch{}
 }catch(error){status('The full model did not load. No smaller substitute is running.');fail(error);}
}
updateLength();start();
