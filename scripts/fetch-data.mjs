import {mkdir,readFile,writeFile} from 'node:fs/promises';import {sha256,validateManifest} from '../src/engine/graph.mjs';
// Immutable full-graph build, with upstream data-license notice.
const revision='50091d6f11c58e38e1c0c29565c994dd711fce3b';
const base=`https://raw.githubusercontent.com/zgbrenner/flypii/${revision}/data/`;
async function get(name){for(let i=0;i<3;i++){try{const r=await fetch(base+name,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return new Uint8Array(await r.arrayBuffer());}catch(e){if(i===2)throw e;await new Promise(r=>setTimeout(r,3000));}}}
await mkdir('data',{recursive:true});const text=await get('manifest.json'),manifest=JSON.parse(new TextDecoder().decode(text));validateManifest(manifest);
for(const p of manifest.parts){let bytes;try{bytes=await readFile('data/'+p.file);}catch{}if(!bytes||bytes.length!==p.bytes||await sha256(bytes)!==p.sha256){bytes=await get(p.file);if(bytes.length!==p.bytes||await sha256(bytes)!==p.sha256)throw Error('Data checksum failed');await writeFile('data/'+p.file,bytes);}console.log('Verified '+p.file);}
await writeFile('data/manifest.json',text);console.log(`Ready: ${manifest.neurons} neurons, ${manifest.edges} directed pairs. No thresholding.`);
