import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {nodeGraph} from './node-graph.mjs';import {validateBundle} from '../src/engine/experiment.mjs';
const graph=await nodeGraph(process.env.FLYPII_TEST_FIXTURE==='1');validateBundle(JSON.parse(await readFile('models/starter.json','utf8')),graph);
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});for(const path of ['index.html','src','data','models','reports','DATA_LICENSE.md'])await cp(path,'dist/'+path,{recursive:true});
await writeFile('dist/_headers',"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n");
console.log(process.env.FLYPII_TEST_FIXTURE==='1'?'TEST FIXTURE website built. Not biological data.':'Static website built in dist/. Includes the verified full graph and trained model.');
