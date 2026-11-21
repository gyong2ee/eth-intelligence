// Current yields: stablecoin savings APY at exchanges (and Aave as an on-chain reference),
// plus ETH staking APR. Every source is fetched independently; failures are listed, not fatal.
const UA={'User-Agent':'ETHIntelligence/1.0',Accept:'application/json'};
async function getJSON(url,ms=10000){
 const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(ms)});
 const text=await r.text();let j=null;try{j=JSON.parse(text)}catch(e){}
 if(!r.ok)throw Error('HTTP '+r.status);
 if(j==null)throw Error('not JSON');
 return j;
}
const pct=v=>{const n=Number(String(v).replace('%',''));return Number.isFinite(n)?n:null};

// OKX Simple Earn: public lending-rate summary. Rates are annual decimals.
async function okx(coin){
 const j=await getJSON('https://www.okx.com/api/v5/finance/savings/lending-rate-summary?ccy='+coin);
 const d=j?.data?.[0];if(!d)throw Error('no data');
 const est=Number(d.estRate),avg=Number(d.avgRate);
 const v=Number.isFinite(est)&&est>0?est:avg;if(!Number.isFinite(v))throw Error('no rate');
 return {venue:'OKX',product:'Simple Earn 유연',coin,apy:+(v*100).toFixed(2),note:'다음 1시간 예상 대출 이율'};
}
// Bybit Earn: flexible savings product list (public).
async function bybit(coin){
 const j=await getJSON('https://api.bybit.com/v5/earn/product?category=FlexibleSaving&coin='+coin);
 if(j.retCode!==0)throw Error('retCode '+j.retCode);
 const list=(j.result?.list||[]).filter(p=>p.coin===coin&&p.status!=='NotAvailable');
 if(!list.length)throw Error('no product');
 const best=list.map(p=>({p,v:pct(p.estimateApr)})).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v)[0];
 if(!best)throw Error('no rate');
 return {venue:'Bybit',product:'Flexible Savings',coin,apy:+best.v.toFixed(2),note:'기본 구간 예상 연이율'};
}
// DefiLlama yields: one fetch feeds Aave (stablecoin reference) and liquid-staking APRs.
let poolsPromise=null;
function pools(){return poolsPromise||(poolsPromise=getJSON('https://yields.llama.fi/pools',15000).then(j=>j.data||[]))}
const topBy=(rows,key)=>{const m=new Map();for(const r of rows){const k=key(r),o=m.get(k);if(!o||(r.tvlUsd||0)>(o.tvlUsd||0))m.set(k,r)}return [...m.values()]};
async function aave(){
 const rows=(await pools()).filter(p=>p.project==='aave-v3'&&p.chain==='Ethereum'&&['USDC','USDT'].includes(p.symbol));
 if(!rows.length)throw Error('no pools');
 return topBy(rows,p=>p.symbol).map(p=>({venue:'Aave v3',product:'공급 (이더리움 메인 마켓)',coin:p.symbol,apy:+Number(p.apyBase??p.apy).toFixed(2),note:'온체인 예치 · DefiLlama'}));
}
async function liquidStaking(){
 const names={RETH:'Rocket Pool rETH',CBETH:'Coinbase cbETH',WBETH:'Binance WBETH'};
 const rows=(await pools()).filter(p=>p.chain==='Ethereum'&&names[p.symbol]&&Number.isFinite(Number(p.apyBase??p.apy)));
 if(!rows.length)throw Error('no pools');
 return topBy(rows,p=>p.symbol).map(p=>({name:names[p.symbol],apr:+Number(p.apyBase??p.apy).toFixed(2),note:'DefiLlama · 최근 수익률'}));
}
// ETH staking
async function lido(){
 const j=await getJSON('https://eth-api.lido.fi/v1/protocol/steth/apr/sma');
 const v=Number(j?.data?.smaApr);if(!Number.isFinite(v))throw Error('no apr');
 return {name:'Lido stETH',apr:+v.toFixed(2),note:'최근 7일 평균 APR'};
}
module.exports=async function(req,res){
 poolsPromise=null; // fresh DefiLlama fetch per request; the CDN cache above handles reuse
 const stableJobs={'OKX USDT':okx('USDT'),'OKX USDC':okx('USDC'),'Bybit USDT':bybit('USDT'),'Bybit USDC':bybit('USDC'),'Aave v3':aave()};
 const stakeJobs={'Lido':lido(),'DefiLlama LST':liquidStaking()};
 const all=await Promise.allSettled([...Object.values(stableJobs),...Object.values(stakeJobs)]);
 const sk=Object.keys(stableJobs),kk=Object.keys(stakeJobs),out={stable:[],staking:[],errors:{},fetchedAt:new Date().toISOString()};
 all.forEach((r,i)=>{
  const isStable=i<sk.length,key=isStable?sk[i]:kk[i-sk.length];
  if(r.status==='fulfilled'){const v=r.value;(isStable?out.stable:out.staking).push(...(Array.isArray(v)?v:[v]))}
  else out.errors[key]=r.reason.message;
 });
 res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
 return res.status(out.stable.length||out.staking.length?200:502).json(out);
};
