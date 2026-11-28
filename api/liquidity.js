// Liquidity series: Fed balance sheet (WALCL), Treasury General Account (TGA),
// overnight reverse repo (RRP), Fed net liquidity, and total stablecoin supply.
// All values are returned in USD billions. Each series fails independently.
const UA={'User-Agent':'ETHIntelligence/1.0',Accept:'application/json,text/csv'};
const YEARS=Math.max(1,Math.min(20,5));

async function fetchText(url,ms=12000){
 const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(ms)});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.text();
}
const since=()=>{const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-YEARS);return d.toISOString().slice(0,10)};
const clean=rows=>[...new Map(rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.value)).map(r=>[r.date,{date:r.date,value:Math.round(r.value*100)/100}])).values()].sort((a,b)=>a.date.localeCompare(b.date));

// FRED CSV first, DBnomics mirror second. scale converts the series' unit to billions.
async function fred(id,scale){
 const errors=[],start=since();
 try{
  const csv=await fetchText('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id+'&cosd='+start);
  const rows=clean(csv.trim().split(/\r?\n/).slice(1).map(l=>l.split(',')).filter(a=>a[1]&&a[1]!=='.').map(a=>({date:a[0],value:Number(a[1])*scale})));
  if(rows.length>10)return {rows,source:'FRED '+id};
  throw Error('too few rows');
 }catch(e){errors.push('FRED: '+e.message)}
 try{
  const j=JSON.parse(await fetchText('https://api.db.nomics.world/v22/series/FRED/'+id+'?observations=1'));
  const doc=j?.series?.docs?.[0],p=doc?.period||[],v=doc?.value||[];
  const rows=clean(p.map((d,i)=>({date:String(d).length===7?d+'-01':String(d),value:Number(v[i])*scale}))).filter(r=>r.date>=start);
  if(rows.length>10)return {rows,source:'DBnomics / FRED '+id};
  throw Error('too few rows');
 }catch(e){errors.push('DBnomics: '+e.message)}
 throw Error(errors.join('; '));
}

// FRED (fred.stlouisfed.org) does not answer requests from the Seoul region these functions run
// in, and DBnomics dropped its FRED mirror (404). So both series use official primary sources first:

// Fed total assets = H.4.1 "Total assets (less eliminations from consolidation)", Wednesday level,
// the same series FRED publishes as WALCL. Via DBnomics' Federal Reserve dataset (millions -> billions).
async function walclH41(){
 const j=JSON.parse(await fetchText('https://api.db.nomics.world/v22/series/FED/H41/RESPPMA_N.WW?observations=1',15000));
 const doc=j?.series?.docs?.[0],p=doc?.period||[],v=doc?.value||[],start=since();
 const rows=clean(p.map((d,i)=>({date:String(d),value:Number(v[i])/1000}))).filter(r=>r.date>=start);
 if(rows.length<10)throw Error('H.4.1 returned '+rows.length+' rows');
 return {rows,source:'Federal Reserve H.4.1 (RESPPMA_N.WW) via DBnomics'};
}

// Overnight reverse repo = NY Fed ON RRP operations, total accepted per day (dollars -> billions).
async function rrpNYFed(){
 const end=new Date().toISOString().slice(0,10);
 const j=JSON.parse(await fetchText('https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate='+since()+'&endDate='+end,15000));
 const byDay=new Map();
 for(const op of j?.repo?.operations||[]){
  if(!/reverse repo/i.test(op.operationType||''))continue;
  const v=Number(op.totalAmtAccepted);if(!Number.isFinite(v))continue;
  byDay.set(op.operationDate,(byDay.get(op.operationDate)||0)+v/1e9);
 }
 const rows=clean([...byDay].map(([date,value])=>({date,value})));
 if(rows.length<10)throw Error('NY Fed returned '+rows.length+' rows');
 return {rows,source:'Federal Reserve Bank of New York ON RRP'};
}
const orFred=(primary,id,scale)=>primary().catch(async e=>{try{return await fred(id,scale)}catch(e2){throw Error(e.message+'; '+e2.message)}});

// Daily TGA closing balance from the Treasury's Daily Treasury Statement (millions -> billions).
async function tgaDaily(){
 const start=since();let rows=[],page=1;
 for(;page<=8;page++){
  const u='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance'
   +'?fields=record_date,account_type,open_today_bal,close_today_bal&filter=record_date:gte:'+start
   +'&sort=record_date&page%5Bsize%5D=1000&page%5Bnumber%5D='+page;
  const j=JSON.parse(await fetchText(u,15000));
  for(const r of j.data||[]){
   const t=String(r.account_type||'');
   // Since 2021 the TGA is reported as one "Closing Balance" row; older rows use close_today_bal.
   if(/Treasury General Account \(TGA\) Closing Balance/i.test(t)){const v=Number(r.open_today_bal);if(Number.isFinite(v))rows.push({date:r.record_date,value:v/1000})}
   else if(/^Federal Reserve Account$/i.test(t)){const v=Number(r.close_today_bal);if(Number.isFinite(v))rows.push({date:r.record_date,value:v/1000})}
  }
  if(!j.links||!j.links.next)break;
 }
 rows=clean(rows);
 if(rows.length<10)throw Error('Treasury DTS returned '+rows.length+' rows');
 return {rows,source:'US Treasury Daily Treasury Statement'};
}

async function stablecoins(){
 const j=JSON.parse(await fetchText('https://stablecoins.llama.fi/stablecoincharts/all',15000));
 const start=since();
 const rows=clean((Array.isArray(j)?j:[]).map(r=>({date:new Date(Number(r.date)*1000).toISOString().slice(0,10),value:Number(r.totalCirculatingUSD?.peggedUSD)/1e9}))).filter(r=>r.date>=start&&r.value>0);
 if(rows.length<10)throw Error('DefiLlama returned '+rows.length+' rows');
 return {rows,source:'DefiLlama stablecoins'};
}

// Net liquidity = Fed assets - TGA - RRP, sampled on Fed balance sheet dates (weekly).
function netLiquidity(walcl,tga,rrp){
 const at=(rows,date)=>{let a=null;for(const r of rows){if(r.date<=date)a=r;else break}return a};
 return walcl.map(w=>{const t=at(tga,w.date),r=at(rrp,w.date);return t&&r?{date:w.date,value:Math.round((w.value-t.value-r.value)*100)/100}:null}).filter(Boolean);
}

module.exports=async function(req,res){
 const jobs={walcl:orFred(walclH41,'WALCL',1/1000),rrp:orFred(rrpNYFed,'RRPONTSYD',1),tga:tgaDaily().catch(async e=>{try{return await fred('WTREGEN',1)}catch(e2){throw Error(e.message+'; '+e2.message)}}),stablecoins:stablecoins()};
 const keys=Object.keys(jobs),settled=await Promise.allSettled(Object.values(jobs)),out={unit:'USD billions',errors:{},sources:{}};
 settled.forEach((s,i)=>{const k=keys[i];if(s.status==='fulfilled'){out[k]=s.value.rows;out.sources[k]=s.value.source}else{out[k]=[];out.errors[k]=s.reason.message}});
 out.net=out.walcl.length&&out.tga.length&&out.rrp.length?netLiquidity(out.walcl,out.tga,out.rrp):[];
 out.fetchedAt=new Date().toISOString();
 res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
 return res.status(Object.keys(out.errors).length===keys.length?502:200).json(out);
};
