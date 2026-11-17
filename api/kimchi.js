// ETH kimchi premium: Upbit KRW spot vs global ETH/USD spot converted at USD/KRW FX.
module.exports=async function(req,res){
 try{
 const get=async(url)=>{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ETHIntelligence/1.0'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Upstream HTTP '+r.status);return r.json()};
 const [upbit,global,fx]=await Promise.all([
 get('https://api.upbit.com/v1/ticker?markets=KRW-ETH'),
 get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'),
 get('https://open.er-api.com/v6/latest/USD')
 ]);
 const krw=Number(upbit?.[0]?.trade_price),usd=Number(global?.ethereum?.usd),rate=Number(fx?.rates?.KRW);
 if(!Number.isFinite(krw)||!Number.isFinite(usd)||!Number.isFinite(rate)||Math.min(krw,usd,rate)<=0)throw Error('Invalid spot or FX quote');
 const premiumPercent=(krw/(usd*rate)-1)*100;
 res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=600');
 return res.json({source:'Upbit + CoinGecko + ExchangeRate-API',data:{premiumPercent,upbitKRW:krw,globalUSD:usd,usdKRW:rate,time:new Date().toISOString(),fxUpdatedAt:fx.time_last_update_utc||null}});
 }catch(e){return res.status(502).json({error:e.message})}
};