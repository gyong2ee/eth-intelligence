// Bybit public market data for BTC/ETH perpetuals.
//   ?kind=oi&symbol=ETHUSDT   daily open interest (coin and USD) for up to ~3 years
//   ?kind=liq&symbol=ETHUSDT  estimated liquidation map from the last 30 days of hourly data
// The liquidation map is a model, not exchange data: rising open interest is treated as new
// positions opened at that hour's price, split long/short by Bybit's account ratio and spread
// over common leverage tiers; levels the price has since crossed are removed.
const BASE='https://api.bybit.com/v5/market/';
const SYMBOLS=new Set(['ETHUSDT','BTCUSDT']);
const H=3600000,D=86400000;
async function get(path,params){
 const u=new URL(BASE+path);Object.entries(params).forEach(([k,v])=>v!=null&&u.searchParams.set(k,String(v)));
 const r=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 const j=await r.json().catch(()=>null);
 if(!r.ok||!j||j.retCode!==0)throw Error('Bybit '+path+' HTTP '+r.status+' code '+(j?.retCode??'?'));
 return j.result;
}
async function openInterest(symbol,intervalTime,start,pages){
 let out=[],cursor=null;
 for(let i=0;i<pages;i++){
  const r=await get('open-interest',{category:'linear',symbol,intervalTime,startTime:start,endTime:Date.now(),limit:200,cursor});
  out.push(...(r.list||[]).map(x=>({t:+x.timestamp,oi:+x.openInterest})));
  cursor=r.nextPageCursor;if(!cursor||!(r.list||[]).length)break;
 }
 return [...new Map(out.filter(x=>Number.isFinite(x.t)&&x.oi>0).map(x=>[x.t,x])).values()].sort((a,b)=>a.t-b.t);
}
async function klines(symbol,interval,start,limit){
 const r=await get('kline',{category:'linear',symbol,interval,start,limit});
 return (r.list||[]).map(k=>({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4]})).filter(k=>Number.isFinite(k.c)).sort((a,b)=>a.t-b.t);
}

async function oiHistory(symbol){
 const start=Date.now()-1000*D;
 const [oi,px]=await Promise.all([openInterest(symbol,'1d',start,5),klines(symbol,'D',start,1000)]);
 const close=new Map(px.map(k=>[Math.floor(k.t/D),k.c]));
 const rows=oi.map(x=>{const c=close.get(Math.floor(x.t/D));return {t:x.t,oi:x.oi,usd:c?Math.round(x.oi*c):null,price:c||null}}).filter(r=>r.usd);
 return {symbol,unit:symbol.replace('USDT',''),source:'Bybit linear perpetual · daily',rows};
}

async function liqMap(symbol){
 const start=Date.now()-30*D;
 const [oi,px,ratio]=await Promise.all([
  openInterest(symbol,'1h',start,5),
  klines(symbol,'60',start,1000),
  get('account-ratio',{category:'linear',symbol,period:'1h',limit:500}).then(r=>(r.list||[]).map(x=>({t:+x.timestamp,buy:+x.buyRatio}))).catch(()=>[])
 ]);
 if(oi.length<48||px.length<48)throw Error('not enough hourly data');
 const bar=new Map(px.map(k=>[Math.floor(k.t/H),k]));
 const buy=new Map(ratio.map(x=>[Math.floor(x.t/H),x.buy]));
 const TIERS=[[10,.35],[25,.30],[50,.22],[100,.13]];
 let longs=[],shorts=[];// {p: liquidation price, q: coin amount}
 for(let i=1;i<oi.length;i++){
  const h=Math.floor(oi[i].t/H),k=bar.get(h);if(!k)continue;
  const prev=oi[i-1].oi,cur=oi[i].oi,d=cur-prev;
  if(d>0){
   const p=(k.h+k.l+k.c)/3,b=Number.isFinite(buy.get(h))?buy.get(h):.5;
   for(const [L,w] of TIERS){longs.push({p:p*(1-1/L),q:d*b*w});shorts.push({p:p*(1+1/L),q:d*(1-b)*w})}
  }else if(d<0&&prev>0){const f=cur/prev;longs.forEach(x=>x.q*=f);shorts.forEach(x=>x.q*=f)}
  longs=longs.filter(x=>x.p<k.l);shorts=shorts.filter(x=>x.p>k.h);
 }
 const price=px[px.length-1].c,step=price*0.005,lo=price*0.75,hi=price*1.25,bins=new Map();
 const add=(list,side)=>list.forEach(x=>{if(x.p<lo||x.p>hi)return;const b=Math.round(x.p/step);const o=bins.get(b)||{long:0,short:0};o[side]+=x.q*x.p;bins.set(b,o)});
 add(longs,'long');add(shorts,'short');
 const rows=[...bins.entries()].map(([b,v])=>({price:+(b*step).toFixed(symbol==='BTCUSDT'?0:2),long:Math.round(v.long),short:Math.round(v.short)})).sort((a,b)=>a.price-b.price);
 return {symbol,price,step:+step.toFixed(2),window:'30d hourly',model:'OI 증가분 × 롱숏 비율 × 레버리지 10/25/50/100배 가정',source:'Bybit linear perpetual (추정)',rows,updated:px[px.length-1].t};
}

// Long/short account ratio: Bybit daily history (about 500 days) and Binance's last 30 days.
async function longShort(symbol){
 const [by,bn]=await Promise.allSettled([
  get('account-ratio',{category:'linear',symbol,period:'1d',limit:500}).then(r=>(r.list||[]).map(x=>({t:+x.timestamp,long:+x.buyRatio*100})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.long)).sort((a,b)=>a.t-b.t)),
  fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol='+symbol+'&period=1d&limit=30',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)})
   .then(async r=>{const j=await r.json();if(!r.ok||!Array.isArray(j))throw Error('Binance HTTP '+r.status);return j.map(x=>({t:+x.timestamp,long:+x.longAccount*100})).filter(x=>Number.isFinite(x.long)).sort((a,b)=>a.t-b.t)})
 ]);
 const out={symbol,unit:'% of accounts long',errors:{}};
 if(by.status==='fulfilled')out.bybit=by.value;else{out.bybit=[];out.errors.bybit=by.reason.message}
 if(bn.status==='fulfilled')out.binance=bn.value;else{out.binance=[];out.errors.binance=bn.reason.message}
 if(!out.bybit.length&&!out.binance.length)throw Error('no long/short data');
 return out;
}

module.exports=async function(req,res){
 const symbol=String(req.query.symbol||'ETHUSDT').toUpperCase(),kind=String(req.query.kind||'oi');
 if(!SYMBOLS.has(symbol))return res.status(400).json({error:'symbol must be ETHUSDT or BTCUSDT'});
 try{
  const body=kind==='liq'?await liqMap(symbol):kind==='ls'?await longShort(symbol):await oiHistory(symbol);
  res.setHeader('Cache-Control',kind==='liq'?'s-maxage=600, stale-while-revalidate=1800':'s-maxage=3600, stale-while-revalidate=21600');
  return res.json(body);
 }catch(e){return res.status(502).json({error:e.message,symbol,kind})}
};
