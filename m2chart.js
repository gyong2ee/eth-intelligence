// M2 level and M2 year-over-year charts, with a full-period navigator under each.
// Data: /api/macro?series=m2 (FRED M2SL, USD billions, monthly).
// Navigator: drag inside to move, drag an edge to resize, click outside to jump there,
// wheel over the chart or the navigator to zoom around the pointer.
(function(){
 var DAY=864e5,NS='http://www.w3.org/2000/svg';
 var FONT='Inter, "Noto Sans KR", system-ui, sans-serif';
 var C={grid:'#1d2a40',text:'#98a4b8',dim:'#6c7a90',ink:'#0a1220',sel:'rgba(201,164,92,.16)',edge:'#c9a45c',navFill:'rgba(152,164,184,.22)',navLine:'#6c7a90'};
 function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
 function niceStep(r){var p=Math.pow(10,Math.floor(Math.log10(r))),n=r/p;return (n<1.5?1:n<3?2:n<7?5:10)*p}
 function ym(t){var d=new Date(t);return d.getUTCFullYear()+'.'+String(d.getUTCMonth()+1).padStart(2,'0')}

 function Chart(o){
  this.o=o;this.box=document.getElementById(o.box);this.pts=[];this.win=null;this.days=o.days||0;
  this.tip=document.getElementById(o.tip);this.frame=0;this.pendingZoom=0;this.zoomRatio=.5;
  var self=this;
  this.main=el('svg',{class:'xc-main',role:'img','aria-label':o.label});
  this.nav=el('svg',{class:'xc-nav','aria-label':o.label+' 전체 기간 선택'});
  this.navLabel=document.createElement('div');this.navLabel.className='xc-nav-label';
  this.navLabel.innerHTML='<span>전체 기간</span><span></span>';
  var navWrap=document.createElement('div');navWrap.className='xc-nav-wrap';navWrap.appendChild(this.navLabel);navWrap.appendChild(this.nav);
  this.box.innerHTML='';this.box.appendChild(this.main);this.box.appendChild(navWrap);
  this.bindNav();this.bindMain();
  window.addEventListener('resize',function(){self.draw()});
 }
 Chart.prototype.bounds=function(){return {a:this.pts[0].t,b:this.pts[this.pts.length-1].t}};
 Chart.prototype.minSpan=function(){return Math.max(this.o.minSpanDays||180,1)*DAY};
 Chart.prototype.setWin=function(a,b){
  var B=this.bounds(),span=Math.max(this.minSpan(),Math.min(B.b-B.a,b-a));
  a=Math.max(B.a,Math.min(B.b-span,a));this.win={a:a,b:a+span};this.schedule();
 };
 Chart.prototype.setDays=function(days){
  this.days=days;var B=this.bounds();
  this.win=days?{a:Math.max(B.a,B.b-days*DAY),b:B.b}:{a:B.a,b:B.b};
  var btns=document.querySelectorAll('.macroRanges[data-chart="'+this.o.rangeKey+'"] button');
  for(var i=0;i<btns.length;i++){var on=+btns[i].dataset.days===days;btns[i].setAttribute('aria-pressed',String(on));btns[i].classList.toggle('on',on)}
  this.schedule();
 };
 Chart.prototype.schedule=function(){var self=this;if(this.frame)return;this.frame=requestAnimationFrame(function(){self.frame=0;self.draw()})};
 Chart.prototype.setData=function(pts){this.pts=pts;this.setDays(this.days)};

 Chart.prototype.draw=function(){
  if(this.pts.length<2)return;
  this.drawMain();this.drawNav();
 };
 Chart.prototype.visible=function(){
  var w=this.win,p=this.pts,out=[];
  for(var i=0;i<p.length;i++){if(p[i].t>=w.a&&p[i].t<=w.b)out.push(p[i])}
  // keep the line continuous at the window edges
  var first=p.findIndex(function(q){return q.t>=w.a});if(first>0)out.unshift(p[first-1]);
  var last=-1;for(var j=p.length-1;j>=0;j--){if(p[j].t<=w.b){last=j;break}}if(last>=0&&last<p.length-1)out.push(p[last+1]);
  return out;
 };
 Chart.prototype.drawMain=function(){
  var svg=this.main,W=Math.max(260,this.box.clientWidth||600),H=this.o.height||230,m={l:8,r:52,t:12,b:24};
  svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('height',H);svg.innerHTML='';
  var v=this.visible(),w=this.win;if(v.length<2)return;
  var lo=Infinity,hi=-Infinity;v.forEach(function(q){if(q.t>=w.a&&q.t<=w.b){lo=Math.min(lo,q.v);hi=Math.max(hi,q.v)}});
  if(!isFinite(lo)){lo=Math.min.apply(null,v.map(function(q){return q.v}));hi=Math.max.apply(null,v.map(function(q){return q.v}))}
  if(this.o.zero){lo=Math.min(lo,0);hi=Math.max(hi,0)}
  var pad=(hi-lo)*.08||Math.abs(hi)*.05||1;lo-=pad;hi+=pad;
  var X=function(t){return m.l+(t-w.a)/(w.b-w.a)*(W-m.l-m.r)},Y=function(val){return m.t+(1-(val-lo)/(hi-lo))*(H-m.t-m.b)};
  var st=niceStep((hi-lo)/4),fmt=this.o.fmtAxis;
  for(var g=Math.ceil(lo/st)*st;g<=hi;g+=st){svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:Y(g),y2:Y(g),stroke:C.grid}));var tx=el('text',{x:W-m.r+8,y:Y(g)+4,fill:C.text,'font-size':11,'font-family':FONT});tx.textContent=fmt(g);svg.appendChild(tx)}
  // x labels: about 4, at month starts
  var span=w.b-w.a,n=W<420?3:5;
  for(var k=0;k<n;k++){var t=w.a+span*(k/(n-1));var lab=el('text',{x:X(t),y:H-6,fill:C.dim,'font-size':11,'font-family':FONT,'text-anchor':k===0?'start':k===n-1?'end':'middle'});lab.textContent=ym(t);svg.appendChild(lab)}
  if(this.o.zero&&lo<0)svg.appendChild(el('line',{x1:m.l,x2:W-m.r,y1:Y(0),y2:Y(0),stroke:C.text,'stroke-dasharray':'4 4','stroke-opacity':.6}));
  var d='';v.forEach(function(q,i){d+=(i?'L':'M')+X(q.t).toFixed(1)+' '+Y(q.v).toFixed(1)});
  var clip='c'+this.o.box;var defs=el('defs',{}),cp=el('clipPath',{id:clip});cp.appendChild(el('rect',{x:m.l,y:0,width:W-m.l-m.r,height:H}));defs.appendChild(cp);
  var gid='g'+this.o.box,lg=el('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});lg.appendChild(el('stop',{offset:'0%','stop-color':this.o.color,'stop-opacity':.22}));lg.appendChild(el('stop',{offset:'100%','stop-color':this.o.color,'stop-opacity':0}));defs.appendChild(lg);svg.appendChild(defs);
  var base=this.o.zero?Y(Math.max(lo,0)):H-m.b;
  var gr=el('g',{'clip-path':'url(#'+clip+')'});
  gr.appendChild(el('path',{d:d+'L'+X(v[v.length-1].t).toFixed(1)+' '+base+'L'+X(v[0].t).toFixed(1)+' '+base+'Z',fill:'url(#'+gid+')'}));
  gr.appendChild(el('path',{d:d,fill:'none',stroke:this.o.color,'stroke-width':2,'stroke-linejoin':'round'}));
  svg.appendChild(gr);
  var lastIn=v.filter(function(q){return q.t<=w.b}).pop();
  if(lastIn)svg.appendChild(el('circle',{cx:X(lastIn.t),cy:Y(lastIn.v),r:3.5,fill:C.ink,stroke:this.o.color,'stroke-width':2}));
  this.cross=el('line',{y1:m.t,y2:H-m.b,stroke:C.text,'stroke-dasharray':'3 3',visibility:'hidden'});this.dot=el('circle',{r:4,fill:this.o.color,visibility:'hidden'});
  svg.appendChild(this.cross);svg.appendChild(this.dot);
  this.geo={X:X,Y:Y,m:m,W:W,H:H};this.showLatest();
 };
 Chart.prototype.showLatest=function(){if(!this.tip)return;var p=this.pts[this.pts.length-1];this.tip.textContent=this.o.name+' · '+new Date(p.t).toISOString().slice(0,10)+' · '+this.o.fmtTip(p.v)};
 Chart.prototype.drawNav=function(){
  var svg=this.nav,W=Math.max(260,this.box.clientWidth||600),H=34,B=this.bounds(),p=this.pts;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('height',H);svg.innerHTML='';
  var lo=Infinity,hi=-Infinity;p.forEach(function(q){lo=Math.min(lo,q.v);hi=Math.max(hi,q.v)});
  var X=function(t){return (t-B.a)/(B.b-B.a)*W},Y=function(v){return H-3-(v-lo)/((hi-lo)||1)*(H-7)};
  var d='';p.forEach(function(q,i){d+=(i?'L':'M')+X(q.t).toFixed(1)+' '+Y(q.v).toFixed(1)});
  svg.appendChild(el('path',{d:d+'L'+W+' '+H+'L0 '+H+'Z',fill:C.navFill}));
  svg.appendChild(el('path',{d:d,fill:'none',stroke:C.navLine,'stroke-width':1}));
  var a=X(this.win.a),b=X(this.win.b);
  svg.appendChild(el('rect',{x:0,y:0,width:Math.max(0,a),height:H,fill:C.ink,'fill-opacity':.55}));
  svg.appendChild(el('rect',{x:b,y:0,width:Math.max(0,W-b),height:H,fill:C.ink,'fill-opacity':.55}));
  svg.appendChild(el('rect',{x:a,y:.5,width:Math.max(2,b-a),height:H-1,fill:C.sel,stroke:C.edge,'stroke-width':1,rx:3}));
  [a,b].forEach(function(x){svg.appendChild(el('rect',{x:x-3,y:H/2-8,width:6,height:16,rx:2,fill:C.edge}))});
  this.navGeo={X:X,W:W,a:a,b:b,B:B};
  this.navLabel.lastChild.textContent=new Date(this.win.a).toISOString().slice(0,10)+' ~ '+new Date(this.win.b).toISOString().slice(0,10);
 };

 Chart.prototype.toTime=function(clientX,svg,full){
  var r=svg.getBoundingClientRect(),f=Math.max(0,Math.min(1,(clientX-r.left)/r.width));
  if(full){var B=this.bounds();return B.a+f*(B.b-B.a)}
  var g=this.geo,W=g.W,x=f*W;return this.win.a+(x-g.m.l)/(W-g.m.l-g.m.r)*(this.win.b-this.win.a);
 };
 Chart.prototype.zoomAt=function(ratio,delta){
  var self=this;this.pendingZoom+=delta;this.zoomRatio=ratio;
  if(this.zoomFrame)return;
  this.zoomFrame=requestAnimationFrame(function(){
   self.zoomFrame=0;var w=self.win,span=w.b-w.a,B=self.bounds();
   var next=Math.max(self.minSpan(),Math.min(B.b-B.a,span*Math.exp(self.pendingZoom*.0012)));self.pendingZoom=0;
   var pivot=w.a+self.zoomRatio*span;self.days=-1;self.markRange();self.setWin(pivot-self.zoomRatio*next,pivot-self.zoomRatio*next+next);
  });
 };
 Chart.prototype.markRange=function(){var btns=document.querySelectorAll('.macroRanges[data-chart="'+this.o.rangeKey+'"] button');for(var i=0;i<btns.length;i++){btns[i].setAttribute('aria-pressed','false');btns[i].classList.remove('on')}};
 function wheelDelta(e){return e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?120:1)}

 Chart.prototype.bindNav=function(){
  var self=this,svg=this.nav,drag=null;
  svg.addEventListener('pointerdown',function(e){
   if(e.button!==0||!self.navGeo)return;e.preventDefault();
   var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*self.navGeo.W,g=self.navGeo,B=g.B,span=self.win.b-self.win.a;
   var mode=Math.abs(x-g.a)<=10?'left':Math.abs(x-g.b)<=10?'right':(x>g.a&&x<g.b)?'move':'jump';
   if(mode==='jump'){var t=self.toTime(e.clientX,svg,true);self.days=-1;self.markRange();self.setWin(t-span/2,t+span/2);mode='move'}
   drag={mode:mode,x:e.clientX,a:self.win.a,b:self.win.b,w:r.width,full:B.b-B.a};
   if(mode==='move'&&span>=drag.full-1){drag=null;return}
   svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');
  });
  svg.addEventListener('pointermove',function(e){
   if(!drag){if(self.navGeo){var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*self.navGeo.W;svg.style.cursor=(Math.abs(x-self.navGeo.a)<=10||Math.abs(x-self.navGeo.b)<=10)?'ew-resize':(x>self.navGeo.a&&x<self.navGeo.b)?'grab':'pointer'}return}
   var dt=(e.clientX-drag.x)/drag.w*drag.full;self.days=-1;self.markRange();
   if(drag.mode==='move')self.setWin(drag.a+dt,drag.b+dt);
   else if(drag.mode==='left')self.setWin(Math.min(drag.a+dt,drag.b-self.minSpan()),drag.b);
   else self.setWin(drag.a,Math.max(drag.b+dt,drag.a+self.minSpan()));
  });
  var end=function(){drag=null;svg.classList.remove('dragging')};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',function(e){if(!self.navGeo)return;e.preventDefault();var r=svg.getBoundingClientRect(),g=self.navGeo,x=(e.clientX-r.left)/r.width*g.W,ratio=Math.max(0,Math.min(1,(x-g.a)/Math.max(1,g.b-g.a)));self.zoomAt(ratio,wheelDelta(e))},{passive:false});
 };
 Chart.prototype.bindMain=function(){
  var self=this,svg=this.main,drag=null;
  svg.addEventListener('wheel',function(e){if(!self.geo)return;e.preventDefault();var r=svg.getBoundingClientRect(),g=self.geo,x=(e.clientX-r.left)/r.width*g.W,ratio=Math.max(0,Math.min(1,(x-g.m.l)/(g.W-g.m.l-g.m.r)));self.zoomAt(ratio,wheelDelta(e))},{passive:false});
  svg.addEventListener('pointerdown',function(e){if(e.button!==0||!self.geo)return;var B=self.bounds();if(self.win.b-self.win.a>=B.b-B.a-1)return;drag={x:e.clientX,a:self.win.a,b:self.win.b,w:svg.getBoundingClientRect().width};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging')});
  svg.addEventListener('pointermove',function(e){
   if(drag){var g=self.geo,plotW=(g.W-g.m.l-g.m.r)/g.W*drag.w,dt=-(e.clientX-drag.x)/plotW*(drag.b-drag.a);self.days=-1;self.markRange();self.setWin(drag.a+dt,drag.b+dt);return}
   if(!self.geo||!self.cross)return;var t=self.toTime(e.clientX,svg,false),v=self.visible(),best=v[0];
   for(var i=1;i<v.length;i++)if(Math.abs(v[i].t-t)<Math.abs(best.t-t))best=v[i];
   var g2=self.geo;self.cross.setAttribute('x1',g2.X(best.t));self.cross.setAttribute('x2',g2.X(best.t));self.cross.setAttribute('visibility','visible');
   self.dot.setAttribute('cx',g2.X(best.t));self.dot.setAttribute('cy',g2.Y(best.v));self.dot.setAttribute('visibility','visible');
   if(self.tip)self.tip.textContent=self.o.name+' · '+new Date(best.t).toISOString().slice(0,10)+' · '+self.o.fmtTip(best.v);
  });
  var end=function(){drag=null;svg.classList.remove('dragging')};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('pointerleave',function(){if(self.cross){self.cross.setAttribute('visibility','hidden');self.dot.setAttribute('visibility','hidden')}self.showLatest()});
 };

 function start(){
  if(!document.getElementById('m2Chart'))return;
  var m2=new Chart({box:'m2Chart',tip:'m2tip',rangeKey:'m2x',label:'M2 통화량',name:'M2',color:'#6fbfa8',minSpanDays:180,
   fmtAxis:function(v){return v.toFixed(1)+'조'},fmtTip:function(v){return v.toFixed(2)+'조 달러'}});
  var yoy=new Chart({box:'yoyChart',tip:'yoytip',rangeKey:'yoyx',label:'M2 전년 대비 증가율',name:'YoY',color:'#c9a45c',zero:true,minSpanDays:180,
   fmtAxis:function(v){return v.toFixed(0)+'%'},fmtTip:function(v){return (v>=0?'+':'')+v.toFixed(2)+'%'}});
  [['m2x',m2],['yoyx',yoy]].forEach(function(pair){
   document.querySelectorAll('.macroRanges[data-chart="'+pair[0]+'"] button').forEach(function(b){b.addEventListener('click',function(){if(pair[1].pts.length)pair[1].setDays(+b.dataset.days)})});
  });
  var label=document.getElementById('m2Latest');
  fetch('/api/macro?series=m2',{headers:{Accept:'application/json'}}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.rows||!j.rows.length)throw Error(j.error||('HTTP '+r.status));return j})}).then(function(j){
   var rows=j.rows.filter(function(r){return /^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(+r.value)}).sort(function(a,b){return a.date.localeCompare(b.date)});
   var lvl=rows.map(function(r){return {t:Date.parse(r.date+'T00:00:00Z'),v:r.value/1000}});
   var byMonth=new Map(rows.map(function(r){return [r.date.slice(0,7),r.value]}));
   var g=rows.map(function(r){var prev=byMonth.get((+r.date.slice(0,4)-1)+r.date.slice(4,7));return prev?{t:Date.parse(r.date+'T00:00:00Z'),v:100*(r.value/prev-1)}:null}).filter(Boolean);
   m2.setData(lvl);yoy.setData(g);
   if(label){var last=rows[rows.length-1];label.textContent='마지막 관측: '+last.date+' · '+(last.value/1000).toFixed(2)+'조 달러 · 출처 '+(j.source||'FRED')}
  }).catch(function(e){
   ['m2Chart','yoyChart'].forEach(function(id){var b=document.getElementById(id);if(b)b.innerHTML='<p class="xc-empty">M2 데이터를 불러오지 못했습니다 ('+String(e.message).replace(/</g,'&lt;')+')</p>'});
   if(label)label.textContent='M2 연결 오류';
  });
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){m2.draw();yoy.draw()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
