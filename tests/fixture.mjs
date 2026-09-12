/** Synthetic fixtures exist ONLY for explicit tests, never a production fallback. */
export function fixture(n=4){
 const rows=n===4?[[0,1,2],[0,2,3],[1,2,4]]:Array.from({length:n*2},(_,e)=>[Math.floor(e/2),(e*7+3)%n,e%5+1]);
 rows.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const m=rows.length,b=new ArrayBuffer(32+8*n+4*(n+1)+8*m),v=new DataView(b);
 new Uint8Array(b,0,8).set(new TextEncoder().encode('FLYPII02'));
 [2,n,m,rows.reduce((s,r)=>s+r[2],0),0,0].forEach((x,i)=>v.setUint32(8+4*i,x,true));
 const ids=new BigUint64Array(b,32,n);for(let i=0;i<n;i++)ids[i]=BigInt(100+i);
 const p=new Uint32Array(b,32+8*n,n+1),t=new Uint32Array(b,32+8*n+4*(n+1),m),w=new Uint32Array(b,32+8*n+4*(n+1)+4*m,m);
 rows.forEach(([s,d,c],i)=>{p[s+1]++;t[i]=d;w[i]=c;});for(let i=1;i<=n;i++)p[i]+=p[i-1];return b;
}
