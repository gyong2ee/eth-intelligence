// TEMPORARY: checks which free sources serve CVDD / coin-days-destroyed data. Remove after use.
const URLS=[
 'https://bitcoin-data.com/v1/cvdd?startday=2010-07-01',
 'https://bitcoin-data.com/v1/cvdd?startday=2011-01-01&endday=2026-12-31',
 'https://bitcoin-data.com/v1/cvdd/2018-12-15',
 'https://bitcoin-data.com/v1/cvdd?size=10000',
 'https://bitcoin-data.com/v1/btc-price?startday=2022-11-21&endday=2022-11-25',
];
module.exports=async function(req,res){
 const out=await Promise.all(URLS.map(async u=>{try{const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});const t=await r.text();
  let hit=null;if(u.includes('catalog')){const m=t.match(/"metric":"[^"]*(CDD|Day|Dest|Cdd|Vdd|VDD)[^"]*"/g);hit=m?[...new Set(m)].slice(0,40):[]}
  return {u,status:r.status,len:t.length,head:t.slice(0,300),tail:t.slice(-150),rl:r.headers.get('x-ratelimit-remaining')||r.headers.get('ratelimit-remaining'),hit}}catch(e){return {u,error:e.message}}}));
 res.status(200).json(out);
};
