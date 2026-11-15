/*
 * MAESTRA virtual-lab engine v1.0 (shared by all chapters)
 * A chapter registers its labs inline, before this script runs:
 *   (window.MVL_LABS=window.MVL_LABS||[]).push(H => ({ 'lab-key': function(panel, c, P){ const {frame,curve,dot,...}=H; ... } }));
 * H holds the drawing helpers below. Each lab draws on a 1080x440 logical canvas, sets panel._reading
 * (notebook row) and panel._readingRaw (numbers for fits).
 */
(function(){
'use strict';
const start=()=>{
const q=1.602176634e-19, kB=8.617333262e-5, EPS0=8.8541878128e-14;
const LW=1080, LH=440;
const SUP={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','.':'·'};
const supNum=n=>String(n).split('').map(ch=>SUP[ch]||ch).join('');
function sci(v,d=2){
  if(!Number.isFinite(v)) return '—';
  if(v===0) return '0';
  const [m,e]=v.toExponential(d).split('e');
  return `${m}×10${supNum(parseInt(e,10))}`;
}
const fx=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';
function fmtI(A){ if(!Number.isFinite(A)) return '—'; const a=Math.abs(A);
  if(a===0) return '0 A'; if(a>=1) return A.toFixed(3)+' A'; if(a>=1e-3) return (A*1e3).toFixed(a>=1e-2?2:3)+' mA';
  if(a>=1e-6) return (A*1e6).toFixed(a>=1e-5?2:3)+' µA'; if(a>=1e-9) return (A*1e9).toFixed(2)+' nA'; return sci(A,2)+' A'; }

/* theme-aware palette (same colours as the module labs) */
const LPAL={
  dark:{bg:'#06101A',grid:'rgba(157,179,194,.13)',frame:'#3a5566',tick:'#9DB3C2',text:'#E8F0F4',
    blue:'#8FDDF6',orange:'#FFA25C',green:'#7EE0C0',red:'#FF7A59',gray:'#7d93a3',purple:'#C4A5FF',amber:'#E8B84B',
    fillGreen:'rgba(126,224,192,.12)',fillOrange:'rgba(255,162,92,.10)',fillRed:'rgba(255,122,89,.10)',
    labelBg:'rgba(6,16,26,.86)',dotStroke:'#06101A'},
  light:{bg:'#ffffff',grid:'#e8edf3',frame:'#334155',tick:'#475569',text:'#111827',
    blue:'#0369A1',orange:'#C2410C',green:'#059669',red:'#D9480F',gray:'#94A3B8',purple:'#7C3AED',amber:'#9A6B0B',
    fillGreen:'rgba(16,185,129,.12)',fillOrange:'rgba(234,88,12,.09)',fillRed:'rgba(217,72,15,.08)',
    labelBg:'rgba(255,255,255,.92)',dotStroke:'#ffffff'}
};
let K=LPAL.dark;
const themeNow=()=>{ try{ if(window.VLAB_THEME) return window.VLAB_THEME()==='light'?'light':'dark'; const h=document.documentElement; if(h.getAttribute('data-theme')==='light'||(document.body&&document.body.classList.contains('light'))) return 'light'; return 'dark'; }catch(e){ return 'dark'; } };

/* drawing helpers */
function prepCanvas(cv){
  const dpr=Math.min(window.devicePixelRatio||1,3);
  if(cv._dpr!==dpr){ cv.width=Math.round(LW*dpr); cv.height=Math.round(LH*dpr); cv._dpr=dpr; }
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  c.fillStyle=K.bg; c.fillRect(0,0,LW,LH); return c;
}
function niceTicks(a,b,max=6){
  const span=b-a; if(!(span>0)) return [a];
  const p=Math.pow(10,Math.floor(Math.log10(span/max)));
  const step=[1,2,2.5,5,10].map(m=>m*p).find(s=>span/s<=max)||10*p;
  const out=[]; for(let t=Math.ceil(a/step-1e-9)*step;t<=b+1e-9;t+=step) out.push(+t.toFixed(10)); return out;
}
const FONT='ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif';
function txt(c,s,x,y,o={}){
  c.save(); c.font=o.font||`12px ${FONT}`; c.textAlign=o.align||'left'; c.textBaseline=o.base||'middle';
  if(o.bg){ const w=c.measureText(s).width; const x0=o.align==='center'?x-w/2:o.align==='right'?x-w:x;
    c.fillStyle=K.labelBg; c.fillRect(x0-3,y-9,w+6,18); }
  c.fillStyle=o.color||K.text; c.fillText(s,x,y); c.restore();
}
function frame(c,b,o){
  const [xa,xb]=o.xr,[ya,yb]=o.yr;
  const Xr=v=>b.x0+(v-xa)/(xb-xa)*(b.x1-b.x0);
  const X=x=>Xr(o.xlog?Math.log10(Math.max(x,1e-300)):x);
  const Yr=v=>b.y0-(v-ya)/(yb-ya)*(b.y0-b.y1);
  const Y=y=>Yr(o.ylog?Math.log10(Math.max(y,1e-300)):y);
  c.save(); c.font=`11.5px ${FONT}`; c.lineWidth=1;
  (o.xticks||[]).forEach(t=>{ const x=Xr(t); c.strokeStyle=K.grid; c.beginPath(); c.moveTo(x,b.y0); c.lineTo(x,b.y1); c.stroke();
    c.fillStyle=K.tick; c.textAlign='center'; c.textBaseline='top'; c.fillText(o.xfmt?o.xfmt(t):String(t),x,b.y0+6); });
  (o.yticks||[]).forEach(t=>{ const y=Yr(t); c.strokeStyle=K.grid; c.beginPath(); c.moveTo(b.x0,y); c.lineTo(b.x1,y); c.stroke();
    c.fillStyle=K.tick; c.textAlign='right'; c.textBaseline='middle'; c.fillText(o.yfmt?o.yfmt(t):String(t),b.x0-6,y); });
  c.strokeStyle=K.frame; c.lineWidth=1.2; c.strokeRect(b.x0,b.y1,b.x1-b.x0,b.y0-b.y1);
  c.fillStyle=K.text; c.font=`12.5px ${FONT}`; c.textAlign='center'; c.textBaseline='top';
  c.fillText(o.xlab,(b.x0+b.x1)/2,b.y0+24);
  c.save(); c.translate(b.x0-(o.ylabOff||50),(b.y0+b.y1)/2); c.rotate(-Math.PI/2); c.textBaseline='middle'; c.fillText(o.ylab,0,0); c.restore();
  if(o.title){ c.font=`600 13.5px ${FONT}`; c.textBaseline='bottom'; c.fillText(o.title,(b.x0+b.x1)/2,b.y1-10); }
  c.restore();
  return {X,Y,Xr,Yr};
}
function clip(c,b){ c.beginPath(); c.rect(b.x0,b.y1,b.x1-b.x0,b.y0-b.y1); c.clip(); }
function curve(c,b,pts,color,width=2.5,dash=[]){
  c.save(); clip(c,b); c.strokeStyle=color; c.lineWidth=width; c.setLineDash(dash); c.lineJoin='round'; c.beginPath();
  let pen=false;
  pts.forEach(([x,y])=>{ if(!Number.isFinite(x)||!Number.isFinite(y)){pen=false;return;} if(!pen){c.moveTo(x,y);pen=true;} else c.lineTo(x,y); });
  c.stroke(); c.restore();
}
function hline(c,b,y,color,width=1.4,dash=[5,4]){ curve(c,b,[[b.x0,y],[b.x1,y]],color,width,dash); }
function vline(c,b,x,color,width=1.4,dash=[5,4]){ curve(c,b,[[x,b.y0],[x,b.y1]],color,width,dash); }
function dot(c,x,y,color,r=6){
  if(!Number.isFinite(x)||!Number.isFinite(y)) return;
  c.save(); c.fillStyle=color; c.strokeStyle=K.dotStroke; c.lineWidth=2; c.beginPath(); c.arc(x,y,r,0,2*Math.PI); c.fill(); c.stroke(); c.restore();
}
function square(c,x,y,color,s=4.5){ if(!Number.isFinite(x)||!Number.isFinite(y)) return;
  c.save(); c.strokeStyle=color; c.lineWidth=2; c.strokeRect(x-s,y-s,2*s,2*s); c.restore(); }
function legend(c,x,y,rows){
  c.save(); c.font=`11.5px ${FONT}`;
  const w=Math.max(...rows.map(r=>c.measureText(r[2]).width))+44;
  c.fillStyle=K.labelBg; c.strokeStyle=K.grid; c.lineWidth=1;
  c.fillRect(x,y,w,rows.length*17+8); c.strokeRect(x,y,w,rows.length*17+8);
  rows.forEach(([color,dash,label],i)=>{ const yy=y+12+i*17;
    c.strokeStyle=color; c.lineWidth=2.5; c.setLineDash(dash); c.beginPath(); c.moveTo(x+8,yy); c.lineTo(x+32,yy); c.stroke(); c.setLineDash([]);
    c.fillStyle=K.text; c.textAlign='left'; c.textBaseline='middle'; c.fillText(label,x+38,yy); });
  c.restore();
  return w;
}
function linfit(pts){
  const n=pts.length; if(n<2) return null;
  let sx=0,sy=0,sxx=0,sxy=0; pts.forEach(([x,y])=>{sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;});
  const den=n*sxx-sx*sx; if(Math.abs(den)<1e-12*Math.max(1,sxx)) return null;
  const m=(n*sxy-sx*sy)/den; return {m,b:(sy-m*sx)/n};
}
/* deterministic "measurement noise": a standard-normal number from a seed */
function gauss(seed){
  let u=Math.sin(seed*12.9898+78.233)*43758.5453; u-=Math.floor(u);
  let v=Math.sin(seed*39.3468+11.135)*24634.6345; v-=Math.floor(v);
  return Math.sqrt(-2*Math.log(Math.max(u,1e-9)))*Math.cos(2*Math.PI*v);
}
const setMetric=(panel,key,s)=>{ const e=panel.querySelector(`[data-metric="${key}"]`); if(e) e.textContent=s; };
const rawOf=panel=>(panel._raw||[]).filter(r=>r&&Object.keys(r).length);
const DRAW={};
const H={q,kB,EPS0,LW,LH,supNum,sci,fx,fmtI,get K(){return K;},prepCanvas,niceTicks,FONT,txt,frame,clip,curve,hline,vline,dot,square,legend,linfit,gauss,setMetric,rawOf};
window.MVL=H;

/* ═════════════ shared lab shell ═════════════ */
function fmtSlider(inp,v){
  const unit=inp.dataset.unit||'';
  if(inp.dataset.fmt==='choice') return (inp.dataset.choices||'').split('|')[Math.round(v)]||String(v);
  if(inp.dataset.fmt==='pow10') return Math.pow(10,v).toFixed(+(inp.dataset.digits||2))+unit;
  if(inp.dataset.log) return sci(Math.pow(10,v),1)+unit;
  return v.toFixed(+(inp.dataset.digits||2))+unit;
}
function readParams(panel){
  const P={};
  panel.querySelectorAll('input[data-param]').forEach(inp=>{
    const v=parseFloat(inp.value); P[inp.dataset.param]=v;
    const out=panel.querySelector(`[data-out="${inp.dataset.param}"]`); if(out) out.textContent=fmtSlider(inp,v);
  });
  return P;
}
function renderTable(panel){
  const rows=panel._rows, table=panel.querySelector('.vl-table');
  const cols=rows.length?Object.keys(rows[0]):Object.keys(panel._reading||{});
  table.querySelector('thead').innerHTML='<tr><th>#</th>'+cols.map(col=>`<th>${col}</th>`).join('')+'</tr>';
  table.querySelector('tbody').innerHTML=rows.length
    ? rows.map((rw,i)=>`<tr><td>${i+1}</td>${cols.map(col=>`<td>${rw[col]??''}</td>`).join('')}</tr>`).join('')
    : `<tr class="empty"><td colspan="${cols.length+1}">No readings yet — set the controls and press “Record reading”.</td></tr>`;
  panel.querySelector('[data-count]').textContent=rows.length+(rows.length===1?' reading':' readings');
}
function downloadCsv(panel){
  const rows=panel._rows; if(!rows.length) return;
  const cols=Object.keys(rows[0]);
  const esc=v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
  const csv=[cols.map(esc).join(','),...rows.map(rw=>cols.map(col=>esc(rw[col]??'')).join(','))].join('\n');
  const url=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download=`${panel.dataset.lab}_lab_data.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
(window.MVL_LABS||[]).forEach(f=>{ try{ Object.assign(DRAW,f(H)); }catch(e){ console.error('MVL lab registration',e); } });
const redraws=[];
function initPanel(panel){
  if(panel._mvl) return; const draw=DRAW[panel.dataset.lab], cv=panel.querySelector('canvas');
  if(!draw||!cv) return; panel._mvl=true;
  const sliders=[...panel.querySelectorAll('input[data-param]')];
  sliders.forEach(i => { const name = i.closest('.vl-ctrl')?.querySelector('.name')?.textContent; if (name && !i.labels?.length && !i.hasAttribute('aria-label')) i.setAttribute('aria-label', name.trim()); });
  const defaults=sliders.map(i=>[i,i.value]);
  panel._rows=[]; panel._raw=[];
  const redraw=()=>{ if(!panel.isConnected) return; K=LPAL[themeNow()]; const P=readParams(panel); const c=prepCanvas(cv);
    try{ draw(panel,c,P); }catch(err){ console.error('Lab',panel.dataset.lab,err); } };
  redraws.push(redraw);
  sliders.forEach(inp=>inp.addEventListener('input',redraw));
  panel.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-act]'); if(!btn) return;
    const act=btn.dataset.act;
    if(act==='record'&&panel._reading){ panel._rows.push({...panel._reading}); panel._raw.push({...panel._readingRaw});
      btn.classList.add('flash'); setTimeout(()=>btn.classList.remove('flash'),350); }
    else if(act==='undo'){ panel._rows.pop(); panel._raw.pop(); }
    else if(act==='clear'){ panel._rows=[]; panel._raw=[]; }
    else if(act==='csv'){ downloadCsv(panel); return; }
    else if(act==='reset'){ defaults.forEach(([i,v])=>{ i.value=v; }); }
    else if(act==='preset'){ const sets=JSON.parse(btn.dataset.values||'{}');
      Object.entries(sets).forEach(([k2,v])=>{ const i=panel.querySelector(`[data-param="${k2}"]`); if(i) i.value=v; }); }
    redraw(); renderTable(panel);
  });
  redraw(); renderTable(panel);
}
/* tabs: each .vl-set switches only its own pages */
function initSet(set){
  if(set._mvl) return; set._mvl=true;
  const tabs=[...set.querySelectorAll('.vl-tab')];
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    tabs.forEach(t=>t.setAttribute('aria-selected',String(t===tab)));
    set.querySelectorAll('.vl-page').forEach(p=>p.classList.toggle('active',p.id===tab.dataset.tab));
    const page=set.querySelector('#'+CSS.escape(tab.dataset.tab));
    if(page) page.querySelectorAll('.vl-inst').forEach(pn=>{ pn._mvl?redraws.forEach(f=>f()):initPanel(pn); });
    if(window.MathJax&&MathJax.typesetPromise&&page) MathJax.typesetPromise([page]).catch(()=>{});
  }));
}
const scan=root=>{ root.querySelectorAll('.vl-set').forEach(initSet); root.querySelectorAll('.vl-inst').forEach(initPanel); };
scan(document);
/* chapters that render sections on demand (single-page apps) insert labs later: start them when they appear */
new MutationObserver(muts=>{ for(const m of muts) for(const n of m.addedNodes){ if(n.nodeType===1&&(n.matches?.('.vl-set,.vl-inst')||n.querySelector?.('.vl-inst'))) { scan(n.parentNode||document); return; } } })
  .observe(document.body,{childList:true,subtree:true});
const redrawAll=()=>redraws.forEach(fn=>fn());
window.addEventListener('themechange',redrawAll);
window.addEventListener('maestra-theme-applied',redrawAll);
let lastTheme=themeNow();
const watch=()=>{ const t=themeNow(); if(t!==lastTheme){ lastTheme=t; redrawAll(); } };
new MutationObserver(watch).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});
if(document.body) new MutationObserver(watch).observe(document.body,{attributes:true,attributeFilter:['class']});
window.MVL.rescan=()=>scan(document);
};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
