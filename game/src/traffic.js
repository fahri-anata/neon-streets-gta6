// traffic.js — AI traffic system

import { TRAFFIC } from './config.js';
import { mulberry32, rand, randInt, pick, dist2D } from './util.js';

export function createTraffic(ctx) {
  const fleet = ctx.vehicles;
  const network = ctx.city?.network;
  if (!fleet || !network) throw new Error('createTraffic needs vehicles and city.network');
  
  const rng = mulberry32(0x7af1);
  const cars = [];
  
  const traffic = {
    cars,
    
    update(dt, player) {
      // Spawn traffic cars around player
      while (cars.length < TRAFFIC.count) {
        spawnTrafficCar(player, fleet, network, cars, rng);
      }
      
      // Update AI
      for (const car of cars) {
        updateTrafficAI(car, dt, ctx);
      }
      
      // Remove far cars
      for (let i = cars.length - 1; i >= 0; i--) {
        const car = cars[i];
        const dist = dist2D(car.x, car.z, player.x, player.z);
        if (dist > TRAFFIC.spawnRange * 2) {
          fleet.remove(car);
          cars.splice(i, 1);
        }
      }
    },
  };
  
  ctx.traffic = traffic;
  return traffic;
}

function spawnTrafficCar(player, fleet, network, cars, rng) {
  // Find random node far from player
  let attempts = 0;
  let node;
  
  do {
    const ix = randInt(rng, 0, network.gridSize);
    const iz = randInt(rng, 0, network.gridSize);
    node = network.getNode(ix, iz);
    attempts++;
  } while (dist2D(node.x, node.z, player.x, player.z) < 30 && attempts < 20);
  
  const car = fleet.spawn({
    x: node.x + rand(rng, -5, 5),
    z: node.z + rand(rng, -5, 5),
    heading: rand(rng, 0, Math.PI * 2),
    role: 'traffic',
  });
  
  car.ai = {
    targetSpeed: TRAFFIC.speedLimit,
    nextNode: null,
    behavior: 'cruise',
  };
  
  cars.push(car);
}

function updateTrafficAI(car, dt, ctx) {
  // Simple cruise behavior
  const throttle = car.speed < TRAFFIC.speedLimit ? 0.5 : 0;
  const brake = car.speed > TRAFFIC.speedLimit * 1.2 ? 0.3 : 0;
  
  // Random gentle steering
  const steer = (Math.random() - 0.5) * 0.2;
  
  car.setControls(throttle, steer, brake, false);
}
