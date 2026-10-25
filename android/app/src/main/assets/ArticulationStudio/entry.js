import * as THREE from './vendor/three.module.js';
  import { createCharacter } from './rig.js';
  import { createController, presets } from './controller.js';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef3ed');
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.08, 8.2);
  camera.lookAt(0, -0.25, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';
  document.body.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#fffbea', '#728a6d', 2.3));
  const light = new THREE.DirectionalLight('#ffe8d0', 3.2);
  light.position.set(-3, 5, 6);
  scene.add(light);
  const rig = createCharacter();
  scene.add(rig.group);
  const controller = createController(state => rig.update(state));
  const available = new Set(presets.map(preset => preset.id));
  const glides = {
    ay: [{ viseme: 'aa', duration: 360 }, { viseme: 'ih', duration: 420 }],
    ey: [{ viseme: 'eh', duration: 360 }, { viseme: 'ee', duration: 420 }],
    aw: [{ viseme: 'aa', duration: 360 }, { viseme: 'oo', duration: 420 }],
  };

  window.speechlySetViseme = id => {
    if (glides[id]) controller.playSequence(glides[id], { speed: 0.8 });
    else if (available.has(id)) controller.setViseme(id, { duration: 320 });
  };
  window.speechlyPlaySequence = ids => {
    const frames = [{ viseme: 'neutral', duration: 180 }];
    for (const id of ids.slice(0, 24)) {
      if (glides[id]) frames.push(...glides[id]);
      else if (available.has(id)) frames.push({ viseme: id, duration: 340 });
    }
    frames.push({ viseme: 'neutral', duration: 280 });
    controller.playSequence(frames, { speed: 0.72 });
  };
  let yaw = 0;
  let pitch = 0.04;
  const target = new THREE.Vector3(0, -0.25, 0);
  const radius = 8.2;
  const positionCamera = () => {
    camera.position.set(radius * Math.sin(yaw) * Math.cos(pitch),
                        target.y + radius * Math.sin(pitch),
                        radius * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target);
  };
  window.speechlySetView = view => {
    yaw = view === 'side' ? Math.PI / 2 : 0;
    pitch = 0.04;
    positionCamera();
  };
  let drag = null;
  renderer.domElement.addEventListener('pointerdown', event => {
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.cursor = 'grabbing';
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    yaw -= (event.clientX - drag.x) * 0.012;
    pitch = THREE.MathUtils.clamp(pitch - (event.clientY - drag.y) * 0.008, -0.55, 0.55);
    drag.x = event.clientX;
    drag.y = event.clientY;
    positionCamera();
  });
  const stopDrag = event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    renderer.domElement.style.cursor = 'grab';
  };
  renderer.domElement.addEventListener('pointerup', stopDrag);
  renderer.domElement.addEventListener('pointercancel', stopDrag);
  positionCamera();

  function resize() {
    const width = Math.max(1, document.body.clientWidth);
    const height = Math.max(1, document.body.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  new ResizeObserver(resize).observe(document.body);
  resize();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  addEventListener('pagehide', () => {
    controller.destroy();
    renderer.setAnimationLoop(null);
    rig.dispose();
    renderer.dispose();
  }, { once: true });
  window.speechlyReady = true;
  window.dispatchEvent(new Event('speechly-ready'));
