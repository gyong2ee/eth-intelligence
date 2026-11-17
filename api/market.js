const sources = {
 upbit: 'https://api.upbit.com/v1/ticker?markets=KRW-ETH',
 price: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd,krw,eur,jpy&include_24hr_change=true',
 fear: 'https://api.alternative.me/fng/?limit=365',
 tvl: 'https://api.llama.fi/v2/historicalChainTvl/Ethereum',
 mvrv: 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=eth&metrics=CapMVRVCur&frequency=1d&page_size=10000',
 funding: 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT',
 oi: 'https://fapi.binance.com/fapi/v1/openInterest?symbol=ETHUSDT',
 vix: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'
};
module.exports=async function(req,res){
 const key=req.query.source;
 if(!Object.hasOwn(sources,key))return res.status(400).json({error:'Unknown source'});
 try{
 const r=await fetch(sources[key],{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Upstream HTTP '+r.status);
 let data=key==='vix'?await r.text():await r.json();
 if(key==='funding'){data={lastFundingRate:data.lastFundingRate,time:data.time||Date.now()};}if(key==='oi'){data={openInterest:data.openInterest,time:data.time||Date.now()};}
 if(key==='vix'){data=data.trim().split(/\r?\n/).slice(1).map(l=>{const a=l.split(',');return a[0]+','+a[4]}).join('\n');}
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 return res.json({source:key,fetchedAt:new Date().toISOString(),data});
 }catch(e){return res.status(502).json({source:key,error:e.message});}
};