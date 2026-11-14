const sources = {
 price: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd&include_24hr_change=true',
 fear: 'https://api.alternative.me/fng/?limit=365',
 tvl: 'https://api.llama.fi/v2/historicalChainTvl/Ethereum',
 mvrv: 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=eth&metrics=CapMVRVCur&frequency=1d&page_size=10000',
 funding: 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT',
 oi: 'https://fapi.binance.com/fapi/v1/openInterest?symbol=ETHUSDT',
 vix: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS'
};
module.exports=async function(req,res){
 const key=req.query.source;
 if(!Object.hasOwn(sources,key))return res.status(400).json({error:'Unknown source'});
 try{
 const r=await fetch(sources[key],{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Upstream HTTP '+r.status);
 const data=key==='vix'?await r.text():await r.json();
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 return res.json({source:key,fetchedAt:new Date().toISOString(),data});
 }catch(e){return res.status(502).json({source:key,error:e.message});}
};