// Binance USD-M ETHUSDT historical open interest; public endpoint, up to 30 days.
module.exports=async function(req,res){
 const days=Math.min(30,Math.max(1,Number(req.query.days)||30));
 const period=days<=7?'1h':'1d';
 const url='https://fapi.binance.com/futures/data/openInterestHist?symbol=ETHUSDT&period='+period+'&limit=500';
 try{
  const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  const data=await r.json().catch(()=>null);
  if(!r.ok||!Array.isArray(data))throw Error('Binance historical OI unavailable (HTTP '+r.status+')');
  const cutoff=Date.now()-days*86400000;
  const rows=data.map(v=>({t:Number(v.timestamp),v:Number(v.sumOpenInterestValue)})).filter(v=>Number.isFinite(v.t)&&Number.isFinite(v.v)&&v.v>0&&v.t>=cutoff).sort((a,b)=>a.t-b.t);
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=900');
  res.status(200).json({source:'Binance ETHUSDT perpetual',days,rows});
 }catch(e){res.status(502).json({error:e.message,source:'Binance ETHUSDT perpetual'})}
};