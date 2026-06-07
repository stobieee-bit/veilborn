import * as THREE from "three";

/**
 * A gradient sky dome (large back-faced sphere with a vertical color ramp).
 * DayNightCycle drives the top/bottom colors to sell dawn/day/dusk/night.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(radius: number) {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x9a6b3f) },
        bottomColor: { value: new THREE.Color(0xd8a36a) },
        offset: { value: 40.0 },
        exponent: { value: 0.55 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, clamp(t, 0.0, 1.0)), 1.0);
        }
      `,
    });

    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  setColors(top: THREE.Color, bottom: THREE.Color): void {
    this.material.uniforms.topColor.value.copy(top);
    this.material.uniforms.bottomColor.value.copy(bottom);
  }
}
