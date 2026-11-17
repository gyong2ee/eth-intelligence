// CoinMarketCap ETH derivatives; requires CMC_API_KEY in Vercel environment.
let cache={time:0,value:null};
module.exports=async function(req,res){
 const key=process.env.CMC_API_KEY;
 if(!key)return res.status(503).json({error:'CMC_API_KEY 환경변수 미설정',setup:'Vercel > Settings > Environment Variables'});
 try{
 if(cache.value&&Date.now()-cache.time<300000)return res.json(cache.value);
 let rows=[],start=1;
 for(let page=0;page<5;page++){
 const u=new URL('https://pro-api.coinmarketcap.com/v5/cryptocurrency/derivatives/market-pairs/list/latest');
 Object.entries({crypto_id:'1027',category:'perpetual',convert:'USD',start,limit:250}).forEach(([k,v])=>u.searchParams.set(k,v));
 const r=await fetch(u,{headers:{'X-CMC_PRO_API_KEY':key,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||Number(j.status?.error_code||0)!==0)throw Error('CMC HTTP '+r.status+'; code='+String(j.status?.error_code??'missing')+'; message='+String(j.status?.error_message||'none')+'; notice='+String(j.status?.notice||'none'));
 const part=j.data?.market_pairs||[];rows.push(...part);if(part.length<250)break;start+=250;
 }
 const pairs=rows.filter(p=>p.category==='perpetual'&&!p.outlier_detected);
 let total=0,weighted=0,weight=0,count=0,latest=null;
 for(const p of pairs){const q=p.exchange_reported_quotes?.find(x=>x.convert_symbol==='USD')||p.exchange_reported_quotes?.[0];const v=p.quotes?.find(x=>x.convert_symbol==='USD')||p.quotes?.[0];const oi=Number(v?.open_interest);const funding=Number(q?.funding_rate);if(Number.isFinite(oi)&&oi>0){total+=oi;if(Number.isFinite(funding)){weighted+=funding*oi;weight+=oi;count++}}const t=q?.last_updated||v?.last_updated;if(t&&(!latest||t>latest))latest=t;}
 if(!total||!weight)throw Error('CMC derivatives fields missing or empty');
 const value={source:'CoinMarketCap',fetchedAt:new Date().toISOString(),data:{lastFundingRate:String(weighted/weight),openInterestUSD:total,time:latest||new Date().toISOString(),marketCount:pairs.length,fundingMarkets:count,method:'OI-weighted funding; summed USD OI'}};
 cache={time:Date.now(),value};res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');return res.json(value);
 }catch(e){return res.status(502).json({error:e.message})}
};