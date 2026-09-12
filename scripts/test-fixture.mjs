/** Explicit development test data. Never used by normal startup or production CI. */
import {fixture} from '../tests/fixture.mjs';import {mkdir,writeFile} from 'node:fs/promises';import {gzipSync} from 'node:zlib';import {sha256} from '../src/engine/graph.mjs';
const n=Number(process.env.FIXTURE_N||512),raw=new Uint8Array(fixture(n)),compressed=gzipSync(raw,{mtime:0}),file='connectome-000.bin.gz';
await mkdir('data',{recursive:true});await writeFile('data/'+file,compressed);await writeFile('data/manifest.json',JSON.stringify({format:'flypii-csr',version:2,id:'fixture-not-biological',neurons:n,edges:n*2,synapses:Array.from({length:n*2},(_,i)=>i%5+1).reduce((a,b)=>a+b,0),bytes:raw.length,downloadBytes:compressed.length,sha256:await sha256(raw),parts:[{file,bytes:compressed.length,rawBytes:raw.length,sha256:await sha256(compressed)}]}));
console.log('TEST FIXTURE ONLY: not biological. Use ?fixture=1 on localhost.');
