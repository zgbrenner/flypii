import {rng,shuffle} from './random.mjs';
import {validateText} from './features.mjs';
export const LABELS=['email','phone','ssn'];
export const DATASET_VERSION='synthetic-forms-v1';
const trainTemplates=[
 'Here is the requested detail: {v}.','Please review {v} before the meeting.',
 'The form contains {v}.','A note for the team: {v}.','Copied from the draft: {v}',
 'The attached record shows {v}.','For reference, {v}.','Put {v} in the follow-up.',
 'The message reads: {v}.','We received this entry: {v}.','The draft includes {v}.',
 'Please check the following: {v}.','The updated field is {v}.','One more item: {v}.',
 'Content to review: {v}','The latest note mentions {v}.',
];
const testTemplates=[
 'During the handover, someone pasted "{v}" into a document.',
 'Would you share the following in a public chat? {v}',
 'Review this excerpt before publishing: [{v}]',
 'An incoming message has this line: {v}',
 'Text found in a copied paragraph: {v}. Nothing else was included.',
 'A reviewer highlighted "{v}" for a second look.',
 'This is the complete entry => {v}',
 'Extract from an unfamiliar form: {v}. Please advise.',
];
function fakeValue(kind,i,random,isTest){
 const n=(max)=>Math.floor(random()*max);
 if(kind==='email')return `${isTest?'record':'case'}${i}.${n(10000)}@example.${['com','org','net'][n(3)]}`;
 if(kind==='phone'){
  const area=['619','858','212','202','415','312'][n(6)];
  const suffix=String((isTest?60:0)+n(isTest?40:60)).padStart(2,'0');
  return [`${area}-555-01${suffix}`,`(${area}) 555-01${suffix}`,`+1 ${area} 555 01${suffix}`,`${area}.555.01${suffix}`][n(4)];
 }
 if(kind==='ssn')return `900-${(isTest?60:20)+n(isTest?40:40)}-${String(1000+n(9000))}`;
 const harmless=[
  `invoice #${100000+n(900000)}`,`order ${1000+n(9000)}-${1000+n(9000)}`,
  `${2020+n(7)}-${String(1+n(12)).padStart(2,'0')}-${String(1+n(28)).padStart(2,'0')}`,
  `version ${1+n(5)}.${n(20)}.${n(30)}`,`SN-${1000+n(9000)}-${1000+n(9000)}`,
  `total $${100+n(900)}.${String(n(100)).padStart(2,'0')}`,`port ${8000+n(500)}`,
  `203.0.113.${n(255)}`,`www.example.com/page-${i}`,`${1+n(11)}:30 AM`,
  'a silver watch with a black bezel','the history of the Roman republic',
  'a dog sleeping beside the desk','the revised product roadmap',
  'a painting with a blue background','a shipping box with no personal details',
  'the next team meeting','please update the release notes',
  `build ${n(999)}-${n(99)}`,`quantity ${n(200)} units`,
 ];return harmless[n(harmless.length)];
}
export function makeDataset(count=800,seed=42){
 if(!Number.isInteger(count)||count<200||count>2400)throw new Error('Training size must be 200 to 2,400 examples.');
 if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw new Error('Seed must be an integer from 0 to 2147483647.');
 function make(size,isTest){
  const random=rng((seed+(isTest?100003:0))>>>0);const templates=isTest?testTemplates:trainTemplates;
  const rows=[];
  for(let i=0;i<size;i++){
   const k=i%10;const kinds=k<5?[]:k===5?['email']:k===6?['phone']:k===7?['ssn']:k===8?['email','phone']:['ssn','phone'];
   const value=(kinds.length?kinds:['none']).map(t=>fakeValue(t,i,random,isTest)).join(' / ');
   const tid=Math.floor(random()*templates.length);
   rows.push({text:templates[tid].replace('{v}',value),labels:LABELS.map(l=>+kinds.includes(l)),template:(isTest?'test:':'train:')+tid});
  }return shuffle(rows,random);
 }
 return {train:make(count,false),test:make(320,true),version:DATASET_VERSION};
}
/** Custom data are training-only and remain in memory unless the user saves their file. */
export function validateExamples(input,holdout=[]){
 if(!Array.isArray(input)||input.length>400)throw new Error('Provide an array of at most 400 labeled examples.');
 const seen=new Map();const blocked=new Set(holdout.map(x=>x.text.trim().toLowerCase()));
 const out=[];
 for(const row of input){
  if(!row||typeof row!=='object')throw new Error('Every example must have text and labels.');
  validateText(row.text);
  if(!Array.isArray(row.labels)||!row.labels.length||row.labels.some(x=>!['none',...LABELS].includes(x)))throw new Error('Labels must be email, phone, ssn, or none.');
  if(row.labels.includes('none')&&row.labels.length!==1)throw new Error('The none label cannot be combined with PII labels.');
  const key=row.text.trim().toLowerCase();const labels=LABELS.map(l=>+row.labels.includes(l));
  if(blocked.has(key))throw new Error('An example duplicates the holdout set. It was not added.');
  if(seen.has(key)){if(seen.get(key)!==labels.join(','))throw new Error('Duplicate text has conflicting labels.');continue;}
  seen.set(key,labels.join(','));out.push({text:row.text,labels,template:'custom'});
 }return out;
}
