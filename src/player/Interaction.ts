import * as THREE from "three";
import { CONFIG } from "../config";
import type { PlacedModule } from "../building/BuildSystem";
import type { LoreFragment } from "../core/types";
import type { CrashSite } from "../data/crashsites";
import type { ResourceNode, World } from "../world/World";

export type InteractTarget =
  | { kind: "resource"; verb: string; label: string; node: ResourceNode }
  | { kind: "module"; verb: string; label: string; module: PlacedModule }
  | { kind: "lore"; verb: string; label: string; fragment: LoreFragment }
  | { kind: "crash"; verb: string; label: string; site: CrashSite }
  | { kind: "signal"; verb: string; label: string };

/**
 * Center-screen raycast that finds whatever the player can interact with within
 * reach — a gatherable resource node or an interactable base module (sleeping
 * pod / storage crate).
 */
export class Interaction {
  current: InteractTarget | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly center = new THREE.Vector2(0, 0);
  // Reused raycast-input buffer (avoids a fresh combined array each frame).
  private readonly targets: THREE.Object3D[] = [];

  update(
    camera: THREE.Camera,
    world: World,
    moduleObjects: THREE.Object3D[],
    loreObjects: THREE.Object3D[],
    crashObjects: THREE.Object3D[],
  ): void {
    this.raycaster.setFromCamera(this.center, camera);
    this.raycaster.far = CONFIG.player.interactDistance;

    const targets = this.targets;
    targets.length = 0;
    const nodeMeshes = world.gatherableMeshes();
    for (let i = 0; i < nodeMeshes.length; i++) targets.push(nodeMeshes[i]);
    for (let i = 0; i < moduleObjects.length; i++) targets.push(moduleObjects[i]);
    for (let i = 0; i < loreObjects.length; i++) targets.push(loreObjects[i]);
    for (let i = 0; i < crashObjects.length; i++) targets.push(crashObjects[i]);
    const hits = this.raycaster.intersectObjects(targets, true);

    this.current = null;
    if (hits.length === 0) return;

    const resolved = resolve(hits[0].object);
    if (!resolved) return;

    if ("node" in resolved) {
      const node = resolved.node;
      this.current = { kind: "resource", verb: node.promptVerb, label: node.label, node };
    } else if ("module" in resolved) {
      const m = resolved.module;
      let verb: string;
      let label = m.def.name;
      if (!m.def.interact) {
        // A damaged shell piece — the only reason it's interactable (GDD §6.1).
        verb = "Repair";
        label = `${m.def.name} (${Math.round(m.integrity)}%)`;
      } else {
        verb =
          m.def.interact === "sleep"
            ? "Rest & Save"
            : m.def.interact === "fabricator"
              ? "Use"
              : m.def.interact === "medical"
                ? "Augments"
                : m.def.interact === "condenser"
                  ? "Drink"
                  : m.def.interact === "cook"
                    ? "Cook"
                    : m.def.interact === "refuel"
                      ? "Refuel"
                      : m.def.interact === "farm"
                        ? "Tend"
                        : "Open";
      }
      this.current = { kind: "module", verb, label, module: m };
    } else if ("fragment" in resolved) {
      this.current = { kind: "lore", verb: "Recover", label: resolved.fragment.title, fragment: resolved.fragment };
    } else if ("site" in resolved) {
      this.current = { kind: "crash", verb: "Salvage", label: resolved.site.name, site: resolved.site };
    } else {
      this.current = { kind: "signal", verb: "Repair", label: "Signal Array" };
    }
  }
}

/** Walk up the hit object's parents to find what it represents. */
function resolve(
  obj: THREE.Object3D,
):
  | { node: ResourceNode }
  | { module: PlacedModule }
  | { fragment: LoreFragment }
  | { site: CrashSite }
  | { signal: true }
  | null {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.userData.resourceNode) return { node: o.userData.resourceNode };
    if (o.userData.placedModule) return { module: o.userData.placedModule };
    if (o.userData.loreFragment) return { fragment: o.userData.loreFragment };
    if (o.userData.crashSite) return { site: o.userData.crashSite };
    if (o.userData.signalArray) return { signal: true };
    o = o.parent;
  }
  return null;
}
