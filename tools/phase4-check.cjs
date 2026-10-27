// Phase 4 (Sails of Sarim) headless check. Usage: node tools/phase4-check.cjs [path] [low|high] [WxH] [save.json]
// Buys a Sloop via the Shipwright dialogue, sails, fires a broadside and sinks a Drowned ship, goes ashore, reads and digs a
// treasure chart, plays both card tables, fires a flintlock, casts a hex, checks saga/sea map marks and quick-button overlap.
// On Low: no cloth sails (sail-high), no textured ship/sea meshes and no High asset requests.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='390x844',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>localStorage.setItem('gielinor3d',s),fs.readFileSync(savef,'utf8'));}
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async()=>{const g=window.gielinor,P=g.player,S=ms=>new Promise(r=>setTimeout(r,ms)),d=document.getElementById('dialogue'),o={};
  const adv=async()=>{for(let i=0;i<30;i++){await S(200);if(d.style.display==='none'||d.dataset.kind!=='line')return d.dataset.kind;d.click();}};
  o.ver=JSON.parse(localStorage.getItem('gielinor3d')||'{}').version;o.vesselLoaded=!!P.vessel&&Array.isArray(P.vessel.charts);
  P.gold=60000;P.vessel.hull=0;const sw=g.nodes.find(n=>n.sea==='shipwright');g.talkTo(sw);let k=await adv();
  if(k==='choose'){[...d.querySelectorAll('.d-opt')][0].click();await adv();}o.hull=P.vessel.hull;
  o.sail=g.sailing.setSail();await S(1200);
  const overlap=()=>{const bs=[...document.querySelectorAll('#flowbtns [data-q]')].map(e=>e.getBoundingClientRect());const ob=['#dpad','#abilityBar','#minimapWrap','#chat'].map(s=>document.querySelector(s)).filter(e=>e&&getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect()).filter(r=>r.width*r.height>1);
    return bs.some(a=>ob.some(r=>a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top));};
  g.hud.layoutQuick();await S(500);o.seaButtons=[...document.querySelectorAll('#flowbtns [data-q]')].map(e=>e.dataset.q).join(',');o.seaOverlap=overlap();
  let sails=0,tex=0;g.scene.traverse(x=>{if(x.name==='sail-high')sails++;let pp=x;while(pp){if(/ship-|sarim-sound/.test(pp.name||'')){if(x.isMesh&&x.material&&x.material.map)tex++;break;}pp=pp.parent;}});o.sails=sails;o.seaTex=tex;
  g.sailing.ship.z=920;g.sailing.S.nextSpawn=0;for(let i=0;i<40&&!g.sailing.enemies.length;i++)await S(500);o.enemies=g.sailing.enemies.length;
  if(o.enemies){const sh=g.sailing.ship,e=g.sailing.enemies[0];e.x=sh.x+Math.cos(sh.yaw)*12;e.z=sh.z-Math.sin(sh.yaw)*12;e.hp=1;g.sailing.S.reload.port=0;g.sailing.fire('port');for(let i=0;i<40&&!P.vessel.sank;i++)await S(500);}o.sank=P.vessel.sank;
  const isl={id:'reef',name:"Wreckers' Reef",x:10,z:1120,r:22,dock:{x:10,z:1096},desc:''};g.sailing.goAshore(isl);await S(600);o.ashore=!g.sailing.atSea&&g.pm.mesh.position.y>1;
  P.inventory['Treasure chart']=1;g.readChart();for(let i=0;i<30&&!g.minimap.marks.length;i++)await S(500);o.chartMarked=P.vessel.charts.length===1&&g.minimap.marks.length>0;
  const c=P.vessel.charts[0];g.pm.mesh.position.set(c.x,1.3,c.z);P.tools=P.tools||{};P.tools.Spade=1;const g0=P.gold;g.digHere();o.dug=P.vessel.dug===1&&P.gold>g0;
  g.cardsUI.open('tides','Dealer Maris');g.cardsUI.act('deal');if(!g.cardsUI.state.done)g.cardsUI.act('stand');o.tides=!!g.cardsUI.state.done;
  g.cardsUI.open('crown','Dealer Quill');g.cardsUI.act('deal');g.cardsUI.act('draw');o.crown=!!g.cardsUI.state.done;g.cardsUI.close();
  g.sailing.homeToSarim();await S(500);o.home=g.pm.mesh.position.z<100;
  // styles + hex
  P.equipment.weapon='Iron flintlock';P.equipment.ammo='Lead shot';P.ammoCount=10;g.skills.Ranged.level=Math.max(10,g.skills.Ranged.level);
  const m=g.monsters.find(x=>x.alive&&(x.name==='Goblin'||x.name==='Cow'));g.pm.mesh.position.set(m.mesh.position.x+2,0,m.mesh.position.z);g.startAction({kind:'attack',mon:m});await S(7000);o.shot=P.ammoCount<10;
  P.equipment.weapon='Hexwood staff';P.inventory['Bog rune']=10;P.inventory['Mind rune']=10;g.skills.Magic.level=Math.max(20,g.skills.Magic.level);
  const m2=g.monsters.find(x=>x.alive&&x.name==='Cow');g.pm.mesh.position.set(m2.mesh.position.x+3,0,m2.mesh.position.z);g.startAction({kind:'attack',mon:m2,spell:'hex_rot'});await S(6000);o.hex=(P.hexCasts||0)>0;
  o.drownedCrew=g.monsters.filter(x=>x.drowned).length;o.ports=g.nodes.filter(n=>n.sea==='harbour').length;
  // land quick buttons (Dig) don't overlap
  P.vessel.charts=[{x:g.pm.mesh.position.x,z:g.pm.mesh.position.z,isl:'gullrest',tier:1}];g.refreshQuick();g.hud.layoutQuick();await S(500);o.landButtons=[...document.querySelectorAll('#flowbtns [data-q]')].map(e=>e.dataset.q).join(',');o.landOverlap=overlap();
  return o;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.vesselLoaded&&r.hull===1&&r.sail&&r.sank>=1&&r.ashore&&r.chartMarked&&r.dug&&r.tides&&r.crown&&r.home&&r.shot&&r.hex&&r.drownedCrew===8&&!r.seaOverlap&&!r.landOverlap&&(tier!=='low'||(hi.length===0&&r.sails===0&&r.seaTex===0))&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
