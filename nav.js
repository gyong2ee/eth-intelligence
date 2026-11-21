// Shared site navigation: page tabs on top of every page, and on desktop a left list of
// the current page's sections. The overview page keeps its own section list (#desktopSidebar).
(function(){
 var PAGES=[
  {href:'/',label:'시장 개요',paths:['/','/index.html']},
  {href:'/derivatives.html',label:'파생상품',paths:['/derivatives.html','/derivatives']},
  {href:'/liquidity.html',label:'글로벌 유동성',paths:['/liquidity.html','/liquidity']}
 ];
 var SECTIONS={
  '/derivatives.html':[['한눈에 보기','summary'],['미결제약정 추이','oiLong'],['청산맵 (추정)','liqmap'],['가격과 미결제약정 흐름','flow'],['펀딩비 수준','funding'],['Binance 펀딩비','binance']],
  '/liquidity.html':[['지금 판정','verdict-sec'],['지표 8개','instruments'],['연준 순유동성','main'],['재무부 통장 TGA','tga'],['역레포','rrp'],['달러 인덱스','dxy'],['미국 10년물','y10'],['스테이블코인','stable'],['DeFi 예치금','tvl'],['스테이블코인 예치 APY','apy']]
 };
 var ETH='<svg width="18" height="27" viewBox="0 0 24 36" aria-hidden="true"><path d="M12 1L1 18l11-5.2L23 18 12 1Z"/><path d="M1 20.5 12 35l11-14.5-11 6.3L1 20.5Z"/><path d="M1 18 12 12.8V25L1 18Z" opacity=".7"/><path d="M23 18 12 12.8V25l11-7Z" opacity=".45"/></svg>';
 var path=location.pathname.replace(/\/+$/,'')||'/';
 var page=PAGES.filter(function(p){return p.paths.indexOf(path)>=0})[0]||PAGES[0];

 function tabs(){
  var host=document.querySelector('body>main')||document.querySelector('.wrap')||document.querySelector('main');if(!host||document.querySelector('.site-tabs'))return;
  var nav=document.createElement('nav');nav.className='site-tabs';nav.setAttribute('aria-label','페이지');
  PAGES.forEach(function(p){var a=document.createElement('a');a.href=p.href;a.textContent=p.label;if(p===page)a.setAttribute('aria-current','page');nav.appendChild(a)});
  host.insertBefore(nav,host.firstChild);
 }
 function side(){
  var existing=document.getElementById('desktopSidebar');
  if(existing){existing.classList.add('site-side');document.body.classList.add('has-side');return}
  var list=SECTIONS[page.href];if(!list)return;
  var aside=document.createElement('aside');aside.className='site-side';aside.setAttribute('aria-label',page.label+' 목차');
  var brand=document.createElement('div');brand.className='side-brand';brand.innerHTML=ETH;var bn=document.createElement('span');bn.textContent='ETH Intelligence';brand.appendChild(bn);
  var pg=document.createElement('div');pg.className='side-page';pg.textContent=page.label;
  aside.appendChild(brand);aside.appendChild(pg);
  var links=[];
  list.forEach(function(item){if(!document.getElementById(item[1]))return;var a=document.createElement('a');a.href='#'+item[1];a.textContent=item[0];aside.appendChild(a);links.push(a)});
  document.body.insertBefore(aside,document.body.firstChild);document.body.classList.add('has-side');
  links.forEach(function(a){a.addEventListener('click',function(e){var t=document.getElementById(a.hash.slice(1));if(!t)return;e.preventDefault();t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});history.replaceState(null,'',a.hash)})});
  if('IntersectionObserver' in window&&links.length){
   var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.toggle('active',l.hash==='#'+e.target.id)})}})},{rootMargin:'-20% 0px -70% 0px'});
   links.forEach(function(l){var t=document.getElementById(l.hash.slice(1));if(t)io.observe(t)});
   links[0].classList.add('active');
  }
 }
 function toTop(){
  if(document.querySelector('.to-top'))return;
  var b=document.createElement('button');b.type='button';b.className='to-top';b.setAttribute('aria-label','맨 위로');b.title='맨 위로';
  b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  b.addEventListener('click',function(){window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
  document.body.appendChild(b);
  // .show is only used by the phone stylesheet; desktop keeps the button always visible
  var tick=function(){b.classList.toggle('show',window.scrollY>600)};window.addEventListener('scroll',tick,{passive:true});tick();
 }
 function init(){tabs();side();toTop()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

// Shared mouse tracker for every chart: a crosshair, a dot per series and a floating
// tooltip with the date and each series' value (color-coded when there are several).
window.ETHTrack=(function(){
 var NS='http://www.w3.org/2000/svg';
 function near(pts,t){var lo=0,hi=pts.length-1;while(hi-lo>1){var m=(lo+hi)>>1;if(pts[m].t<t)lo=m;else hi=m}return Math.abs(pts[lo].t-t)<=Math.abs(pts[hi].t-t)?pts[lo]:pts[hi]}
 function tip(host){
  if(getComputedStyle(host).position==='static')host.style.position='relative';
  var box=host.querySelector(':scope>.eth-track-tip');if(!box){box=document.createElement('div');box.className='eth-track-tip';box.hidden=true;host.appendChild(box)}
  return {
   show:function(clientX,clientY,title,rows){
    box.innerHTML='';var h=document.createElement('div');h.className='tt-h';h.textContent=title;box.appendChild(h);
    rows.forEach(function(r){var d=document.createElement('div');d.className='tt-r';var i=document.createElement('i');i.style.background=r.color||'currentColor';var n=document.createElement('span');n.textContent=r.name;var v=document.createElement('b');v.textContent=r.value;d.append(i,n,v);box.appendChild(d)});
    box.hidden=false;var hr=host.getBoundingClientRect(),bw=box.offsetWidth,bh=box.offsetHeight;
    var x=clientX-hr.left+14,y=clientY-hr.top-bh-10;if(x+bw>hr.width-4)x=clientX-hr.left-bw-14;if(x<4)x=4;if(y<4)y=clientY-hr.top+16;
    box.style.left=x+'px';box.style.top=y+'px';
   },
   hide:function(){box.hidden=true}
  };
 }
 // opts: {W, left, right, top, bottom, tAt(svgX)->time, date(t)->string, dots(bool, default true),
 //        series:[{name,color,pts:[{t,v}],x(t),y(v),fmt(v)}]}
 function attach(svg,o){
  if(svg._ethTrackOff)svg._ethTrackOff();
  var host=o.host||svg.parentElement,tt=tip(host),dots=o.dots!==false;
  var cross=document.createElementNS(NS,'line');cross.setAttribute('y1',o.top);cross.setAttribute('y2',o.bottom);cross.setAttribute('stroke','currentColor');cross.setAttribute('stroke-opacity','.45');cross.setAttribute('stroke-dasharray','3 3');cross.setAttribute('visibility','hidden');cross.setAttribute('pointer-events','none');svg.appendChild(cross);
  var marks=o.series.map(function(s){var c=document.createElementNS(NS,'circle');c.setAttribute('r',4);c.setAttribute('fill',s.color);c.setAttribute('stroke','#0a1220');c.setAttribute('stroke-width',1.5);c.setAttribute('visibility','hidden');c.setAttribute('pointer-events','none');svg.appendChild(c);return c});
  function move(e){
   var r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*o.W;
   if(sx<o.left||sx>o.right){leave();return}
   var t=o.tAt(sx),rows=[],first=null;
   o.series.forEach(function(s,i){if(!s.pts||!s.pts.length){marks[i].setAttribute('visibility','hidden');return}var p=near(s.pts,t);if(!first)first=p;
    if(dots){marks[i].setAttribute('cx',s.x(p.t));marks[i].setAttribute('cy',s.y(p.v));marks[i].setAttribute('visibility','visible')}
    rows.push({name:s.name,color:s.color,value:s.fmt(p.v)})});
   if(!first)return;var cx=o.series[0].x(first.t);cross.setAttribute('x1',cx);cross.setAttribute('x2',cx);cross.setAttribute('visibility','visible');
   tt.show(e.clientX,e.clientY,o.date(first.t),rows);
  }
  function leave(){cross.setAttribute('visibility','hidden');marks.forEach(function(m){m.setAttribute('visibility','hidden')});tt.hide()}
  svg.addEventListener('pointermove',move);svg.addEventListener('pointerleave',leave);
  svg._ethTrackOff=function(){svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerleave',leave);tt.hide()};
  return {leave:leave};
 }
 function ymd(t){return new Date(t).toISOString().slice(0,10)}
 return {attach:attach,tip:tip,ymd:ymd};
})();
