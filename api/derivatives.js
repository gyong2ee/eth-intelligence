// Binance USD-M ETHUSDT perpetual futures history. API errors are reported per series.
module.exports=async function(req,res){
 const days=Math.min(180,Math.max(1,Number(req.query.days)||180)),since=Date.now()-days*86400000;
 async function get(path,params){const u=new URL(path.startsWith('/')?'https://fapi.binance.com'+path:'https://fapi.binance.com/fapi/v1/'+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));const r=await fetch(u,{signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Binance '+path+' HTTP '+r.status);const j=await r.json();if(j.code&&j.code<0)throw Error('Binance '+j.code+': '+j.msg);return j;}
 const clean=a=>[...new Map(a.filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.v)&&x.t>=since).map(x=>[x.t,x])).values()].sort((a,b)=>a.t-b.t);
 async function funding(){let out=[],start=since;for(let i=0;i<4;i++){let a=await get('fundingRate',{symbol:'ETHUSDT',startTime:start,endTime:Date.now(),limit:1000});if(!a.length)break;out.push(...a.map(x=>({t:Number(x.fundingTime),v:Number(x.fundingRate)*100})));let last=Number(a.at(-1).fundingTime);if(a.length<1000||last<=start)break;start=last+1;}return clean(out);}
 async function oi(){// Binance public OI history is restricted to approximately the latest 30 days.
 const limitDays=Math.min(days,29);let out=[],end=Date.now(),floor=Date.now()-limitDays*86400000;
 for(let i=0;i<7&&end>floor;i++){let start=Math.max(floor,end-4*86400000);let a=await get('/futures/data/openInterestHist',{symbol:'ETHUSDT',period:'1d',limit:500,startTime:start,endTime:end});out.push(...a.map(x=>({t:Number(x.timestamp),v:Number(x.sumOpenInterest)})));end=start-1;}return clean(out);}
 const result=await Promise.allSettled([funding(),oi()]),errors={};if(result[0].status==='rejected')errors.funding=result[0].reason.message;if(result[1].status==='rejected')errors.oi=result[1].reason.message;
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 return res.status(Object.keys(errors).length===2?502:200).json({funding:result[0].status==='fulfilled'?result[0].value:[],oi:result[1].status==='fulfilled'?result[1].value:[],errors,source:'Binance USD-M ETHUSDT',oiCoverageDays:29});
};