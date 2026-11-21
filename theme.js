// ETH Intelligence bulletin masthead: issue number, serial and a guilloche band behind the page title.
(function(){
 function isoWeek(d){var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);var y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return [t.getUTCFullYear(),Math.ceil(((t-y0)/864e5+1)/7)]}
 function draw(c){
  var r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);if(!r.width)return;
  c.width=r.width*dpr;c.height=r.height*dpr;var g=c.getContext('2d');g.scale(dpr,dpr);g.lineWidth=.6;
  var W=r.width,H=r.height,s=H/90;
  function rose(cx,cy,R,rr,d,col,steps){g.strokeStyle=col;g.beginPath();for(var i=0;i<=steps;i++){var t=i/steps*Math.PI*2*rr,x=cx+(R-rr)*Math.cos(t)+d*Math.cos((R-rr)/rr*t),y=cy+(R-rr)*Math.sin(t)-d*Math.sin((R-rr)/rr*t);i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}
  rose(W*.62,H*.5,52*s,7*s,24*s,'#2f6f61',1400);
  rose(W*.62,H*.5,40*s,5*s,15*s,'#8a7140',1200);
  for(var x=W*.3;x<W+40;x+=86*s)rose(x,H*.5,30*s,3*s,11*s,'#2f6f61',700);
  g.strokeStyle='#8a7140';g.globalAlpha=.35;
  for(var k=0;k<6;k++){g.beginPath();for(var xx=0;xx<=W;xx+=4){var yy=H*.14+k*H*.15+Math.sin(xx/26+k*.9)*3.5*s;xx?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.stroke()}
  g.globalAlpha=1;
  var fade=g.createLinearGradient(0,0,W,0);fade.addColorStop(0,'#0f1a2b');fade.addColorStop(.35,'rgba(15,26,43,0)');g.fillStyle=fade;g.fillRect(0,0,W,H);
 }
 function init(){
  var h=document.querySelector('main>h1');if(!h||h.querySelector('.bul-guilloche'))return;
  var now=new Date(),iw=isoWeek(now),seed=(now.getFullYear()*372+now.getMonth()*31+now.getDate())%1000000;
  var c=document.createElement('canvas');c.className='bul-guilloche';c.setAttribute('aria-hidden','true');h.prepend(c);
  // kicker above the title text
  var title=[].slice.call(h.childNodes).filter(function(n){return n.nodeType===3&&n.textContent.trim()})[0];
  if(title){var wrap=document.createElement('span');var k=document.createElement('span');k.className='bul-kicker';k.textContent='LIQUIDITY BULLETIN · 시장 관측 회보';wrap.append(k,document.createTextNode(title.textContent.trim()));h.replaceChild(wrap,title)}
  var ser=document.createElement('span');ser.className='bul-serial';ser.setAttribute('aria-hidden','true');
  ser.append(document.createTextNode('제 '+iw[0]+'-'+String(iw[1]).padStart(2,'0')+' 호'));var b=document.createElement('b');b.textContent='No. '+String(seed).padStart(6,'0');ser.append(b);h.append(ser);
  if(getComputedStyle(h).display!=='flex'){h.style.display='flex';h.style.alignItems='center';h.style.gap='11px'}
  draw(c);var t;window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(function(){draw(c)},150)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
