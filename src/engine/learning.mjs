/** Train-only feature scaling and a 3-head logistic readout trained with full-batch Adam. */
export function fitReadout(rows,{epochs=32,onEpoch=()=>{}}={}){
 if(!rows.length||!Number.isInteger(epochs)||epochs<1||epochs>100)throw new Error('Invalid training request.');
 const dim=rows[0].features.length, width=dim+1, count=rows.length;
 const mean=new Float64Array(dim),scale=new Float64Array(dim);
 for(const row of rows)for(let j=0;j<dim;j++)mean[j]+=row.features[j]/count;
 for(const row of rows)for(let j=0;j<dim;j++)scale[j]+=(row.features[j]-mean[j])**2/count;
 for(let j=0;j<dim;j++)scale[j]=Math.max(.025,Math.sqrt(scale[j]));
 const xs=rows.map(r=>{const x=new Float32Array(width);for(let j=0;j<dim;j++)x[j]=Math.max(-6,Math.min(6,(r.features[j]-mean[j])/scale[j]));x[dim]=1;return x;});
 const weights=new Float64Array(3*width), m=new Float64Array(3*width),v=new Float64Array(3*width);
 for(let epoch=1;epoch<=epochs;epoch++){
  const grad=new Float64Array(weights.length);let loss=0;
  for(let i=0;i<count;i++){
   const x=xs[i];
   for(let c=0;c<3;c++){
    const offset=c*width;let z=0;for(let j=0;j<width;j++)z+=weights[offset+j]*x[j];
    const p=1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));const y=rows[i].labels[c];
    loss-=y*Math.log(p+1e-10)+(1-y)*Math.log(1-p+1e-10);
    const err=(p-y)/(count*3);for(let j=0;j<width;j++)grad[offset+j]+=err*x[j];
   }
  }
  for(let k=0;k<weights.length;k++){
   const g=grad[k]+(k%width===dim?0:.001*weights[k]);m[k]=.9*m[k]+.1*g;v[k]=.999*v[k]+.001*g*g;
   weights[k]-=.035*(m[k]/(1-.9**epoch))/(Math.sqrt(v[k]/(1-.999**epoch))+1e-8);
  }
  onEpoch({epoch,loss:loss/(count*3)});
 }
 return {dim,mean:Array.from(mean),scale:Array.from(scale),weights:Array.from(weights)};
}
export function predictReadout(model,features){
 const {dim,mean,scale,weights}=model;const x=new Float32Array(dim);
 for(let j=0;j<dim;j++)x[j]=Math.max(-6,Math.min(6,(features[j]-mean[j])/scale[j]));
 return [0,1,2].map(c=>{const offset=c*(dim+1);let z=weights[offset+dim];for(let j=0;j<dim;j++)z+=weights[offset+j]*x[j];return 1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));});
}
export function metrics(truth,predictions){
 if(truth.length!==predictions.length)throw new Error('Metrics require equally sized arrays.');
 let tp=0,tn=0,fp=0,fn=0;
 truth.forEach((y,i)=>{if(y){if(predictions[i])tp++;else fn++;}else if(predictions[i])fp++;else tn++;});
 const precision=tp/(tp+fp)||0,recall=tp/(tp+fn)||0;
 return {tp,tn,fp,fn,precision,recall,f1:2*precision*recall/(precision+recall)||0,accuracy:(tp+tn)/(truth.length||1),support:truth.length};
}
