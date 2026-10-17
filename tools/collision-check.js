// Building collision check (dev tool, not loaded by the game). Serve the repo root, then:
//   NODE_PATH=<dir with puppeteer-core> node tools/collision-check.js <port> [/ | /webgpu/]   (HIGH=1 also checks the High meadow)
// For every building it walks into and out of every wall at 25 points per face (straight-line moves of 5 cm, 62 cm
// and 1 m, plus the real updatePlayer at 60 fps and at a 10 fps lag spike while running), sweeps 8 directions from a
// grid of points inside, and checks the door can be walked in and out. Any crossing that is not through the door
// opening fails the building. It also counts grass and ground clutter standing inside building footprints.
// usage: node probe.js [port] [path]
const p=require('puppeteer-core');(async()=>{
const port=process.argv[2]||'8877', path=process.argv[3]||'/';
const b=await p.launch({executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage();await pg.setViewport({width:640,height:400});const errs=[];
pg.on('pageerror',e=>errs.push('PE '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
await pg.goto(`http://127.0.0.1:${port}${path}?v=${Date.now()}`);await pg.waitForFunction(()=>window.gielinor&&window.gielinor.pm,{timeout:90000});
if(process.env.HIGH){await pg.evaluate(()=>{window.gielinor.setGfx('high');const p=window.gielinor.pm.mesh.position;p.x=7;p.z=8;});}
await new Promise(r=>setTimeout(r,process.env.HIGH?8000:3000));
let res=await pg.evaluate(async(path)=>{
  const base=path.includes('webgpu')?'../../js/':'/js/';
  const P=await import(new URL(path.includes('webgpu')?'/js/player.js':'/js/player.js',location.href).href);
  const W=await import(new URL('/js/world.js',location.href).href);
  const g=window.gielinor, pm=g.pm, pos=pm.mesh.position, save={x:pos.x,z:pos.z};
  const raw=(q,dx,dz,s)=>{ if(P.moveWithCollision) return P.moveWithCollision(q,dx,dz,s); q.x+=dx*s;q.z+=dz*s;P.resolveCollisions(q); };
  const out=[];const T=0.18;
  for(const B of g.buildings.filter(b=>b&&b.inner&&b.door)){
    const I=B.inner, d=B.door, fails=[];
    const inside=(x,z)=>x>I.minX+0.05&&x<I.maxX-0.05&&z>I.minZ+0.05&&z<I.maxZ-0.05;
    // door span: along the door face, |lateral|<DOOR/2
    const inDoor=(x,z)=>Math.abs((x-d.x)*d.nz)+Math.abs((z-d.z)*d.nx)<0.575+0.02;
    const cx=(I.minX+I.maxX)/2, cz=(I.minZ+I.maxZ)/2;
    const faces=[[0,-1],[0,1],[-1,0],[1,0]];
    for(const [nx,nz] of faces){
      const isDoor=nx===d.nx&&nz===d.nz;
      const half=nx?(I.maxZ-I.minZ)/2:(I.maxX-I.minX)/2, faceC=nx?(nx>0?I.maxX:I.minX):(nz>0?I.maxZ:I.minZ);
      for(let k=0;k<=24;k++){
        const lat=-half-0.3+(2*half+0.6)*k/24;
        const fx=nx?faceC:cx+lat, fz=nx?cz+lat:faceC;
        if(isDoor&&inDoor(fx,fz)) continue; // the opening itself
        for(const dir of [1,-1]){ // 1: outside->in, -1: inside->out
          for(const mode of ['raw0.05','raw0.62','raw1.0','up60','up10']){
            const sx=fx+nx*dir*1.4, sz=fz+nz*dir*1.4; // start 1.4 out (dir 1) or 1.4 in (dir -1)
            const q={x:sx,z:sz};
            if(dir===-1&&!inside(sx,sz)) continue;
            if(P.blockedAt(sx,sz)) continue;
            const mx=-nx*dir, mz=-nz*dir; let crossed=null;
            const wasIn=inside(sx,sz);
            if(mode.startsWith('raw')){ const s=+mode.slice(3); for(let i=0;i<Math.ceil(3/s);i++){ const px=q.x,pz=q.z; raw(q,mx,mz,s); if(inside(q.x,q.z)!==inside(px,pz)&&!crossed) crossed=[px,pz,q.x,q.z]; } }
            else { const dt=mode==='up60'?1/60:0.1; pos.x=sx;pos.z=sz; pm.target={x:sx+mx*3,z:sz+mz*3,walk:true}; pm.stopDist=0.1; pm.steerSide=0;
              for(let i=0;i<Math.ceil(2.5/(6.2*dt))+4&&pm.target;i++){ const px=pos.x,pz=pos.z; P.updatePlayer(pm,{},dt,true,0); if(inside(pos.x,pos.z)!==inside(px,pz)&&!crossed) crossed=[px,pz,pos.x,pos.z]; }
              q.x=pos.x;q.z=pos.z; }
            if(crossed){ let [ax,az,bx,bz]=crossed; const ain=inside(ax,az); for(let it=0;it<30;it++){ const mx2=(ax+bx)/2,mz2=(az+bz)/2; if(inside(mx2,mz2)===ain){ax=mx2;az=mz2;} else {bx=mx2;bz=mz2;} }
              const onFace=Math.abs((ax-d.x)*d.nx+(az-d.z)*d.nz)<0.2; const ok=inDoor(ax,az)&&onFace; crossed.push(+ax.toFixed(2),+az.toFixed(2)); if(!ok) fails.push({face:[nx,nz],lat:+lat.toFixed(2),dir,mode,from:[+sx.toFixed(2),+sz.toFixed(2)],to:[+q.x.toFixed(2),+q.z.toFixed(2)],at:crossed.slice(4)}); }
          }
        }
      }
    }
    // interior sweep: from a grid of free points inside, run 3 m in 8 directions (60 fps and 10 fps); leaving is only allowed via the door
    for(let gx=0.15;gx<1;gx+=0.17) for(let gz=0.15;gz<1;gz+=0.17){ const sx=I.minX+(I.maxX-I.minX)*gx, sz=I.minZ+(I.maxZ-I.minZ)*gz; if(P.blockedAt(sx,sz)||!inside(sx,sz)) continue;
      for(let a=0;a<8;a++) for(const dt of [1/60,0.1]){ const mx=Math.cos(a*Math.PI/4), mz=Math.sin(a*Math.PI/4); pos.x=sx;pos.z=sz; pm.target={x:sx+mx*3,z:sz+mz*3,walk:true}; pm.stopDist=0.1; pm.steerSide=0; let crossed=null;
        for(let i=0;i<Math.ceil(3/(6.2*dt))+4&&pm.target;i++){ const px=pos.x,pz=pos.z; P.updatePlayer(pm,{},dt,true,0); if(!inside(pos.x,pos.z)&&!crossed) crossed=[px,pz,pos.x,pos.z]; }
        if(crossed){ let [ax,az,bx,bz]=crossed; for(let it=0;it<30;it++){ const mx2=(ax+bx)/2,mz2=(az+bz)/2; if(inside(mx2,mz2)){ax=mx2;az=mz2;} else {bx=mx2;bz=mz2;} }
          const onFace=Math.abs((ax-d.x)*d.nx+(az-d.z)*d.nz)<0.2; if(!(inDoor(ax,az)&&onFace)) fails.push({mode:'sweep'+(dt>0.05?10:60),dir:-1,from:[+sx.toFixed(2),+sz.toFixed(2)],at:[+ax.toFixed(2),+az.toFixed(2)]}); } } }
    // door must be passable: walk straight in through the door centre and back out
    const dq={x:d.x+d.nx*1.5,z:d.z+d.nz*1.5}; for(let i=0;i<60;i++) raw(dq,-d.nx,-d.nz,0.05); const doorIn=inside(dq.x,dq.z);
    for(let i=0;i<60;i++) raw(dq,d.nx,d.nz,0.05); const doorOut=!inside(dq.x,dq.z);
    // updatePlayer route in at dt 0.1 and 1/60
    let doorUp=true; for(const dt of [1/60,0.1]){ pos.x=d.x+d.nx*1.5; pos.z=d.z+d.nz*1.5; pm.target={x:d.x-d.nx*1.2,z:d.z-d.nz*1.2,walk:true}; pm.stopDist=0.1; for(let i=0;i<200&&pm.target;i++) P.updatePlayer(pm,{},dt,true,0); if(!inside(pos.x,pos.z)) doorUp=false; }
    out.push({name:B.name,x:B.x,z:B.z,door:[d.nx,d.nz],fails:fails.length,doorIn,doorOut,doorUp,sample:fails.slice(0,4),modes:fails.reduce((a,f)=>(a[f.mode+(f.dir>0?'in':'out')]=(a[f.mode+(f.dir>0?'in':'out')]||0)+1,a),{}),up60:fails.filter(f=>f.mode.startsWith('up')).slice(0,3)});
  }
  // ground clutter inside building footprints (any InstancedMesh whose instances stand inside a footprint, below 1.2 m)
  const fps=g.buildings.filter(b=>b&&b.inner).map(b=>b.inner); const m4=new (g.scene.children[0].matrix.constructor)(); let clutter=0; const kinds={};
  g.scene.traverse(o=>{ if(!o.isInstancedMesh||!(o.parent&&o.parent.type==='Group'&&o.parent!==g.scene||o.count>=1000)) return; /* decor chunks + near-player meadow, not torch glow decals or guild ore rocks */ for(let i=0;i<o.count;i++){ o.getMatrixAt(i,m4); const e=m4.elements; if(e[0]===0&&e[5]===0) continue; const x=e[12],z=e[14],y=e[13];
    if(y<1.2&&fps.some(f=>x>f.minX+0.05&&x<f.maxX-0.05&&z>f.minZ+0.05&&z<f.maxZ-0.05)){ clutter++; kinds[o.name||o.geometry.type]=(kinds[o.name||o.geometry.type]||0)+1; } } });
  const clut={clutter,kinds};
  pos.x=save.x;pos.z=save.z;pm.target=null;
  return {out,clut};
},path);
const clut=res.clut;res=res.out;let bad=0;for(const r of res){const f=r.fails||!r.doorIn||!r.doorOut||!r.doorUp; if(f) bad++; console.log((f?'FAIL ':'ok   ')+r.name.padEnd(28)+` fails=${r.fails} doorIn=${r.doorIn} doorOut=${r.doorOut} doorWalk=${r.doorUp}`+' '+JSON.stringify(r.modes)+(r.up60.length?' up60:'+JSON.stringify(r.up60):''));}
console.log('BUILDINGS',res.length,'FAILED',bad);console.log('CLUTTER_IN_FOOTPRINTS',JSON.stringify(clut));console.log('ERR',JSON.stringify(errs));await b.close();})();
