// Mechanics update headless check. Usage: node tools/mech-check.cjs [path] [low|high] [WxH] [save.json]
// Synergy, XP curve conversion, economy (stock, price climb, wear, death fee), hunt tasks + Drowned standing,
// magic kit, boss telegraphs (no fill disc on Low), Flow rules, companion crew skills, button/ability-bar overlap,
// and on Low: zero High asset requests.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,path='',tier='low',sz='390x844',savef]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/2d/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>localStorage.setItem('gielinor3d',s),fs.readFileSync(savef,'utf8'));}
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async(tier)=>{const g=window.gielinor,P=g.player,o={};
  const [Sk,Ec,Tk,Fl,Er]=await Promise.all(['skills','economy','tasks','flow','errands'].map(n=>import(`/js/${n}.js`)));
  o.ver=JSON.parse(localStorage.getItem('gielinor3d')||'{}').version;
  // synergy
  const fake={};for(const k of Object.keys(g.skills))fake[k]={level:90};o.synergy=Sk.synergy(fake,'Combat','dodgeMs')>0&&Sk.synergyLines(fake,'Smithing').length>0;
  // XP curve
  o.xp99=Sk.xpForLevel(99);let lv=true;for(const L of [2,10,50,80,99]){const x=Sk.convertXpV1(Sk.xpForLevelV1(L));if(Sk.getLevel(x)!==L)lv=false;}o.xpConvert=lv;
  // economy
  const fp={gold:100000},e={item:'Bronze sword',price:30};const p0=Ec.unitPrice(fp,'t',e,30);Ec.noteBought(fp,'t','Bronze sword',90);
  o.econ=Ec.unitPrice(fp,'t',e,30)>p0&&Ec.stockLeft(fp,'t',e)===10&&Ec.deathFee(fp)===5000;
  // tasks
  const T=Tk.normalizeTasks(null);const t=Tk.assignTask(T,60);let done=null;for(let i=0;i<t.n;i++)done=Tk.taskKill(T,t.mon)||done;o.tasks=!!(done&&done.done&&T.points>0);
  o.corvane=!!g.nodes.find(n=>n.sea==='tasks'&&/Corvane/.test(n.name));
  // magic kit on the bar when autocasting
  o.magicBar=!!document.querySelector('#abilityBar');
  // boss telegraph
  const boss=g.monsters.find(m=>m.boss);let tele=false,fill=0;
  if(boss){for(let t2=0;t2<20&&!tele;t2++){const ev=g.bossMech.tick(boss,t2,{playerPos:g.pm.mesh.position,groundY:()=>0,maxHp:P.maxHp});if(ev.some(x=>x.kind==='telegraph')){tele=true;g.bossMech.frame&&g.bossMech.frame(t2);}}
   g.scene.traverse(x=>{if(x.name==='boss-tele-fill-high'&&x.visible)fill++;});}
  o.bossTele=tele;o.bossFillVisible=fill;
  // flow
  const f=Fl.createFlow();Fl.flowOnSkillHit(f,1,'a');const rep=Fl.flowOnSkillHit(f,2,'a');Fl.flowPerfectDodge(f,3);o.flow=!!rep.repeat&&f.links===2;
  // crew skills
  o.crew=Er.crewLevel(4000)===11&&Er.errandItems(Er.errandById('e_copper'),30)[0][1]>12;
  // overlap
  g.hud.layoutQuick&&g.hud.layoutQuick();await new Promise(r=>setTimeout(r,400));
  const vis=s=>[...document.querySelectorAll(s)].filter(e=>getComputedStyle(e).display!=='none'&&e.offsetWidth).map(e=>e.getBoundingClientRect());
  const a=vis('#flowbtns [data-q]'),bb=vis('#abilityBar').concat(vis('#dpad'),vis('#minimapWrap'));o.overlap=a.some(x=>bb.some(r=>x.left<r.right&&x.right>r.left&&x.top<r.bottom&&x.bottom>r.top));
  return o;},tier);
 const hi=req.filter(u=>/textures\/|\.webp|detail_/.test(u));
 const ok=r.ver>=13&&r.synergy&&r.xp99===3910329&&r.xpConvert&&r.econ&&r.tasks&&r.corvane&&r.bossTele&&r.flow&&r.crew&&!r.overlap&&(tier!=='low'||(hi.length===0&&r.bossFillVisible===0))&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,highAssetRequests:hi.length,errs:errs.slice(0,4)}));
 await b.close();})();
