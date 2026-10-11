import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/*
  Campus Plus scene
  -----------------
  This is a compact, production-friendly version of the supplied ghost scene.
  The original orange emissive palette has been replaced by an electric blue
  palette in the ghost body, eyes, particles, bloom, preloader, and reveal.
*/

function reportSceneFailure(error) {
  console.error("[Campus Plus] WebGL scene failed; using the resilient static fallback.", error);
  if (typeof window.CampusPlusFallback === "function") {
    window.CampusPlusFallback(true);
  } else {
    window.dispatchEvent(new CustomEvent("campusplus:fallback"));
  }
}

function boot() {
const BLUE = {
  body: 0x06284d,
  bright: 0x147dff,
  light: 0x5cdcff,
  deep: 0x020713,
  eye: 0x4cdcff
};

const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

class PreloaderManager {
  constructor() {
    this.preloader = document.getElementById("preloader");
    this.mainContent = document.getElementById("main-content");
    this.progressBar = document.querySelector(".progress-bar");
    this.totalSteps = 5;
    this.isComplete = false;
  }

  updateProgress(step) {
    const percentage = (Math.min(step, this.totalSteps) / this.totalSteps) * 100;
    this.progressBar.style.width = `${percentage}%`;
  }

  complete() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.updateProgress(this.totalSteps);

    window.setTimeout(() => {
      if (typeof window.CampusPlusRevealShell === "function") {
        window.CampusPlusRevealShell();
      } else {
        document.documentElement.classList.add("scene-revealed");
        this.preloader.classList.add("fade-out");
        this.mainContent.classList.add("fade-in");
        window.setTimeout(() => {
          this.preloader.style.display = "none";
        }, 760);
      }
    }, 380);
  }
}

const preloader = new PreloaderManager();
preloader.updateProgress(1);

const capabilityCanvas = document.createElement("canvas");
if (!capabilityCanvas.getContext("webgl2") && !capabilityCanvas.getContext("webgl")) {
  throw new Error("WebGL is unavailable in this browser.");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(BLUE.deep);

const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 0, 20);
preloader.updateProgress(2);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  alpha: false,
  stencil: false,
  depth: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(BLUE.deep, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.className = "scene-canvas";
renderer.domElement.setAttribute("aria-hidden", "true");
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.82,
  0.8,
  0.2
);
composer.addPass(bloomPass);
preloader.updateProgress(3);

// A restrained VHS / analog finish, matching the atmosphere of the reference.
const analogDecayShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uIntensity: { value: 0.46 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uIntensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      float frame = floor(uTime * 60.0);
      float jitter = (hash(vec2(frame, 2.0)) - 0.5) * 0.0022 * uIntensity;
      uv.x += jitter;

      float chroma = 0.0028 * uIntensity * (0.5 + 0.5 * sin(uTime * 2.0 + uv.y * 22.0));
      float red = texture2D(tDiffuse, uv + vec2(chroma, 0.0)).r;
      float green = texture2D(tDiffuse, uv).g;
      float blue = texture2D(tDiffuse, uv - vec2(chroma, 0.0)).b;
      vec3 color = vec3(red, green, blue);

      float grain = hash(uv * uResolution.xy + frame) - 0.5;
      color += grain * 0.036 * uIntensity;

      float scanline = 0.5 + 0.5 * sin(uv.y * uResolution.y * 1.55);
      color *= 1.0 - scanline * 0.045 * uIntensity;

      vec2 vignetteUv = uv * (1.0 - uv.yx);
      float vignette = vignetteUv.x * vignetteUv.y * 16.0;
      color *= mix(0.68, 1.0, pow(vignette, 0.25));

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const analogPass = new ShaderPass(analogDecayShader);
composer.addPass(analogPass);
composer.addPass(new OutputPass());

// ------- Ambient reveal behind the ghost -------
const atmosphereGeometry = new THREE.PlaneGeometry(70, 48);
const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: {
    ghostPosition: { value: new THREE.Vector3() },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorldPosition = world.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 ghostPosition;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      float d = distance(vWorldPosition.xy, ghostPosition.xy);
      float pulse = sin(time * 1.6) * 0.7 + sin(time * 0.59) * 0.45;
      float halo = 1.0 - smoothstep(1.5, 12.8 + pulse, d);
      float outer = 1.0 - smoothstep(5.0, 22.0, d);
      float grain = noise(vUv * 180.0 + time * 0.07) * 0.022;

      vec3 base = vec3(0.003, 0.012, 0.034);
      vec3 reveal = vec3(0.005, 0.07, 0.21) * halo;
      vec3 haze = vec3(0.0, 0.025, 0.10) * outer * 0.3;
      gl_FragColor = vec4(base + reveal + haze + grain, 1.0);
    }
  `,
  depthWrite: false,
  depthTest: false
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
atmosphere.position.z = -18;
atmosphere.renderOrder = -10;
scene.add(atmosphere);

// ------- Blue ghost -------
const ghostGroup = new THREE.Group();
// Kept deliberately compact so it reads as a cursor companion, not a hero object.
ghostGroup.scale.setScalar(0.72);
scene.add(ghostGroup);

const ghostGeometry = new THREE.SphereGeometry(2, 48, 36);
const ghostPositions = ghostGeometry.attributes.position;
for (let i = 0; i < ghostPositions.count; i += 1) {
  const x = ghostPositions.getX(i);
  const y = ghostPositions.getY(i);
  const z = ghostPositions.getZ(i);

  // Turn the lower half into a softly irregular spectral hem.
  if (y < -0.18) {
    const waves =
      Math.sin(x * 4.8) * 0.27 +
      Math.cos(z * 5.5) * 0.2 +
      Math.sin((x + z) * 2.8) * 0.14;
    ghostPositions.setY(i, -2.0 + waves);
  }
}
ghostPositions.needsUpdate = true;
ghostGeometry.computeVertexNormals();

const ghostMaterial = new THREE.MeshPhysicalMaterial({
  color: BLUE.body,
  emissive: BLUE.bright,
  emissiveIntensity: 2.25,
  roughness: 0.2,
  metalness: 0.02,
  transparent: true,
  opacity: 0.93,
  clearcoat: 0.75,
  clearcoatRoughness: 0.16,
  side: THREE.DoubleSide
});
const ghostBody = new THREE.Mesh(ghostGeometry, ghostMaterial);
ghostGroup.add(ghostBody);

const innerLight = new THREE.PointLight(BLUE.light, 3.6, 11, 2);
innerLight.position.set(0, 0.2, 2.2);
ghostGroup.add(innerLight);

const ambient = new THREE.AmbientLight(0x12355f, 0.28);
scene.add(ambient);

const rimLeft = new THREE.DirectionalLight(0x1788ff, 1.25);
rimLeft.position.set(-8, 7, 6);
scene.add(rimLeft);

const rimRight = new THREE.DirectionalLight(0x69dfff, 0.75);
rimRight.position.set(7, -3, 4);
scene.add(rimRight);

function createEyes() {
  const group = new THREE.Group();
  ghostGroup.add(group);

  const socketGeometry = new THREE.SphereGeometry(0.46, 20, 16);
  const socketMaterial = new THREE.MeshBasicMaterial({ color: 0x00040a });
  const eyeGeometry = new THREE.SphereGeometry(0.235, 16, 12);
  const auraGeometry = new THREE.SphereGeometry(0.48, 16, 12);

  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: BLUE.eye,
    transparent: true,
    opacity: 0.14
  });
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: BLUE.light,
    transparent: true,
    opacity: 0.025,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });

  const sockets = [];
  const eyes = [];
  const auras = [];
  [-0.7, 0.7].forEach((x) => {
    const socket = new THREE.Mesh(socketGeometry, socketMaterial);
    socket.position.set(x, 0.56, 1.86);
    socket.scale.set(1.1, 1.0, 0.52);
    group.add(socket);
    sockets.push(socket);

    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(x, 0.56, 2.03);
    group.add(eye);
    eyes.push(eye);

    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    aura.position.set(x, 0.56, 1.97);
    group.add(aura);
    auras.push(aura);
  });

  return { eyes, auras, eyeMaterial, auraMaterial };
}

const eyes = createEyes();
preloader.updateProgress(4);

// ------- Floating sparks + a pointer-driven trail -------
const fireflyCount = 66;
const fireflyPositions = new Float32Array(fireflyCount * 3);
const fireflySeeds = new Float32Array(fireflyCount * 4);
for (let i = 0; i < fireflyCount; i += 1) {
  const i3 = i * 3;
  const i4 = i * 4;
  fireflyPositions[i3] = (Math.random() - 0.5) * 33;
  fireflyPositions[i3 + 1] = (Math.random() - 0.5) * 22;
  fireflyPositions[i3 + 2] = -7 - Math.random() * 8;
  fireflySeeds[i4] = Math.random() * Math.PI * 2;
  fireflySeeds[i4 + 1] = 0.3 + Math.random() * 0.8;
  fireflySeeds[i4 + 2] = fireflyPositions[i3];
  fireflySeeds[i4 + 3] = fireflyPositions[i3 + 1];
}

const fireflyGeometry = new THREE.BufferGeometry();
fireflyGeometry.setAttribute("position", new THREE.BufferAttribute(fireflyPositions, 3));
const fireflyMaterial = new THREE.PointsMaterial({
  color: 0x6ce1ff,
  size: 0.09,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true
});
const fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
scene.add(fireflies);

const trailCount = 180;
const trailPositions = new Float32Array(trailCount * 3);
const trailAlpha = new Float32Array(trailCount);
const trailGeometry = new THREE.BufferGeometry();
trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
trailGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(trailAlpha, 1));
const trailMaterial = new THREE.ShaderMaterial({
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  uniforms: { color: { value: new THREE.Color(0x1688ff) } },
  vertexShader: /* glsl */ `
    attribute float aAlpha;
    varying float vAlpha;
    void main() {
      vAlpha = aAlpha;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = (4.0 + aAlpha * 12.0) * (18.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    varying float vAlpha;
    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      float alpha = smoothstep(0.5, 0.04, d) * vAlpha;
      gl_FragColor = vec4(color, alpha);
    }
  `
});
const trail = new THREE.Points(trailGeometry, trailMaterial);
scene.add(trail);

const trailVelocity = Array.from({ length: trailCount }, () => new THREE.Vector3());
function emitTrail(amount) {
  const count = Math.min(amount, trailCount);
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    // Reuse the dimmest particles first. This avoids allocations during movement.
    if (trailAlpha[i] < 0.08 || Math.random() < 0.12) {
      trailPositions[i3] = ghostGroup.position.x + (Math.random() - 0.5) * 2.6;
      trailPositions[i3 + 1] = ghostGroup.position.y - 0.65 + (Math.random() - 0.5) * 2.4;
      trailPositions[i3 + 2] = -0.1 - Math.random() * 1.8;
      trailVelocity[i].set(
        (Math.random() - 0.5) * 0.035,
        (Math.random() - 0.4) * 0.035,
        -0.012 - Math.random() * 0.028
      );
      trailAlpha[i] = 0.55 + Math.random() * 0.45;
    }
  }
}

// ------- Interaction -------
const pointer = new THREE.Vector2(0, 0);
const previousPointer = new THREE.Vector2(0, 0);
const pointerVelocity = new THREE.Vector2();
let lastPointerTime = 0;

function updatePointer(clientX, clientY) {
  previousPointer.copy(pointer);
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  pointerVelocity.subVectors(pointer, previousPointer);
  lastPointerTime = performance.now();
}

function markInteracted() {
  if (document.documentElement.classList.contains("scene-revealed")) {
    document.documentElement.classList.add("has-interacted");
  }
}

window.addEventListener("pointermove", (event) => {
  markInteracted();
  updatePointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener("pointerdown", (event) => {
  markInteracted();
  updatePointer(event.clientX, event.clientY);
}, { passive: true });

function updateFromTouch(event) {
  const touch = event.touches[0];
  if (touch) {
    markInteracted();
    updatePointer(touch.clientX, touch.clientY);
  }
}

window.addEventListener("touchstart", updateFromTouch, { passive: true });
window.addEventListener("touchmove", updateFromTouch, { passive: true });

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
  analogPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  atmosphereMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
});

// ------- Animation -------
let lastFrame = performance.now();
let elapsed = 0;
let eyeEnergy = 0.1;
let renderFailed = false;

function animate(now) {
  if (renderFailed) return;
  requestAnimationFrame(animate);

  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  elapsed += delta;
  pointerVelocity.multiplyScalar(Math.pow(0.0001, delta));

  // Convert the pointer into camera-space coordinates. The small ghost can now
  // genuinely follow the cursor across the entire viewport without clipping.
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const viewWidth = viewHeight * camera.aspect;
  const edgePadding = 1.7;
  const targetX = pointer.x * Math.max(0, viewWidth / 2 - edgePadding);
  const targetY = pointer.y * Math.max(0, viewHeight / 2 - edgePadding);
  const before = ghostGroup.position.clone();
  const follow = 1.0 - Math.pow(0.0008, delta);

  ghostGroup.position.x += (targetX - ghostGroup.position.x) * follow;
  ghostGroup.position.y += (targetY - ghostGroup.position.y) * follow;

  const movement = before.distanceTo(ghostGroup.position);
  const pointerStill = now - lastPointerTime < 120;
  const kineticEnergy = Math.min(1, movement * 7 + pointerVelocity.length() * 8);
  eyeEnergy += (pointerStill ? kineticEnergy : 0.09 - eyeEnergy) * Math.min(1, delta * 7);

  const floatA = Math.sin(elapsed * 1.7) * 0.12;
  const floatB = Math.cos(elapsed * 0.71) * 0.075;
  ghostGroup.position.y += floatA * delta * 2.1 + floatB * delta;

  ghostBody.rotation.z += ((-pointerVelocity.x * 1.8) - ghostBody.rotation.z) * delta * 2.6;
  ghostBody.rotation.x += ((pointerVelocity.y * 1.25) - ghostBody.rotation.x) * delta * 2.6;
  ghostBody.rotation.y = Math.sin(elapsed * 0.9) * 0.08;

  const breath = 1 + Math.sin(elapsed * 1.45) * 0.032 + Math.sin(elapsed * 0.47) * 0.018;
  ghostBody.scale.setScalar(breath);
  ghostMaterial.emissiveIntensity = 2.08 + Math.sin(elapsed * 2.3) * 0.28 + eyeEnergy * 0.52;
  innerLight.intensity = 3.0 + eyeEnergy * 1.25;

  const eyeOpacity = 0.08 + eyeEnergy * 0.92;
  eyes.eyeMaterial.opacity = eyeOpacity;
  eyes.auraMaterial.opacity = 0.035 + eyeEnergy * 0.2;
  eyes.eyes.forEach((eye, index) => {
    const twinkle = 1 + Math.sin(elapsed * 6 + index * 0.85) * 0.08 * eyeEnergy;
    eye.scale.setScalar(twinkle);
  });

  atmosphereMaterial.uniforms.ghostPosition.value.copy(ghostGroup.position);
  atmosphereMaterial.uniforms.time.value = elapsed;
  analogPass.uniforms.uTime.value = elapsed;

  // drift the background fireflies in a small field
  for (let i = 0; i < fireflyCount; i += 1) {
    const i3 = i * 3;
    const i4 = i * 4;
    const phase = fireflySeeds[i4];
    const speed = fireflySeeds[i4 + 1];
    fireflyPositions[i3] = fireflySeeds[i4 + 2] + Math.sin(elapsed * speed + phase) * 0.8;
    fireflyPositions[i3 + 1] = fireflySeeds[i4 + 3] + Math.cos(elapsed * (speed * 0.72) + phase) * 0.6;
  }
  fireflyGeometry.attributes.position.needsUpdate = true;
  fireflyMaterial.opacity = 0.58 + Math.sin(elapsed * 1.7) * 0.14;

  if (pointerStill && kineticEnergy > 0.02) {
    emitTrail(Math.ceil(kineticEnergy * 13));
  }

  for (let i = 0; i < trailCount; i += 1) {
    if (trailAlpha[i] <= 0) continue;
    const i3 = i * 3;
    trailPositions[i3] += trailVelocity[i].x;
    trailPositions[i3 + 1] += trailVelocity[i].y;
    trailPositions[i3 + 2] += trailVelocity[i].z;
    trailVelocity[i].y -= 0.00018;
    trailAlpha[i] = Math.max(0, trailAlpha[i] - delta * (0.64 + (i % 5) * 0.07));
  }
  trailGeometry.attributes.position.needsUpdate = true;
  trailGeometry.attributes.aAlpha.needsUpdate = true;

  try {
    composer.render();
  } catch (error) {
    renderFailed = true;
    reportSceneFailure(error);
  }
}

// Reveal the reliable HTML shell first. The heavier post-processing scene joins
// after the browser has had a chance to paint the page instead of blocking it.
preloader.updateProgress(5);
preloader.complete();

window.setTimeout(() => {
  try {
    composer.render();
    if (document.documentElement.dataset.sceneState === "failed") {
      renderer.domElement.remove();
      return;
    }

    // Cross-fade from the static blue ghost into the live 3D scene.
    renderer.domElement.classList.add("fade-in");
    document.documentElement.dataset.sceneState = "ready";
    document.documentElement.classList.add("webgl-ready");

    // Start just off the title so the ghost is visible before the first cursor move.
    updatePointer(window.innerWidth * 0.72, window.innerHeight * 0.62);
    if (!prefersReducedMotion) {
      animate(performance.now());
    }
  } catch (error) {
    reportSceneFailure(error);
  }
}, 720);
}

try {
  boot();
} catch (error) {
  reportSceneFailure(error);
}
