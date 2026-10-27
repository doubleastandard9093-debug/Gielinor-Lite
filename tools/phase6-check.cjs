// Phase 6 (Wanderer's Horizons part 1) headless check. Usage: node tools/phase6-check.cjs [path] [low|high] [WxH] [save.json]
// Silver Tongue checks, Quirks, Daily Writs, Stillwatch; save v15+; old saves migrate; Low loads no High assets.
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
  const pick=(scr,re)=>{for(const x of scr){if(x&&x.choose){const c=x.choose.find(c=>re.test(c[0]));if(c)return c;}}return null;};
  // Silver Tongue
  g.skills.Prayer.level=99;P.quests.hilda_pie=P.quests.hilda_pie||{stage:0};const g0=P.gold;
  let c=pick(g.tongueWrap({npc:'hilda'},[]),/Persuade/);o.tongueOpt=!!c;if(c)c[1][0].run();
  o.tonguePass=P.tongue.done['q:hilda_pie']==='pass'&&P.gold>g0;o.tongueOnce=!pick(g.tongueWrap({npc:'hilda'},[]),/Persuade/);
  // Quirks
  if(E.quirks){const Q=E.quirks;Q.bump('deaths',99);Q.offerDue();const off=P.quirks.offered;o.quirkOffer=!!off;
   if(off){Q.accept(off);o.quirkHeld=P.quirks.held.includes(off);o.quirkMax=Q.max;}o.ysolde=!!g.nodes.find(n=>n.ext==='quirks')&&E.extTalk.quirks.talk().length===2;}
  // Daily Writs
  if(E.writs){const W=E.writs;W.roll();o.writs=P.writs.daily.length;const wr=P.writs.daily[0];const r0=JSON.stringify(P.rep);
   W.progress(wr.kind,wr.target,wr.n);o.writDone=P.writs.daily[0].done===true;o.writRep=JSON.stringify(P.rep)!==r0;o.weekly=!!P.writs.weekly;}
  // Stillwatch
  if(E.still){const St=E.still;St.fill(100);o.stillReady=St.ready();St.trigger(performance.now());o.stillOn=St.active(performance.now());o.timeScale=St.scale(performance.now());
   let hi=0;g.scene.traverse(x=>{if(/stillwatch-high/.test(x.name))hi++;});o.stillHigh=hi+(document.getElementById('stillwatchTint')?.dataset.high==='1'?1:0);}
  const sv=JSON.parse((await import('/js/save.js')).getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  o.saved=!!(sv.player.tongue&&sv.player.tongue.done['q:hilda_pie'])&&(!E.quirks||sv.player.quirks.held.length>0)&&(!E.writs||sv.player.writs.daily.length===3);
  o.notes=(await import('/js/save.js')).applySaveData.lastNotes.length;o.hp=P.hp>0;o.skillsKept=g.skills.Attack.level;
  return o;});
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.tongueOpt&&r.tonguePass&&r.tongueOnce&&r.ver>=15&&r.saved&&(r.quirkOffer!==false)&&(r.quirkHeld!==false)&&(r.ysolde!==false)&&(r.writs===undefined||(r.writs===3&&r.writDone&&r.writRep&&r.weekly))&&(r.stillReady===undefined||(r.stillReady&&r.stillOn&&r.timeScale<0.5&&(tier!=='low'||r.stillHigh===0)))&&(tier!=='low'||hi.length===0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
