import * as THREE from './vendor/three.module.js';

/**
 * A self-contained, procedural facial articulation rig.
 * Y is up and the character looks along +Z. All controls are normalized to 0–1,
 * except tongueLeft, which is normalized to −1–1.
 */
export function createCharacter() {
  const group = new THREE.Group();
  group.name = 'ArticulationBoy';
  const geometries = new Set();
  const materials = new Set();
  const materialRoles = new Map();
  const solidMaterials = new Map();
  const trackedMeshes = [];
  let cutaway = false;
  let wireframe = false;

  function material(color, role = 'detail', options = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.73, metalness: 0, ...options });
    materials.add(mat);
    materialRoles.set(mat, role);
    solidMaterials.set(mat, { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite });
    return mat;
  }
  const skin = material('#ffd0a5', 'skin');
  const earSkin = material('#ffc398', 'skin');
  const earInner = material('#f59c7f', 'skin');
  const blush = material('#f5a08b', 'blush', { transparent: true, opacity: 0.48 });
  const hair = material('#453025', 'hair', { roughness: 0.91 });
  const hairLight = material('#533b2d', 'hair', { roughness: 0.88 });
  const hairDark = material('#3a281f', 'hair', { roughness: 0.94 });
  const eyeWhite = material('#fffaf0', 'eye', { roughness: 0.44 });
  const iris = material('#34271f', 'eye', { roughness: 0.35 });
  const pupil = material('#171714', 'eye', { roughness: 0.26 });
  const gleam = material('#ffffff', 'eye', { emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.15 });
  const nostril = material('#c77d63', 'skin', { roughness: 0.9 });
  const upperLipMat = material('#e98b79', 'lips', { roughness: 0.63 });
  const lowerLipMat = material('#f5a18a', 'lips', { roughness: 0.58 });
  const mouthMat = material('#511f27', 'cavity', { roughness: 0.96, side: THREE.DoubleSide });
  const palateMat = material('#b96c70', 'palate', { roughness: 0.8 });
  const toothMat = material('#fff8e7', 'teeth', { roughness: 0.38 });
  const tongueMat = material('#ee8695', 'tongue', { roughness: 0.62 });
  const tongueLineMat = material('#cf657b', 'tongue', { roughness: 0.8 });
  const hoodieMat = material('#76b5e3', 'hoodie', { roughness: 0.92 });
  const hoodieShadow = material('#4d91c4', 'hoodie', { roughness: 0.94 });
  const hoodieLight = material('#9bcdf0', 'hoodie', { roughness: 0.93 });
  const shirtMat = material('#e5f3fa', 'hoodie', { roughness: 0.9 });

  function mesh(geometry, mat, name, parent = group) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.name = name;
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    trackedMeshes.push(object);
    return object;
  }
  const unitSphere = new THREE.SphereGeometry(1, 40, 28);
  geometries.add(unitSphere);
  function ellipsoid(name, mat, position, scale, parent = group) {
    const object = mesh(unitSphere, mat, name, parent);
    object.position.set(...position);
    object.scale.set(...scale);
    return object;
  }
  function curveTube(name, points, radius, mat, parent = group) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, 32, radius, 8, false), mat, name, parent);
  }
  const clamp = THREE.MathUtils.clamp;
  const mix = THREE.MathUtils.lerp;
  const smooth = x => { const v = clamp(x, 0, 1); return v * v * (3 - 2 * v); };
  const gaussian = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

  const rx = 1.24, ry = 1.51, rz = 1.075;
  const sides = 128, faceRings = 38, backRings = 30;
  const state = {};
  const keys = ['jawOpen', 'lipRound', 'lipSpread', 'lipClose', 'upperLipRaise', 'lowerLipDepress',
    'tongueOut', 'tongueUp', 'tongueBack', 'tongueLeft', 'cheekPuffLeft', 'cheekPuffRight',
    'cheekRaiseLeft', 'cheekRaiseRight', 'blinkLeft', 'blinkRight', 'smile'];
  keys.forEach(key => { state[key] = 0; });
  let mouthWidth = 0.37, mouthHeight = 0.014, mouthCenter = -0.57;

  function jawDeform(y) {
    return state.jawOpen * 0.31 * smooth((-y - 0.42) / 1.1);
  }
  function surfaceZ(x, y) {
    const d = Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2);
    return rz * Math.sqrt(d);
  }
  function mouthPoint(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = mouthWidth * c;
    const upper = s > 0;
    const cupid = upper ? -0.016 * Math.exp(-(((x / Math.max(mouthWidth, 0.01)) / 0.22) ** 2)) * (1 - state.lipRound) : 0;
    const cornerSmile = state.smile * 0.105 * Math.abs(c) ** 2;
    const raise = upper ? 0.075 * state.upperLipRaise * s : -0.075 * state.lowerLipDepress * -s;
    const y = mouthCenter + mouthHeight * s + cornerSmile + cupid + raise * (1 - state.lipClose);
    const z = surfaceZ(x, y) + 0.044 + 0.145 * state.lipRound;
    return { x, y, z };
  }
  function makeGrid(rows, columns, indexOrder = false) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((rows + 1) * (columns + 1) * 3), 3));
    const indices = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c, b = a + columns + 1;
      if (indexOrder) indices.push(a, a + 1, b, a + 1, b + 1, b);
      else indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    geometry.setIndex(indices);
    return geometry;
  }
  const frontGeometry = makeGrid(faceRings, sides);
  const front = mesh(frontGeometry, skin, 'HeadSkinFront');
  const backGeometry = makeGrid(backRings, sides, true);
  mesh(backGeometry, skin, 'HeadSkinBack');

  // The front is an annulus: its inner boundary is the moving mouth aperture.
  // There is no hidden skin sheet behind the lips.
  function updateHead() {
    const positions = frontGeometry.attributes.position.array;
    let index = 0;
    for (let r = 0; r <= faceRings; r++) {
      const t = r / faceRings;
      for (let c = 0; c <= sides; c++) {
        const angle = c / sides * Math.PI * 2;
        const inner = mouthPoint(angle);
        let x = mix(inner.x, rx * Math.cos(angle), t);
        const baseY = mix(inner.y, ry * Math.sin(angle), t);
        let y = baseY - jawDeform(baseY) * t;
        let z = surfaceZ(x, baseY) + (0.044 + 0.145 * state.lipRound) * (1 - t) ** 7;
        const left = gaussian(x, baseY, 0.79, -0.22, 0.4, 0.42);
        const right = gaussian(x, baseY, -0.79, -0.22, 0.4, 0.42);
        const fade = Math.sin(t * Math.PI / 2);
        const pL = state.cheekPuffLeft, pR = state.cheekPuffRight;
        z += 0.19 * (left * pL + right * pR) * fade;
        x += 0.065 * (left * pL - right * pR) * fade;
        y += 0.11 * (left * state.cheekRaiseLeft + right * state.cheekRaiseRight) * fade;
        z -= state.jawOpen * 0.035 * smooth((-baseY - 0.5) / 0.9) * t;
        positions[index++] = x; positions[index++] = y; positions[index++] = z;
      }
    }
    frontGeometry.attributes.position.needsUpdate = true;
    frontGeometry.computeVertexNormals();
    frontGeometry.computeBoundingSphere();
    const back = backGeometry.attributes.position.array;
    index = 0;
    for (let r = 0; r <= backRings; r++) {
      const phi = r / backRings * Math.PI / 2;
      for (let c = 0; c <= sides; c++) {
        const angle = c / sides * Math.PI * 2;
        const x = rx * Math.cos(angle) * Math.sin(phi);
        const baseY = ry * Math.sin(angle) * Math.sin(phi);
        back[index++] = x;
        back[index++] = baseY - jawDeform(baseY);
        back[index++] = -rz * Math.cos(phi) - state.jawOpen * 0.035 * smooth((-baseY - 0.5) / 0.9);
      }
    }
    backGeometry.attributes.position.needsUpdate = true;
    backGeometry.computeVertexNormals();
    backGeometry.computeBoundingSphere();
  }

  // Ears, neck and soft clothing establish the same friendly proportions as the reference.
  const ears = [];
  for (const sign of [-1, 1]) {
    const ear = ellipsoid(`Ear${sign > 0 ? 'Left' : 'Right'}`, earSkin, [sign * 1.22, -0.1, -0.015], [0.245, 0.35, 0.17]);
    ear.rotation.z = -sign * 0.15;
    ellipsoid(`EarInner${sign}`, earInner, [sign * 1.305, -0.105, 0.135], [0.105, 0.215, 0.045]);
    ellipsoid(`EarFold${sign}`, skin, [sign * 1.27, -0.17, 0.166], [0.064, 0.112, 0.045]);
    ears.push(ear);
  }
  const neck = mesh(new THREE.CylinderGeometry(0.265, 0.31, 0.66, 40), skin, 'Neck');
  neck.position.set(0, -1.66, -0.1);
  ellipsoid('HoodBack', hoodieShadow, [0, -1.95, -0.33], [0.72, 0.56, 0.52]);
  const bodyProfile = [[0, -0.55], [0.98, -0.55], [1.26, -0.42], [1.43, -0.13], [1.34, 0.12], [0.98, 0.32], [0.57, 0.42], [0.34, 0.33], [0, 0.31]];
  const body = mesh(new THREE.LatheGeometry(bodyProfile.map(p => new THREE.Vector2(...p)), 64), hoodieMat, 'HoodieBust');
  body.position.set(0, -2.3, -0.12);
  body.scale.z = 0.6;
  ellipsoid('ShirtCollar', shirtMat, [0, -1.92, 0.325], [0.3, 0.22, 0.105]);
  curveTube('HoodCollarLeft', [[-0.19, -1.81, 0.26], [-0.46, -1.9, 0.39], [-0.38, -2.08, 0.51], [-0.08, -2.2, 0.51]], 0.09, hoodieLight);
  curveTube('HoodCollarRight', [[0.19, -1.81, 0.26], [0.46, -1.9, 0.39], [0.38, -2.08, 0.51], [0.08, -2.2, 0.51]], 0.09, hoodieLight);
  curveTube('HoodieSeamLeft', [[-0.95, -2.05, 0.3], [-0.93, -2.32, 0.5], [-0.89, -2.76, 0.46]], 0.011, hoodieShadow);
  curveTube('HoodieSeamRight', [[0.95, -2.05, 0.3], [0.93, -2.32, 0.5], [0.89, -2.76, 0.46]], 0.011, hoodieShadow);
  for (const sign of [-1, 1]) {
    curveTube(`Drawstring${sign}`, [[sign * 0.2, -2.1, 0.56], [sign * 0.23, -2.31, 0.59], [sign * 0.18, -2.49, 0.59]], 0.017, shirtMat);
    const tip = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.085, 12), hoodieShadow, `DrawstringTip${sign}`);
    tip.position.set(sign * 0.18, -2.51, 0.59);
  }

  // Large, softly inset eyes and small highlights are intentionally stylized.
  const eyes = [];
  for (const sign of [-1, 1]) {
    const eye = new THREE.Group();
    eye.name = sign > 0 ? 'EyeLeft' : 'EyeRight';
    eye.position.set(sign * 0.445, 0.265, 1.005);
    group.add(eye);
    ellipsoid('Sclera', eyeWhite, [0, 0, 0], [0.265, 0.325, 0.105], eye);
    ellipsoid('Iris', iris, [-sign * 0.018, -0.015, 0.082], [0.174, 0.237, 0.064], eye);
    ellipsoid('Pupil', pupil, [-sign * 0.018, -0.016, 0.128], [0.124, 0.191, 0.025], eye);
    ellipsoid('EyeHighlight', gleam, [-0.055, 0.085, 0.153], [0.047, 0.061, 0.015], eye);
    ellipsoid('EyeHighlightSmall', gleam, [0.056, -0.095, 0.153], [0.019, 0.024, 0.01], eye);
    const lid = curveTube(`UpperEyelid${sign}`, [[-0.232, 0.1, 0.047], [-0.15, 0.287, 0.056], [0.04, 0.326, 0.052], [0.225, 0.145, 0.036]], 0.025, hairDark, eye);
    const closed = curveTube(`ClosedEyelid${sign}`, [[-0.224, 0.015, 0.116], [-0.09, 0.08, 0.138], [0.09, 0.08, 0.138], [0.224, 0.015, 0.116]], 0.025, hairDark);
    closed.position.copy(eye.position);
    closed.visible = false;
    const brow = curveTube(`Brow${sign}`, [[sign * 0.2, 0.7, 0.97], [sign * 0.36, 0.787, 0.981], [sign * 0.55, 0.785, 0.916], [sign * 0.69, 0.704, 0.862]], 0.035, hairDark);
    eyes.push({ sign, eye, closed, brow, lid });
  }
  ellipsoid('NoseBridge', skin, [0, -0.04, 1.04], [0.105, 0.185, 0.13]);
  ellipsoid('NoseTip', earSkin, [0, -0.185, 1.12], [0.145, 0.12, 0.15]);
  for (const sign of [-1, 1]) {
    ellipsoid(`Nostril${sign}`, nostril, [sign * 0.065, -0.235, 1.225], [0.023, 0.013, 0.008]);
  }
  const cheeks = [];
  for (const sign of [-1, 1]) {
    const cheek = ellipsoid(`Blush${sign}`, blush, [sign * 0.79, -0.29, 0.833], [0.205, 0.115, 0.032]);
    cheek.rotation.y = sign * 0.38;
    cheeks.push({ sign, mesh: cheek });
  }

  // An irregular scalp cap and overlapping tapered locks make a sculpted hairstyle.
  const hairSegments = 100, hairRows = 32;
  const scalpGeometry = makeGrid(hairRows, hairSegments, true);
  const scalpPositions = scalpGeometry.attributes.position.array;
  let scalpIndex = 0;
  for (let row = 0; row <= hairRows; row++) {
    for (let c = 0; c <= hairSegments; c++) {
      const phi = c / hairSegments * Math.PI * 2;
      const forward = (Math.sin(phi) + 1) / 2;
      const end = mix(1.98, 1.22, smooth(forward));
      const theta = row / hairRows * (end + 0.025 * Math.sin(phi * 7));
      const ripple = 1 + 0.014 * Math.sin(phi * 9 + theta * 2);
      scalpPositions[scalpIndex++] = 1.29 * Math.sin(theta) * Math.cos(phi) * ripple;
      scalpPositions[scalpIndex++] = 0.16 + 1.49 * Math.cos(theta);
      scalpPositions[scalpIndex++] = 1.11 * Math.sin(theta) * Math.sin(phi) * ripple - 0.045;
    }
  }
  scalpGeometry.computeVertexNormals();
  mesh(scalpGeometry, hairDark, 'HairScalp');

  function hairLock(name, points, width, mat = hair) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(30, false);
    const geometry = makeGrid(30, 12, true);
    const array = geometry.attributes.position.array;
    const vector = new THREE.Vector3();
    let i = 0;
    for (let row = 0; row <= 30; row++) {
      const t = row / 30;
      const center = curve.getPointAt(t);
      const radius = width * (0.56 + 0.46 * Math.sin(t * Math.PI)) * Math.max(0.012, (1 - t) ** 0.43);
      for (let c = 0; c <= 12; c++) {
        const a = c / 12 * Math.PI * 2;
        vector.copy(center).addScaledVector(frames.normals[row], Math.cos(a) * radius)
          .addScaledVector(frames.binormals[row], Math.sin(a) * radius * 0.57);
        array[i++] = vector.x; array[i++] = vector.y; array[i++] = vector.z;
      }
    }
    geometry.computeVertexNormals();
    return mesh(geometry, mat, name);
  }
  const locks = [
    ['Fringe01', [[0.37, 1.48, 0.61], [0.39, 1.25, 0.91], [0.2, 0.89, 1.075], [-0.05, 0.61, 1.04]], 0.27, hairLight],
    ['Fringe02', [[-0.12, 1.5, 0.63], [-0.36, 1.27, 0.94], [-0.59, 0.92, 1.0], [-0.68, 0.67, 0.96]], 0.25, hair],
    ['Fringe03', [[-0.52, 1.35, 0.63], [-0.8, 1.08, 0.86], [-0.95, 0.79, 0.79], [-1.0, 0.48, 0.66]], 0.235, hairLight],
    ['Fringe04', [[0.67, 1.34, 0.52], [0.88, 1.08, 0.8], [1.0, 0.81, 0.74], [1.06, 0.5, 0.61]], 0.245, hair],
    ['Fringe05', [[0.25, 1.48, 0.58], [0.7, 1.39, 0.67], [0.94, 1.16, 0.7], [1.19, 0.93, 0.54]], 0.2, hairLight],
    ['Fringe06', [[-0.16, 1.52, 0.47], [-0.58, 1.47, 0.59], [-0.94, 1.25, 0.59], [-1.2, 1.03, 0.45]], 0.19, hair],
    ['Crown01', [[0.03, 1.46, 0.11], [0.28, 1.74, 0.15], [0.65, 1.8, 0.12], [0.84, 1.72, 0.1]], 0.17, hairLight],
    ['Crown02', [[-0.3, 1.43, -0.04], [-0.42, 1.72, 0.05], [-0.27, 1.89, 0.13], [-0.08, 1.94, 0.14]], 0.16, hair],
    ['Crown03', [[-0.05, 1.5, -0.18], [-0.1, 1.79, -0.21], [-0.3, 1.91, -0.18], [-0.5, 1.87, -0.12]], 0.13, hairDark],
    ['SideLeft01', [[-1.02, 0.98, 0.2], [-1.2, 0.72, 0.3], [-1.25, 0.34, 0.25], [-1.15, 0.11, 0.21]], 0.18, hair],
    ['SideRight01', [[1.03, 1.0, 0.2], [1.21, 0.73, 0.23], [1.24, 0.36, 0.19], [1.14, 0.13, 0.18]], 0.18, hairDark],
  ];
  locks.forEach(args => hairLock(...args));
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + i / 8 * Math.PI;
    const x = Math.cos(angle), z = Math.sin(angle);
    hairLock(`BackLock${i}`, [[1.12 * x, 0.85, 0.9 * z], [1.25 * x, 0.45, 1.02 * z], [1.15 * x, 0.01, 0.95 * z], [1.05 * x, -0.35 - 0.07 * Math.sin(i * 1.8), 0.86 * z]], 0.16, i % 2 ? hair : hairLight);
  }

  // Soft independent upper and lower lip surfaces sit on the mouth-hole boundary.
  const lipRows = 10;
  const lipGeometry = makeGrid(lipRows, sides, true);
  lipGeometry.clearGroups();
  // Two materials split around the aperture, preserving upper/lower lip color.
  for (let r = 0; r < lipRows; r++) {
    for (let c = 0; c < sides; c++) {
      lipGeometry.addGroup((r * sides + c) * 6, 6, c < sides / 2 ? 0 : 1);
    }
  }
  const lips = mesh(lipGeometry, [upperLipMat, lowerLipMat], 'Lips');
  const cavityGeometry = makeGrid(18, sides, true);
  const cavity = mesh(cavityGeometry, mouthMat, 'OralCavity');
  cavity.castShadow = false;
  const upperTeeth = new THREE.Group(); upperTeeth.name = 'UpperTeeth'; group.add(upperTeeth);
  const lowerTeeth = new THREE.Group(); lowerTeeth.name = 'LowerTeeth'; group.add(lowerTeeth);

  function roundedToothGeometry(width, height, depth) {
    const radius = 0.018;
    const w = width / 2, h = height / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-w + radius, -h);
    shape.lineTo(w - radius, -h); shape.quadraticCurveTo(w, -h, w, -h + radius);
    shape.lineTo(w, h - radius); shape.quadraticCurveTo(w, h, w - radius, h);
    shape.lineTo(-w + radius, h); shape.quadraticCurveTo(-w, h, -w, h - radius);
    shape.lineTo(-w, -h + radius); shape.quadraticCurveTo(-w, -h, -w + radius, -h);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.008, bevelThickness: 0.008, curveSegments: 4 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * 0.103;
    const upperTooth = mesh(roundedToothGeometry(0.097, i === 3 || i === 4 ? 0.145 : 0.132, 0.087), toothMat, `UpperTooth${i + 1}`, upperTeeth);
    upperTooth.position.set(x, 0, -0.12 * (Math.abs(x) / 0.42) ** 1.7);
    upperTooth.rotation.y = -x * 0.45;
    const lowerTooth = mesh(roundedToothGeometry(0.091, 0.104, 0.072), toothMat, `LowerTooth${i + 1}`, lowerTeeth);
    lowerTooth.position.set(x * 0.91, 0, -0.12 * (Math.abs(x) / 0.42) ** 1.7);
    lowerTooth.rotation.y = -x * 0.45;
  }

  // The facial surface is a changing annulus, so an ellipsoid estimate at the
  // tooth center cannot contain a full tooth near the sharply curving chin.
  // Cache complete tooth surfaces, including their edges and triangle centers.
  function dentalSurfaceSamples(geometry) {
    const positions = geometry.attributes.position, indices = geometry.index;
    const unique = new Map();
    function add(x, y, z) {
      const key = `${x.toFixed(7)},${y.toFixed(7)},${z.toFixed(7)}`;
      if (!unique.has(key)) unique.set(key, [x, y, z]);
    }
    for (let i = 0; i < positions.count; i++) add(positions.getX(i), positions.getY(i), positions.getZ(i));
    const count = indices ? indices.count : positions.count;
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(j => indices ? indices.getX(i + j) : i + j);
      const points = ids.map(j => [positions.getX(j), positions.getY(j), positions.getZ(j)]);
      for (let edge = 0; edge < 3; edge++) {
        const a = points[edge], b = points[(edge + 1) % 3];
        add((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      }
      add((points[0][0] + points[1][0] + points[2][0]) / 3,
        (points[0][1] + points[1][1] + points[2][1]) / 3,
        (points[0][2] + points[1][2] + points[2][2]) / 3);
    }
    return new Float32Array([...unique.values()].flat());
  }
  const dentalParts = [upperTeeth, lowerTeeth].flatMap(arch => arch.children.map(tooth => {
    tooth.geometry.computeBoundingBox();
    return { arch, tooth, samples: dentalSurfaceSamples(tooth.geometry), matrix: new THREE.Matrix4() };
  }));
  const dentalBounds = new THREE.Box3(), partBounds = new THREE.Box3();
  const dentalGridSize = 24;
  const dentalBuckets = Array.from({ length: dentalGridSize ** 2 }, () => []);
  const dentalTriangles = new Float64Array(frontGeometry.index.count / 3 * 10);
  const dentalDomain = { minX: 0, minY: 0, scaleX: 1, scaleY: 1 };
  const dentalMargin = 0.016;

  function indexDentalSkin() {
    for (const bucket of dentalBuckets) bucket.length = 0;
    dentalBounds.makeEmpty();
    upperTeeth.updateMatrix(); lowerTeeth.updateMatrix();
    for (const part of dentalParts) {
      part.tooth.updateMatrix();
      part.matrix.multiplyMatrices(part.arch.matrix, part.tooth.matrix);
      partBounds.copy(part.tooth.geometry.boundingBox).applyMatrix4(part.matrix);
      dentalBounds.union(partBounds);
    }
    dentalBounds.expandByScalar(0.002);
    const minX = dentalBounds.min.x, maxX = dentalBounds.max.x;
    const minY = dentalBounds.min.y, maxY = dentalBounds.max.y;
    const scaleX = dentalGridSize / (maxX - minX), scaleY = dentalGridSize / (maxY - minY);
    Object.assign(dentalDomain, { minX, minY, scaleX, scaleY });
    const p = frontGeometry.attributes.position.array, indices = frontGeometry.index.array;
    let triangle = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const x0 = p[a], y0 = p[a + 1], z0 = p[a + 2];
      const x1 = p[b], y1 = p[b + 1], z1 = p[b + 2];
      const x2 = p[c], y2 = p[c + 1], z2 = p[c + 2];
      const loX = Math.min(x0, x1, x2), hiX = Math.max(x0, x1, x2);
      const loY = Math.min(y0, y1, y2), hiY = Math.max(y0, y1, y2);
      if (loX > maxX || hiX < minX || loY > maxY || hiY < minY) continue;
      const dx1 = x1 - x0, dy1 = y1 - y0, dx2 = x2 - x0, dy2 = y2 - y0;
      const determinant = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(determinant) < 1e-12) continue;
      const offset = triangle++ * 10;
      dentalTriangles[offset] = x0; dentalTriangles[offset + 1] = y0; dentalTriangles[offset + 2] = z0;
      dentalTriangles[offset + 3] = dx1; dentalTriangles[offset + 4] = dy1; dentalTriangles[offset + 5] = z1 - z0;
      dentalTriangles[offset + 6] = dx2; dentalTriangles[offset + 7] = dy2; dentalTriangles[offset + 8] = z2 - z0;
      dentalTriangles[offset + 9] = 1 / determinant;
      const cellLoX = clamp(Math.floor((loX - minX) * scaleX), 0, dentalGridSize - 1);
      const cellHiX = clamp(Math.floor((hiX - minX) * scaleX), 0, dentalGridSize - 1);
      const cellLoY = clamp(Math.floor((loY - minY) * scaleY), 0, dentalGridSize - 1);
      const cellHiY = clamp(Math.floor((hiY - minY) * scaleY), 0, dentalGridSize - 1);
      for (let row = cellLoY; row <= cellHiY; row++) for (let col = cellLoX; col <= cellHiX; col++) {
        dentalBuckets[row * dentalGridSize + col].push(offset);
      }
    }
  }

  function currentSkinZ(x, y) {
    const gx = Math.floor((x - dentalDomain.minX) * dentalDomain.scaleX);
    const gy = Math.floor((y - dentalDomain.minY) * dentalDomain.scaleY);
    if (gx < 0 || gx >= dentalGridSize || gy < 0 || gy >= dentalGridSize) return -Infinity;
    let z = -Infinity;
    for (const i of dentalBuckets[gy * dentalGridSize + gx]) {
      const dx = x - dentalTriangles[i], dy = y - dentalTriangles[i + 1];
      const u = (dx * dentalTriangles[i + 7] - dy * dentalTriangles[i + 6]) * dentalTriangles[i + 9];
      const v = (dy * dentalTriangles[i + 3] - dx * dentalTriangles[i + 4]) * dentalTriangles[i + 9];
      if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
      z = Math.max(z, dentalTriangles[i + 2] + u * dentalTriangles[i + 5] + v * dentalTriangles[i + 8]);
    }
    return z; // No skin in the mouth aperture: the tooth remains visible there.
  }

  function containDentalArches() {
    indexDentalSkin();
    let maxCorrection = 0;
    for (const { tooth, samples, matrix } of dentalParts) {
      const m = matrix.elements;
      let correction = 0;
      for (let i = 0; i < samples.length; i += 3) {
        const px = samples[i], py = samples[i + 1], pz = samples[i + 2];
        const x = m[0] * px + m[4] * py + m[8] * pz + m[12];
        const y = m[1] * px + m[5] * py + m[9] * pz + m[13];
        const z = m[2] * px + m[6] * py + m[10] * pz + m[14];
        const skinZ = currentSkinZ(x, y);
        if (skinZ !== -Infinity) correction = Math.max(correction, z - skinZ + dentalMargin);
      }
      tooth.position.z -= correction;
      maxCorrection = Math.max(maxCorrection, correction);
    }
    group.userData.dentalContainment = { margin: dentalMargin, maxCorrection };
  }
  const palate = ellipsoid('UpperPalate', palateMat, [0, -0.53, 0.54], [0.35, 0.1, 0.34]);
  const tongueRows = 34, tongueSides = 24;
  const tongueGeometry = makeGrid(tongueRows, tongueSides, true);
  const tongue = mesh(tongueGeometry, tongueMat, 'Tongue');
  tongue.renderOrder = 2;
  // A shallow center furrow follows the upper surface of the deforming tongue.
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 3), 3));
  geometries.add(lineGeometry);
  const lineMat = new THREE.LineBasicMaterial({ color: '#c86179', transparent: true, opacity: 0.5 });
  materials.add(lineMat); materialRoles.set(lineMat, 'tongue');
  solidMaterials.set(lineMat, { opacity: 0.5, transparent: true, depthWrite: true });
  const tongueGroove = new THREE.Line(lineGeometry, lineMat);
  tongueGroove.name = 'TongueCenterFurrow'; group.add(tongueGroove);

  function tongueCenter(t) {
    const baseY = mouthCenter - mouthHeight * 0.58 - 0.025;
    const x = state.tongueLeft * 0.31 * smooth(t);
    const y = baseY + 0.025 * t + state.tongueUp * (0.31 + 0.15 * state.jawOpen) * t ** 1.65
      + 0.035 * Math.sin(t * Math.PI) + state.tongueOut * 0.025 * t;
    const tipZ = 0.91 + state.tongueOut * 0.64 - state.tongueBack * 0.31;
    const z = mix(0.28, tipZ, t);
    return { x, y, z };
  }
  function tongueRadius(t) {
    const cap = Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
    return { width: (0.235 - state.tongueUp * 0.04) * cap, height: (0.072 + state.tongueUp * 0.012) * cap };
  }

  function updateMouth() {
    mouthWidth = clamp((0.37 + state.jawOpen * 0.095 + state.lipSpread * 0.22 + state.smile * 0.1 - state.lipRound * 0.205) * (1 - state.lipClose * 0.13), 0.145, 0.76);
    mouthHeight = (0.014 + state.jawOpen * 0.345 + state.lipRound * 0.12 + state.tongueOut * 0.075) * (1 - state.lipClose * 0.985);
    mouthCenter = -0.57 - state.jawOpen * 0.20 - state.lowerLipDepress * 0.035 + state.upperLipRaise * 0.018;
    const lip = lipGeometry.attributes.position.array;
    let index = 0;
    for (let row = 0; row <= lipRows; row++) {
      const cross = row / lipRows * Math.PI * 2;
      for (let c = 0; c <= sides; c++) {
        const a = c / sides * Math.PI * 2;
        const p = mouthPoint(a);
        const upper = Math.sin(a) >= 0;
        const openness = smooth(mouthHeight / 0.15);
        const thickness = (upper ? mix(0.024, 0.039, openness) : mix(0.03, 0.051, openness)) * (1 + state.lipRound * 0.36);
        const nx = Math.cos(a), ny = Math.sin(a);
        lip[index++] = p.x + nx * Math.cos(cross) * thickness;
        lip[index++] = p.y + ny * Math.cos(cross) * thickness;
        lip[index++] = p.z + Math.sin(cross) * (0.035 + state.lipRound * 0.025);
      }
    }
    lipGeometry.attributes.position.needsUpdate = true;
    lipGeometry.computeVertexNormals(); lipGeometry.computeBoundingSphere();
    const inside = cavityGeometry.attributes.position.array;
    index = 0;
    for (let row = 0; row <= 18; row++) {
      const t = row / 18;
      for (let c = 0; c <= sides; c++) {
        const p = mouthPoint(c / sides * Math.PI * 2);
        inside[index++] = p.x * (1 - t);
        inside[index++] = mix(p.y, mouthCenter, t);
        inside[index++] = mix(p.z - 0.027, 0.28, t) - 0.1 * Math.sin(t * Math.PI);
      }
    }
    cavityGeometry.attributes.position.needsUpdate = true;
    cavityGeometry.computeVertexNormals(); cavityGeometry.computeBoundingSphere();
    const top = mouthPoint(Math.PI / 2), bottom = mouthPoint(Math.PI * 1.5);
    upperTeeth.position.set(0, top.y + 0.026, 0);
    lowerTeeth.position.set(0, bottom.y + 0.035, 0);
    upperTeeth.scale.x = 1 - state.lipRound * 0.1;
    lowerTeeth.scale.x = 1 - state.lipRound * 0.1;
    // Keep the entire dental arch behind the skin at each tooth's location.
    // A front-facing strip placed ahead of the skin looks like braces at rest.
    for (const arch of [upperTeeth, lowerTeeth]) {
      const undeformedY = arch.position.y + jawDeform(arch.position.y) * 0.7;
      for (const tooth of arch.children) {
        tooth.position.z = surfaceZ(tooth.position.x, undeformedY) - 0.105;
      }
    }
    const aperture = Math.max(0, top.y - bottom.y);
    upperTeeth.visible = cutaway || (aperture > 0.04 && state.lipClose < 0.93);
    lowerTeeth.visible = cutaway || (aperture > 0.13 && state.lipClose < 0.93);
    palate.position.y = top.y + 0.015;
    const array = tongueGeometry.attributes.position.array;
    index = 0;
    for (let row = 0; row <= tongueRows; row++) {
      const t = row / tongueRows;
      const center = tongueCenter(t), radius = tongueRadius(t);
      for (let c = 0; c <= tongueSides; c++) {
        const a = c / tongueSides * Math.PI * 2;
        const centerDip = Math.sin(a) > 0 ? 0.008 * Math.exp(-((Math.cos(a) / 0.17) ** 2)) * Math.sin(Math.PI * t) : 0;
        array[index++] = center.x + Math.cos(a) * radius.width;
        array[index++] = center.y + Math.sin(a) * radius.height - centerDip;
        array[index++] = center.z;
      }
    }
    tongueGeometry.attributes.position.needsUpdate = true;
    tongueGeometry.computeVertexNormals(); tongueGeometry.computeBoundingSphere();
    const lineArray = lineGeometry.attributes.position.array;
    for (let i = 0; i < 25; i++) {
      const t = mix(0.2, 0.9, i / 24), center = tongueCenter(t), radius = tongueRadius(t);
      lineArray[i * 3] = center.x;
      lineArray[i * 3 + 1] = center.y + radius.height - 0.004;
      lineArray[i * 3 + 2] = center.z;
    }
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.computeBoundingSphere();
  }

  let previous = '';
  function update(input = {}) {
    for (const key of keys) state[key] = clamp(Number.isFinite(input[key]) ? input[key] : 0, key === 'tongueLeft' ? -1 : 0, 1);
    const signature = keys.map(key => state[key].toFixed(4)).join(',');
    if (signature === previous) return;
    previous = signature;
    updateMouth(); updateHead(); containDentalArches();
    for (const { sign, eye, closed, brow } of eyes) {
      const blink = sign > 0 ? state.blinkLeft : state.blinkRight;
      const raise = sign > 0 ? state.cheekRaiseLeft : state.cheekRaiseRight;
      eye.scale.y = Math.max(0.025, 1 - blink * 0.98 - raise * 0.12 - state.smile * 0.06);
      eye.position.y = 0.265 + raise * 0.035;
      eye.visible = blink < 0.94;
      closed.visible = blink >= 0.94;
      closed.position.y = 0.265 + raise * 0.035;
      brow.position.y = state.jawOpen * 0.025 + raise * 0.045;
    }
    for (const { sign, mesh: cheek } of cheeks) {
      const puff = sign > 0 ? state.cheekPuffLeft : state.cheekPuffRight;
      const raise = sign > 0 ? state.cheekRaiseLeft : state.cheekRaiseRight;
      cheek.position.set(sign * (0.79 + puff * 0.027), -0.29 + raise * 0.085, 0.833 + puff * 0.145);
      cheek.scale.set(0.205 + puff * 0.025, 0.115 + puff * 0.025 - raise * 0.012, 0.032);
    }
    group.userData.state = { ...state };
  }

  function applyAppearance() {
    for (const mat of materials) {
      const role = materialRoles.get(mat), original = solidMaterials.get(mat);
      const fades = { skin: 0.14, blush: 0.08, eye: 0.17, hair: 0.16, lips: 0.46, cavity: 0.065, palate: 0.18, hoodie: 0.32 };
      const opacity = cutaway && fades[role] !== undefined ? fades[role] : original.opacity;
      mat.opacity = opacity;
      mat.transparent = cutaway && fades[role] !== undefined ? true : original.transparent;
      mat.depthWrite = cutaway && fades[role] !== undefined ? false : original.depthWrite;
      if ('wireframe' in mat) mat.wireframe = wireframe;
      mat.needsUpdate = true;
    }
    front.renderOrder = cutaway ? 4 : 0;
    lips.renderOrder = cutaway ? 5 : 0;
    cavity.renderOrder = cutaway ? 3 : 0;
    tongue.renderOrder = cutaway ? 1 : 0;
    group.userData.cutaway = cutaway;
    group.userData.wireframe = wireframe;
  }
  function setWireframe(value) { wireframe = Boolean(value); applyAppearance(); }
  function setCutaway(value) { cutaway = Boolean(value); updateMouth(); containDentalArches(); applyAppearance(); }
  function dispose() {
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
    group.removeFromParent();
    group.clear();
  }
  group.userData.rig = 'procedural-articulation-boy-v1';
  group.userData.controls = [...keys];
  group.userData.coordinateSystem = { up: '+Y', forward: '+Z', anatomicalLeft: '+X' };
  update();
  return { group, update, setWireframe, setCutaway, dispose };
}
