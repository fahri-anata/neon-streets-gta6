// city.js — Crimson Bay city builder with procedural buildings, roads, and colliders

import * as THREE from 'three';
import { CITY, COLORS } from './config.js';
import { mulberry32, rand, randInt, clamp, TAU } from './util.js';

export function buildCity(ctx) {
  const scene = ctx.scene;
  const rng = mulberry32(CITY.seed);
  const root = new THREE.Group();
  root.name = 'CrimsonBay';
  scene.add(root);

  const colliders = ctx.colliders ?? (ctx.colliders = []);
  
  // Create road network
  const network = createRoadNetwork();
  
  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(500, 500);
  const groundMat = new THREE.MeshStandardMaterial({ 
    color: COLORS.ground,
    roughness: 0.9 
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  
  // Build roads
  buildRoads(root, network, rng);
  
  // Build street lights
  buildStreetLights(root, network, scene);
  
  // Build city blocks with buildings
  buildBlocks(root, network, colliders, rng);
  
  // Lighting
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.6);
  scene.add(hemi);
  
  const sun = new THREE.DirectionalLight(COLORS.sun, 1.5);
  sun.position.set(100, 150, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  
  // Sky with gradient
  const skyGeo = new THREE.SphereGeometry(400, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 topColor = vec3(0.1, 0.3, 0.6);     // bright sky blue
        vec3 horizonColor = vec3(0.5, 0.7, 0.9); // light cyan horizon
        vec3 color = mix(horizonColor, topColor, max(h, 0.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  
  scene.fog = new THREE.Fog(COLORS.fog, 100, 280);
  
  const city = {
    root,
    network,
    colliders,
    sun,
    update(dt) {
      // Future: day/night cycle
    },
  };
  
  ctx.city = city;
  return city;
}

function createRoadNetwork() {
  const size = CITY.gridSize;
  const block = CITY.blockSize;
  const road = CITY.roadWidth;
  const halfSize = (size * (block + road)) / 2;
  
  const nodes = [];
  const edges = [];
  
  // Create grid nodes
  for (let ix = 0; ix <= size; ix++) {
    for (let iz = 0; iz <= size; iz++) {
      const x = ix * (block + road) - halfSize;
      const z = iz * (block + road) - halfSize;
      nodes.push({ ix, iz, x, z });
    }
  }
  
  // Create edges (roads between nodes)
  for (let ix = 0; ix <= size; ix++) {
    for (let iz = 0; iz <= size; iz++) {
      const idx = iz * (size + 1) + ix;
      
      if (ix < size) {
        edges.push({ 
          from: idx, 
          to: idx + 1,
          horizontal: true 
        });
      }
      
      if (iz < size) {
        edges.push({ 
          from: idx, 
          to: idx + (size + 1),
          horizontal: false 
        });
      }
    }
  }
  
  return {
    nodes,
    edges,
    gridSize: size,
    blockSize: block,
    roadWidth: road,
    getNode: (ix, iz) => nodes[iz * (size + 1) + ix],
    nearestNode: (x, z) => {
      const ix = Math.round((x + halfSize) / (block + road));
      const iz = Math.round((z + halfSize) / (block + road));
      return nodes[clamp(iz, 0, size) * (size + 1) + clamp(ix, 0, size)];
    },
  };
}

function buildRoads(root, network, rng) {
  const roadMat = new THREE.MeshStandardMaterial({ 
    color: COLORS.road,
    roughness: 0.95 
  });
  
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  
  network.edges.forEach(edge => {
    const from = network.nodes[edge.from];
    const to = network.nodes[edge.to];
    
    const x = (from.x + to.x) / 2;
    const z = (from.z + to.z) / 2;
    const length = Math.abs(edge.horizontal ? (to.x - from.x) : (to.z - from.z));
    
    // Road surface
    const roadGeo = new THREE.BoxGeometry(
      edge.horizontal ? length : network.roadWidth,
      0.1,
      edge.horizontal ? network.roadWidth : length
    );
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(x, 0.05, z);
    road.receiveShadow = true;
    root.add(road);
    
    // Center line markings
    const lineCount = Math.floor(length / 4);
    for (let i = 0; i < lineCount; i++) {
      if (i % 2 === 0) {
        const lineGeo = new THREE.BoxGeometry(
          edge.horizontal ? 2 : 0.15,
          0.11,
          edge.horizontal ? 0.15 : 2
        );
        const line = new THREE.Mesh(lineGeo, lineMat);
        const offset = (i / lineCount - 0.5) * length;
        line.position.set(
          x + (edge.horizontal ? offset : 0),
          0.06,
          z + (edge.horizontal ? 0 : offset)
        );
        root.add(line);
      }
    }
  });
}

function buildStreetLights(root, network, scene) {
  const spacing = 25; // meters between lights
  
  network.edges.forEach(edge => {
    const from = network.nodes[edge.from];
    const to = network.nodes[edge.to];
    
    const length = Math.abs(edge.horizontal ? (to.x - from.x) : (to.z - from.z));
    const count = Math.floor(length / spacing);
    
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      
      // Offset to side of road
      const offset = network.roadWidth / 2 + 1;
      const offsetX = edge.horizontal ? 0 : offset;
      const offsetZ = edge.horizontal ? offset : 0;
      
      // Build light on both sides
      buildStreetLight(root, scene, x + offsetX, z + offsetZ);
      buildStreetLight(root, scene, x - offsetX, z - offsetZ);
    }
  });
}

function buildStreetLight(root, scene, x, z) {
  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, 3, z);
  pole.castShadow = true;
  root.add(pole);
  
  // Light bulb
  const bulbGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(x, 6, z);
  root.add(bulb);
  
  // Point light
  const light = new THREE.PointLight(0xffffaa, 0.8, 20);
  light.position.set(x, 6, z);
  light.castShadow = true;
  light.shadow.mapSize.set(256, 256);
  scene.add(light);
}

function buildBlocks(root, network, colliders, rng) {
  const size = network.gridSize;
  
  for (let ix = 0; ix < size; ix++) {
    for (let iz = 0; iz < size; iz++) {
      buildBlock(root, network, ix, iz, colliders, rng);
    }
  }
}

function buildBlock(root, network, ix, iz, colliders, rng) {
  const node = network.getNode(ix, iz);
  const blockSize = network.blockSize;
  const sidewalk = CITY.sidewalkWidth;
  
  // Central position of the block
  const centerX = node.x + (blockSize + network.roadWidth) / 2;
  const centerZ = node.z + (blockSize + network.roadWidth) / 2;
  
  // Sidewalk slab
  const slabSize = blockSize - sidewalk * 2;
  const slabGeo = new THREE.BoxGeometry(slabSize, CITY.curbHeight, slabSize);
  const slabMat = new THREE.MeshStandardMaterial({ 
    color: COLORS.sidewalk,
    roughness: 0.9 
  });
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.set(centerX, CITY.curbHeight / 2, centerZ);
  slab.receiveShadow = true;
  slab.castShadow = true;
  root.add(slab);
  
  // Decide if this is a park or has buildings
  const isPark = rng() < 0.15;
  
  if (isPark) {
    buildPark(root, centerX, centerZ, slabSize, rng);
  } else {
    buildBuildings(root, centerX, centerZ, slabSize, colliders, rng);
  }
}

function buildPark(root, centerX, centerZ, size, rng) {
  // Grass
  const grassGeo = new THREE.BoxGeometry(size * 0.9, 0.2, size * 0.9);
  const grassMat = new THREE.MeshStandardMaterial({ 
    color: 0x2d5a3d,
    roughness: 0.95 
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.position.set(centerX, CITY.curbHeight + 0.1, centerZ);
  grass.receiveShadow = true;
  root.add(grass);
  
  // Trees
  const treeCount = randInt(rng, 3, 6);
  for (let i = 0; i < treeCount; i++) {
    const tx = centerX + rand(rng, -size * 0.3, size * 0.3);
    const tz = centerZ + rand(rng, -size * 0.3, size * 0.3);
    buildTree(root, tx, tz, rng);
  }
}

function buildTree(root, x, z, rng) {
  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, CITY.curbHeight + 2, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  root.add(trunk);
  
  // Foliage
  const foliageGeo = new THREE.SphereGeometry(2.5, 8, 8);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
  const foliage = new THREE.Mesh(foliageGeo, foliageMat);
  foliage.position.set(x, CITY.curbHeight + 5, z);
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  root.add(foliage);
}

function buildBuildings(root, centerX, centerZ, blockSize, colliders, rng) {
  // Split block into 1-4 buildings
  const lotCount = randInt(rng, 1, 3);
  
  if (lotCount === 1) {
    buildBuilding(root, centerX, centerZ, blockSize * 0.85, blockSize * 0.85, colliders, rng);
  } else {
    const lotSize = blockSize / 2;
    const offset = lotSize / 2;
    
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        if (rng() > 0.2) {
          const lx = centerX + (i - 0.5) * lotSize;
          const lz = centerZ + (j - 0.5) * lotSize;
          buildBuilding(root, lx, lz, lotSize * 0.8, lotSize * 0.8, colliders, rng);
        }
      }
    }
  }
}

function buildBuilding(root, x, z, width, depth, colliders, rng) {
  const height = rand(rng, CITY.buildingMinHeight, CITY.buildingMaxHeight);
  const floors = Math.floor(height / 3);
  
  // Building structure
  const buildingGeo = new THREE.BoxGeometry(width, height, depth);
  const buildingMat = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color().setHSL(rand(rng, 0, 1), rand(rng, 0.1, 0.3), rand(rng, 0.6, 0.85)),
    roughness: 0.8 
  });
  const building = new THREE.Mesh(buildingGeo, buildingMat);
  building.position.set(x, CITY.curbHeight + height / 2, z);
  building.castShadow = true;
  building.receiveShadow = true;
  root.add(building);
  
  // Windows
  const windowMat = new THREE.MeshStandardMaterial({ 
    color: rand(rng, 0, 1) < 0.7 ? 0xffffdd : 0x111111,
    emissive: rand(rng, 0, 1) < 0.7 ? 0xffff88 : 0x000000,
    emissiveIntensity: 0.8,
    roughness: 0.3
  });
  
  for (let f = 0; f < floors; f++) {
    const windowsPerRow = Math.floor(width / 2.5);
    for (let w = 0; w < windowsPerRow; w++) {
      if (rng() > 0.3) {
        const windowGeo = new THREE.BoxGeometry(1, 1.5, 0.05);
        const window1 = new THREE.Mesh(windowGeo, windowMat);
        window1.position.set(
          x + (w - windowsPerRow / 2) * 2.5,
          CITY.curbHeight + f * 3 + 2,
          z + depth / 2 + 0.1
        );
        root.add(window1);
        
        const window2 = new THREE.Mesh(windowGeo, windowMat);
        window2.position.set(
          x + (w - windowsPerRow / 2) * 2.5,
          CITY.curbHeight + f * 3 + 2,
          z - depth / 2 - 0.1
        );
        root.add(window2);
      }
    }
  }
  
  // Add to colliders
  colliders.push({
    x,
    z,
    width,
    depth,
    height,
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    kind: 'building',
  });
}
