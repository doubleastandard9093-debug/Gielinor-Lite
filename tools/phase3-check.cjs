// Phase 3 (The Wanderer's Saga) headless check. Usage: node tools/phase3-check.cjs [path] [low|high] [WxH] [save.json]
// Plays all six chapters through the real dialogue UI (requirements and objectives are filled in by the test),
// checks remembered choices (Varro's help, a companion leaving, the ending title), and on Low that nothing High loads.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='390x844',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>localStorage.setItem('gielinor3d',s),fs.readFileSync(savef,'utf8'));}
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async()=>{const g=window.gielinor,P=g.player,S=ms=>new Promise(r=>setTimeout(r,ms)),d=document.getElementById('dialogue');
  const adv=async()=>{for(let i=0;i<30;i++){await S(200);if(d.style.display==='none'||d.dataset.kind!=='line')return d.dataset.kind;d.click();}};
  const ver=JSON.parse(localStorage.getItem('gielinor3d')||'{}').version;
  const c=g.nodes.find(n=>n.saga);for(const s of Object.values(g.skills))s.level=Math.max(s.level,40);
  P.saga={calling:null,ch:0,active:false,prog:0,flags:{},choices:[],title:null};
  const tones=['kind','cunning','kind','firm','kind','x'];const log=[];
  // companion who dislikes 'firm' (Tamsin likes kind) at bond 1 -> leaves in chapter 4
  P.companions.tamsin.recruited=true;P.companions.tamsin.bond=1;g.setCompanion('tamsin');
  P.saga.ch=1;const qpGate=g.sagaTalk()[0][1];P.saga.ch=0;
  const base=location.pathname.includes('webgpu')?'../':'/';const {QUEST_DATA}=await import(base+'js/quests2.js');for(const qd of QUEST_DATA.slice(0,30))P.quests[qd.id]={stage:'done'};
  for(let i=0;i<6;i++){
    const gateTxt=g.sagaTalk()[0][1];if(/quest points/.test(gateTxt)){window.__qpBypass=true;}
    g.talkTo(c);let k=await adv();
    if(k==='choose'){[...d.querySelectorAll('.d-opt')][0].click();k=await adv();}
    if(!P.saga.active){log.push('notActive'+i+':'+gateTxt.slice(0,60));break;}
    const ch=P.saga.ch;P.saga.prog=99;P.inventory['Cowhide']=5;P.inventory['Rune essence']=(ch===4?5:20);
    g.talkTo(c);k=await adv();
    if(k==='wheel'){const t=tones[i];const bt=[...d.querySelectorAll('.w-opt')].find(b=>+b.dataset.i===['kind','firm','cunning'].indexOf(t));bt.click();await adv();}
    log.push(P.saga.ch);
  }
  return{ver,qpGate:qpGate.slice(0,40),log,ch:P.saga.ch,title:P.saga.title,flags:P.saga.flags,tamsin:P.companions.tamsin.recruited,active:P.activeCompanion,essLeft:P.inventory['Rune essence']||0,choices:P.saga.choices.map(c=>c.tone).join(',')};});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.ch===6&&!!r.title&&r.flags.varro&&r.flags.left_tamsin&&!r.tamsin&&(tier!=='low'||hi.length===0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
