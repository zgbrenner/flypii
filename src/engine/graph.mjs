export const GRAPH_ID='flywire783-proofread-all-1plus-v2';
export const FULL_NEURONS=139255;
export function parseGraph(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<36)throw new Error('Connectome file is truncated.');
 const view=new DataView(buffer), magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
 const n=view.getUint32(12,true),m=view.getUint32(16,true),synapses=view.getUint32(20,true);
 if(magic!=='FLYPII02'||view.getUint32(8,true)!==2||!n||n>200000||m>50000000||buffer.byteLength!==32+8*n+4*(n+1)+8*m)throw new Error('Invalid connectome header or length.');
 if(new Uint8Array(new Uint32Array([1]).buffer)[0]!==1)throw new Error('Little-endian hardware is required.');
 const ids=new BigUint64Array(buffer,32,n),ptr=new Uint32Array(buffer,32+8*n,n+1);
 const targets=new Uint32Array(buffer,32+8*n+4*(n+1),m),counts=new Uint32Array(buffer,32+8*n+4*(n+1)+4*m,m);
 if(ptr[0]!==0||ptr[n]!==m)throw new Error('Invalid CSR offsets.');
 for(let i=0;i<n;i++)if(ptr[i]>ptr[i+1]||ptr[i+1]>m||(i&&ids[i]<=ids[i-1]))throw new Error('Invalid node order or CSR offsets.');
 let sum=0;for(let e=0;e<m;e++){if(targets[e]>=n||!counts[e])throw new Error('Invalid connection.');sum+=counts[e];}
 if(sum!==synapses)throw new Error('Synapse counts do not reconcile.');
 return {n,m,synapses,ids,ptr,targets,counts,buffer};
}
export async function sha256(bytes){
 const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export function validateManifest(m,allowFixture=false){
 if(!m||m.format!=='flypii-csr'||m.version!==2||(!allowFixture&&(m.id!==GRAPH_ID||m.neurons!==FULL_NEURONS))||!Number.isInteger(m.bytes)||m.bytes<36||m.bytes>600000000||!Number.isInteger(m.edges)||m.edges<1||!Number.isInteger(m.synapses)||m.synapses<1||m.bytes!==32+8*m.neurons+4*(m.neurons+1)+8*m.edges||!/^[a-f0-9]{64}$/.test(m.sha256)||!Array.isArray(m.parts)||!m.parts.length||m.parts.length>80)throw new Error('Not a supported full FlyWire manifest.');
 let total=0,compressed=0;const names=new Set();
 for(const p of m.parts){
  if(!/^connectome-\d{3}\.bin\.gz$/.test(p.file)||names.has(p.file)||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>9000000||!Number.isInteger(p.rawBytes)||p.rawBytes<1||p.rawBytes>8388608||!/^[a-f0-9]{64}$/.test(p.sha256))throw new Error('Invalid data chunk manifest.');
  names.add(p.file);total+=p.rawBytes;compressed+=p.bytes;
 }
 if(total!==m.bytes||compressed!==m.downloadBytes)throw new Error('Data chunks do not reconcile.');return true;
}
export async function loadGraph(base,onProgress=()=>{},allowFixture=false){
 if(typeof DecompressionStream==='undefined'||!globalThis.crypto?.subtle)throw new Error('Use a current browser on HTTPS or localhost. Gzip and Web Crypto are required.');
 const fetchFile=async name=>{const r=await fetch(new URL(name,base),{credentials:'omit',signal:AbortSignal.timeout(180000)});if(!r.ok)throw new Error(`Data load failed (${r.status}). Run npm run data, then reload.`);return r;};
 const manifest=await (await fetchFile('manifest.json')).json();validateManifest(manifest,allowFixture);
 const buffer=new ArrayBuffer(manifest.bytes),out=new Uint8Array(buffer);let offset=0,downloaded=0;
 for(const p of manifest.parts){
  const payload=await (await fetchFile(p.file)).arrayBuffer();
  if(payload.byteLength!==p.bytes||await sha256(payload)!==p.sha256)throw new Error('A connectome download failed its SHA-256 check.');
  const stream=new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader=stream.getReader();let written=0;
  for(;;){const {value,done}=await reader.read();if(done)break;if(written+value.length>p.rawBytes){await reader.cancel();throw new Error('Data chunk exceeds declared size.');}out.set(value,offset+written);written+=value.length;}
  if(written!==p.rawBytes)throw new Error('Truncated data chunk.');offset+=written;downloaded+=p.bytes;
  onProgress({phase:'download',done:downloaded,total:manifest.downloadBytes});
 }
 if(await sha256(buffer)!==manifest.sha256)throw new Error('The complete connectome failed its SHA-256 check.');
 const graph=parseGraph(buffer);
 if(graph.n!==manifest.neurons||graph.m!==manifest.edges||graph.synapses!==manifest.synapses)throw new Error('Graph counts disagree with manifest.');
 return Object.assign(graph,{sha256:manifest.sha256,id:manifest.id,manifest});
}
