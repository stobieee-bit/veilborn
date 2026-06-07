import * as THREE from "three";
import { CONFIG } from "../config";
import {
  ModuleType,
  type Ingredient,
  type ModuleCollision,
  type ModuleInteract,
  type ModuleSnap,
} from "../core/types";

const CELL = CONFIG.build.cell;
const FLOOR = CONFIG.build.floor;

export interface ModuleDef {
  type: ModuleType;
  name: string;
  snap: ModuleSnap;
  collision: ModuleCollision;
  cost: Ingredient[];
  interact?: ModuleInteract;
  /** Builds a fresh visual (local anchor on the ground/edge it snaps to). */
  create(): THREE.Object3D;
}

// --- shared materials -------------------------------------------------------
const alloy = (c: number, rough = 0.8, metal = 0.15) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

function foundationMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.3, CELL), alloy(0x8a8170));
  slab.position.y = 0.15;
  g.add(slab);
  const legGeo = new THREE.BoxGeometry(0.2, 1.2, 0.2);
  const legMat = alloy(0x6d655a);
  for (const sx of [-0.85, 0.85])
    for (const sz of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx, -0.6, sz);
      g.add(leg);
    }
  return g;
}

function wallMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(CELL, FLOOR, 0.18),
    alloy(0x9a9182),
  );
  wall.position.y = FLOOR / 2;
  g.add(wall);
  return g;
}

function doorwayMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = alloy(0x9a9182);
  for (const sx of [-0.85, 0.85]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.3, FLOOR, 0.18), mat);
    jamb.position.set(sx, FLOOR / 2, 0);
    g.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.5, 0.18), mat);
  lintel.position.y = FLOOR - 0.25;
  g.add(lintel);
  return g;
}

function roofMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.18, CELL), alloy(0x6f6a5e));
  g.add(slab);
  return g;
}

function firePitMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.17, 6, 12),
    alloy(0x554f48, 1, 0),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  const embers = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({
      color: 0x3a1a08,
      emissive: 0xff6a1a,
      emissiveIntensity: 1.4,
      roughness: 1,
      flatShading: true,
    }),
  );
  embers.position.y = 0.2;
  g.add(embers);
  const light = new THREE.PointLight(0xff7a2a, 3.2, 14, 1.6);
  light.position.y = 0.8;
  light.userData.isFireLight = true;
  g.add(light);
  return g;
}

function sleepingPodMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.4, 6, 12),
    alloy(0x39505b, 0.5, 0.4),
  );
  shell.rotation.z = Math.PI / 2;
  shell.position.y = 0.6;
  g.add(shell);
  const glass = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.0, 4, 12),
    new THREE.MeshStandardMaterial({
      color: 0x0c2630,
      emissive: 0x3fc9e0,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    }),
  );
  glass.rotation.z = Math.PI / 2;
  glass.position.set(0, 0.92, 0);
  g.add(glass);
  return g;
}

function storageCrateMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.9, 1.1),
    alloy(0x6b5a3e, 0.9, 0.05),
  );
  body.position.y = 0.45;
  g.add(body);
  const bandMat = alloy(0x3c342a, 0.8, 0.3);
  for (const by of [0.2, 0.7]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.1, 1.14), bandMat);
    band.position.y = by;
    g.add(band);
  }
  return g;
}

function fabricatorMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.95), alloy(0x4a5158, 0.7, 0.4));
  base.position.y = 0.25;
  g.add(base);
  const bedMat = new THREE.MeshStandardMaterial({
    color: 0x0c2e2a,
    emissive: 0x2fe0c0,
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.75), bedMat);
  bed.position.y = 0.53;
  g.add(bed);
  const armMat = alloy(0x6a7178, 0.6, 0.5);
  for (const px of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), armMat);
    post.position.set(px, 1.0, -0.35);
    g.add(post);
  }
  const gantry = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.14, 0.2), armMat);
  gantry.position.set(0, 1.55, -0.35);
  g.add(gantry);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.24, 6),
    new THREE.MeshStandardMaterial({ color: 0x102b28, emissive: 0x3fe6c8, emissiveIntensity: 1.4 }),
  );
  head.position.set(0, 1.34, -0.2);
  g.add(head);
  return g;
}

function powerNodeMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const pylon = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.6, 0.34),
    alloy(0x44484f, 0.6, 0.5),
  );
  pylon.position.y = 0.8;
  g.add(pylon);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({
      color: 0x0c2e2a,
      emissive: 0x3fe6c8,
      emissiveIntensity: 1.6,
      roughness: 0.3,
      flatShading: true,
    }),
  );
  core.position.y = 1.75;
  g.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(CONFIG.build.powerRadius, 0.06, 4, 48),
    new THREE.MeshStandardMaterial({
      color: 0x0c2e2a,
      emissive: 0x2fb9a0,
      emissiveIntensity: 0.8,
      roughness: 0.5,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  return g;
}

function medicalStationMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.9), alloy(0xcdd2d6, 0.5, 0.2));
  bed.position.y = 0.5;
  g.add(bed);
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2a4a55, roughness: 0.6 }),
  );
  pillow.position.set(0, 0.78, -0.6);
  g.add(pillow);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), alloy(0x6a7178, 0.6, 0.5));
  arm.position.set(0.5, 1.05, 0.7);
  g.add(arm);
  const crossMat = new THREE.MeshStandardMaterial({
    color: 0x102b28,
    emissive: 0x4fe0c0,
    emissiveIntensity: 1.2,
  });
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.04), crossMat);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.04), crossMat);
  cv.position.set(0.5, 1.7, 0.7);
  ch.position.set(0.5, 1.7, 0.7);
  g.add(cv, ch);
  return g;
}

function condenserMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.55, 1.4, 12),
    alloy(0x5a6168, 0.5, 0.4),
  );
  tank.position.y = 0.7;
  g.add(tank);
  const gauge = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.7, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x0c2630,
      emissive: 0x3fa8d0,
      emissiveIntensity: 0.9,
    }),
  );
  gauge.position.set(0, 0.7, 0.56);
  g.add(gauge);
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.06, 6, 18),
    alloy(0x7a8088, 0.4, 0.6),
  );
  coil.rotation.x = Math.PI / 2;
  coil.position.y = 1.2;
  g.add(coil);
  return g;
}

function lightPostMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6),
    alloy(0x4a4640, 0.7, 0.3),
  );
  pole.position.y = 1.1;
  g.add(pole);
  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({
      color: 0x2a2410,
      emissive: 0xffc070,
      emissiveIntensity: 1.4,
      flatShading: true,
    }),
  );
  head.position.y = 2.3;
  g.add(head);
  const light = new THREE.PointLight(0xffc070, 2.2, 16, 1.6);
  light.position.y = 2.3;
  g.add(light);
  return g;
}

function perimeterSpikeMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.2, 8),
    alloy(0x4a3a2a, 1, 0),
  );
  base.position.y = 0.1;
  g.add(base);
  const spikeMat = alloy(0x8a8170, 0.6, 0.3);
  for (const [sx, sz] of [[0, 0], [0.28, 0.18], [-0.28, 0.18], [0.2, -0.26], [-0.2, -0.26]]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.0, 5), spikeMat);
    spike.position.set(sx, 0.6, sz);
    g.add(spike);
  }
  return g;
}

export const MODULES: ModuleDef[] = [
  {
    type: ModuleType.Foundation,
    name: "Foundation",
    snap: "cell",
    collision: "none",
    cost: [{ itemId: "ash_sediment", quantity: 4 }, { itemId: "fiber_frond", quantity: 1 }],
    create: foundationMesh,
  },
  {
    type: ModuleType.Wall,
    name: "Wall",
    snap: "edge",
    collision: "wall",
    cost: [{ itemId: "ash_sediment", quantity: 2 }, { itemId: "fiber_frond", quantity: 1 }],
    create: wallMesh,
  },
  {
    type: ModuleType.Doorway,
    name: "Doorway",
    snap: "edge",
    collision: "door",
    cost: [{ itemId: "ash_sediment", quantity: 2 }, { itemId: "fiber_frond", quantity: 1 }],
    create: doorwayMesh,
  },
  {
    type: ModuleType.Roof,
    name: "Roof",
    snap: "roof",
    collision: "none",
    cost: [{ itemId: "ash_sediment", quantity: 3 }, { itemId: "fiber_frond", quantity: 2 }],
    create: roofMesh,
  },
  {
    type: ModuleType.FirePit,
    name: "Fire Pit",
    snap: "prop",
    collision: "cylinder",
    interact: "cook", // GDD §4.3 — cook raw food at the fire
    cost: [{ itemId: "ash_sediment", quantity: 3 }, { itemId: "fiber_frond", quantity: 2 }],
    create: firePitMesh,
  },
  {
    type: ModuleType.SleepingPod,
    name: "Sleeping Pod",
    snap: "prop",
    collision: "cylinder",
    interact: "sleep",
    cost: [{ itemId: "ash_sediment", quantity: 4 }, { itemId: "fiber_frond", quantity: 4 }],
    create: sleepingPodMesh,
  },
  {
    type: ModuleType.StorageCrate,
    name: "Storage Crate",
    snap: "prop",
    collision: "cylinder",
    interact: "storage",
    cost: [{ itemId: "ash_sediment", quantity: 3 }, { itemId: "fiber_frond", quantity: 3 }],
    create: storageCrateMesh,
  },
  {
    type: ModuleType.PowerNode,
    name: "Power Node",
    snap: "prop",
    collision: "cylinder",
    cost: [{ itemId: "ash_sediment", quantity: 5 }, { itemId: "fiber_frond", quantity: 2 }],
    create: powerNodeMesh,
  },
  {
    type: ModuleType.Fabricator,
    name: "Fabricator",
    snap: "prop",
    collision: "cylinder",
    interact: "fabricator",
    cost: [
      { itemId: "ash_sediment", quantity: 6 },
      { itemId: "fiber_frond", quantity: 4 },
      { itemId: "ship_alloy_scrap", quantity: 2 },
    ],
    create: fabricatorMesh,
  },
  {
    type: ModuleType.MedicalStation,
    name: "Medical Station",
    snap: "prop",
    collision: "cylinder",
    interact: "medical",
    cost: [
      { itemId: "ash_sediment", quantity: 6 },
      { itemId: "fiber_frond", quantity: 4 },
      { itemId: "alloy_frame", quantity: 1 },
      { itemId: "ship_alloy_scrap", quantity: 2 },
    ],
    create: medicalStationMesh,
  },
  {
    type: ModuleType.Condenser,
    name: "Condenser",
    snap: "prop",
    collision: "cylinder",
    interact: "condenser",
    cost: [
      { itemId: "ash_sediment", quantity: 5 },
      { itemId: "fiber_frond", quantity: 3 },
      { itemId: "ship_alloy_scrap", quantity: 1 },
    ],
    create: condenserMesh,
  },
  {
    type: ModuleType.LightPost,
    name: "Light Post",
    snap: "prop",
    collision: "cylinder",
    cost: [
      { itemId: "ash_sediment", quantity: 3 },
      { itemId: "fiber_frond", quantity: 1 },
      { itemId: "bioluminite", quantity: 1 },
    ],
    create: lightPostMesh,
  },
  {
    type: ModuleType.PerimeterSpike,
    name: "Perimeter Spike",
    snap: "prop",
    collision: "cylinder",
    cost: [
      { itemId: "ash_sediment", quantity: 2 },
      { itemId: "spine_crystal_shard", quantity: 1 },
    ],
    create: perimeterSpikeMesh,
  },
];

export const MODULE_BY_TYPE = Object.fromEntries(
  MODULES.map((m) => [m.type, m]),
) as Record<ModuleType, ModuleDef>;
