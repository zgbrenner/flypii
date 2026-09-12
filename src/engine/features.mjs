import {hashText} from './random.mjs';
export const INPUT_DIM=512;
export const MAX_TEXT=2000;
export const FEATURE_VERSION=1;
export function validateText(text){
 if(typeof text!=='string'||!text.trim())throw new Error('Enter some text before analyzing.');
 if(text.length>MAX_TEXT)throw new Error(`Use at most ${MAX_TEXT.toLocaleString()} characters. Input is never silently truncated.`);
 return text;
}
/** Generic character n-grams, not PII rules or a pretrained language model.
 * Digit identity is intentionally discarded. Format detection cannot authenticate an ID.
 */
export function encodeText(text){
 validateText(text);
 const s='^'+text.normalize('NFKC').toLowerCase().replace(/[0-9]/g,'0').replace(/\s+/g,' ')+'$';
 const x=new Float32Array(INPUT_DIM);
 for(let n=1;n<=4;n++)for(let i=0;i<=s.length-n;i++){
  const key=n+':'+s.slice(i,i+n);x[hashText(key)%INPUT_DIM]+=1;
 }
 let norm=0;for(let i=0;i<x.length;i++){x[i]=Math.log1p(x[i]);norm+=x[i]*x[i];}
 const inv=1/Math.sqrt(norm||1);for(let i=0;i<x.length;i++)x[i]*=inv;
 return x;
}
