// Daily liquidations (long and short, USD) for ETH or BTC perpetual futures, summed over every
// exchange Coinalyze tracks. Needs a free Coinalyze API key in the COINALYZE_API_KEY env var.
//   ?src=liqhist&coin=ETH|BTC
// Exchanges throttle what they publish (Binance sends at most one liquidation per symbol per
// second), so every source, Coinalyze included, undercounts big days. Read it as relative size.
const BASE='https://api.coinalyze.net/v1/';
const D=86400;
async function api(path,params,key){
 const u=new URL(BASE+path);Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 const r=await fetch(u,{headers:{Accept:'application/json',api_key:key},signal:AbortSignal.timeout(15000)});
 const text=await r.text();let j=null;try{j=JSON.parse(text)}catch(e){}
 if(!r.ok)throw Error('Coinalyze '+path+' HTTP '+r.status+(j&&j.message?' '+j.message:''));
 if(j==null)throw Error('Coinalyze '+path+' not JSON');
 return j;
}
let marketsCache=null;// {at, coin -> markets}
async function perps(coin,key){
 if(!marketsCache||Date.now()-marketsCache.at>6*3600e3){
  const [ex,mk]=await Promise.all([api('exchanges',{},key),api('future-markets',{},key)]);
  marketsCache={at:Date.now(),names:new Map((ex||[]).map(e=>[e.code,e.name])),markets:mk||[]};
 }
 const list=marketsCache.markets.filter(m=>m.is_perpetual&&String(m.base_asset).toUpperCase()===coin);
 return list.map(m=>({symbol:m.symbol,exchange:marketsCache.names.get(m.exchange)||m.exchange}));
}
module.exports=async function(req,res){
 const key=process.env.COINALYZE_API_KEY;
 if(!key)return res.status(503).json({error:'COINALYZE_API_KEY가 설정되지 않았습니다',needsKey:true});
 const coin=String(req.query.coin||'ETH').toUpperCase();
 if(!['ETH','BTC'].includes(coin))return res.status(400).json({error:'coin must be ETH or BTC'});
 try{
  const markets=await perps(coin,key);
  if(!markets.length)throw Error('no perpetual markets for '+coin);
  const exOf=new Map(markets.map(m=>[m.symbol,m.exchange]));
  const to=Math.floor(Date.now()/1000),from=to-1000*D;
  const chunks=[];for(let i=0;i<markets.length;i+=20)chunks.push(markets.slice(i,i+20).map(m=>m.symbol));
  const results=await Promise.allSettled(chunks.map(c=>api('liquidation-history',{symbols:c.join(','),interval:'daily',from,to,convert_to_usd:'true'},key)));
  const days=new Map(),byEx=new Map(),errors=[];
  results.forEach(r=>{
   if(r.status!=='fulfilled'){errors.push(r.reason.message);return}
   (r.value||[]).forEach(s=>{const ex=exOf.get(s.symbol)||'?';(s.history||[]).forEach(h=>{
    const t=Math.floor(+h.t/D)*D*1000,l=+h.l||0,sh=+h.s||0;if(!Number.isFinite(t))return;
    const d=days.get(t)||{t,long:0,short:0};d.long+=l;d.short+=sh;days.set(t,d);
    if(+h.t>=to-365*D){const e=byEx.get(ex)||0;byEx.set(ex,e+l+sh)}
   })});
  });
  const rows=[...days.values()].sort((a,b)=>a.t-b.t).map(d=>({t:d.t,long:Math.round(d.long),short:Math.round(d.short)}));
  if(!rows.length)throw Error(errors[0]||'no liquidation data');
  const exchanges=[...byEx.entries()].map(([name,usd])=>({name,usd:Math.round(usd)})).sort((a,b)=>b.usd-a.usd);
  res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=7200');
  return res.status(200).json({coin,rows,exchanges,markets:markets.length,errors,source:'Coinalyze · 주요 거래소 무기한 선물 합계',fetchedAt:new Date().toISOString()});
 }catch(e){return res.status(502).json({error:e.message})}
};
