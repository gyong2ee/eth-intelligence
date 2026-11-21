// Deribit options snapshot for ETH or BTC (public API, no key):
//   put/call ratio by open interest and by 24h volume, and the DVOL implied-volatility index
//   (daily closes for about one year).
const BASE='https://www.deribit.com/api/v2/public/';
async function get(method,params){
 const u=new URL(BASE+method);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 const r=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 const j=await r.json().catch(()=>null);
 if(!r.ok||!j||j.error)throw Error('Deribit '+method+' HTTP '+r.status+(j&&j.error?' '+j.error.message:''));
 return j.result;
}
async function putCall(cur){
 const rows=await get('get_book_summary_by_currency',{currency:cur,kind:'option'});
 let pOI=0,cOI=0,pVol=0,cVol=0;
 for(const r of rows||[]){const put=/-P$/.test(r.instrument_name);const oi=+r.open_interest||0,vol=+r.volume||0;if(put){pOI+=oi;pVol+=vol}else{cOI+=oi;cVol+=vol}}
 if(!cOI)throw Error('no option open interest');
 return {oi:{put:Math.round(pOI),call:Math.round(cOI),ratio:+(pOI/cOI).toFixed(3)},volume:{put:Math.round(pVol),call:Math.round(cVol),ratio:cVol?+(pVol/cVol).toFixed(3):null},instruments:(rows||[]).length};
}
async function dvol(cur){
 const end=Date.now(),start=end-400*86400000;
 const r=await get('get_volatility_index_data',{currency:cur,start_timestamp:start,end_timestamp:end,resolution:'1D'});
 const rows=(r.data||[]).map(d=>({t:+d[0],v:+d[4]})).filter(d=>Number.isFinite(d.t)&&Number.isFinite(d.v)).sort((a,b)=>a.t-b.t);
 if(rows.length<10)throw Error('no DVOL data');
 return rows;
}
module.exports=async function(req,res){
 const cur=String(req.query.currency||'ETH').toUpperCase();
 if(!['ETH','BTC'].includes(cur))return res.status(400).json({error:'currency must be ETH or BTC'});
 const [pc,dv]=await Promise.allSettled([putCall(cur),dvol(cur)]);
 const out={currency:cur,source:'Deribit',fetchedAt:new Date().toISOString(),errors:{}};
 if(pc.status==='fulfilled')out.putCall=pc.value;else out.errors.putCall=pc.reason.message;
 if(dv.status==='fulfilled')out.dvol=dv.value;else out.errors.dvol=dv.reason.message;
 res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1800');
 return res.status(out.putCall||out.dvol?200:502).json(out);
};
