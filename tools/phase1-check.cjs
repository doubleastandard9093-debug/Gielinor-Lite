// Phase 1 (Bonds & Choices) headless check. Usage: node tools/phase1-check.cjs [path] [low|high] [WxH] [save.json]
// Checks: save version, 4 companions + quartermaster spawned, recruit/follow/assist, XP perk, standing, errands,
// Bonds panel, and on Low that companions use the normal NPC LOD (no rig beyond the Low 14 m range) and no High textures are requested.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='390x844',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
const S=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>localStorage.setItem('gielinor3d',s),fs.readFileSync(savef,'utf8'));}
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await S(15000);
 const r1=await p.evaluate(()=>{const g=window.gielinor,P=g.player;const comps=g.nodes.filter(n=>n.companion).map(n=>n.companion);
   const qm=!!g.nodes.find(n=>n.standing);const ver=JSON.parse(localStorage.getItem('gielinor3d')||'{}').version;
   const s=P.companions.tamsin;s.recruited=true;s.bond=6;g.setCompanion('tamsin');const xp0=g.skills.Defence.xp;g.giveXP('Defence',100);
   const m=g.monsters.filter(m=>m.alive).sort((a,b)=>Math.hypot(a.mesh.position.x-g.pm.mesh.position.x,a.mesh.position.z-g.pm.mesh.position.z)-Math.hypot(b.mesh.position.x-g.pm.mesh.position.x,b.mesh.position.z-g.pm.mesh.position.z))[0];
   window._m=m;m.hp=m.maxHp=9999;const mp=m.mesh.position;g.pm.mesh.position.set(mp.x+1.2,g.terrainHeight(mp.x+1.2,mp.z),mp.z);g.startAction({kind:'attack',mon:m});window._hp0=m.hp;
   return{ver,comps,qm,defXpGain:+(g.skills.Defence.xp-xp0).toFixed(1),hasRep:typeof P.rep==='object',errands:Array.isArray(P.errands)};});
 await S(20000);
 const r2=await p.evaluate(()=>{const g=window.gielinor,e=g.compEnts.tamsin,pp=g.pm.mesh.position;
   const ents=Object.values(g.compEnts);return{followDist:+Math.hypot(e.mesh.position.x-pp.x,e.mesh.position.z-pp.z).toFixed(1),monDamage:window._hp0-window._m.hp,hiRigsFar:ents.filter(n=>n.lod&&n.lod.hi&&Math.hypot(n.mesh.position.x-pp.x,n.mesh.position.z-pp.z)>14).length,gfx:g.gfxQ};});
 const r3=await p.evaluate(async()=>{const g=window.gielinor,P=g.player,W=ms=>new Promise(r=>setTimeout(r,ms));P.companions.ysolde.recruited=true;
   g.bondsUI.open('err');await W(400);const bd=document.getElementById('bonds');bd.querySelector('[data-a="send"][data-e="e_copper"]').click();await W(300);const n=P.errands.length;
   P.errands[0].end=Date.now()-1;P.errands[0].ok=true;const c0=(P.bank['Copper ore']||0);g.finishErrands();const gain=(P.bank['Copper ore']||0)-c0;g.bondsUI.close();
   return{errandStarted:n,bankGain:gain,watchRep:P.rep.watch||0};});
 await p.evaluate(()=>{window.gielinor.player.lastSave=0;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r1.comps.length===4&&r1.qm&&r2.followDist<6&&r2.monDamage>0&&r3.bankGain===12&&(tier!=='low'||(r2.hiRigsFar===0&&hi.length===0))&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r1,r2,r3,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
