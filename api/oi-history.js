// Historical ETHUSDT open interest from Bybit public V5 API (ETH units).
module.exports=async function(req,res){
 const days=Math.min(180,Math.max(1,Number(req.query.days)||30));
 const intervalTime=days<=7?'1h':'1d';
 const url=new URL('https://api.bybit.com/v5/market/open-interest');
 Object.entries({category:'linear',symbol:'ETHUSDT',intervalTime,limit:'200',startTime:String(Date.now()-days*86400000),endTime:String(Date.now())}).forEach(([k,v])=>url.searchParams.set(k,v));
 try{
  const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||j?.retCode!==0||!Array.isArray(j?.result?.list))throw Error('Bybit OI unavailable (HTTP '+r.status+', code '+String(j?.retCode??'unknown')+')');
  const rows=j.result.list.map(v=>({t:Number(v.timestamp),v:Number(v.openInterest)})).filter(v=>Number.isFinite(v.t)&&Number.isFinite(v.v)&&v.v>0).sort((a,b)=>a.t-b.t);
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=900');
  res.status(200).json({source:'Bybit ETHUSDT perpetual',unit:'ETH',days,rows});
 }catch(e){res.status(502).json({error:e.message,source:'Bybit ETHUSDT perpetual'})}
};