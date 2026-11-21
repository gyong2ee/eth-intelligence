// One serverless function for the derivatives page (Vercel Hobby allows 12 functions per deployment).
//   ?src=bybit&kind=oi|liq|ls&symbol=ETHUSDT|BTCUSDT   long OI history, estimated liquidation map, long/short ratio
//   ?src=options&currency=ETH|BTC                       Deribit put/call ratio and DVOL
//   ?src=oinow&coin=ETH|BTC                             current OI summed across Binance, Bybit, OKX
const handlers={bybit:require('../lib/bybit.js'),options:require('../lib/options.js'),oinow:require('../lib/oi-now.js')};
module.exports=function(req,res){
 const h=handlers[String(req.query.src||'')];
 if(!h)return res.status(400).json({error:'src must be bybit, options or oinow'});
 return h(req,res);
};
