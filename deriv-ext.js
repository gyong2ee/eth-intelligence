// Derivatives page add-ons: long open-interest history and an estimated liquidation map,
// each for BTC and ETH, from /api/deriv (src=bybit / options).
(function(){
 var NS='http://www.w3.org/2000/svg',DAY=864e5;
 var FONT='Inter, "Noto Sans KR", system-ui, sans-serif';
 function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
 function txt(x,y,s,a){var t=el('text',Object.assign({x:x,y:y,fill:'var(--muted)','font-size':11,'font-family':FONT},a||{}));t.textContent=s;return t}
 function niceStep(r){var p=Math.pow(10,Math.floor(Math.log10(r))),n=r/p;return (n<1.5?1:n<3?2:n<7?5:10)*p}
 function usd(v){return v>=1e9?'$'+(v/1e9).toFixed(v>=1e10?1:2)+'B':v>=1e6?'$'+(v/1e6).toFixed(0)+'M':'$'+Math.round(v).toLocaleString('en-US')}
 function priceFmt(p,sym){return '$'+Number(p).toLocaleString('en-US',{maximumFractionDigits:sym==='BTCUSDT'?0:0})}
 var cache={};
 function load(kind,sym){var key=kind+sym;if(!cache[key])cache[key]=fetch('/api/deriv?src=bybit&kind='+kind+'&symbol='+sym,{headers:{Accept:'application/json'}}).then(function(r){return r.json().then(function(j){if(!r.ok)throw Error(j.error||('HTTP '+r.status));return j})});cache[key].catch(function(){delete cache[key]});return cache[key]}
 function seg(id,onPick){var box=document.getElementById(id);box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(box.children,function(x){x.setAttribute('aria-pressed',String(x===b))});onPick(b.dataset.v)})}


 /* ---------- daily candles for the coin price (weekly when too dense to read) ---------- */
 var UPC='#6fbfa8',DNC='#e2735c';
 function candlePts(rows){return rows.filter(function(r){return r.h>0&&r.l>0&&r.o>0}).map(function(r){return {t:r.t,v:r.price!=null?r.price:r.v,o:r.o,h:r.h,l:r.l}})}
 function drawCandles(svg,pts,X,Y,plotW){
  if(!pts.length)return {bars:pts,weekly:false};var bars=pts,weekly=false;
  if(plotW/pts.length<3){var wk=new Map();pts.forEach(function(p){var k=Math.floor((p.t/DAY+3)/7),b=wk.get(k);if(!b)wk.set(k,{t:p.t,o:p.o,h:p.h,l:p.l,v:p.v,t1:p.t});else{b.h=Math.max(b.h,p.h);b.l=Math.min(b.l,p.l);b.v=p.v;b.t1=p.t}});
   bars=[...wk.values()].map(function(b){return {t:(b.t+b.t1)/2,o:b.o,h:b.h,l:b.l,v:b.v}});weekly=true}
  var step=bars.length>1?(X(bars[bars.length-1].t)-X(bars[0].t))/(bars.length-1):plotW,bw=Math.max(1,Math.min(10,step*.62));
  var g=el('g',{'pointer-events':'none'});
  bars.forEach(function(b){var up=b.v>=b.o,c=up?UPC:DNC,x=X(b.t),y1=Y(Math.max(b.o,b.v)),y2=Y(Math.min(b.o,b.v));
   g.appendChild(el('line',{x1:x,x2:x,y1:Y(b.h),y2:Y(b.l),stroke:c,'stroke-width':1,'stroke-opacity':.8}));
   g.appendChild(el('rect',{x:x-bw/2,y:y1,width:bw,height:Math.max(1,y2-y1),fill:c,'fill-opacity':.8}))});
  svg.appendChild(g);return {bars:bars,weekly:weekly};
 }
 function candleFmt(sym){return function(v,p){var f=function(x){return priceFmt(x,sym)};return p&&p.h?'종가 '+f(v)+' · 고 '+f(p.h)+' · 저 '+f(p.l):f(v)}}

 /* ---------- open interest history ---------- */
 var oiState={sym:'ETHUSDT',days:365};
 function drawOI(){
  var box=document.getElementById('oiLongChart'),note=document.getElementById('oiLongNote');
  box.innerHTML='<div class="empty">불러오는 중</div>';
  load('oi',oiState.sym).then(function(j){
   var rows=j.rows||[];if(rows.length<2)throw Error('기록 없음');
   var end=rows[rows.length-1].t,pts=oiState.days?rows.filter(function(r){return r.t>=end-oiState.days*DAY}):rows;
   if(pts.length<2)pts=rows;
   // open interest (area, right axis) and the coin's price (line, left axis) on one chart
   var W=Math.max(280,box.clientWidth||700),H=290,m={l:64,r:64,t:14,b:24};
   var svg=el('svg',{viewBox:'0 0 '+W+' '+H,width:'100%',height:H,role:'img','aria-label':j.unit+' 미결제약정과 가격 추이'});
   var t0=pts[0].t,t1=pts[pts.length-1].t,X=function(t){return m.l+(t-t0)/(t1-t0)*(W-m.l-m.r)};
   function scale(vals,floor0){var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals),pad=(hi-lo)*.08||hi*.05;lo=floor0?Math.max(0,lo-pad):lo-pad;hi+=pad;return {lo:lo,hi:hi,Y:function(v){return m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b)}}}
   var A=scale(pts.map(function(p){return p.usd}),true),P=scale([].concat.apply([],pts.map(function(p){return [p.price,p.h||p.price,p.l||p.price]})),false);
   var st=niceStep((A.hi-A.lo)/4);
   for(var g=Math.ceil(A.lo/st)*st;g<=A.hi;g+=st){svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:A.Y(g),y2:A.Y(g),stroke:'var(--line)','stroke-opacity':.6}));svg.appendChild(txt(W-m.r+8,A.Y(g)+4,usd(g),{fill:'var(--accent)'}))}
   var ps=niceStep((P.hi-P.lo)/4);
   for(var q=Math.ceil(P.lo/ps)*ps;q<=P.hi;q+=ps){svg.appendChild(txt(m.l-8,P.Y(q)+4,priceFmt(q,oiState.sym),{'text-anchor':'end',fill:'var(--fg)','fill-opacity':.75}))}
   var n=W<480?3:5;for(var k=0;k<n;k++){var t=t0+(t1-t0)*k/(n-1),d=new Date(t);svg.appendChild(txt(X(t),H-6,(d.getUTCFullYear()+'').slice(2)+'.'+String(d.getUTCMonth()+1).padStart(2,'0'),{'text-anchor':k===0?'start':k===n-1?'end':'middle'}))}
   var path='';pts.forEach(function(p,i){path+=(i?'L':'M')+X(p.t).toFixed(1)+' '+A.Y(p.usd).toFixed(1)});
   svg.appendChild(el('path',{d:path+'L'+X(t1)+' '+(H-m.b)+'L'+X(t0)+' '+(H-m.b)+'Z',fill:'var(--accent)','fill-opacity':.12}));
   svg.appendChild(el('path',{d:path,fill:'none',stroke:'var(--accent)','stroke-width':2,'stroke-linejoin':'round'}));
   var cp=candlePts(pts),cd=null;if(cp.length>pts.length/2)cd=drawCandles(svg,cp,X,P.Y,W-m.l-m.r);
   else{var pp='';pts.forEach(function(p,i){pp+=(i?'L':'M')+X(p.t).toFixed(1)+' '+P.Y(p.price).toFixed(1)});svg.appendChild(el('path',{d:pp,fill:'none',stroke:'var(--fg)','stroke-opacity':.85,'stroke-width':1.5,'stroke-linejoin':'round'}))}
   var last=pts[pts.length-1];
   box.innerHTML='';box.appendChild(svg);
   var unit=j.unit,byT=new Map(pts.map(function(p){return [p.t,p]}));
   if(window.ETHTrack)ETHTrack.attach(svg,{W:W,left:m.l,right:W-m.r,top:m.t,bottom:H-m.b,tAt:function(sx){return t0+(sx-m.l)/(W-m.l-m.r)*(t1-t0)},date:ETHTrack.ymd,
    series:[
     {name:'미결제약정',color:'var(--accent)',pts:pts.map(function(p){return {t:p.t,v:p.usd}}),x:X,y:A.Y,fmt:function(v){return usd(v)}},
     {name:unit+' 환산',color:'var(--accent)',pts:pts.map(function(p){return {t:p.t,v:p.oi}}),x:X,y:function(){return -50},fmt:function(v){return Math.round(v).toLocaleString('en-US')+' '+unit}},
     {name:unit+' 가격'+(cd?(cd.weekly?' (주봉)':' (일봉)'):''),color:'var(--fg)',pts:cd?cd.bars:pts.map(function(p){return {t:p.t,v:p.price}}),x:X,y:P.Y,fmt:candleFmt(oiState.sym)}
    ]});
   note.textContent='최신 '+new Date(last.t).toISOString().slice(0,10)+' · 미결제약정 '+usd(last.usd)+' ('+Math.round(last.oi).toLocaleString('en-US')+' '+unit+') · 가격 '+priceFmt(last.price,oiState.sym);
   var first=pts[0],ch=(last.usd/first.usd-1)*100,pch=(last.price/first.price-1)*100;
   document.getElementById('oiLongStat').textContent='선택 기간 미결제약정 '+(ch>=0?'+':'')+ch.toFixed(1)+'% · 가격 '+(pch>=0?'+':'')+pch.toFixed(1)+'% · 미결제약정 최고 '+usd(Math.max.apply(null,pts.map(function(p){return p.usd})))+' · 최저 '+usd(Math.min.apply(null,pts.map(function(p){return p.usd})));
  }).catch(function(e){box.innerHTML='<div class="empty">미결제약정 기록을 불러오지 못했습니다 ('+String(e.message).replace(/</g,'&lt;')+')</div>';note.textContent=''});
 }

 /* ---------- estimated liquidation map ---------- */
 var liqSym='ETHUSDT';
 function drawLiq(){
  var box=document.getElementById('liqChart'),note=document.getElementById('liqNote');
  box.innerHTML='<div class="empty">계산 중</div>';
  load('liq',liqSym).then(function(j){
   var rows=j.rows||[];if(!rows.length)throw Error('남은 청산 구간 없음');
   var W=Math.max(280,box.clientWidth||700),H=300,m={l:8,r:58,t:16,b:26},price=j.price;
   var svg=el('svg',{viewBox:'0 0 '+W+' '+H,width:'100%',height:H,role:'img','aria-label':'추정 청산맵'});
   var pLo=price*0.75,pHi=price*1.25,X=function(p){return m.l+(p-pLo)/(pHi-pLo)*(W-m.l-m.r)};
   var maxV=Math.max.apply(null,rows.map(function(r){return r.long+r.short}))||1,Y=function(v){return H-m.b-(v/maxV)*(H-m.t-m.b)};
   var st=niceStep(maxV/4);for(var g=st;g<=maxV;g+=st){svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:Y(g),y2:Y(g),stroke:'var(--line)','stroke-opacity':.6}));svg.appendChild(txt(W-m.r+8,Y(g)+4,usd(g)))}
   var bw=Math.max(1.5,(X(price+j.step)-X(price))*0.86);
   rows.forEach(function(r){
    var x=X(r.price)-bw/2;
    if(r.long>0)svg.appendChild(el('rect',{x:x,y:Y(r.long),width:bw,height:H-m.b-Y(r.long),fill:'var(--down)','fill-opacity':.85,rx:1}));
    if(r.short>0)svg.appendChild(el('rect',{x:x,y:Y(r.long+r.short),width:bw,height:Y(r.long)-Y(r.long+r.short),fill:'var(--up)','fill-opacity':.85,rx:1}));
   });
   [-20,-10,0,10,20].forEach(function(pc){var p=price*(1+pc/100);svg.appendChild(txt(X(p),H-7,(pc===0?'':(pc>0?'+':''))+(pc===0?priceFmt(p,liqSym):pc+'%'),{'text-anchor':'middle',fill:pc===0?'var(--fg)':'var(--muted)'}))});
   svg.appendChild(el('line',{x1:X(price),x2:X(price),y1:m.t-6,y2:H-m.b,stroke:'var(--fg)','stroke-width':1.5,'stroke-dasharray':'4 3'}));
   var hl=el('rect',{y:m.t,height:H-m.t-m.b,width:bw,fill:'var(--fg)','fill-opacity':.08,visibility:'hidden'});svg.appendChild(hl);
   var cursor=el('line',{y1:m.t-6,y2:H-m.b,stroke:'var(--accent)','stroke-width':1.2,visibility:'hidden'});svg.appendChild(cursor);
   var sumL=rows.filter(function(r){return r.price<price}).reduce(function(a,r){return a+r.long},0),sumS=rows.filter(function(r){return r.price>price}).reduce(function(a,r){return a+r.short},0);
   var big=function(side){return rows.slice().sort(function(a,b){return b[side]-a[side]})[0]};
   var bl=big('long'),bs=big('short');
   var base='현재가 '+priceFmt(price,liqSym)+' · 아래쪽 롱 청산 대기 '+usd(sumL)+' (최대 '+priceFmt(bl.price,liqSym)+') · 위쪽 숏 청산 대기 '+usd(sumS)+' (최대 '+priceFmt(bs.price,liqSym)+')';
   note.textContent=base;
   var tip=document.createElement('div');tip.className='liq-tip';tip.hidden=true;
   var half=j.step/2;
   svg.addEventListener('pointermove',function(e){
    var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;
    if(x<m.l||x>W-m.r){tip.hidden=true;cursor.setAttribute('visibility','hidden');hl.setAttribute('visibility','hidden');return}
    var p=pLo+(x-m.l)/(W-m.l-m.r)*(pHi-pLo),pc=(p/price-1)*100;
    cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);cursor.setAttribute('visibility','visible');
    var bin=null;rows.forEach(function(q){if(Math.abs(q.price-p)<=half&&(!bin||Math.abs(q.price-p)<Math.abs(bin.price-p)))bin=q});
    if(bin){hl.setAttribute('x',X(bin.price)-bw/2);hl.setAttribute('visibility','visible')}else hl.setAttribute('visibility','hidden');
    var side=p<price?'롱':'숏',amt=bin?(p<price?bin.long:bin.short):0;
    tip.innerHTML='';var b=document.createElement('b');b.textContent=priceFmt(p,liqSym);
    var s1=document.createElement('span');s1.textContent='현재가 대비 '+(pc>=0?'+':'')+pc.toFixed(1)+'%';
    var s2=document.createElement('span');s2.textContent=amt?(side+' 청산 추정 '+usd(amt)):'이 가격대 청산 물량 거의 없음';
    tip.append(b,s1,s2);tip.hidden=false;
    var bx=box.getBoundingClientRect(),left=e.clientX-bx.left,top=e.clientY-bx.top;
    tip.style.left=Math.min(Math.max(left,70),bx.width-70)+'px';tip.style.top=Math.max(top-12,8)+'px';
    note.textContent=bin?priceFmt(bin.price,liqSym)+' 구간 · 롱 청산 '+usd(bin.long)+' · 숏 청산 '+usd(bin.short):base;
   });
   svg.addEventListener('pointerleave',function(){hl.setAttribute('visibility','hidden');cursor.setAttribute('visibility','hidden');tip.hidden=true;note.textContent=base});
   box.innerHTML='';box.appendChild(svg);box.appendChild(tip);
   document.getElementById('liqTime').textContent=new Date(j.updated).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' 기준';
   document.getElementById('liqLink').href='https://www.coinglass.com/pro/futures/LiquidationHeatMap?coin='+(liqSym==='BTCUSDT'?'BTC':'ETH');
  }).catch(function(e){box.innerHTML='<div class="empty">청산맵을 계산하지 못했습니다 ('+String(e.message).replace(/</g,'&lt;')+')</div>';note.textContent=''});
 }

 /* ---------- shared simple line chart (one or more comparable series, one axis) ---------- */
 function lineChart(box,series,o){
  series=series.filter(function(s){return s.pts&&s.pts.length>1});
  if(!series.length){box.innerHTML='<div class="empty">기록을 받지 못했습니다.</div>';return}
  var dual=series.some(function(s){return s.axis==='R'});
  var W=Math.max(280,box.clientWidth||700),H=o.h||240,m={l:dual?52:8,r:dual?64:58,t:14,b:24};
  var svg=el('svg',{viewBox:'0 0 '+W+' '+H,width:'100%',height:H,role:'img','aria-label':o.label});
  var all=[];series.forEach(function(s){s.pts.forEach(function(p){all.push(p)})});
  var t0=Math.min.apply(null,all.map(function(p){return p.t})),t1=Math.max.apply(null,all.map(function(p){return p.t}));
  function scale(side,base){var v=[];series.forEach(function(s){if((s.axis||'L')===side)s.pts.forEach(function(p){v.push(p.v);if(s.candle&&p.h){v.push(p.h,p.l)}})});if(!v.length)return null;
   var lo=Math.min.apply(null,v),hi=Math.max.apply(null,v);if(base!=null){lo=Math.min(lo,base);hi=Math.max(hi,base)}var pad=(hi-lo)*.1||1;lo-=pad;hi+=pad;
   return {lo:lo,hi:hi,Y:function(x){return m.t+(1-(x-lo)/(hi-lo))*(H-m.t-m.b)}}}
  var L=scale('L',o.base),R=dual?scale('R'):null;
  var X=function(t){return m.l+(t-t0)/((t1-t0)||1)*(W-m.l-m.r)};
  var st=niceStep((L.hi-L.lo)/4);
  for(var g=Math.ceil(L.lo/st)*st;g<=L.hi;g+=st){svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:L.Y(g),y2:L.Y(g),stroke:'var(--line)','stroke-opacity':.6}));
   svg.appendChild(dual?txt(m.l-8,L.Y(g)+4,o.fy(g),{'text-anchor':'end'}):txt(W-m.r+8,L.Y(g)+4,o.fy(g)))}
  if(R){var rs=niceStep((R.hi-R.lo)/4);for(var q=Math.ceil(R.lo/rs)*rs;q<=R.hi;q+=rs)svg.appendChild(txt(W-m.r+8,R.Y(q)+4,o.fyR(q),{fill:'var(--fg)','fill-opacity':.75}))}
  if(o.base!=null)svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:L.Y(o.base),y2:L.Y(o.base),stroke:'var(--muted)','stroke-dasharray':'4 4'}));
  (o.hlines||[]).forEach(function(h){svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:L.Y(h.v),y2:L.Y(h.v),stroke:h.color||'var(--muted)','stroke-dasharray':'5 4','stroke-opacity':.9}));svg.appendChild(txt(m.l+6,L.Y(h.v)-5,h.label,{fill:h.color||'var(--muted)','font-size':10.5}))});
  var n=W<480?3:5,shortSpan=(t1-t0)<120*DAY;for(var k=0;k<n;k++){var t=t0+(t1-t0)*k/(n-1),d=new Date(t);svg.appendChild(txt(X(t),H-6,shortSpan?(d.getUTCMonth()+1)+'/'+d.getUTCDate():(d.getUTCFullYear()+'').slice(2)+'.'+String(d.getUTCMonth()+1).padStart(2,'0'),{'text-anchor':k===0?'start':k===n-1?'end':'middle'}))}
  series.forEach(function(s){if(s.candle){var cd=drawCandles(svg,s.pts,X,(s.axis==='R'?R:L).Y,W-m.l-m.r);s.trackPts=cd.bars;s.trackName=s.name+(cd.weekly?' (주봉)':' (일봉)')}});
  series.forEach(function(s,i){if(s.candle)return;var Y=(s.axis==='R'?R:L).Y,path='';s.pts.forEach(function(p,j){path+=(j?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)});
   if(i===0&&o.fill)svg.appendChild(el('path',{d:path+'L'+X(s.pts[s.pts.length-1].t)+' '+(H-m.b)+'L'+X(s.pts[0].t)+' '+(H-m.b)+'Z',fill:s.color,'fill-opacity':.1}));
   svg.appendChild(el('path',{d:path,fill:'none',stroke:s.color,'stroke-width':s.w||2,'stroke-linejoin':'round','stroke-opacity':s.opacity||1}))});
  box.innerHTML='';box.appendChild(svg);
  if(window.ETHTrack)ETHTrack.attach(svg,{W:W,left:m.l,right:W-m.r,top:m.t,bottom:H-m.b,tAt:function(sx){return t0+(sx-m.l)/(W-m.l-m.r)*(t1-t0)},date:ETHTrack.ymd,
   series:series.map(function(s){return {name:s.trackName||s.name,color:s.color,pts:s.trackPts||s.pts,x:X,y:(s.axis==='R'?R:L).Y,fmt:s.fmt}})});
 }


 /* ---------- line chart with a full-period navigator underneath ----------
    drag inside the window to move it, drag an edge to resize, click outside to jump there,
    wheel over the chart or the navigator to zoom around the pointer, drag the chart to pan.
    Redraws in place, no animation. st: {a,b} window kept by the caller across redraws. */
 function navChart(box,series,o,st){
  series=series.filter(function(s){return s.pts&&s.pts.length>1});
  if(!series.length){box.innerHTML='<div class="empty">기록을 받지 못했습니다.</div>';return}
  var full=series[0].pts,T0=Infinity,T1=-Infinity;series.forEach(function(s){T0=Math.min(T0,s.pts[0].t);T1=Math.max(T1,s.pts[s.pts.length-1].t)});
  var minSpan=30*DAY;
  if(!(st.a<st.b)||st.reset){st.b=T1;st.a=st.days>0?Math.max(T0,T1-st.days*DAY):T0;st.reset=false}
  box.innerHTML='';var main=document.createElement('div');main.className='nc-main';
  var wrap=document.createElement('div');wrap.className='nc-nav-wrap';
  var lab=document.createElement('div');lab.className='nc-nav-label';lab.innerHTML='<span>전체 기간</span><span></span>';
  var nav=el('svg',{class:'nc-nav','aria-label':(o.label||'차트')+' 전체 기간 선택'});
  wrap.append(lab,nav);box.append(main,wrap);
  function clamp(a,b){var span=Math.max(minSpan,Math.min(b-a,T1-T0));if(a<T0){a=T0;b=a+span}if(b>T1){b=T1;a=b-span}st.a=Math.max(T0,a);st.b=Math.min(T1,b)}
  function cut(pts){var out=[],i;for(i=0;i<pts.length;i++)if(pts[i].t>=st.a&&pts[i].t<=st.b)out.push(pts[i]);return out}
  var navGeo=null;
  function drawNav(){
   var W=Math.max(260,wrap.clientWidth-16||600),H=34;nav.setAttribute('viewBox','0 0 '+W+' '+H);nav.setAttribute('width','100%');nav.setAttribute('height',H);while(nav.firstChild)nav.removeChild(nav.firstChild);
   var X=function(t){return (t-T0)/((T1-T0)||1)*W},lo=Infinity,hi=-Infinity;full.forEach(function(p){lo=Math.min(lo,p.v);hi=Math.max(hi,p.v)});
   var Y=function(v){return H-2-(v-lo)/((hi-lo)||1)*(H-6)},d='';full.forEach(function(p,j){d+=(j?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)});
   nav.appendChild(el('path',{d:d+'L'+W+' '+H+'L0 '+H+'Z',fill:'rgba(152,164,184,.22)'}));nav.appendChild(el('path',{d:d,fill:'none',stroke:'#6c7a90','stroke-width':1}));
   var a=X(st.a),b=X(st.b);
   nav.appendChild(el('rect',{x:0,y:0,width:Math.max(0,a),height:H,fill:'#0a1220','fill-opacity':.55}));nav.appendChild(el('rect',{x:b,y:0,width:Math.max(0,W-b),height:H,fill:'#0a1220','fill-opacity':.55}));
   nav.appendChild(el('rect',{x:a,y:.5,width:Math.max(1,b-a),height:H-1,fill:'rgba(201,164,92,.16)',stroke:'#c9a45c','stroke-width':1,rx:3}));
   [a,b].forEach(function(x){nav.appendChild(el('rect',{x:x-2.5,y:H/2-8,width:5,height:16,rx:2,fill:'#c9a45c'}))});
   navGeo={W:W,X:X,a:a,b:b};lab.lastChild.textContent=ETHTrack.ymd(st.a)+' ~ '+ETHTrack.ymd(st.b);
  }
  function draw(){lineChart(main,series.map(function(s){return Object.assign({},s,{pts:cut(s.pts)})}),o);drawNav();if(o.onWindow)o.onWindow(st)}
  function manual(){st.days=-1;if(o.onManual)o.onManual()}
  function zoomAt(ratio,dy){var span=st.b-st.a,k=Math.exp(dy*.0015),ns=Math.max(minSpan,Math.min(T1-T0,span*k)),c=st.a+span*ratio;clamp(c-ns*ratio,c+ns*(1-ratio));manual();draw()}
  function wd(e){return e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?120:1)}
  var drag=null;
  nav.addEventListener('pointerdown',function(e){if(e.button!==0||!navGeo)return;e.preventDefault();var r=nav.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*navGeo.W,span=st.b-st.a;
   var mode=Math.abs(x-navGeo.a)<=10?'left':Math.abs(x-navGeo.b)<=10?'right':(x>navGeo.a&&x<navGeo.b)?'move':'jump';
   if(mode==='jump'){var t=T0+x/navGeo.W*(T1-T0);clamp(t-span/2,t+span/2);manual();draw();mode='move'}
   drag={mode:mode,x:e.clientX,a:st.a,b:st.b,w:r.width,el:nav};nav.setPointerCapture(e.pointerId);nav.classList.add('dragging')});
  nav.addEventListener('pointermove',function(e){
   if(!drag||drag.el!==nav){if(navGeo){var r=nav.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*navGeo.W;nav.style.cursor=(Math.abs(x-navGeo.a)<=10||Math.abs(x-navGeo.b)<=10)?'ew-resize':(x>navGeo.a&&x<navGeo.b)?'grab':'pointer'}return}
   var dt=(e.clientX-drag.x)/drag.w*(T1-T0);
   if(drag.mode==='move')clamp(drag.a+dt,drag.b+dt);else if(drag.mode==='left')clamp(Math.min(drag.a+dt,drag.b-minSpan),drag.b);else clamp(drag.a,Math.max(drag.b+dt,drag.a+minSpan));manual();draw()});
  var end=function(){drag=null;nav.classList.remove('dragging');main.classList.remove('dragging')};
  nav.addEventListener('pointerup',end);nav.addEventListener('pointercancel',end);
  nav.addEventListener('wheel',function(e){if(!navGeo)return;e.preventDefault();var r=nav.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*navGeo.W;zoomAt(Math.max(0,Math.min(1,(x-navGeo.a)/Math.max(1,navGeo.b-navGeo.a))),wd(e))},{passive:false});
  main.addEventListener('wheel',function(e){e.preventDefault();var r=main.getBoundingClientRect();zoomAt(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),wd(e))},{passive:false});
  main.addEventListener('pointerdown',function(e){if(e.button!==0||e.pointerType==='touch'||st.b-st.a>=T1-T0-1)return;drag={mode:'pan',x:e.clientX,a:st.a,b:st.b,w:main.getBoundingClientRect().width,el:main};main.setPointerCapture(e.pointerId);main.classList.add('dragging')});
  main.addEventListener('pointermove',function(e){if(!drag||drag.el!==main)return;var dt=-(e.clientX-drag.x)/drag.w*(drag.b-drag.a);clamp(drag.a+dt,drag.b+dt);manual();draw()});
  main.addEventListener('pointerup',end);main.addEventListener('pointercancel',end);
  draw();
 }

 /* ---------- options (Deribit) ---------- */
 var optCur='ETH',optCache={};
 function drawOpt(){
  var box=document.getElementById('optChart');box.innerHTML='<div class="empty">불러오는 중</div>';
  var p=optCache[optCur]||(optCache[optCur]=fetch('/api/deriv?src=options&currency='+optCur).then(function(r){return r.json().then(function(j){if(!r.ok)throw Error(j.error||('HTTP '+r.status));return j})}));
  p.catch(function(){delete optCache[optCur]});
  p.then(function(j){
   var pc=j.putCall,cards=document.getElementById('optCards');cards.innerHTML='';
   var card=function(k,v,s,cls){var d=document.createElement('div');d.className='opt-card';var a=document.createElement('span');a.className='label';a.textContent=k;var b=document.createElement('b');b.className='num'+(cls?' '+cls:'');b.textContent=v;var c=document.createElement('span');c.className='note';c.textContent=s;d.append(a,b,c);cards.appendChild(d)};
   var tone=function(r){return r==null?'':r>=1?'down':r<=0.6?'up':''};
   if(pc){card('풋/콜 비율 · 미결제약정',pc.oi.ratio.toFixed(2),'풋 '+pc.oi.put.toLocaleString('en-US')+' · 콜 '+pc.oi.call.toLocaleString('en-US')+' '+optCur,tone(pc.oi.ratio));
    if(pc.volume.ratio!=null)card('풋/콜 비율 · 24시간 거래량',pc.volume.ratio.toFixed(2),'1보다 크면 하락 대비(풋)가 더 많음',tone(pc.volume.ratio))}
   var dv=j.dvol||[];
   if(dv.length){var last=dv[dv.length-1],m30=dv.filter(function(x){return x.t<=last.t-30*DAY}).pop();var ch=m30?last.v-m30.v:null;
    card('내재변동성 DVOL',last.v.toFixed(1),'30일 '+(ch==null?'—':(ch>=0?'+':'')+ch.toFixed(1)+'p')+' · 시장이 예상하는 연간 변동 폭(%)','')}
   var yr=dv.filter(function(x){return x.t>=dv[dv.length-1].t-365*DAY}),cur=optCur,sym=cur+'USDT';
   var draw=function(px){if(cur!==optCur)return;
    lineChart(box,[{name:cur+' DVOL',color:'var(--accent)',pts:yr,fmt:function(v){return v.toFixed(1)}},
     {name:cur+' 가격',color:'var(--fg)',axis:'R',candle:true,pts:px,fmt:candleFmt(sym)}],
     {label:cur+' 내재변동성과 가격',h:260,fy:function(v){return v.toFixed(0)},fyR:function(v){return priceFmt(v,sym)},fill:true})};
   // the coin's daily price comes from the open-interest history that the OI chart already loads
   load('oi',sym).then(function(o){draw(candlePts((o.rows||[]).filter(function(r){return r.t>=yr[0].t})))}).catch(function(){draw([])});
   document.getElementById('optTime').textContent=new Date(j.fetchedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' 기준';
  }).catch(function(e){box.innerHTML='<div class="empty">옵션 데이터를 불러오지 못했습니다 ('+String(e.message).replace(/</g,'&lt;')+')</div>'});
 }

 /* ---------- long/short account ratio ---------- */
 var lsSym='ETHUSDT';
 function drawLS(){
  var box=document.getElementById('lsChart');box.innerHTML='<div class="empty">불러오는 중</div>';
  load('ls',lsSym).then(function(j){
   var by=(j.bybit||[]),bn=(j.binance||[]),end=Math.max(by.length?by[by.length-1].t:0,bn.length?bn[bn.length-1].t:0);
   var yr=by.filter(function(x){return x.t>=end-365*DAY});
   var cards=document.getElementById('lsCards');cards.innerHTML='';
   var card=function(k,v,s,cls){var d=document.createElement('div');d.className='opt-card';var a=document.createElement('span');a.className='label';a.textContent=k;var b=document.createElement('b');b.className='num'+(cls?' '+cls:'');b.textContent=v;var c=document.createElement('span');c.className='note';c.textContent=s;d.append(a,b,c);cards.appendChild(d)};
   var tone=function(v){return v>=60?'down':v<=40?'up':''};
   if(by.length){var l=by[by.length-1].long;card('Bybit 롱 계정',l.toFixed(1)+'%','숏 '+(100-l).toFixed(1)+'% · 롱/숏 '+(l/(100-l)).toFixed(2),tone(l))}
   if(bn.length){var b2=bn[bn.length-1].long;card('Binance 롱 계정',b2.toFixed(1)+'%','숏 '+(100-b2).toFixed(1)+'% · 롱/숏 '+(b2/(100-b2)).toFixed(2),tone(b2))}
   var tp=(j.binanceTop||[]);if(tp.length){var t3=tp[tp.length-1].long;card('Binance 큰손 · 금액 기준',t3.toFixed(1)+'%','상위 트레이더 포지션 금액 중 롱 비중 · 롱/숏 '+(t3/(100-t3)).toFixed(2),tone(t3))}
   var coin=lsSym.replace('USDT',''),px=(j.price||[]).filter(function(x){return x.t>=end-365*DAY});
   lineChart(box,[
    {name:'Bybit 롱 계정',color:'var(--accent)',pts:yr.map(function(x){return {t:x.t,v:x.long}}),fmt:function(v){return v.toFixed(1)+'%'}},
    {name:'Binance 롱 계정',color:'var(--up)',pts:bn.map(function(x){return {t:x.t,v:x.long}}),fmt:function(v){return v.toFixed(1)+'%'},w:2.4},
    {name:'Binance 큰손(금액)',color:'#5b8def',pts:(j.binanceTop||[]).map(function(x){return {t:x.t,v:x.long}}),fmt:function(v){return v.toFixed(1)+'%'},w:2.4},
    {name:coin+' 가격',color:'var(--fg)',axis:'R',candle:true,pts:px,fmt:candleFmt(lsSym)}
   ],{label:'롱 계정 비율과 가격',h:260,fy:function(v){return v.toFixed(0)+'%'},fyR:function(v){return priceFmt(v,lsSym)},base:50});
  }).catch(function(e){box.innerHTML='<div class="empty">롱/숏 비율을 불러오지 못했습니다 ('+String(e.message).replace(/</g,'&lt;')+')</div>'});
 }

 /* ---------- leverage ratio: open interest / market cap ---------- */
 var levSym='ETHUSDT',levWin={days:365,reset:true};
 function drawLev(){
  var box=document.getElementById('levChart');box.innerHTML='<div class="empty">불러오는 중</div>';
  var sym=levSym,coin=sym.replace('USDT','');
  Promise.all([load('lev',sym),fetch('/api/deriv?src=oinow&coin='+coin).then(function(r){return r.ok?r.json():null}).catch(function(){return null})]).then(function(res){
   if(sym!==levSym)return;
   var j=res[0],now=res[1],rows=j.rows||[],end=rows.length?rows[rows.length-1].t:0;
   var vals=rows.filter(function(r){return r.t>end-365*DAY}).map(function(r){return r.ratio}).sort(function(a,b){return a-b});
   var q=function(p){return vals[Math.min(vals.length-1,Math.floor(p*(vals.length-1)))]};
   var last=rows[rows.length-1],rank=vals.filter(function(v){return v<=last.ratio}).length/vals.length*100;
   var cards=document.getElementById('levCards');cards.innerHTML='';
   var card=function(k,v,sub,cls){var d=document.createElement('div');d.className='opt-card';var a=document.createElement('span');a.className='label';a.textContent=k;var b=document.createElement('b');b.className='num'+(cls?' '+cls:'');b.textContent=v;var c=document.createElement('span');c.className='note';c.textContent=sub;d.append(a,b,c);cards.appendChild(d)};
   if(now&&now.totalUsd&&j.marketCap)card('전체 시장 레버리지',(now.totalUsd/j.marketCap*100).toFixed(2)+'%','미결제약정 $'+(now.totalUsd/1e9).toFixed(1)+'B ÷ 시가총액 $'+(j.marketCap/1e9).toFixed(0)+'B · '+now.exchanges.length+'개 시장','');
   var tone=rank>=90?'down':rank<=10?'up':'',state=rank>=90?'레버리지 과열 구간':rank<=10?'레버리지 낮은 구간':'보통 구간';
   card('1년 중 위치',rank>=50?'상위 '+Math.max(1,Math.round(100-rank))+'%':'하위 '+Math.max(1,Math.round(rank))+'%',state+' · Bybit 기준',tone);
   card('Bybit 레버리지 비율',last.ratio.toFixed(3)+'%','1년 범위 '+vals[0].toFixed(3)+'% ~ '+vals[vals.length-1].toFixed(3)+'%','');
   navChart(box,[
    {name:coin+' 레버리지 비율',color:'var(--accent)',pts:rows.map(function(r){return {t:r.t,v:r.ratio}}),fmt:function(v){return v.toFixed(3)+'%'}},
    {name:coin+' 가격',color:'var(--fg)',axis:'R',candle:true,pts:candlePts(rows),fmt:candleFmt(sym)}
   ],{label:coin+' 레버리지 비율과 가격',h:260,fill:true,fy:function(v){return v.toFixed(2)+'%'},fyR:function(v){return priceFmt(v,sym)},
    hlines:[{v:q(.9),label:'상위 10%',color:'var(--down)'},{v:q(.1),label:'하위 10%',color:'var(--up)'}],
    onManual:function(){[].forEach.call(document.getElementById('levRange').children,function(x){x.setAttribute('aria-pressed','false')})}},levWin);
   document.getElementById('levSrc').textContent='시가총액: '+j.capSource;
  }).catch(function(e){box.innerHTML='<div class="empty">레버리지 비율을 불러오지 못했습니다 ('+String(e.message).replace(/</g,'&lt;')+')</div>'});
 }

 function start(){
  if(!document.getElementById('oiLongChart'))return;
  seg('oiLongSym',function(v){oiState.sym=v;drawOI()});
  seg('oiLongRange',function(v){oiState.days=+v;drawOI()});
  seg('liqSym',function(v){liqSym=v;drawLiq()});
  if(document.getElementById('optChart')){seg('optCur',function(v){optCur=v;drawOpt()});drawOpt()}
  if(document.getElementById('lsChart')){seg('lsSym',function(v){lsSym=v;drawLS()});drawLS()}
  if(document.getElementById('levChart')){seg('levSym',function(v){levSym=v;levWin.reset=true;drawLev()});seg('levRange',function(v){levWin.days=+v;levWin.reset=true;drawLev()});drawLev()}
  drawOI();drawLiq();
  var t;window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(function(){drawOI();drawLiq();if(document.getElementById('optChart'))drawOpt();if(document.getElementById('lsChart'))drawLS();if(document.getElementById('levChart'))drawLev()},200)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
