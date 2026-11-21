// Derivatives page add-ons: long open-interest history and an estimated liquidation map,
// each for BTC and ETH, from /api/bybit.
(function(){
 var NS='http://www.w3.org/2000/svg',DAY=864e5;
 var FONT='Inter, "Noto Sans KR", system-ui, sans-serif';
 function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
 function txt(x,y,s,a){var t=el('text',Object.assign({x:x,y:y,fill:'var(--muted)','font-size':11,'font-family':FONT},a||{}));t.textContent=s;return t}
 function niceStep(r){var p=Math.pow(10,Math.floor(Math.log10(r))),n=r/p;return (n<1.5?1:n<3?2:n<7?5:10)*p}
 function usd(v){return v>=1e9?'$'+(v/1e9).toFixed(v>=1e10?1:2)+'B':v>=1e6?'$'+(v/1e6).toFixed(0)+'M':'$'+Math.round(v).toLocaleString('en-US')}
 function priceFmt(p,sym){return '$'+Number(p).toLocaleString('en-US',{maximumFractionDigits:sym==='BTCUSDT'?0:0})}
 var cache={};
 function load(kind,sym){var key=kind+sym;if(!cache[key])cache[key]=fetch('/api/bybit?kind='+kind+'&symbol='+sym,{headers:{Accept:'application/json'}}).then(function(r){return r.json().then(function(j){if(!r.ok)throw Error(j.error||('HTTP '+r.status));return j})});cache[key].catch(function(){delete cache[key]});return cache[key]}
 function seg(id,onPick){var box=document.getElementById(id);box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(box.children,function(x){x.setAttribute('aria-pressed',String(x===b))});onPick(b.dataset.v)})}

 /* ---------- open interest history ---------- */
 var oiState={sym:'ETHUSDT',days:365};
 function drawOI(){
  var box=document.getElementById('oiLongChart'),note=document.getElementById('oiLongNote');
  box.innerHTML='<div class="empty">불러오는 중</div>';
  load('oi',oiState.sym).then(function(j){
   var rows=j.rows||[];if(rows.length<2)throw Error('기록 없음');
   var end=rows[rows.length-1].t,pts=oiState.days?rows.filter(function(r){return r.t>=end-oiState.days*DAY}):rows;
   if(pts.length<2)pts=rows;
   var W=Math.max(280,box.clientWidth||700),H=260,m={l:8,r:58,t:12,b:24};
   var svg=el('svg',{viewBox:'0 0 '+W+' '+H,width:'100%',height:H,role:'img','aria-label':j.unit+' 미결제약정 추이'});
   var lo=Math.min.apply(null,pts.map(function(p){return p.usd})),hi=Math.max.apply(null,pts.map(function(p){return p.usd}));
   var pad=(hi-lo)*.08||hi*.05;lo=Math.max(0,lo-pad);hi+=pad;
   var t0=pts[0].t,t1=pts[pts.length-1].t,X=function(t){return m.l+(t-t0)/(t1-t0)*(W-m.l-m.r)},Y=function(v){return m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b)};
   var st=niceStep((hi-lo)/4);
   for(var g=Math.ceil(lo/st)*st;g<=hi;g+=st){svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:Y(g),y2:Y(g),stroke:'var(--line)','stroke-opacity':.6}));svg.appendChild(txt(W-m.r+8,Y(g)+4,usd(g)))}
   var n=W<480?3:5;for(var k=0;k<n;k++){var t=t0+(t1-t0)*k/(n-1),d=new Date(t);svg.appendChild(txt(X(t),H-6,(d.getUTCFullYear()+'').slice(2)+'.'+String(d.getUTCMonth()+1).padStart(2,'0'),{'text-anchor':k===0?'start':k===n-1?'end':'middle'}))}
   var path='';pts.forEach(function(p,i){path+=(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.usd).toFixed(1)});
   svg.appendChild(el('path',{d:path+'L'+X(t1)+' '+(H-m.b)+'L'+X(t0)+' '+(H-m.b)+'Z',fill:'var(--accent)','fill-opacity':.10}));
   svg.appendChild(el('path',{d:path,fill:'none',stroke:'var(--accent)','stroke-width':2,'stroke-linejoin':'round'}));
   var last=pts[pts.length-1];svg.appendChild(el('circle',{cx:X(last.t),cy:Y(last.usd),r:4,fill:'var(--bg)',stroke:'var(--accent)','stroke-width':2}));
   var cross=el('line',{y1:m.t,y2:H-m.b,stroke:'var(--muted)','stroke-dasharray':'3 3',visibility:'hidden'}),dot=el('circle',{r:4,fill:'var(--accent)',visibility:'hidden'});svg.appendChild(cross);svg.appendChild(dot);
   var unit=j.unit,show=function(p){note.textContent=new Date(p.t).toISOString().slice(0,10)+' · '+usd(p.usd)+' · '+Math.round(p.oi).toLocaleString('en-US')+' '+unit+' · 가격 '+priceFmt(p.price,oiState.sym)};
   svg.addEventListener('pointermove',function(e){var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,t=t0+(x-m.l)/(W-m.l-m.r)*(t1-t0),best=pts[0];for(var i=1;i<pts.length;i++)if(Math.abs(pts[i].t-t)<Math.abs(best.t-t))best=pts[i];cross.setAttribute('x1',X(best.t));cross.setAttribute('x2',X(best.t));cross.setAttribute('visibility','visible');dot.setAttribute('cx',X(best.t));dot.setAttribute('cy',Y(best.usd));dot.setAttribute('visibility','visible');show(best)});
   svg.addEventListener('pointerleave',function(){cross.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');show(last)});
   box.innerHTML='';box.appendChild(svg);show(last);
   var first=pts[0],ch=(last.usd/first.usd-1)*100;
   document.getElementById('oiLongStat').textContent='선택 기간 '+(ch>=0?'+':'')+ch.toFixed(1)+'% · 최고 '+usd(Math.max.apply(null,pts.map(function(p){return p.usd})))+' · 최저 '+usd(Math.min.apply(null,pts.map(function(p){return p.usd})));
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

 function start(){
  if(!document.getElementById('oiLongChart'))return;
  seg('oiLongSym',function(v){oiState.sym=v;drawOI()});
  seg('oiLongRange',function(v){oiState.days=+v;drawOI()});
  seg('liqSym',function(v){liqSym=v;drawLiq()});
  drawOI();drawLiq();
  var t;window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(function(){drawOI();drawLiq()},200)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
