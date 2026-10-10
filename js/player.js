import * as THREE from 'three';

export function createPlayer(scene) {
  // 2004 RS2-style blocky character
  const playerGroup = new THREE.Group();

  // Torso (wider, shorter)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.9, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  body.position.y = 1.0;
  body.castShadow = true;
  playerGroup.add(body);

  // Head (cube-ish)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshLambertMaterial({ color: 0xd4a574 })
  );
  head.position.y = 1.75;
  head.castShadow = true;
  playerGroup.add(head);

  // Simple hair/cap
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.15, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
  );
  hair.position.y = 2.05;
  playerGroup.add(hair);

  // Arms (thin boxes)
  const armMat = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), armMat);
  leftArm.position.set(-0.55, 1.0, 0);
  playerGroup.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), armMat);
  rightArm.position.set(0.55, 1.0, 0);
  playerGroup.add(rightArm);

  // Legs (separate)
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.65, 0.28), legMat);
  leftLeg.position.set(-0.18, 0.32, 0);
  playerGroup.add(leftLeg);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.65, 0.28), legMat);
  rightLeg.position.set(0.18, 0.32, 0);
  playerGroup.add(rightLeg);

  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);

  return {
    mesh: playerGroup,
    position: playerGroup.position,
    speed: 0.1,
    target: null
  };
}

export function updatePlayer(player, keys) {
  const { mesh, speed } = player;

  // Keyboard movement
  if (keys['w'] || keys['arrowup']) mesh.position.z -= speed;
  if (keys['s'] || keys['arrowdown']) mesh.position.z += speed;
  if (keys['a'] || keys['arrowleft']) mesh.position.x -= speed;
  if (keys['d'] || keys['arrowright']) mesh.position.x += speed;

  // Click-to-move
  if (player.target) {
    const dx = player.target.x - mesh.position.x;
    const dz = player.target.z - mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.2) {
      mesh.position.x += (dx / dist) * speed;
      mesh.position.z += (dz / dist) * speed;
      mesh.lookAt(player.target.x, 0, player.target.z);
    } else {
      player.target = null;
    }
  }
}
