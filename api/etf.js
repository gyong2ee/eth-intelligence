// Free CoinBoss US spot ETF flow history (million USD), no key required.
module.exports=async function(req,res){
 try{
 const asset=String(req.query.asset||'ETH').toUpperCase();
 if(!['ETH','BTC'].includes(asset))return res.status(400).json({error:'Unsupported asset'});
 const url='https://www.coinboss.com/api/etf/flows?asset='+asset+'&days=all';
 const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 const j=await r.json();
 if(!r.ok||j.success!==true||!Array.isArray(j.data))throw Error('CoinBoss HTTP '+r.status+': '+(j.error||'Invalid response'));
 if(j.unit!=='million_usd')throw Error('Unexpected ETF flow unit: '+j.unit);
 const rows=j.data.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(Number(x.flow))).map(x=>({date:x.date,flow:Number(x.flow),cum:Number.isFinite(Number(x.cum))?Number(x.cum):null,aum:x.aum==null?null:Number(x.aum)}));
 if(!rows.length)throw Error('No ETF flow observations');
 res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
 return res.json({source:'CoinBoss',asset,unit:'million_usd',fetchedAt:new Date().toISOString(),rows});
 }catch(e){return res.status(502).json({error:e.message})}
};