// Historical Bybit ETHUSDT perpetual data. No paid API keys.
module.exports=async function(req,res){
 const days=Math.min(180,Math.max(1,Number(req.query.days)||180));
 const since=Date.now()-days*86400000;
 async function get(path,params){const url=new URL('https://api.bybit.com/v5/market/'+path);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Bybit HTTP '+r.status);const j=await r.json();if(j.retCode!==0)throw Error(j.retMsg||'Bybit API error');return j.result?.list||[];}
 try{
 // Funding records may be spaced 8h apart; paginate by decreasing endTime.
 let funding=[],end=Date.now();
 for(let i=0;i<4;i++){let a=await get('funding/history',{category:'linear',symbol:'ETHUSDT',limit:200,endTime:end});if(!a.length)break;funding.push(...a.map(x=>({t:Number(x.fundingRateTimestamp),v:Number(x.fundingRate)*100})));let oldest=Math.min(...a.map(x=>Number(x.fundingRateTimestamp)));if(oldest<=since||a.length<200)break;end=oldest-1;}
 const oiRaw=await get('open-interest',{category:'linear',symbol:'ETHUSDT',intervalTime:'1d',limit:200,startTime:since,endTime:Date.now()});
 const clean=a=>[...new Map(a.filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.v)&&x.t>=since).map(x=>[x.t,x])).values()].sort((a,b)=>a.t-b.t);
 res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');
 return res.json({funding:clean(funding),oi:clean(oiRaw.map(x=>({t:Number(x.timestamp),v:Number(x.openInterest)}))),source:'Bybit ETHUSDT'});
 }catch(e){return res.status(502).json({error:e.message})}
};