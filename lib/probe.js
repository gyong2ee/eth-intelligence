// TEMPORARY: checks which free sources serve CVDD / coin-days-destroyed data. Remove after use.
const URLS=[
 'https://community-api.coinmetrics.io/v4/catalog-all/asset-metrics?assets=btc',
 'https://bitcoin-data.com/v1/cvdd',
 'https://bitcoin-data.com/api/v1/cvdd',
 'https://bitcoin-data.com/v1/cvdd/last',
 'https://charts.bgeometrics.com/files/cvdd.json',
 'https://charts.bgeometrics.com/files/cvdd_data.json',
 'https://api.blockchain.info/charts/coin-days-destroyed?timespan=all&format=json',
];
module.exports=async function(req,res){
 const out=await Promise.all(URLS.map(async u=>{try{const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});const t=await r.text();
  let hit=null;if(u.includes('catalog')){const m=t.match(/"metric":"[^"]*(CDD|Day|Dest|Cdd|Vdd|VDD)[^"]*"/g);hit=m?[...new Set(m)].slice(0,40):[]}
  return {u,status:r.status,len:t.length,head:t.slice(0,400),tail:t.slice(-200),hit}}catch(e){return {u,error:e.message}}}));
 res.status(200).json(out);
};
