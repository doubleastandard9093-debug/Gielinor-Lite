import { createScene, createCamera, createRenderer, createLights } from './scene.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { setupInput } from './input.js';
import { setupUI, updateCamera } from './ui.js';
import { createSkills, addXP } from './skills.js';
import { createPlayerState, addItem, removeItem, recalcMaxHp } from './playerState.js';
import { RECIPES, canCraft, ITEMS } from './items.js';
import { gather, attackMonster, equip, SELL_PRICES, SHOP_STOCK } from './gameplay.js';
import { createInventoryUI } from './inventoryUI.js';
import { saveToLocal, loadFromLocal, exportSave, importSave } from './save.js';

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

createLights(scene);
const { ground, nodes, monsters } = createWorld(scene);
const playerMesh = createPlayer(scene);
const skills = createSkills();
const player = createPlayerState();
player.mesh = playerMesh.mesh; // link for distance checks
const { log } = setupUI();
const keys = setupInput(renderer, camera, ground, playerMesh, log);

const craftPanel = document.createElement('div');
craftPanel.id = 'craftPanel';
craftPanel.style.cssText = 'position:absolute;bottom:60px;right:10px;background:rgba(0,0,0,0.7);color:#fff;padding:8px;border-radius:6px;font-size:11px;max-width:220px;max-height:180px;overflow:auto;pointer-events:auto;';
document.body.appendChild(craftPanel);

// Advanced inventory
const invUI = createInventoryUI(player, skills, (item) => {
  equip(player, skills, item, log);
  invUI.render();
}, log);

function updatePanels() {
  recalcMaxHp(player, skills);
  invUI.render();
  craftPanel.innerHTML = '<strong>Craft</strong><br>' + RECIPES.filter(r => canCraft(skills, player.inventory, r)).map(r =>
    `<button style="margin:2px;font-size:10px;" onclick="window.doCraft('${r.name}')">${r.name}</button>`
  ).join('') || 'Gather materials';
}
window.doEquip = (item) => { equip(player, skills, item, log); updatePanels(); };
window.doCraft = (name) => {
  const recipe = RECIPES.find(r => r.name === name);
  if (!recipe || !canCraft(skills, player.inventory, recipe)) return;
  for (const [item, qty] of Object.entries(recipe.inputs)) removeItem(player, item, qty);
  addItem(player, recipe.output, 1);
  addXP(skills, recipe.skill, recipe.xp, (s, l) => log(`${s} advanced to level ${l}!`));
  log(`Crafted ${recipe.output}.`);
  updatePanels();
};

function tryInteract() {
  // Nearest node (including shop and fish)
  let closest = null, minD = 4;
  for (const n of nodes) {
    if (!n.alive) continue;
    const d = Math.hypot(n.mesh.position.x - playerMesh.mesh.position.x, n.mesh.position.z - playerMesh.mesh.position.z);
    if (d < minD) { minD = d; closest = n; }
  }
  if (closest) {
    if (closest.type === 'shop') {
      openShop();
      return;
    }
    gather(closest, skills, player, log);
    updatePanels();
    return;
  }

  // Nearest monster
  for (const m of monsters) {
    if (!m.alive) continue;
    const d = Math.hypot(m.mesh.position.x - playerMesh.mesh.position.x, m.mesh.position.z - playerMesh.mesh.position.z);
    if (d < 3) { attackMonster(m, skills, player, log); updatePanels(); return; }
  }
  log('Nothing nearby.');
}

function openShop() {
  log('Merchant: "Buy or sell?"');
  craftPanel.innerHTML = `<strong>Merchant</strong><br>
    <button onclick="window.showBuy()">Buy</button> <button onclick="window.showSell()">Sell</button><br>
    <div id="shopContent"></div>`;
  window.showBuy = () => {
    document.getElementById('shopContent').innerHTML = SHOP_STOCK.map(s =>
      `<button onclick="window.buyItem('${s.item}',${s.price})">${s.item} ${s.price}gp</button>`
    ).join('');
  };
  window.showSell = () => {
    document.getElementById('shopContent').innerHTML = Object.entries(player.inventory).map(([item, qty]) => {
      const price = SELL_PRICES[item] || 1;
      return `<button onclick="window.sellItem('${item}')">${item} x${qty} (${price}gp)</button>`;
    }).join('') || 'Nothing to sell';
  };
  window.buyItem = (item, price) => {
    if (player.gold < price) { log('Not enough gold.'); return; }
    player.gold -= price;
    addItem(player, item, 1);
    log(`Bought ${item}.`);
    updatePanels();
    openShop();
  };
  window.sellItem = (item) => {
    const price = SELL_PRICES[item] || 1;
    if (removeItem(player, item, 1)) {
      player.gold += price;
      log(`Sold for ${price}gp.`);
      updatePanels();
      openShop();
    }
  };
  window.showBuy();
}

document.getElementById('interactBtn').addEventListener('click', tryInteract);

function animate() {
  updatePlayer(playerMesh, keys);
  updateCamera(camera, playerMesh);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updatePanels();

// Load existing save
if (loadFromLocal(skills, player, playerMesh)) {
  log('Save loaded.');
  updatePanels();
}

// Auto-save every 15 seconds
setInterval(() => {
  saveToLocal(skills, player, playerMesh);
}, 15000);

// Save buttons
const saveBar = document.createElement('div');
saveBar.style.cssText = 'position:absolute;top:calc(10px + env(safe-area-inset-top));left:calc(10px + env(safe-area-inset-left));display:flex;flex-direction:column;gap:4px;pointer-events:auto;z-index:10;';
saveBar.innerHTML = `
  <button id="saveBtn" style="padding:8px 10px;font-size:12px;min-width:64px;">Save</button>
  <button id="exportBtn" style="padding:8px 10px;font-size:12px;min-width:64px;">Export</button>
  <button id="importBtn" style="padding:8px 10px;font-size:12px;min-width:64px;">Import</button>
`;
document.body.appendChild(saveBar);

document.getElementById('saveBtn').onclick = () => {
  if (saveToLocal(skills, player, playerMesh)) log('Game saved.');
};
document.getElementById('exportBtn').onclick = () => {
  exportSave(skills, player, playerMesh);
  log('Save exported.');
};
document.getElementById('importBtn').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    if (input.files[0]) {
      importSave(input.files[0], skills, player, playerMesh, (ok) => {
        if (ok) { log('Save imported.'); updatePanels(); }
        else log('Import failed.');
      });
    }
  };
  input.click();
};

log('Tap ground to walk. Interact near trees, rocks, fish, monsters, or the Merchant.');
animate();
