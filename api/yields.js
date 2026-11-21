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
// Aave v3 on Ethereum via DefiLlama yields (on-chain reference, not an exchange).
async function aave(){
 const j=await getJSON('https://yields.llama.fi/pools',15000);
 const rows=(j.data||[]).filter(p=>p.project==='aave-v3'&&p.chain==='Ethereum'&&['USDC','USDT'].includes(p.symbol));
 if(!rows.length)throw Error('no pools');
 return rows.map(p=>({venue:'Aave v3',product:'공급 (이더리움)',coin:p.symbol,apy:+Number(p.apyBase??p.apy).toFixed(2),note:'온체인 예치 · DefiLlama'}));
}
// ETH staking
async function lido(){
 const j=await getJSON('https://eth-api.lido.fi/v1/protocol/steth/apr/sma');
 const v=Number(j?.data?.smaApr);if(!Number.isFinite(v))throw Error('no apr');
 return {name:'Lido stETH',apr:+v.toFixed(2),note:'최근 7일 평균 APR'};
}
async function ethstore(){
 const j=await getJSON('https://beaconcha.in/api/v1/ethstore/latest');
 const v=Number(j?.data?.apr);if(!Number.isFinite(v))throw Error('no apr');
 return {name:'ETH.STORE',apr:+(v*100).toFixed(2),note:'네트워크 평균 검증자 수익률 · beaconcha.in',day:j.data.day};
}

module.exports=async function(req,res){
 const stableJobs={'OKX USDT':okx('USDT'),'OKX USDC':okx('USDC'),'Bybit USDT':bybit('USDT'),'Bybit USDC':bybit('USDC'),'Aave v3':aave()};
 const stakeJobs={'Lido':lido(),'ETH.STORE':ethstore()};
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
