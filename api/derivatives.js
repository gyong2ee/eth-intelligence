// Bybit ETHUSDT perpetual historical derivatives. Independent series errors.
module.exports=async function(req,res){
 const days=Math.min(180,Math.max(1,Number(req.query.days)||180)),since=Date.now()-days*86400000;
 async function get(path,params){const u=new URL('https://api.bybit.com/v5/market/'+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));const response=await fetch(u,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw Error('Bybit HTTP '+response.status);const j=await response.json();if(j.retCode!==0)throw Error('Bybit '+j.retCode+': '+j.retMsg);return j.result?.list||[];}
 const clean=a=>[...new Map(a.filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.v)&&x.t>=since).map(x=>[x.t,x])).values()].sort((a,b)=>a.t-b.t);
 async function funding(){let out=[],end=Date.now();for(let i=0;i<4;i++){let a=await get('funding/history',{category:'linear',symbol:'ETHUSDT',limit:200,endTime:end});if(!a.length)break;out.push(...a.map(x=>({t:Number(x.fundingRateTimestamp),v:Number(x.fundingRate)*100})));let oldest=Math.min(...a.map(x=>Number(x.fundingRateTimestamp)));if(oldest<=since||a.length<200)break;end=oldest-1;}return clean(out);}
 async function oi(){// Bybit caps OI history query spans; page backward in 25-day windows.
 let out=[];let end=Date.now();for(let i=0;i<8&&end>since;i++){let start=Math.max(since,end-25*86400000);let a=await get('open-interest',{category:'linear',symbol:'ETHUSDT',intervalTime:'1d',limit:200,startTime:start,endTime:end});out.push(...a.map(x=>({t:Number(x.timestamp),v:Number(x.openInterest)})));end=start-1;}return clean(out);}
 const results=await Promise.allSettled([funding(),oi()]);let errors={};if(results[0].status==='rejected')errors.funding=results[0].reason.message;if(results[1].status==='rejected')errors.oi=results[1].reason.message;
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 return res.status(Object.keys(errors).length===2?502:200).json({funding:results[0].status==='fulfilled'?results[0].value:[],oi:results[1].status==='fulfilled'?results[1].value:[],errors,source:'Bybit ETHUSDT'});
};