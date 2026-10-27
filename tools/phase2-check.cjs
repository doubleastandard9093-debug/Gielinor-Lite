// Phase 2 (Flow & Steeds) headless check. Usage: node p2check.cjs [path] [low|high] [WxH] [save.json]
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='1280x800',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>localStorage.setItem('gielinor3d',s),fs.readFileSync(savef,'utf8'));}
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r1=await p.evaluate(()=>{const g=window.gielinor;const s=g.skills;if(s.Agility.level<30){s.Agility.level=30;s.Agility.xp=99999;}g.checkSteeds();
   const owned=[...g.player.steeds.owned];g.player.steeds.lastRide='boar';g.toggleRide();const id=g.steedState.id;const sp=g.player.runEnergy;
   const pos=g.pm.mesh.position;return{q:g.gfxQ,ver:JSON.parse(localStorage.getItem('gielinor3d')||'{}').version,owned,riding:id,x:pos.x,z:pos.z,re:sp,btns:document.querySelectorAll('#flowbtns button').length};});
 await new Promise(r=>setTimeout(r,800));
 const r2=await p.evaluate(()=>{const g=window.gielinor;g.steedShift();return{bul:g.steedState.bulwarkUntil>performance.now()}});
 await p.waitForFunction(()=>!window.gielinor.pm.dodge,{timeout:60000,polling:250}).catch(()=>{});await new Promise(r=>setTimeout(r,3000));
 const r3=await p.evaluate(()=>{const g=window.gielinor;const a=!!g.scene.getObjectByName('bulwark-armor-high');const pos=g.pm.mesh.position;const seat=pos.y;g.toggleRide();return{armorHigh:a,afterShiftX:pos.x,afterShiftZ:pos.z,riddenAfterOff:g.steedState.id,steedInScene:!!g.scene.getObjectByName('steed-boar')}});
 const before=await p.evaluate(()=>{const g=window.gielinor;g.player.runEnergy=100;const P=g.pm.mesh.position;return[P.x,P.z]});
 await p.keyboard.press(' '); await new Promise(r=>setTimeout(r,300)); await p.waitForFunction(()=>!window.gielinor.pm.dodge,{timeout:60000,polling:250}).catch(()=>{});
 const r4=await p.evaluate(()=>{const g=window.gielinor;const P=g.pm.mesh.position;return{x:P.x,z:P.z,re:g.player.runEnergy,flowBest:g.player.flowBest||0,keys:Object.keys(g.flow)}});
 const moved=Math.hypot(r4.x-before[0],r4.z-before[1]);
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 console.log(JSON.stringify({tier,path,r1,r2,r3,dodgeMoved:+moved.toFixed(2),dodgeEnergy:r4.re,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
