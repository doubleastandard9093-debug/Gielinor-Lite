# Gielinor: WebGPU release

A second build of the same game at `/Gielinor-Lite/webgpu/`, rendered with three.js `WebGPURenderer` and TSL node materials.
The WebGL game at the site root is untouched.

- **Backend:** WebGPU when the browser has it, otherwise three's WebGL2 backend. A badge at the top of the screen shows which one is running. Add `?backend=webgl` to force the fallback.
- **Shared code:** game logic, world, models, UI and saves come straight from `../js/`. Saves are shared with the main game (same `localStorage` key on the same site), so progress carries both ways.
- **What is swapped** (in `webgpu/js/`): `scene.js` (renderer, node height fog), `gfx.js` (sky, clouds, terrain, water with a reflector node), `vfx.js` (instanced sprite particles, glow pools), `post.js` (NaN guard, GTAO, bloom, AgX/ACES, light shafts and grade as one node graph), `nodeMats.js` (TSL versions of foliage sway and trampling, building wood/stone/plaster/thatch, noise bump, skin/fur/cloth and armour patterns), `extras.js` (WebGPU-only features).
- The import map in `webgpu/index.html` redirects the three shared-module URLs (`../js/scene.js`, `gfx.js`, `vfx.js`) to these versions.
- `webgpu/js/main.js` is generated from `js/main.js` by `node webgpu/tools/build-main.mjs`. Re-run that after changing the main game so both stay in step.

## Stages
1. **Renderer and materials:** `WebGPURenderer` with WebGL2 fallback, TSL materials and the node post chain.
2. **Tiled lighting:** on WebGPU a 160-light pool (`?lights=N`) covers every fire, forge and torch within ~110 m plus spell and hit flashes. The fallback keeps 12 lights.
3. **Dense GPU grass:** one instanced draw with 90,000 blades on WebGPU (32,400 on the fallback) in a grid that follows the player. The vertex shader places each blade from a world hash and a baked height and grass mask (no roads, sand, cobbles, water, buildings or cave), then adds wind and bends blades away from the player and nearby mobs. Off on Low and in the cave. `?nograss` turns it off.
4. **Cascaded shadow maps:** `CSMShadowNode` splits the sun's shadow into 4 cascades out to 300 m on WebGPU (3 out to 200 m on the fallback), with fading between them. `?nocsm` turns it off.
5. **Atmosphere, effects and life** (`webgpu/js/stage5.js`):
   - **Volumetric height fog:** density falls off with height and drifts slowly. It's integrated along each view ray so valleys fill with mist, and it glows gold looking into the sun. Thicker in rain. `?nofog` turns it off.
   - **Compute particles (WebGPU only):** a 65,536-particle storage-buffer pool simulated in a compute shader. Embers and sparks stream from the 64 nearest fires, and 16 burst slots handle hit sparks and magic. `?particles=N`, `?nocompute`. The fallback keeps the CPU particles.
   - **Weather:** rain streaks or snowflakes that wrap around the camera, with clear spells and showers alternating. It snows in the northern mountains, and rain dims the sun. `?weather=rain|snow|clear|off`.
   - **Crowds:** 120 instanced townsfolk on WebGPU (48 on the fallback) in 8 looks, strolling town streets with a GPU walk cycle. They're scenery only. `?crowd=N`, `?nocrowd`.
