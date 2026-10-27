// Phase 8 (Action & Giants) headless check. Usage: node tools/phase8-check.cjs [path] [low|high] [WxH] [save.json]
// True Aim (shapes, multi-hit, dodge-cancel, classic default), Colossi (scale, parts, back bonus, one per area, chest), Skywing (unlock gate, flight, dive cost, draw distance); save v17+; Low strictness.
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
  for(const k of ['Attack','Strength','Defence','Hitpoints','Ranged','Magic','Prayer','Agility']){g.skills[k].level=99;}
  P.equipment.weapon=null;
  // True Aim
  const A=E.aim;o.classicDefault=P.aim.on===false;o.aimOn=A.toggle(true)===true;
  const px=g.pm.mesh.position.x,pz=g.pm.mesh.position.z;g.pm.facing=0;g.pm.mesh.rotation.y=0;
  const gs=[0,1,2].map(i=>g.spawnMonster('Goblin',px-1+i,pz+2.2,0));for(const m of gs){m.mesh.position.set(m.spawnX,0,m.spawnZ);}
  const far=g.spawnMonster('Goblin',px,pz-6,0);far.mesh.position.set(px,0,pz-6);
  o.multi=A.targets('cone').length>=3&&!A.targets('cone').includes(far);
  o.lineHit=A.targets('line').length>=1;
  o.strike=A.strike('flurry')>=3;o.cancel=A.window()>0;
  for(const m of [...gs,far]){m.alive=false;m.state='dead';m.respawnAt=0;m.mesh.visible=false;}
  A.toggle(false);
  // Colossi
  if(E.colossi){const C=E.colossi;o.colList=C.list().length===3;
   const m=C.wake('stonehorn');o.scale=m.mesh.scale.x>=3;o.big=m.maxHp>=3000;
   const m2=C.wake('stonehorn');o.oneArea=m2===m&&C.active().filter(x=>x.colossus.area==='north').length===1;
   m.mesh.rotation.y=0;o.back=C.backBonus(m,m.mesh.position.x,m.mesh.position.z-5)===0.2&&C.backBonus(m,m.mesh.position.x,m.mesh.position.z+5)===0;
   C.damagePart(m,'horn',99999);o.horn=m.parts.horn<=0&&m.noCharge===true;
   const t0=P.arena.tokens;g.killMonster(m,performance.now());await S(300);o.chest=P.colossi.kills.stonehorn===1&&P.arena.tokens>t0;
   let hi=0;g.scene.traverse(x=>{if(/colossus-high/.test(x.name))hi++;});o.hiMesh=hi;}
  // Skywing
  if(E.skywing){const W=E.skywing;o.gate=W.canUnlock()===false;
   P.rep=P.rep||{};P.rep.watch=2000;o.unlock=W.canUnlock()===true&&W.unlock();
   o.fly=W.toggle(true)===true;await S(400);o.lift=g.pm.rideLift>=6;o.far=g.camera.far<=420;
   P.runEnergy=50;const e0=P.runEnergy,h0=W.alt();W.dive();o.dive=P.runEnergy<e0&&W.alt()<h0;
   W.climb();o.climb=W.alt()<=30;W.toggle(false);await S(200);o.landed=g.pm.rideLift===0&&g.camera.far>420;
   let hi=0;g.scene.traverse(x=>{if(/skywing-high|skyrook-high/.test(x.name))hi++;});o.hiSky=hi;}
  const sv=JSON.parse((await import('/js/save.js')).getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  o.saved=sv.player.aim.strikes>=1&&(!E.colossi||sv.player.colossi.kills.stonehorn===1)&&(!E.skywing||sv.player.skywing.unlocked===true);
  o.skillsKept=g.skills.Attack.level;
  return o;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.classicDefault&&r.aimOn&&r.multi&&r.lineHit&&r.strike&&r.cancel&&r.ver>=17&&r.saved
  &&(r.colList===undefined||(r.colList&&r.scale&&r.big&&r.oneArea&&r.back&&r.horn&&r.chest&&(tier!=='low'||r.hiMesh===0)))
  &&(r.gate===undefined||(r.gate&&r.unlock&&r.fly&&r.lift&&r.far&&r.dive&&r.climb&&r.landed&&(tier!=='low'||r.hiSky===0)))
  &&(tier!=='low'||hi.length===0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
