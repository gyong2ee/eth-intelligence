const {fredFetch}=require('./_fred');
const ids={spread:'T10Y2Y',m2:'M2SL',fed:'DFF',m3:'DGS3MO',y2:'DGS2',y10:'DGS10',y30:'DGS30'};
module.exports=async(req,res)=>{let id=ids[req.query.series];if(['dxy','gold','wti'].includes(req.query.series)){let symbol=req.query.series==='dxy'?'DX-Y.NYB':req.query.series==='wti'?'CL=F':'XAUUSD=X';try{let response;for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){try{response=await fetch('https://'+host+'/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=5y&interval=1d',{headers:{'User-Agent':'Mozilla/5.0 (compatible; ETHIntelligence/1.0)','Accept':'application/json'},signal:AbortSignal.timeout(10000)});if(response.ok)break;}catch(e){response=null}}if(!response?.ok)throw Error('Yahoo Finance data unavailable'+(response?' (HTTP '+response.status+')':''));let j=(await response.json()).chart.result[0],q=j.indicators.quote[0],rows=j.timestamp.flatMap((t,i)=>Number.isFinite(q.close[i])?[{date:new Date(t*1000).toISOString().slice(0,10),value:q.close[i],open:q.open[i],high:q.high[i],low:q.low[i]}]:[]);if(!rows.length)throw Error('No observations');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.json({id:symbol,source:'Yahoo Finance',rows})}catch(e){return res.status(502).json({error:e.message})}}if(!id)return res.status(400).json({error:'Unknown series'});try{
 // Effective fed funds rate: NY Fed (the publisher of EFFR) first, because FRED does not answer
 // requests from the Seoul region these functions run in.
 if(req.query.series==='fed'){try{const end=new Date().toISOString().slice(0,10);const r=await fetch('https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2000-07-03&endDate='+end,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('NY Fed HTTP '+r.status);const rows=((await r.json())?.refRates||[]).map(x=>({date:x.effectiveDate,value:Number(x.percentRate)})).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(x.value)).sort((a,b)=>a.date.localeCompare(b.date));if(rows.length>100){res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.json({id,source:'Federal Reserve Bank of New York EFFR',rows})}}catch(e){}}
if(['y2','y10','y30','m3'].includes(req.query.series)){try{const fr=await fredFetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id+'&cosd=1976-06-01',{signal:AbortSignal.timeout(14000)});if(fr.ok){const rows=(await fr.text()).trim().split(/\r?\n/).slice(1).map(l=>l.split(',')).filter(a=>/^\d{4}-\d{2}-\d{2}$/.test(a[0])&&a[1]!==''&&a[1]!=='.'&&Number.isFinite(Number(a[1]))).map(a=>({date:a[0],value:Number(a[1])}));if(rows.length>2000){res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.json({id,source:'FRED',rows})}}}catch(e){}let tag={y2:'BC_2YEAR',y10:'BC_10YEAR',y30:'BC_30YEAR',m3:'BC_3MONTH'}[req.query.series],year=new Date().getUTCFullYear();let batches=await Promise.allSettled(Array.from({length:6},(_,i)=>year-i).map(async y=>{let r=await fetch('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value='+y,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Treasury HTTP '+r.status);let xml=await r.text(),rows=[];for(let m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)){let date=m[1].match(/<d:NEW_DATE[^>]*>(\d{4}-\d{2}-\d{2})/),v=m[1].match(new RegExp('<d:'+tag+'(?:\\s[^>]*)?>([0-9.]+)</d:'+tag+'>'));if(date&&v&&Number.isFinite(Number(v[1])))rows.push({date:date[1],value:Number(v[1])})}if(!rows.length)throw Error('Treasury empty year '+y);return rows}));let rows=batches.flatMap(b=>b.status==='fulfilled'?b.value:[]).sort((a,b)=>a.date.localeCompare(b.date));if(!rows.length)throw Error('Treasury observations unavailable across requested years');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.json({id,source:'US Treasury',rows})}if(req.query.series==='spread'){
  // Treasury annual XML fallback for 10Y/20Y/ALL when FRED blocks serverless traffic.
  const yr=new Date().getUTCFullYear();
  const years=Array.from({length:22},(_,i)=>yr-i);
  const results=await Promise.allSettled(years.map(async y=>{
   const u='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value='+y;
   const response=await fetch(u,{signal:AbortSignal.timeout(18000)});
   if(!response.ok)throw Error('Treasury HTTP '+response.status);
   const xml=await response.text(),out=[];
   for(const match of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)){
    const v=match[1],date=v.match(/<d:NEW_DATE[^>]*>(\d{4}-\d{2}-\d{2})/),two=v.match(/<d:BC_2YEAR(?:\s[^>]*)?>([0-9.]+)<\/d:BC_2YEAR>/),ten=v.match(/<d:BC_10YEAR(?:\s[^>]*)?>([0-9.]+)<\/d:BC_10YEAR>/);
    if(date&&two&&ten)out.push({date:date[1],value:Number((Number(ten[1])-Number(two[1])).toFixed(4))});
   }
   return out;
  }));
  const fallback=results.flatMap(x=>x.status==='fulfilled'?x.value:[]).sort((a,b)=>a.date.localeCompare(b.date));
  // Prefer full FRED series; fall back to Treasury when FRED is unavailable.
  try{
   const fr=await fredFetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y&cosd=1976-06-01',{signal:AbortSignal.timeout(14000)});
   if(fr.ok){const csv=await fr.text();const rows=csv.trim().split(/\r?\n/).slice(1).map(l=>l.split(',')).filter(a=>/^\d{4}-\d{2}-\d{2}$/.test(a[0])&&a[1]!==''&&Number.isFinite(Number(a[1]))).map(a=>({date:a[0],value:Number(a[1])}));if(rows.length>fallback.length){res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.json({id,source:'FRED',rows})}}
  }catch(e){}
  if(fallback.length){res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.json({id,source:'US Treasury',rows:fallback,notice:'Fallback: 22 years maximum'})}
  throw Error('FRED and Treasury yield spread unavailable');
 }
 if(req.query.series==='m2'){
  const errors=[];
  // FRED M2SL directly first (USD billions, monthly)
  try{
    const fr=await fredFetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL',{signal:AbortSignal.timeout(12000)});
    if(!fr.ok)throw Error('HTTP '+fr.status);
    const rows=(await fr.text()).trim().split(/\r?\n/).slice(1).map(l=>l.split(',')).filter(a=>/^\d{4}-\d{2}-\d{2}$/.test(a[0])&&a[1]!==''&&a[1]!=='.'&&Number.isFinite(Number(a[1]))).map(a=>({date:a[0],value:Number(a[1])}));
    if(rows.length<24)throw Error('Too few observations: '+rows.length);
    res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
    return res.json({id,source:'FRED M2SL (USD billions)',rows});
  }catch(e){errors.push('FRED: '+e.message)}
  try{
    const rr=await fetch('https://m0.com/data/m2',{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(9000)});
    if(!rr.ok)throw Error('HTTP '+rr.status);
    const csv=await rr.text();
    const rows=csv.split(/\r?\n/).flatMap(line=>{
      const cells=line.replace(/"/g,'').split(',');
      const date=cells.find(v=>/^\d{4}-\d{2}(?:-\d{2})?$/.test(v.trim()));
      if(!date)return [];
      const idx=cells.indexOf(date);
      const v=Number((cells[idx+1]||'').trim());
      return Number.isFinite(v)&&v>0?[{date:date.length===7?date+'-01':date,value:v}]:[];
    }).sort((a,b)=>a.date.localeCompare(b.date));
    if(rows.length<24)throw Error('Too few observations: '+rows.length);
    res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
    return res.json({id,source:'m0.com / FRED M2SL mirror (USD billions)',rows});
  }catch(e){errors.push('m0.com: '+e.message)}

  const dbUrls=['https://api.db.nomics.world/v22/series/FRED/M2SL?observations=1','https://api.db.nomics.world/v22/series/FRED/M2SL?observations=1&limit=1000'];
  for(const url of dbUrls.slice(0,1)){
    try{
      const rr=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
      if(!rr.ok)throw Error('HTTP '+rr.status);
      const jj=await rr.json(),series=jj?.series?.docs?.[0],periods=series?.period||[],values=series?.value||[];
      const rows=periods.flatMap((p,i)=>{const v=Number(values[i]);return /^\d{4}-\d{2}$/.test(p)&&Number.isFinite(v)?[{date:p+'-01',value:v}]:[]});
      if(!rows.length)throw Error('No valid observations');
      res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
      return res.json({id,source:'DBnomics / FRED M2SL',rows});
    }catch(e){errors.push('DBnomics: '+e.message)}
  }
  for(const url of [
    'https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL',
    'https://fred.stlouisfed.org/graph/fredgraph.csv?cosd=2000-01-01&id=M2SL',
    'https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL&cosd=2000-01-01'
  ].slice(0,1)){
    try{
      const rr=await fredFetch(url,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Mozilla/5.0','Accept':'text/csv'}});
      if(!rr.ok)throw Error('HTTP '+rr.status);
      const csv=await rr.text();
      const rows=csv.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p[0])&&p[1]!==''&&Number.isFinite(Number(p[1]))).map(p=>({date:p[0],value:Number(p[1])}));
      if(!rows.length)throw Error('No valid observations');
      res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
      return res.json({id,source:'FRED CSV',rows});
    }catch(e){errors.push('FRED: '+e.message)}
  }
  return res.status(502).json({id,error:'M2 upstream unavailable',details:errors});
}
let r=await fredFetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id+'&cosd='+(req.query.series==='spread'?'1976-06-01':'2000-01-01'),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('FRED HTTP '+r.status);let csv=await r.text(),rows=csv.trim().split(/\r?\n/).slice(1).map(l=>l.split(',')).filter(a=>/^\d{4}-\d{2}-\d{2}$/.test(a[0])&&a[1]!==''&&Number.isFinite(Number(a[1]))).map(a=>({date:a[0],value:Number(a[1])}));if(!rows.length)throw Error('No valid observations');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');res.json({id,rows});}catch(e){res.status(502).json({error:e.message,id});}};