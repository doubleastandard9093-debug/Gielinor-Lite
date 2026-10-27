// Phase 5 (Hearth & Arena) headless check. Usage: node tools/phase5-check.cjs [path] [low|high] [WxH] [save.json]
// Buys a Hearthstead deed, enters the instance, builds all rooms and furniture, harvests; wins and loses a
// Proving Grounds duel; captures a Contested Wilds banner; checks the save (v14, instance position redirected)
// and quick-button overlap. On Low: no hearth/arena lights, raiders capped at 3, and no High asset requests.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='390x844',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>localStorage.setItem('gielinor3d',s),fs.readFileSync(savef,'utf8'));}
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async()=>{const g=window.gielinor,P=g.player,S=ms=>new Promise(r=>setTimeout(r,ms)),o={};
  for(const k in g.skills){if(g.skills[k].level<60){g.skills[k].level=60;}}
  P.gold=500000;P.bank=P.bank||{};Object.assign(P.bank,{'Oak logs':100,'Iron bar':50,'Steel bar':30,'Logs':50,'Cowhide':10});
  // Hearthstead
  const ag=g.nodes.find(n=>n.hearth==='agent');let s=g.hearthTalk(ag);s[1].choose[0][1][0].run();o.deed=P.house.deed;
  g.enterHearth();await S(400);o.inHouse=g.pm.mesh.position.x<-900;
  const st=g.nodes.find(n=>n.hearth==='stone');
  for(let i=0;i<4;i++){s=g.hearthTalk(st);s[1].choose[0][1][0].choose[0][1][0].run();}
  for(let i=0;i<8;i++){s=g.hearthTalk(st);const f=s[1].choose.find(c=>/furniture/.test(c[0]));if(f)f[1][0].choose[0][1][0].run();}
  o.rooms=P.house.rooms.length;o.furn=P.house.furniture.length;
  s=g.hearthTalk(st);o.harvest=/Grimy/.test(s[1].choose.find(c=>/Harvest/.test(c[0]))[1][0].run()[0][1]);
  // Proving Grounds
  const sefa=g.nodes.find(n=>n.arena==='master');g.pm.mesh.position.set(sefa.x+2,0,sefa.z);
  s=g.arenaTalk();s[1].choose[0][1][0].run();await S(2000);
  const m=g.duellist;o.duelIn=g.pm.mesh.position.x<-900&&m.alive;g.killMonster(m,performance.now());await S(2500);
  o.win=P.arena.wins===1&&P.arena.tokens>=10&&g.pm.mesh.position.x>0;
  s=g.arenaTalk();s[1].choose[0][1][0].run();await S(1500);const g0=P.gold;g.playerDied();await S(800);
  o.loss=P.arena.losses===1&&P.gold===g0&&g.pm.mesh.position.x>0;
  // Contested Wilds
  g.pm.mesh.position.set(122,0,-100);await S(2500);o.raiders=g.wilds.raiders.filter(x=>x.alive).length;
  const f=g.wilds.flags[0];for(const x of g.wilds.raiders)if(x.alive)g.killMonster(x,performance.now());g.wilds.lastRaid=1e9;
  g.pm.mesh.position.set(f.x+0.5,0,f.z);await S(7000);o.captured=P.wilds.held[0]==='you';
  // save
  g.enterHearth();await S(300);
  const sv=JSON.parse((await import('/js/save.js')).getSaveData(g.skills,P,g.pm));
  o.ver=sv.version;o.saved=!!(sv.player.house&&sv.player.house.rooms.length===4&&sv.player.arena.wins===1&&sv.player.wilds.held[0]==='you')&&sv.position.x>-300;
  let hi=0;g.scene.traverse(x=>{if(/(hearth|arena)-light-high/.test(x.name))hi++;});o.hiLights=hi;
  g.hud.layoutQuick&&g.hud.layoutQuick();await S(400);
  const vis=q=>[...document.querySelectorAll(q)].filter(e=>getComputedStyle(e).display!=='none'&&e.offsetWidth).map(e=>e.getBoundingClientRect());
  const a=vis('#flowbtns [data-q]'),bb=vis('#abilityBar').concat(vis('#dpad'),vis('#minimapWrap'));o.overlap=a.some(x=>bb.some(r=>x.left<r.right&&x.right>r.left&&x.top<r.bottom&&x.bottom>r.top));
  return o;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.deed&&r.inHouse&&r.rooms===4&&r.furn===8&&r.harvest&&r.duelIn&&r.win&&r.loss&&r.captured&&r.saved&&r.ver>=14&&!r.overlap&&(tier!=='low'||(hi.length===0&&r.hiLights===0&&r.raiders<=3))&&(tier==='low'||r.hiLights>0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
