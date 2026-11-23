// main.js — game initialization, player controller, and main loop

import * as THREE from 'three';
import { GAME, PLAYER, CITY } from './config.js';
import { initInput, isKeyDown, getMouseDelta, isMouseLocked } from './input.js';
import { buildCity } from './city.js';
import { createVehicleSystem } from './vehicles.js';
import { createPolice } from './police.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createMinimap } from './minimap.js';
import { clamp, dist2D, wrapAngle } from './util.js';

let scene, camera, renderer;
let gameState = 'menu';
let isPaused = false;

// Debug: expose to window for verification
window.DEBUG_MODULE_LOADED = true;

const player = {
  x: 0,
  y: PLAYER.height,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  heading: 0,
  pitch: 0,
  health: PLAYER.health,
  cash: PLAYER.startCash,
  vehicle: null,
  onGround: true,
  mesh: null, // Player 3D model
};

const ctx = {
  scene: null,
  camera: null,
  renderer: null,
  colliders: [],
  events: createEventEmitter(),
};

function createEventEmitter() {
  const listeners = {};
  return {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    emit(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(fn => fn(data));
      }
    },
  };
}

function init() {
  console.log('🎮 Initializing Neon Streets...');
  window.DEBUG_INIT_CALLED = true;
  
  // Setup Three.js
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Simple sky blue - verified working
  ctx.scene = scene;
  window.DEBUG_SCENE = scene; // Expose for debugging
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  ctx.camera = camera;
  
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'gameCanvas'; // Set ID to match CSS
  document.body.appendChild(renderer.domElement);
  ctx.renderer = renderer;
  window.DEBUG_RENDERER = renderer; // Expose for debugging
  
  console.log('✅ Renderer created:', renderer.domElement.width, 'x', renderer.domElement.height);
  
  // Input
  initInput();
  
  // Build city
  buildCity(ctx);
  
  // Vehicle system
  createVehicleSystem(ctx);
  
  // Spawn some parked cars
  spawnParkedCars(ctx);
  
  // Police system
  createPolice(ctx);
  
  // Traffic system
  createTraffic(ctx);
  
  // Pedestrians
  createPedestrians(ctx);
  
  // Minimap
  createMinimap(ctx);
  
  // Position player in city center
  player.x = 0;
  player.z = 0;
  player.y = PLAYER.height;
  
  // Create player mesh
  const playerGeo = new THREE.CapsuleGeometry(0.4, 1.4, 4, 8);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x3366ff });
  player.mesh = new THREE.Mesh(playerGeo, playerMat);
  player.mesh.castShadow = true;
  scene.add(player.mesh);
  
  // Position camera for city overview - TPP aerial view
  camera.position.set(50, 60, 80);
  camera.lookAt(0, 0, 0);
  
  // Window resize
  window.addEventListener('resize', onResize);
  
  // Hide loading
  document.getElementById('loading').style.display = 'none';
  
  console.log('City built! Ready to play.');
}

function spawnParkedCars(ctx) {
  const fleet = ctx.vehicles;
  const count = 20;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    
    fleet.spawn({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      heading: Math.random() * Math.PI * 2,
      role: 'parked',
    });
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function startGame() {
  gameState = 'playing';
  document.getElementById('menu').classList.add('hidden');
  animate();
}

function togglePause() {
  if (gameState !== 'playing') return;
  
  isPaused = !isPaused;
  const pauseMenu = document.getElementById('pauseMenu');
  
  if (isPaused) {
    pauseMenu.classList.add('active');
    document.exitPointerLock();
  } else {
    pauseMenu.classList.remove('active');
  }
}

function resumeGame() {
  isPaused = false;
  document.getElementById('pauseMenu').classList.remove('active');
}

function returnToMenu() {
  gameState = 'menu';
  isPaused = false;
  document.getElementById('pauseMenu').classList.remove('active');
  document.getElementById('menu').classList.remove('hidden');
  document.exitPointerLock();
}

function update(dt) {
  if (isPaused) return;
  
  // Player input
  if (player.vehicle) {
    updateVehicleControls(dt);
  } else {
    updatePlayerControls(dt);
  }
  
  // Vehicle physics
  ctx.vehicles.update(dt, ctx);
  
  // Police
  ctx.police.update(dt, player);
  
  // Traffic
  ctx.traffic.update(dt, player);
  
  // Pedestrians
  ctx.pedestrians.update(dt, player);
  
  // Camera
  updateCamera();
  
  // HUD
  updateHUD();
  
  // Minimap
  if (ctx.minimap) {
    ctx.minimap.render(player, ctx.vehicles, ctx.city);
  }
  
  // City
  ctx.city.update(dt);
}

function updatePlayerControls(dt) {
  const { dx, dy } = getMouseDelta();
  
  if (isMouseLocked()) {
    player.heading -= dx * 0.002;
    player.pitch = clamp(player.pitch - dy * 0.002, -Math.PI / 2, Math.PI / 2);
  }
  
  // Movement
  const forward = isKeyDown('KeyW') ? 1 : isKeyDown('KeyS') ? -1 : 0;
  const right = isKeyDown('KeyD') ? 1 : isKeyDown('KeyA') ? -1 : 0;
  const sprint = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
  const jump = isKeyDown('Space');
  
  const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  
  const fwdX = Math.sin(player.heading);
  const fwdZ = Math.cos(player.heading);
  const rightX = Math.cos(player.heading);
  const rightZ = -Math.sin(player.heading);
  
  player.vx = (forward * fwdX + right * rightX) * speed;
  player.vz = (forward * fwdZ + right * rightZ) * speed;
  
  // Gravity
  if (!player.onGround) {
    player.vy -= 20 * dt;
  }
  
  // Jump
  if (jump && player.onGround) {
    player.vy = PLAYER.jumpForce;
    player.onGround = false;
  }
  
  // Update position
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;
  
  // Update player mesh
  if (player.mesh) {
    player.mesh.position.set(player.x, player.y - 0.5, player.z);
    player.mesh.rotation.y = player.heading;
    player.mesh.visible = true;
  }
  
  // Ground collision
  if (player.y <= PLAYER.height) {
    player.y = PLAYER.height;
    player.vy = 0;
    player.onGround = true;
  }
  
  // Building collision
  for (const col of ctx.colliders) {
    if (col.kind === 'building') {
      const dx = player.x - col.x;
      const dz = player.z - col.z;
      
      if (Math.abs(dx) < col.width / 2 + PLAYER.radius &&
          Math.abs(dz) < col.depth / 2 + PLAYER.radius) {
        
        // Push out
        const overlapX = (col.width / 2 + PLAYER.radius) - Math.abs(dx);
        const overlapZ = (col.depth / 2 + PLAYER.radius) - Math.abs(dz);
        
        if (overlapX < overlapZ) {
          player.x += (dx > 0 ? 1 : -1) * overlapX;
        } else {
          player.z += (dz > 0 ? 1 : -1) * overlapZ;
        }
      }
    }
  }
  
  // Enter vehicle with E
  if (isKeyDown('KeyE')) {
    const nearby = ctx.vehicles.nearest(player.x, player.z, 4, car => car.role === 'parked');
    if (nearby && !player.vehicle) {
      enterVehicle(nearby);
    }
  }
}

function updateVehicleControls(dt) {
  const car = player.vehicle;
  if (!car) return;
  
  // Hide player mesh when in vehicle
  if (player.mesh) player.mesh.visible = false;
  
  const forward = isKeyDown('KeyW') ? 1 : isKeyDown('KeyS') ? -1 : 0;
  const steer = isKeyDown('KeyD') ? 1 : isKeyDown('KeyA') ? -1 : 0;
  const brake = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight') ? 1 : 0;
  const handbrake = isKeyDown('Space');
  
  car.setControls(forward, steer, brake, handbrake);
  
  // Camera follows car
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  
  // Exit vehicle with E
  if (isKeyDown('KeyE')) {
    exitVehicle();
  }
  
  // Crime detection
  if (car.speed > 20) {
    // Speeding
    if (Math.random() < 0.01) {
      ctx.police.raise(10, 'speeding');
    }
  }
}

function enterVehicle(car) {
  player.vehicle = car;
  car.role = 'player';
  car.occupiedBy = player;
  
  // Raise wanted level for car theft
  if (car.modelId !== 'taxi') {
    ctx.police.raise(35, 'car_theft');
  }
  
  document.getElementById('speedometer').style.display = 'block';
}

function exitVehicle() {
  if (!player.vehicle) return;
  
  const car = player.vehicle;
  
  // Position player next to car
  const exitX = car.x + Math.cos(car.heading) * 2;
  const exitZ = car.z - Math.sin(car.heading) * 2;
  
  player.x = exitX;
  player.z = exitZ;
  player.y = PLAYER.height;
  
  car.role = 'parked';
  car.occupiedBy = null;
  car.clearControls();
  player.vehicle = null;
  
  document.getElementById('speedometer').style.display = 'none';
}

function updateCamera() {
  if (player.vehicle) {
    // Chase camera
    const car = player.vehicle;
    const dist = 12;
    const height = 4;
    
    const targetX = car.x - Math.sin(car.heading) * dist;
    const targetY = height;
    const targetZ = car.z - Math.cos(car.heading) * dist;
    
    camera.position.x += (targetX - camera.position.x) * 0.1;
    camera.position.y += (targetY - camera.position.y) * 0.1;
    camera.position.z += (targetZ - camera.position.z) * 0.1;
    
    camera.lookAt(car.x, 1, car.z);
  } else {
    // Third person camera
    const dist = 5;
    const height = 2;
    
    const camX = player.x - Math.sin(player.heading) * dist * Math.cos(player.pitch);
    const camY = player.y + height - Math.sin(player.pitch) * dist;
    const camZ = player.z - Math.cos(player.heading) * dist * Math.cos(player.pitch);
    
    camera.position.set(camX, camY, camZ);
    camera.lookAt(player.x, player.y, player.z);
  }
}

function updateHUD() {
  document.getElementById('healthValue').textContent = Math.floor(player.health);
  document.getElementById('cashValue').textContent = player.cash;
  
  // Wanted stars
  const stars = document.querySelectorAll('.star');
  stars.forEach((star, i) => {
    if (i < ctx.police.level) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
  
  // Speedometer
  if (player.vehicle) {
    const mph = Math.floor(player.vehicle.speed * 2.237);
    document.getElementById('speed').textContent = mph;
  }
}

function animate() {
  if (gameState !== 'playing') return;
  
  requestAnimationFrame(animate);
  
  const dt = 1 / 60;
  update(dt);
  
  renderer.render(scene, camera);
}

// Global API for HTML buttons
window.game = {
  start: startGame,
  togglePause,
  resume: resumeGame,
  returnToMenu,
};

// Initialize on load
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already loaded, call init immediately
  init();
}
