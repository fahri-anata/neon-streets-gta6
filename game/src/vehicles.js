// vehicles.js — car factory, physics, and vehicle registry

import * as THREE from 'three';
import { CAR_MODELS, POLICE_CAR, VEHICLE, CITY } from './config.js';
import { mulberry32, rand, pick, clamp, lerp, wrapAngle, distSq2D, circleRectCollision, TAU } from './util.js';

let nextId = 1;

export function createVehicleSystem(ctx) {
  const rng = mulberry32((CITY.seed ^ 0x51c0) >>> 0);
  const root = new THREE.Group();
  root.name = 'Vehicles';
  if (ctx.scene) ctx.scene.add(root);

  const list = [];
  const byId = new Map();

  const fleet = {
    root,
    list,
    
    spawn(opts) {
      const model = opts.modelId === 'police' ? POLICE_CAR : 
                    CAR_MODELS.find(m => m.id === opts.modelId) ?? pick(rng, CAR_MODELS);
      
      const car = createCar(model, opts, rng, root);
      list.push(car);
      byId.set(car.id, car);
      return car;
    },
    
    remove(car) {
      const idx = list.indexOf(car);
      if (idx >= 0) list.splice(idx, 1);
      byId.delete(car.id);
      if (car.root.parent) car.root.parent.remove(car.root);
    },
    
    get(id) {
      return byId.get(id);
    },
    
    nearest(x, z, maxDist, filter) {
      let nearest = null;
      let minDist = maxDist * maxDist;
      
      for (const car of list) {
        if (filter && !filter(car)) continue;
        const distSq = distSq2D(x, z, car.x, car.z);
        if (distSq < minDist) {
          minDist = distSq;
          nearest = car;
        }
      }
      return nearest;
    },
    
    update(dt, ctx) {
      for (const car of list) {
        updateCarPhysics(car, dt, ctx);
      }
    },
  };

  ctx.vehicles = fleet;
  return fleet;
}

function createCar(model, opts, rng, root) {
  const id = nextId++;
  
  // Create car mesh
  const carRoot = new THREE.Group();
  carRoot.name = `Car_${id}`;
  root.add(carRoot);
  
  // Body
  const bodyGeo = new THREE.BoxGeometry(model.width, model.height, model.length);
  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: opts.color ?? model.color,
    metalness: 0.6,
    roughness: 0.4 
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = model.height / 2 + 0.3;
  body.castShadow = true;
  body.receiveShadow = true;
  carRoot.add(body);
  
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const wheels = [];
  
  const wheelOffsets = [
    { x: model.width * 0.4, z: model.length * 0.35 },
    { x: -model.width * 0.4, z: model.length * 0.35 },
    { x: model.width * 0.4, z: -model.length * 0.35 },
    { x: -model.width * 0.4, z: -model.length * 0.35 },
  ];
  
  wheelOffsets.forEach(offset => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(offset.x, 0.35, offset.z);
    wheel.castShadow = true;
    carRoot.add(wheel);
    wheels.push(wheel);
  });
  
  // Lights
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
  const headlightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  
  const leftLight = new THREE.Mesh(headlightGeo, headlightMat);
  leftLight.position.set(model.width * 0.3, model.height * 0.3, model.length * 0.5);
  carRoot.add(leftLight);
  
  const rightLight = new THREE.Mesh(headlightGeo, headlightMat);
  rightLight.position.set(-model.width * 0.3, model.height * 0.3, model.length * 0.5);
  carRoot.add(rightLight);
  
  // Police siren
  if (model.id === 'police') {
    const sirenGeo = new THREE.BoxGeometry(0.6, 0.2, 0.3);
    const sirenMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const siren = new THREE.Mesh(sirenGeo, sirenMat);
    siren.position.set(0, model.height + 0.2, 0);
    carRoot.add(siren);
  }
  
  const car = {
    id,
    model,
    modelId: model.id,
    name: model.name,
    role: opts.role ?? 'parked',
    
    root: carRoot,
    body,
    wheels,
    
    x: opts.x ?? 0,
    z: opts.z ?? 0,
    y: 0,
    heading: opts.heading ?? 0,
    speed: 0,
    
    vx: 0,
    vz: 0,
    angularVelocity: 0,
    
    steerAngle: 0,
    targetSteerAngle: 0,
    
    health: 1,
    damage: 0,
    
    controls: {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
    },
    
    occupiedBy: null,
    ai: null,
    
    setControls(throttle, steer, brake, handbrake) {
      this.controls.throttle = clamp(throttle, -1, 1);
      this.controls.steer = clamp(steer, -1, 1);
      this.controls.brake = clamp(brake, 0, 1);
      this.controls.handbrake = !!handbrake;
    },
    
    clearControls() {
      this.controls.throttle = 0;
      this.controls.steer = 0;
      this.controls.brake = 0;
      this.controls.handbrake = false;
    },
    
    applyImpulse(dx, dz, amount) {
      this.vx += dx * amount;
      this.vz += dz * amount;
    },
    
    damage(amount) {
      this.health = Math.max(0, this.health - amount);
      this.damage = 1 - this.health;
    },
    
    repair() {
      this.health = 1;
      this.damage = 0;
    },
  };
  
  // Position the car
  carRoot.position.set(car.x, car.y, car.z);
  carRoot.rotation.y = car.heading;
  
  return car;
}

function updateCarPhysics(car, dt, ctx) {
  if (car.role === 'parked' || car.health <= 0) {
    return;
  }
  
  const model = car.model;
  const controls = car.controls;
  
  // Steering
  car.targetSteerAngle = controls.steer * model.handling * 0.6;
  car.steerAngle = lerp(car.steerAngle, car.targetSteerAngle, dt * 5);
  
  // Forward direction
  const fwdX = Math.sin(car.heading);
  const fwdZ = Math.cos(car.heading);
  
  // Right direction
  const rightX = Math.cos(car.heading);
  const rightZ = -Math.sin(car.heading);
  
  // Forward velocity
  const fwdVel = car.vx * fwdX + car.vz * fwdZ;
  
  // Acceleration
  if (Math.abs(controls.throttle) > 0.01 && car.health > 0.1) {
    const accel = controls.throttle * model.acceleration * dt;
    car.vx += fwdX * accel;
    car.vz += fwdZ * accel;
  }
  
  // Braking
  if (controls.brake > 0 || controls.handbrake) {
    const brakePower = controls.handbrake ? 0.5 : controls.brake;
    const brakeForce = brakePower * VEHICLE.braking * dt;
    const velMag = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
    if (velMag > 0.1) {
      const brakeRatio = Math.max(0, 1 - brakeForce / velMag);
      car.vx *= brakeRatio;
      car.vz *= brakeRatio;
    } else {
      car.vx = 0;
      car.vz = 0;
    }
  }
  
  // Steering (affects angular velocity)
  if (Math.abs(fwdVel) > 1) {
    car.angularVelocity = car.steerAngle * fwdVel * 0.3;
  } else {
    car.angularVelocity *= 0.9;
  }
  
  car.heading = wrapAngle(car.heading + car.angularVelocity * dt);
  
  // Lateral grip (drift physics)
  const latVel = car.vx * rightX + car.vz * rightZ;
  const grip = controls.handbrake ? VEHICLE.drift * 0.3 : VEHICLE.drift;
  const latDrag = latVel * grip * dt;
  car.vx -= rightX * latDrag;
  car.vz -= rightZ * latDrag;
  
  // Speed drag
  const speed = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
  const drag = speed * (1 - VEHICLE.topSpeedDrag) * dt;
  if (speed > 0.1) {
    car.vx -= (car.vx / speed) * drag;
    car.vz -= (car.vz / speed) * drag;
  }
  
  // Max speed cap
  const maxSpeed = model.maxSpeed;
  if (speed > maxSpeed) {
    const ratio = maxSpeed / speed;
    car.vx *= ratio;
    car.vz *= ratio;
  }
  
  // Update position
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = speed;
  
  // Collision with buildings
  if (ctx.colliders) {
    for (const col of ctx.colliders) {
      if (col.kind === 'building') {
        const collision = circleRectCollision(
          car.x, 
          car.z, 
          Math.max(model.width, model.length) * 0.6,
          col
        );
        
        if (collision) {
          car.x += collision.x * collision.overlap;
          car.z += collision.z * collision.overlap;
          
          // Bounce back
          const impactSpeed = Math.abs(car.vx * collision.x + car.vz * collision.z);
          car.vx *= -0.3;
          car.vz *= -0.3;
          
          // Damage
          if (impactSpeed > 5) {
            car.damage(VEHICLE.collisionDamage * impactSpeed * 0.1);
          }
        }
      }
    }
  }
  
  // Update mesh transform
  car.root.position.set(car.x, car.y, car.z);
  car.root.rotation.y = car.heading;
  
  // Rotate wheels
  const wheelRotation = speed * dt * 2;
  car.wheels.forEach((wheel, i) => {
    wheel.rotation.x += wheelRotation;
    if (i < 2) { // Front wheels steer
      wheel.rotation.y = car.steerAngle;
    }
  });
}
