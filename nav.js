// Shared site navigation: page tabs on top of every page, and on desktop a left list of
// the current page's sections. The overview page keeps its own section list (#desktopSidebar).
(function(){
 var PAGES=[
  {href:'/',label:'시장 개요',paths:['/','/index.html']},
  {href:'/derivatives.html',label:'파생상품',paths:['/derivatives.html','/derivatives']},
  {href:'/liquidity.html',label:'글로벌 유동성',paths:['/liquidity.html','/liquidity']}
 ];
 var SECTIONS={
  '/derivatives.html':[['한눈에 보기','summary'],['미결제약정 추이','oi'],['미결제약정 장기 추이','oiLong'],['청산맵 (추정)','liqmap'],['가격과 미결제약정 흐름','flow'],['펀딩비 수준','funding'],['Binance 펀딩비','binance'],['Bybit 미결제약정','bybit']],
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
 }
 function init(){tabs();side();toTop()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
