// One serverless function for the derivatives page (Vercel Hobby allows 12 functions per deployment).
//   ?src=bybit&kind=oi|liq|ls&symbol=ETHUSDT|BTCUSDT   long OI history, estimated liquidation map, long/short ratio
//   ?src=options&currency=ETH|BTC                       Deribit put/call ratio and DVOL
//   ?src=oinow&coin=ETH|BTC                             current OI summed across Binance, Bybit, OKX
//   ?src=liqhist&coin=ETH|BTC                           daily long/short liquidations (Coinalyze, needs COINALYZE_API_KEY)
const handlers={bybit:require('../lib/bybit.js'),options:require('../lib/options.js'),oinow:require('../lib/oi-now.js'),liqhist:require('../lib/liq-history.js')};
module.exports=function(req,res){
 const h=handlers[String(req.query.src||'')];
 if(!h)return res.status(400).json({error:'src must be bybit, options, oinow or liqhist'});
 return h(req,res);
};
