// Phase 9 (Frontier & Siege) headless check. Usage: node tools/phase9-check.cjs [path] [low|high] [WxH] [save.json]
// Charter vs Commons (hamlet, checks, permanent outcome, companion approval, stall), Warband Siege (party caps, mechanics, lockout); save v18+.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='390x844',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});
 await p.evaluate(s=>{localStorage.clear();if(s)localStorage.setItem('gielinor3d',s);},savef?fs.readFileSync(savef,'utf8'):null);
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async()=>{const g=window.gielinor,P=g.player,E=g.EXT,S=ms=>new Promise(r=>setTimeout(r,ms)),o={};
  for(const k of ['Attack','Strength','Defence','Hitpoints','Ranged','Magic','Prayer']){g.skills[k].level=99;}
  // Charter vs Commons
  const C=E.charter,startSide=P.charter.side;o.npcs=g.nodes.filter(n=>n.ext==='charter').length===2;
  o.crowd=g.nodes.filter(n=>n.npc!=='brannoch'&&n.npc!=='ysmay'&&n.x!=null&&Math.hypot(n.x-40,n.z-90)<10).length;
  if(!startSide){o.script=E.extTalk.charter.talk(g.nodes.find(n=>n.npc==='ysmay')).length===2;
   o.deal=C.resolve('deal');o.once=C.resolve('charter')===false;o.both=P.charter.rep.charter>0&&P.charter.rep.commons>0;
   o.stall=C.stall().length>0;}else{o.script=o.deal=o.once=o.both=o.stall=true;}
  let hiC=0;g.scene.traverse(x=>{if(/wellmere/.test(x.name)&&/high/.test(x.name))hiC++;});o.hiC=hiC;
  // Warband Siege
  if(E.siege){const W=E.siege;o.enter=W.enter();await S(800);o.inSiege=g.pm.mesh.position.x<-700;
   o.friendCap=W.friends().length<=8&&W.friends().length>=4;o.hostCap=W.hostiles().length<=10;
   o.fire=W.mech('fire');o.stack=W.mech('stack');
   for(let i=0;i<8&&W.run;i++){for(const m of W.hostiles())g.killMonster(m,performance.now());await S(250);W.tick();await S(250);}
   o.cleared=P.siege.downed.length===4;o.locked=W.enter()===false;await S(2500);o.out=g.pm.mesh.position.x>-700;}
  const sv=JSON.parse((await import('/js/save.js')).getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  o.saved=!!sv.player.charter.side&&(!E.siege||sv.player.siege.downed.length===4);o.skillsKept=g.skills.Attack.level;
  return o;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.npcs&&r.crowd===0&&r.script&&r.deal&&r.once&&r.both&&r.stall&&r.ver>=18&&r.saved&&(tier!=='low'||r.hiC===0)
  &&(r.enter===undefined||(r.enter&&r.inSiege&&r.friendCap&&r.hostCap&&r.fire&&r.stack&&r.cleared&&r.locked&&r.out))
  &&(tier!=='low'||hi.length===0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
