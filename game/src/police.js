// police.js — wanted system and police pursuit AI

import * as THREE from 'three';
import { WANTED, POLICE_CAR } from './config.js';
import { mulberry32, rand, clamp, dist2D, wrapAngle, angleDelta } from './util.js';

export function createPolice(ctx) {
  const fleet = ctx.vehicles;
  if (!fleet) throw new Error('createPolice needs ctx.vehicles');
  
  const rng = mulberry32(0x9b17);
  
  const state = {
    heat: 0,
    level: 0,
    seen: false,
    spawnTimer: 0,
  };
  
  const cars = [];
  
  const police = {
    cars,
    state,
    
    get heat() {
      return state.heat;
    },
    
    get level() {
      return state.level;
    },
    
    get stars() {
      return state.level;
    },
    
    raise(amount, reason) {
      state.heat = Math.min(WANTED.heatMax, state.heat + amount);
      updateLevel(state);
      if (ctx.events) {
        ctx.events.emit('crime', { amount, reason });
      }
    },
    
    setLevel(level) {
      state.level = clamp(Math.floor(level), 0, 5);
      state.heat = WANTED.levelThresholds[state.level];
    },
    
    clear() {
      state.heat = 0;
      state.level = 0;
      // Despawn all police cars
      for (const car of cars) {
        fleet.remove(car);
      }
      cars.length = 0;
    },
    
    coolDown(amount) {
      state.heat = Math.max(0, state.heat - amount);
      updateLevel(state);
    },
    
    update(dt, player) {
      // Heat decay when not seen
      if (!state.seen && state.level > 0) {
        this.coolDown(WANTED.decayRate * dt);
      }
      
      // Check visibility
      state.seen = false;
      for (const car of cars) {
        const dist = dist2D(car.x, car.z, player.x, player.z);
        if (dist < 40) {
          state.seen = true;
          break;
        }
      }
      
      // Spawn police cars
      if (state.level > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && cars.length < state.level * 2) {
          spawnPoliceCar(player, fleet, cars, rng);
          state.spawnTimer = WANTED.spawnDelay;
        }
      }
      
      // Update police car AI
      for (const car of cars) {
        updatePursuitAI(car, player, dt, ctx);
      }
      
      // Remove far away police cars
      for (let i = cars.length - 1; i >= 0; i--) {
        const car = cars[i];
        const dist = dist2D(car.x, car.z, player.x, player.z);
        if (dist > 200) {
          fleet.remove(car);
          cars.splice(i, 1);
        }
      }
    },
  };
  
  ctx.police = police;
  return police;
}

function updateLevel(state) {
  for (let i = 5; i >= 0; i--) {
    if (state.heat >= WANTED.levelThresholds[i]) {
      state.level = i;
      return;
    }
  }
  state.level = 0;
}

function spawnPoliceCar(player, fleet, cars, rng) {
  // Spawn off-screen around player
  const angle = rand(rng, 0, Math.PI * 2);
  const dist = rand(rng, 50, 80);
  const x = player.x + Math.cos(angle) * dist;
  const z = player.z + Math.sin(angle) * dist;
  
  const car = fleet.spawn({
    modelId: 'police',
    x,
    z,
    heading: Math.atan2(player.x - x, player.z - z),
    role: 'police',
  });
  
  car.ai = {
    target: null,
    state: 'pursuit',
  };
  
  cars.push(car);
}

function updatePursuitAI(car, player, dt, ctx) {
  const dist = dist2D(car.x, car.z, player.x, player.z);
  
  // Calculate direction to player
  const dx = player.x - car.x;
  const dz = player.z - car.z;
  const targetHeading = Math.atan2(dx, dz);
  
  const headingDelta = angleDelta(car.heading, targetHeading);
  
  // Steering
  const steer = clamp(headingDelta * 2, -1, 1);
  
  // Throttle - chase player
  let throttle = 1;
  
  // Brake if too close or turning sharp
  let brake = 0;
  if (dist < 10 || Math.abs(headingDelta) > 1.2) {
    brake = 0.6;
    throttle = 0.3;
  }
  
  // Ram if very close
  if (dist < 5) {
    throttle = 1;
    brake = 0;
  }
  
  car.setControls(throttle, steer, brake, false);
}
