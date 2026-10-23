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
6. **Round 2 graphics** (`webgpu/js/stage6.js`, `stage7.js`, engine comparison in `ENGINE_NOTES.md`):
   - **Procedural PBR:** stochastic-tiled terrain detail, parallax occlusion on cobbles (High), cavity AO and roughness variation, overlapping roof tiles, close-up detail normals on characters.
   - **Water:** Gerstner waves, depth absorption, screen-space refraction, Fresnel reflection, shore foam, caustics and player ripples.
   - **Volumetric light:** raymarched sun and nearest-torch in-scatter at 1/4 resolution, on by default on High. `?novol` turns it off.
   - **Compute culling and density:** a compute-shader frustum/distance mask drives ~83k extra decor instances, and distant trees cross-fade to a lighter LOD at 90 m (`?treenear=M`). `?nodense` turns it off.
   - **Building detail:** shutters, stone sills, timber lintels, diagonal braces, fascia and barge boards, gable finials, chimney flashing and pots. Roof details hide with the roof indoors. `?nobdetail` turns it off.
   - **Bloom tuning:** bloom threshold drops and strength rises at night, in the cave and inside buildings so fires, torches and spells glow. `?nobloomtune` turns it off.
   - **Neutral moonlight:** the shared day cycle's saturated blue moon and night sky fill turned grey stone (the town-square cobbles, the well) bright blue under PBR shading. At night both lights are pulled toward their own brightness with only a slight cool tint. `?bluenight` keeps the old colours.
   - **Close-up character and monster detail (High, within ~6 m):** mesh-local surface patterns that move with the body: skin mottling, pores and freckles; cloth weave; fur strands and clumps with a strand highlight; overlapping scales with dark lips; chitin segment seams; bone pits and hairline cracks; fine scratches on metal; backlit skin glows red at thin edges. `?nochardetail` turns it off.
   - **Brighter spells and fire:** flames and sparks have HDR cores, spell bolts are a hot core in a halo of their own colour that sheds glowing motes in flight, impact bursts take the spell's colour, and spell and hit flashes light the surroundings more strongly. `?noglow` restores the old levels.

## Ultra graphics (stage 10)
Settings > Graphics quality now cycles High > Ultra > Low > Auto (the game still starts on Low; your pick is saved). Ultra adds full-resolution GTAO with 24 samples, 4096 px shadow cascades out to 480 m with softer PCF, full-resolution water reflections with a third ripple normal layer and a lacy shoreline foam fringe, and a denser, wider GPU grass field (360k blades, 114 m) with rolling wind gusts. Each piece falls back to the High version if it cannot be set up.
