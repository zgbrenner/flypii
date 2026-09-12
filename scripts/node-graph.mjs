import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {parseGraph,sha256,validateManifest} from '../src/engine/graph.mjs';
export async function nodeGraph(allowFixture=false){
 const manifest=JSON.parse(await readFile('data/manifest.json','utf8'));validateManifest(manifest,allowFixture);const output=new Uint8Array(manifest.bytes);let offset=0;
 for(const part of manifest.parts){const compressed=await readFile('data/'+part.file);if(compressed.length!==part.bytes||await sha256(compressed)!==part.sha256)throw Error('Compressed data checksum mismatch');const raw=gunzipSync(compressed,{maxOutputLength:part.rawBytes});if(raw.length!==part.rawBytes)throw Error('Chunk length mismatch');output.set(raw,offset);offset+=raw.length;}
 if(await sha256(output)!==manifest.sha256)throw Error('Graph checksum mismatch');const graph=parseGraph(output.buffer);if(graph.n!==manifest.neurons||graph.m!==manifest.edges||graph.synapses!==manifest.synapses)throw Error('Graph count mismatch');return Object.assign(graph,{sha256:manifest.sha256,id:manifest.id,manifest});
}
