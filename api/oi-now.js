// Current perpetual-futures open interest for ETH or BTC, summed across Binance, Bybit and OKX
// (USDT-margined and coin-margined contracts), straight from each exchange's public API.
// change24 is the 24-hour change in contracts held (coin units, so price moves do not count),
// measured on Binance USDT-M and Bybit USDT perpetuals.
const UA={Accept:'application/json'};
async function j(url){const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(10000)});const b=await r.json().catch(()=>null);if(!r.ok||b==null)throw Error('HTTP '+r.status);return b}
const CONTRACT_USD={ETH:10,BTC:100};// Binance COIN-M contract size in USD

async function binanceUsdt(c){
 const [oi,px]=await Promise.all([j('https://fapi.binance.com/fapi/v1/openInterest?symbol='+c+'USDT'),j('https://fapi.binance.com/fapi/v1/premiumIndex?symbol='+c+'USDT')]);
 const coin=+oi.openInterest,price=+px.markPrice;if(!(coin>0&&price>0))throw Error('bad data');
 return {name:'Binance USDT',coin,usd:coin*price,price};
}
async function binanceCoin(c){
 const oi=await j('https://dapi.binance.com/dapi/v1/openInterest?symbol='+c+'USD_PERP');
 const usd=+oi.openInterest*CONTRACT_USD[c];if(!(usd>0))throw Error('bad data');
 return {name:'Binance COIN',usd};
}
async function bybit(c,cat){
 const sym=cat==='linear'?c+'USDT':c+'USD';
 const r=await j('https://api.bybit.com/v5/market/tickers?category='+cat+'&symbol='+sym);
 const t=r?.result?.list?.[0];if(!t)throw Error('no ticker');
 const usd=cat==='linear'?+t.openInterestValue:+t.openInterest;// inverse contracts are 1 USD each
 if(!(usd>0))throw Error('bad data');
 return {name:'Bybit '+(cat==='linear'?'USDT':'COIN'),usd,coin:cat==='linear'?+t.openInterest:null,price:+t.markPrice};
}
async function okx(c,quote){
 const r=await j('https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId='+c+'-'+quote+'-SWAP');
 const d=r?.data?.[0];const usd=+d?.oiUsd;if(!(usd>0))throw Error('bad data');
 return {name:'OKX '+(quote==='USDT'?'USDT':'COIN'),usd,coin:+d.oiCcy||null};
}
// 24h change in coin units on Binance USDT-M and Bybit USDT perpetuals
async function change24(c){
 const [bn,by]=await Promise.allSettled([
  j('https://fapi.binance.com/futures/data/openInterestHist?symbol='+c+'USDT&period=1h&limit=25').then(a=>{if(!Array.isArray(a)||a.length<2)throw Error('short');return [+a[0].sumOpenInterest,+a[a.length-1].sumOpenInterest]}),
  j('https://api.bybit.com/v5/market/open-interest?category=linear&symbol='+c+'USDT&intervalTime=1h&limit=25').then(r=>{const l=r?.result?.list||[];if(l.length<2)throw Error('short');return [+l[l.length-1].openInterest,+l[0].openInterest]})
 ]);
 let a=0,b=0,used=[];
 if(bn.status==='fulfilled'){a+=bn.value[0];b+=bn.value[1];used.push('Binance')}
 if(by.status==='fulfilled'){a+=by.value[0];b+=by.value[1];used.push('Bybit')}
 if(!a)return null;
 return {pct:+((b/a-1)*100).toFixed(2),basis:used.join('+')+' USDT 무기한 · 계약 수 기준'};
}

module.exports=async function(req,res){
 const c=String(req.query.coin||'ETH').toUpperCase();
 if(!['ETH','BTC'].includes(c))return res.status(400).json({error:'coin must be ETH or BTC'});
 const jobs=[binanceUsdt(c),binanceCoin(c),bybit(c,'linear'),bybit(c,'inverse'),okx(c,'USDT'),okx(c,'USD')];
 const names=['Binance USDT','Binance COIN','Bybit USDT','Bybit COIN','OKX USDT','OKX COIN'];
 const [settled,ch]=await Promise.all([Promise.allSettled(jobs),change24(c).catch(()=>null)]);
 const exchanges=[],errors={};
 settled.forEach((s,i)=>{if(s.status==='fulfilled')exchanges.push(s.value);else errors[names[i]]=s.reason.message});
 if(!exchanges.length)return res.status(502).json({error:'no exchange responded',errors});
 const price=(exchanges.find(e=>e.price)||{}).price||null;
 const totalUsd=exchanges.reduce((s,e)=>s+e.usd,0);
 res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=300');
 return res.json({coin:c,price,totalUsd:Math.round(totalUsd),totalCoin:price?Math.round(totalUsd/price):null,
  exchanges:exchanges.map(e=>({name:e.name,usd:Math.round(e.usd)})).sort((a,b)=>b.usd-a.usd),
  change24:ch,errors,fetchedAt:new Date().toISOString()});
};
