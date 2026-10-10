import * as THREE from 'three';

export function createWorld(scene) {
  const groundGeo = new THREE.PlaneGeometry(80, 80, 20, 20);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a6a3a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const nodes = [];
  const monsters = [];

  function createTree(x, z) {
    const group = new THREE.Group();
    // 2004 RS2 tree: simple box trunk + cone leaves
    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.6, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x4a3010 })
    );
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.0, 2.2, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a4a1a })
    );
    leaves.position.y = 2.4;
    leaves.castShadow = true;
    group.add(leaves);
    group.position.set(x, 0, z);
    scene.add(group);
    return { mesh: group, type: 'tree', alive: true, x, z };
  }

  function createRock(x, z) {
    // Blocky low-poly rock
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x5a5a5a })
    );
    rock.position.set(x, 0.3, z);
    rock.rotation.y = Math.random() * 0.5;
    rock.castShadow = true;
    scene.add(rock);
    const ore = Math.random() < 0.6 ? 'Copper' : (Math.random() < 0.5 ? 'Tin' : 'Iron');
    return { mesh: rock, type: 'rock', ore, alive: true, x, z };
  }

  function createMonster(x, z) {
    const types = [
      { name: 'Goblin', level: 2, hp: 15, atk: 2, xp: 10, color: 0x4a7a3a },
      { name: 'Cow', level: 2, hp: 20, atk: 1, xp: 8, color: 0x8a6a4a },
      { name: 'Guard', level: 8, hp: 40, atk: 6, xp: 25, color: 0x3a3a6a }
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    // Blocky monster body
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.5),
      new THREE.MeshLambertMaterial({ color: t.color })
    );
    mesh.position.set(x, 0.45, z);
    mesh.castShadow = true;
    scene.add(mesh);
    // Simple head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.35, 0.4),
      new THREE.MeshLambertMaterial({ color: t.color })
    );
    head.position.y = 0.65;
    mesh.add(head);
    return { ...t, mesh, maxHp: t.hp, alive: true, x, z };
  }

  function createFish(x, z) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x4488cc })
    );
    mesh.position.set(x, 0.3, z);
    scene.add(mesh);
    const fish = Math.random() < 0.6 ? 'shrimp' : 'trout';
    return { mesh, type: 'fish', fish, alive: true, x, z };
  }

  function createMerchant(x, z) {
    // Blocky merchant
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    body.position.y = 0.9;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.45, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd4a574 })
    );
    head.position.y = 1.65;
    group.add(head);
    // Hat
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.2, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
    );
    hat.position.y = 1.95;
    group.add(hat);
    group.position.set(x, 0, z);
    scene.add(group);
    return { mesh: group, type: 'shop', alive: true, x, z, name: 'Merchant' };
  }

  for (let i = 0; i < 25; i++) {
    const x = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 60;
    if (Math.abs(x) > 3 || Math.abs(z) > 3) nodes.push(createTree(x, z));
  }
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * 50;
    const z = (Math.random() - 0.5) * 50;
    nodes.push(createRock(x, z));
  }
  for (let i = 0; i < 6; i++) {
    const x = (Math.random() - 0.5) * 40;
    const z = (Math.random() - 0.5) * 40;
    nodes.push(createFish(x, z));
  }
  nodes.push(createMerchant(8, 0));

  for (let i = 0; i < 8; i++) {
    const x = (Math.random() - 0.5) * 40;
    const z = (Math.random() - 0.5) * 40;
    monsters.push(createMonster(x, z));
  }

  return { ground, nodes, monsters };
}
