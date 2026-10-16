# Engine notes: Three.js (TSL) vs Babylon.js vs PlayCanvas for the WebGPU release

*Written October 2026 for Gielinor-Lite. Three.js r180 is pinned in `webgpu/index.html`.*

## What the project needs
- One shared codebase: the root WebGL game and `webgpu/` share about 25k lines of game logic, world gen, models and UI (`js/*.js`). `webgpu/tools/build-main.mjs` rebuilds the WebGPU entry point from the root one.
- Procedural everything (no art files): geometry built in code, materials written as shader graphs.
- Chunk streaming, many instanced props, lots of small dynamic lights, volumetric fog and light, and compute VFX.
- Consoles and PC on High. Phones must still run (WebGL2 fallback, Low).

## Comparison

| | Three.js r180 (WebGPURenderer + TSL) | Babylon.js 8.x | PlayCanvas 2.x |
|---|---|---|---|
| WebGPU maturity | Good. Still flagged experimental, and the API changes between releases | Most mature, with WebGPU and WebGL parity for years | Solid WebGPU backend; some features are WebGL-first |
| Fallback | Same TSL graph compiles to WGSL **or** GLSL (we use this today) | WebGL1/2 engine with the same scene code | WebGL2 with the same scene code |
| Shader authoring | TSL: JS node graphs, compute in the same language, already used in every material here | Node Material Editor plus raw WGSL/GLSL, ShaderMaterial | Shader chunks (GLSL/WGSL), less composable |
| Many lights | Not built in. `TiledLighting` addon (we run a 160-light pool) | **Clustered lighting built in** (8.0 `ClusteredLightContainer`) | Clustered lighting built in (CPU-built clusters) |
| Volumetric light | `VolumeNodeMaterial` raymarches shadowed lights (example `webgpu_volume_lighting`) | Volumetric light scattering post (screen-space) plus area/IES lights | No built-in volumetrics |
| Render graph | `PostProcessing`/`RenderPipeline` node graph with MRT and pass nodes | **Frame Graph** (8.0), an explicit task graph | Render passes/layers, no general graph |
| Compute | `instancedArray` plus `compute()` in TSL (we run 65k particles) | ComputeShader (WGSL), works but more boilerplate | Compute (WGSL) on WebGPU |
| GPU-driven/indirect | `IndirectStorageBufferAttribute` and `BatchedMesh` exist; no culling path built in | GPU picking and thin instances; no GPU culling built in | GSplat sorting on GPU; no general GPU culling |
| Editor/tooling | None (code only) | Playground, Inspector, NME | Best-in-class hosted editor |
| Raw draw-call performance | Good with instancing/BatchedMesh | Good, with snapshot rendering (render bundles) | Very good, lean runtime |
| Porting cost here | **None** | Rewrite every model builder, material (~40 node graphs), post chain and the UI hooks. Weeks | Same rewrite, plus moving to its entity/component model. Weeks |

## Recommendation: stay on Three.js + TSL
Babylon's clustered lighting and Frame Graph are real advantages, and PlayCanvas has the best raw speed and editor. But neither is **clearly better for this project**, so we should not port:
1. Our biggest assets are code that would need rewriting: procedural models, TSL materials and the shared game logic. A port would freeze feature work for weeks, and the two releases would drift apart.
2. Clustered lighting is covered well enough by the tiled light pool (160 lights, which can be raised). Volumetric light is covered by `VolumeNodeMaterial` and the CSM shadows. The Frame Graph is covered by the TSL post graph.
3. TSL compiles the same material to WebGPU and WebGL2, which keeps the phone fallback free. That is our mobile story.
4. Consoles: every route to a console (a wrapped Chromium/Electron shell, or a native port) works with all three engines, so this doesn't decide it.

**Revisit if:** Three.js's WebGPU path stalls, we need more than about 500 shadowed dynamic lights, or we want a visual editor for level design. If so, Babylon.js is the port target (closest feature set, Frame Graph and clustered lights), and a one-zone prototype would come first.
