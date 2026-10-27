// Phase 7 (Wanderer's Horizons part 2) headless check. Usage: node tools/phase7-check.cjs [path] [low|high] [WxH] [save.json]
// Combat Paths + talents, Delves of Three (roles, rooms, bosses), Stable Codex (mounts, skyrook flights, wardrobe); save v16+; Low strictness.
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
  // Combat Paths
  const X=E.paths;o.pathChoose=X.choose('striker');o.rend=g.ABIL_UNLOCKED('rend')&&!g.ABIL_UNLOCKED('wall');
  for(let i=0;i<7;i++)X.pick(i,1);o.rows=P.path.talents.filter(v=>v!=null).length;o.fxDmg=X.fx().dmg>0.1;
  X.choose('mender');P.hp=Math.max(1,Math.floor(P.maxHp/2));const h0=P.hp;g.useAbility('mend');o.mend=P.hp>h0&&P.path.switches===1;
  o.idris=!!g.nodes.find(n=>n.ext==='paths')&&E.extTalk.paths.talk().length===2;
  // Delves of Three
  if(E.delves){const D=E.delves;o.delveEnter=D.enter('sewers','healer');await S(800);o.inDelve=g.pm.mesh.position.x<-700;o.roomFoes=D.alive().length;o.foeCap=o.roomFoes<=8;
   for(let room=0;room<5&&D.run;room++){for(const m of D.alive())g.killMonster(m,performance.now());await S(300);D.tick();await S(300);}
   o.delveClear=P.delves.clears.sewers===1;await S(2500);o.delveOut=g.pm.mesh.position.x>-700;}
  // Stable Codex
  if(E.codex){const C=E.codex;o.mounts=C.mounts().length>=2;P.codex.skyrook=true;o.fly=C.fly('Brightwater','Varrock');await S(500);o.flying=!!C.flight;C.finish();o.landed=Math.hypot(g.pm.mesh.position.x-120,g.pm.mesh.position.z+40)<20;
   P.equipment.body=P.equipment.body||null;P.codex.seen.push('Rune platebody');o.look=C.setLook('body','Rune platebody');o.wardrobe=P.codex.looks.body==='Rune platebody';
   let hi=0;g.scene.traverse(x=>{if(/skyrook-high|delve-high/.test(x.name))hi++;});o.hiMesh=hi;}
  const sv=JSON.parse((await import('/js/save.js')).getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  o.saved=sv.player.path.id==='mender'&&sv.player.path.talents.length===7&&(!E.delves||sv.player.delves.clears.sewers===1)&&(!E.codex||!!sv.player.codex.looks.body);
  o.skillsKept=g.skills.Attack.level;
  g.refreshQuick();g.hud.layoutQuick&&g.hud.layoutQuick();await S(300);const vis=q=>[...document.querySelectorAll(q)].filter(e=>getComputedStyle(e).display!=='none'&&e.offsetWidth).map(e=>e.getBoundingClientRect());const a=vis('#flowbtns [data-q]'),bb=vis('#abilityBar').concat(vis('#dpad'),vis('#minimapWrap'));o.overlap=a.some(x=>bb.some(r=>x.left<r.right&&x.right>r.left&&x.top<r.bottom&&x.bottom>r.top));
  return o;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.pathChoose&&r.rend&&r.rows===7&&r.fxDmg&&r.mend&&r.idris&&r.ver>=16&&r.saved&&!r.overlap&&(r.delveEnter===undefined||(r.delveEnter&&r.inDelve&&r.roomFoes>0&&r.foeCap&&r.delveClear&&r.delveOut))&&(r.mounts===undefined||(r.mounts&&r.fly&&r.flying&&r.landed&&r.look&&r.wardrobe&&(tier!=='low'||r.hiMesh===0)))&&(tier!=='low'||hi.length===0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
