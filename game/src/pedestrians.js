// pedestrians.js — NPC pedestrian system

import * as THREE from 'three';
import { PEDS } from './config.js';
import { mulberry32, rand, randInt, dist2D, clamp } from './util.js';

export function createPedestrians(ctx) {
  const scene = ctx.scene;
  const rng = mulberry32(0xc4f3);
  
  const root = new THREE.Group();
  root.name = 'Pedestrians';
  scene.add(root);
  
  const peds = [];
  
  const system = {
    peds,
    
    spawn(x, z) {
      const ped = createPed(x, z, rng, root);
      peds.push(ped);
      return ped;
    },
    
    update(dt, player) {
      // Spawn peds around player
      while (peds.length < PEDS.count) {
        const angle = rand(rng, 0, Math.PI * 2);
        const dist = rand(rng, 20, PEDS.spawnRange);
        const x = player.x + Math.cos(angle) * dist;
        const z = player.z + Math.sin(angle) * dist;
        this.spawn(x, z);
      }
      
      // Update peds
      for (const ped of peds) {
        updatePed(ped, dt, player);
      }
      
      // Remove far peds
      for (let i = peds.length - 1; i >= 0; i--) {
        const ped = peds[i];
        const dist = dist2D(ped.x, ped.z, player.x, player.z);
        if (dist > PEDS.spawnRange * 2) {
          root.remove(ped.mesh);
          peds.splice(i, 1);
        }
      }
    },
  };
  
  ctx.pedestrians = system;
  return system;
}

function createPed(x, z, rng, root) {
  // Simple capsule ped
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.4, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color().setHSL(rand(rng, 0, 1), 0.6, 0.5) 
  });
  const mesh = new THREE.Mesh(bodyGeo, bodyMat);
  mesh.position.set(x, 1, z);
  mesh.castShadow = true;
  root.add(mesh);
  
  return {
    x,
    z,
    heading: rand(rng, 0, Math.PI * 2),
    speed: PEDS.walkSpeed,
    state: 'walking',
    mesh,
    stateTimer: rand(rng, 2, 8),
  };
}

function updatePed(ped, dt, player) {
  // Check if should flee from player
  const distToPlayer = dist2D(ped.x, ped.z, player.x, player.z);
  
  if (distToPlayer < PEDS.fleeDistance && player.vehicle && player.vehicle.speed > 10) {
    ped.state = 'fleeing';
    ped.speed = PEDS.fleeSpeed;
    
    // Run away from player
    const dx = ped.x - player.x;
    const dz = ped.z - player.z;
    ped.heading = Math.atan2(dx, dz);
  } else if (ped.state === 'fleeing' && distToPlayer > PEDS.fleeDistance * 1.5) {
    ped.state = 'walking';
    ped.speed = PEDS.walkSpeed;
  }
  
  // Random walk behavior
  ped.stateTimer -= dt;
  if (ped.stateTimer <= 0) {
    ped.heading += rand(() => Math.random(), -0.5, 0.5);
    ped.stateTimer = rand(() => Math.random(), 2, 8);
  }
  
  // Move
  const fwdX = Math.sin(ped.heading);
  const fwdZ = Math.cos(ped.heading);
  
  ped.x += fwdX * ped.speed * dt;
  ped.z += fwdZ * ped.speed * dt;
  
  // Update mesh
  ped.mesh.position.set(ped.x, 1, ped.z);
  ped.mesh.rotation.y = ped.heading;
}
