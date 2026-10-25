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
  const restShapeEntries = [];
  let restShapeReady = false;
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
    const cornerSmile = (0.022 + state.smile * 0.105) * Math.abs(c) ** 2
      * (1 - state.jawOpen * 0.75) * (1 - state.lipRound * 0.8);
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
        // Keep the shared front/back outline coincident during cheek motion.
        const fade = Math.sin(t * Math.PI);
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
  ellipsoid('NoseBridge', skin, [0, -0.08, 1.025], [0.105, 0.125, 0.08]);
  ellipsoid('NoseTip', earSkin, [0, -0.185, 1.10], [0.145, 0.12, 0.115]);
  for (const sign of [-1, 1]) {
    ellipsoid(`Nostril${sign}`, nostril, [sign * 0.065, -0.235, 1.191], [0.023, 0.013, 0.007]);
  }
  const cheeks = [];
  for (const sign of [-1, 1]) {
    const cheek = ellipsoid(`Blush${sign}`, blush, [sign * 0.79, -0.29, 0.833], [0.205, 0.115, 0.032]);
    cheek.rotation.y = sign * 0.38;
    cheeks.push({ sign, mesh: cheek });
  }

  // An irregular scalp cap and overlapping tapered locks make a sculpted hairstyle.
  // The cap follows the head ellipsoid and its lower rim turns into the head.
  // Locks are seated against that same surface instead of independent air paths.
  const hairSegments = 100, hairRows = 32;
  function hairlineEnd(phi) {
    const forward = (Math.sin(phi) + 1) / 2;
    return mix(1.92, 1.12, smooth(forward))
      + 0.018 * Math.sin(phi * 6) + 0.01 * Math.sin(phi * 10);
  }
  function scalpSample(theta, phi, depthOverride) {
    const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
    const normal = new THREE.Vector3(
      sinTheta * Math.cos(phi) / rx,
      cosTheta / ry,
      sinTheta * Math.sin(phi) / rz,
    ).normalize();
    const depth = depthOverride ?? (0.06 + sinTheta ** 2
      * (0.016 + 0.008 * Math.sin(phi * 7 + theta * 1.8)));
    const point = new THREE.Vector3(
      rx * sinTheta * Math.cos(phi),
      ry * cosTheta,
      rz * sinTheta * Math.sin(phi),
    ).addScaledVector(normal, depth);
    return { point, normal, depth };
  }
  function finishHairGeometry(geometry, rows, columns) {
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    // The grid duplicates its seam. Share its normals so a dark seam cannot
    // look like a split between the cap and a lock.
    for (let row = 0; row <= rows; row++) {
      const first = row * (columns + 1), last = first + columns;
      a.fromBufferAttribute(normals, first);
      b.fromBufferAttribute(normals, last);
      a.add(b);
      if (a.lengthSq() < 1e-12) a.set(0, 1, 0);
      a.normalize();
      normals.setXYZ(first, a.x, a.y, a.z);
      normals.setXYZ(last, a.x, a.y, a.z);
    }
    normals.needsUpdate = true;
    geometry.computeBoundingSphere();
  }
  const scalpGeometry = makeGrid(hairRows + 1, hairSegments, true);
  const scalpPositions = scalpGeometry.attributes.position.array;
  let scalpIndex = 0;
  for (let row = 0; row <= hairRows + 1; row++) {
    for (let c = 0; c <= hairSegments; c++) {
      const phi = c / hairSegments * Math.PI * 2;
      const theta = Math.min(row, hairRows) / hairRows * hairlineEnd(phi);
      // This short final ring closes the visible edge into the skin.
      const sample = scalpSample(theta, phi, row === hairRows + 1 ? -0.012 : undefined);
      scalpPositions[scalpIndex++] = sample.point.x;
      scalpPositions[scalpIndex++] = sample.point.y;
      scalpPositions[scalpIndex++] = sample.point.z;
    }
  }
  finishHairGeometry(scalpGeometry, hairRows + 1, hairSegments);
  for (let c = 0; c <= hairSegments; c++) scalpGeometry.attributes.normal.setXYZ(c, 0, 1, 0);
  mesh(scalpGeometry, hairDark, 'HairScalp');

  function hairLock(name, points, width, mat = hair) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const rows = 30, columns = 12;
    const geometry = makeGrid(rows, columns, true);
    const array = geometry.attributes.position.array;
    const centers = [], surfaceNormals = [], widths = [], depths = [];
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const direction = curve.getPointAt(t).divide(new THREE.Vector3(rx, ry, rz)).normalize();
      const theta = Math.acos(clamp(direction.y, -1, 1));
      const phi = Math.atan2(direction.z, direction.x);
      const sample = scalpSample(theta, phi);
      const boundary = hairlineEnd(phi);
      let coverage = 1 - smooth((theta - boundary) / 0.1);
      const radius = width * (0.68 + 0.32 * Math.sin(t * Math.PI)) * Math.sqrt(1 - t);
      const depth = radius * 0.64;
      // Beyond the cap boundary, keep the underside inside the actual skin;
      // a thin tail must not inherit an unsupported offset from the cap.
      if (theta > boundary) coverage = Math.min(coverage, depth * 0.65 / sample.depth);
      const seating = mix(-0.62, 0.1, smooth(t / 0.25));
      const tipSink = sample.depth * coverage * smooth((t - 0.72) / 0.28);
      // Every section cuts into the continuous cap or skin. Tips finish in
      // that surface too, including the fringe below the cap's hairline.
      sample.point.addScaledVector(sample.normal,
        -sample.depth * (1 - coverage) + depth * seating - tipSink);
      centers.push(sample.point); surfaceNormals.push(sample.normal);
      widths.push(radius); depths.push(depth);
    }
    const tangent = new THREE.Vector3(), lateral = new THREE.Vector3();
    const normal = new THREE.Vector3(), vertex = new THREE.Vector3();
    let index = 0;
    for (let row = 0; row <= rows; row++) {
      const center = centers[row], outward = surfaceNormals[row];
      tangent.subVectors(centers[Math.min(rows, row + 1)], centers[Math.max(0, row - 1)]);
      tangent.addScaledVector(outward, -tangent.dot(outward));
      if (tangent.lengthSq() < 1e-10) {
        tangent.crossVectors(outward, Math.abs(outward.y) > 0.9
          ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
      }
      tangent.normalize();
      lateral.crossVectors(outward, tangent).normalize();
      normal.crossVectors(tangent, lateral).normalize();
      for (let c = 0; c <= columns; c++) {
        const angle = c / columns * Math.PI * 2;
        vertex.copy(center).addScaledVector(lateral, Math.cos(angle) * widths[row])
          .addScaledVector(normal, Math.sin(angle) * depths[row]);
        array[index++] = vertex.x; array[index++] = vertex.y; array[index++] = vertex.z;
      }
    }
    finishHairGeometry(geometry, rows, columns);
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

  function lipThickness(upper) {
    const openness = smooth(mouthHeight / 0.15);
    return (upper ? mix(0.03, 0.039, openness) : mix(0.039, 0.051, openness)) * (1 + state.lipRound * 0.36);
  }

  function innerLipBounds(x) {
    const upperThickness = lipThickness(true), lowerThickness = lipThickness(false);
    const upperWidth = Math.max(0.001, mouthWidth - upperThickness);
    const lowerWidth = Math.max(0.001, mouthWidth - lowerThickness);
    const upperAngle = Math.acos(clamp(x / upperWidth, -1, 1));
    const lowerAngle = Math.PI * 2 - Math.acos(clamp(x / lowerWidth, -1, 1));
    return {
      upper: mouthPoint(upperAngle).y - Math.sin(upperAngle) * upperThickness,
      lower: mouthPoint(lowerAngle).y - Math.sin(lowerAngle) * lowerThickness,
    };
  }

  // Lift remains independent inside the oral cavity. As the tongue approaches
  // the lips, fit its whole oval cross-section through their actual inner edge.
  // This bends a raised tongue through the opening instead of toward the nose.
  function fittedTongueRing(t) {
    const center = tongueCenter(t), radius = tongueRadius(t);
    const approachDepth = surfaceZ(0, mouthCenter) + 0.044;
    const fit = smooth((center.z - (approachDepth - 0.25)) / 0.14);
    if (fit === 0) return { center, radius };
    const halfWidth = Math.max(0.002, mouthWidth - Math.max(lipThickness(true), lipThickness(false)) - 0.018);
    const fitX = clamp(center.x, -halfWidth * 0.7, halfWidth * 0.7);
    const fitWidth = Math.min(radius.width, Math.max(0.001, halfWidth - Math.abs(fitX)) * 0.84);
    let lower = -Infinity, upper = Infinity;
    for (let sample = 0; sample <= 12; sample++) {
      const x = mix(fitX - fitWidth, fitX + fitWidth, sample / 12);
      const bounds = innerLipBounds(x);
      lower = Math.max(lower, bounds.lower + 0.016);
      upper = Math.min(upper, bounds.upper - 0.016);
    }
    const gap = upper - lower;
    const fitHeight = Math.min(radius.height, Math.max(0.001, gap * 0.48));
    const fitY = gap >= fitHeight * 2 ? clamp(center.y, lower + fitHeight, upper - fitHeight) : (lower + upper) / 2;
    center.x = mix(center.x, fitX, fit);
    center.y = mix(center.y, fitY, fit);
    radius.width = mix(radius.width, fitWidth, fit);
    radius.height = mix(radius.height, fitHeight, fit);
    return { center, radius };
  }

  // Independent collision index: its domain follows the complete tongue,
  // including lateral and lifted positions, rather than the dental bounds.
  const tongueGridSize = 26;
  const tongueBuckets = Array.from({ length: tongueGridSize ** 2 }, () => []);
  const tongueCollisionTriangles = new Float64Array((frontGeometry.index.count + lipGeometry.index.count) / 3 * 11);
  const tongueDomain = { minX: 0, minY: 0, scaleX: 1, scaleY: 1 };
  const tongueCorrections = new Float64Array(tongueRows + 1);
  const tongueMargin = 0.014;
  const tongueSampleList = [];
  const tongueEdges = new Set();
  for (let i = 0; i < tongueGeometry.attributes.position.count; i++) tongueSampleList.push([i, i, i, 1, 0, 0]);
  const tongueIndices = tongueGeometry.index.array;
  for (let i = 0; i < tongueIndices.length; i += 3) {
    const ids = [tongueIndices[i], tongueIndices[i + 1], tongueIndices[i + 2]];
    for (let edge = 0; edge < 3; edge++) {
      const a = Math.min(ids[edge], ids[(edge + 1) % 3]), b = Math.max(ids[edge], ids[(edge + 1) % 3]);
      const key = `${a},${b}`;
      if (!tongueEdges.has(key)) { tongueEdges.add(key); tongueSampleList.push([a, b, b, 0.5, 0.5, 0]); }
    }
    tongueSampleList.push([...ids, 1 / 3, 1 / 3, 1 / 3]);
  }

  function indexTongueSurfaces() {
    for (const bucket of tongueBuckets) bucket.length = 0;
    tongueGeometry.computeBoundingBox();
    const box = tongueGeometry.boundingBox;
    const minX = box.min.x - 0.004, minY = box.min.y - 0.004;
    const maxX = box.max.x + 0.004, maxY = box.max.y + 0.004;
    const scaleX = tongueGridSize / Math.max(0.008, maxX - minX);
    const scaleY = tongueGridSize / Math.max(0.008, maxY - minY);
    Object.assign(tongueDomain, { minX, minY, scaleX, scaleY });
    let triangle = 0;
    for (const [geometry, role] of [[frontGeometry, 0], [lipGeometry, 1]]) {
      const p = geometry.attributes.position.array, indices = geometry.index.array;
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
        const offset = triangle++ * 11;
        tongueCollisionTriangles.set([x0, y0, z0, dx1, dy1, z1 - z0, dx2, dy2, z2 - z0, 1 / determinant, role], offset);
        const colLo = clamp(Math.floor((loX - minX) * scaleX), 0, tongueGridSize - 1);
        const colHi = clamp(Math.floor((hiX - minX) * scaleX), 0, tongueGridSize - 1);
        const rowLo = clamp(Math.floor((loY - minY) * scaleY), 0, tongueGridSize - 1);
        const rowHi = clamp(Math.floor((hiY - minY) * scaleY), 0, tongueGridSize - 1);
        for (let row = rowLo; row <= rowHi; row++) for (let col = colLo; col <= colHi; col++) {
          tongueBuckets[row * tongueGridSize + col].push(offset);
        }
      }
    }
  }

  function tongueSurfaceLimit(x, y) {
    const col = Math.floor((x - tongueDomain.minX) * tongueDomain.scaleX);
    const row = Math.floor((y - tongueDomain.minY) * tongueDomain.scaleY);
    if (col < 0 || col >= tongueGridSize || row < 0 || row >= tongueGridSize) return Infinity;
    let skinZ = -Infinity, lipBackZ = Infinity;
    for (const i of tongueBuckets[row * tongueGridSize + col]) {
      const dx = x - tongueCollisionTriangles[i], dy = y - tongueCollisionTriangles[i + 1];
      const u = (dx * tongueCollisionTriangles[i + 7] - dy * tongueCollisionTriangles[i + 6]) * tongueCollisionTriangles[i + 9];
      const v = (dy * tongueCollisionTriangles[i + 3] - dx * tongueCollisionTriangles[i + 4]) * tongueCollisionTriangles[i + 9];
      if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
      const z = tongueCollisionTriangles[i + 2] + u * tongueCollisionTriangles[i + 5] + v * tongueCollisionTriangles[i + 8];
      if (tongueCollisionTriangles[i + 10] === 0) skinZ = Math.max(skinZ, z);
      else lipBackZ = Math.min(lipBackZ, z);
    }
    return Math.min(skinZ === -Infinity ? Infinity : skinZ, lipBackZ) - tongueMargin;
  }

  function containTongue() {
    indexTongueSurfaces();
    tongueCorrections.fill(0);
    const p = tongueGeometry.attributes.position.array;
    for (const [ia, ib, ic, wa, wb, wc] of tongueSampleList) {
      const a = ia * 3, b = ib * 3, c = ic * 3;
      const x = p[a] * wa + p[b] * wb + p[c] * wc;
      const y = p[a + 1] * wa + p[b + 1] * wb + p[c + 1] * wc;
      const z = p[a + 2] * wa + p[b + 2] * wb + p[c + 2] * wc;
      const correction = z - tongueSurfaceLimit(x, y);
      if (correction <= 0) continue;
      for (const vertex of [ia, ib, ic]) {
        const section = Math.floor(vertex / (tongueSides + 1));
        tongueCorrections[section] = Math.max(tongueCorrections[section], correction);
      }
    }
    let maxCorrection = 0;
    for (let row = 0; row <= tongueRows; row++) {
      maxCorrection = Math.max(maxCorrection, tongueCorrections[row]);
      for (let c = 0; c <= tongueSides; c++) p[(row * (tongueSides + 1) + c) * 3 + 2] -= tongueCorrections[row];
    }
    // Preserve a continuous path from the rear tongue to its tip after contact.
    for (let row = tongueRows - 1; row >= 0; row--) {
      const z = Math.min(p[row * (tongueSides + 1) * 3 + 2], p[(row + 1) * (tongueSides + 1) * 3 + 2]);
      for (let c = 0; c <= tongueSides; c++) p[(row * (tongueSides + 1) + c) * 3 + 2] = z;
    }
    tongueGeometry.attributes.position.needsUpdate = true;
    tongueGeometry.computeVertexNormals(); tongueGeometry.computeBoundingSphere();
    const line = lineGeometry.attributes.position.array;
    for (let i = 0; i < 25; i++) {
      const row = mix(0.2, 0.9, i / 24) * tongueRows;
      const lo = Math.floor(row), hi = Math.min(tongueRows, lo + 1), f = row - lo;
      const a = (lo * (tongueSides + 1) + tongueSides / 4) * 3;
      const b = (hi * (tongueSides + 1) + tongueSides / 4) * 3;
      for (let c = 0; c < 3; c++) line[i * 3 + c] = mix(p[a + c], p[b + c], f);
      line[i * 3 + 1] -= 0.004;
    }
    lineGeometry.attributes.position.needsUpdate = true; lineGeometry.computeBoundingSphere();
    group.userData.tongueContainment = { margin: tongueMargin, maxCorrection };
  }

  function updateMouth() {
    mouthWidth = clamp((0.37 + state.jawOpen * 0.055 + state.lipSpread * 0.22 + state.smile * 0.1 - state.lipRound * 0.205) * (1 - state.lipClose * 0.13), 0.145, 0.76);
    // Compensate jaw articulation for the shorter identity shape. The neutral
    // shape stays fixed while AH retains a useful vertical opening after warp.
    mouthHeight = (0.014 + state.jawOpen * 0.50 + state.lipRound * 0.12 + state.tongueOut * 0.075) * (1 - state.lipClose * 0.985);
    mouthCenter = -0.57 - state.jawOpen * 0.20 - state.lowerLipDepress * 0.035 + state.upperLipRaise * 0.018;
    let heightLimit = mouthHeight;
    for (let c = 0; c < sides; c++) {
      const angle = c / sides * Math.PI * 2, sine = Math.sin(angle), cosine = Math.cos(angle);
      if (Math.abs(sine) < 1e-6) continue;
      const point = mouthPoint(angle);
      const baseY = point.y - mouthHeight * sine;
      const outerThickness = (sine > 0 ? 0.039 : 0.051) * (1 + state.lipRound * 0.36);
      const outerX = point.x + cosine * outerThickness;
      const allowedY = (ry - 0.085) * Math.sqrt(Math.max(0, 1 - (outerX / (rx - 0.035)) ** 2));
      const edgeY = sine > 0 ? allowedY : -allowedY;
      heightLimit = Math.min(heightLimit, (edgeY - baseY - sine * outerThickness) / sine);
    }
    // Combined round/protrude/depress poses retain a complete strip of chin.
    mouthHeight = Math.max(0, Math.min(mouthHeight, heightLimit));
    const lip = lipGeometry.attributes.position.array;
    let index = 0;
    for (let row = 0; row <= lipRows; row++) {
      const cross = row / lipRows * Math.PI * 2;
      for (let c = 0; c <= sides; c++) {
        const a = c / sides * Math.PI * 2;
        const p = mouthPoint(a);
        const upper = Math.sin(a) >= 0;
        const thickness = lipThickness(upper);
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
      const { center, radius } = fittedTongueRing(t);
      for (let c = 0; c <= tongueSides; c++) {
        const a = c / tongueSides * Math.PI * 2;
        const centerDip = Math.sin(a) > 0 ? 0.008 * Math.exp(-((Math.cos(a) / 0.17) ** 2)) * Math.sin(Math.PI * t) : 0;
        array[index++] = center.x + Math.cos(a) * radius.width;
        array[index++] = center.y + Math.sin(a) * radius.height - centerDip;
        array[index++] = center.z;
      }
    }
    tongueGeometry.attributes.position.needsUpdate = true;
  }

  // Identity shape and expression stay separate. The articulation solve above
  // works in its canonical bind space; this one shared, smooth deformation then
  // carries every surface into the reference's short, rounded child proportions.
  // The triangular Jacobian has strictly positive diagonal entries, preserving
  // orientation and the contacts established between skin, lips and oral parts.
  const shapeY = [-3, -2.3, -1.95, -1.51, -0.57, -0.2, 0.265, 0.75, 1.51, 1.7];
  const shapeTargetY = [-2.15, -1.45, -1.1, -0.92, -0.38, -0.1, 0.265, 0.66, 1.42, 1.61];
  const shapeSlopes = shapeY.slice(1).map((y, i) => (shapeTargetY[i + 1] - shapeTargetY[i]) / (y - shapeY[i]));
  const shapeTangents = shapeY.map((y, i) => {
    if (i === 0) return shapeSlopes[0];
    if (i === shapeY.length - 1) return shapeSlopes.at(-1);
    const before = y - shapeY[i - 1], after = shapeY[i + 1] - y;
    const w1 = 2 * after + before, w2 = after + 2 * before;
    return (w1 + w2) / (w1 / shapeSlopes[i - 1] + w2 / shapeSlopes[i]);
  });
  const shapeSegments = shapeSlopes.map((slope, i) => {
    const h = shapeY[i + 1] - shapeY[i];
    return {
      h, a: 2 * shapeTargetY[i] - 2 * shapeTargetY[i + 1] + h * (shapeTangents[i] + shapeTangents[i + 1]),
      b: -3 * shapeTargetY[i] + 3 * shapeTargetY[i + 1] - h * (2 * shapeTangents[i] + shapeTangents[i + 1]),
      c: h * shapeTangents[i], d: shapeTargetY[i],
    };
  });
  const shapeResult = { x: 0, y: 0, z: 0, xx: 1, xy: 0, yy: 1, zy: 0, zz: 1 };
  function referenceShape(x, y, z) {
    let finalY, derivativeY;
    if (y <= shapeY[0]) {
      derivativeY = shapeTangents[0]; finalY = shapeTargetY[0] + (y - shapeY[0]) * derivativeY;
    } else if (y >= shapeY.at(-1)) {
      derivativeY = shapeTangents.at(-1); finalY = shapeTargetY.at(-1) + (y - shapeY.at(-1)) * derivativeY;
    } else {
      let i = 0;
      while (shapeY[i + 1] < y) i++;
      const segment = shapeSegments[i], t = (y - shapeY[i]) / segment.h;
      finalY = ((segment.a * t + segment.b) * t + segment.c) * t + segment.d;
      derivativeY = (3 * segment.a * t * t + 2 * segment.b * t + segment.c) / segment.h;
    }
    const eyeField = 0.14 * Math.exp(-(((y - 0.265) / 0.4) ** 2));
    const noseField = 0.35 * Math.exp(-(((y + 0.185) / 0.16) ** 2));
    const cheekField = 0.025 * Math.exp(-(((y + 0.38) / 0.55) ** 2));
    const mouthField = 0.18 * Math.exp(-(((y + 0.57) / 0.18) ** 2));
    const eyeX4 = (x / 0.8) ** 4, noseX4 = (x / 0.24) ** 4, mouthX4 = (x / 0.65) ** 4;
    const eyeFalloff = Math.exp(-eyeX4), noseFalloff = Math.exp(-noseX4), mouthFalloff = Math.exp(-mouthX4);
    const width = 1 + cheekField + eyeField * eyeFalloff - noseField * noseFalloff - mouthField * mouthFalloff;
    const derivativeX = 1 + cheekField + eyeField * eyeFalloff * (1 - 4 * eyeX4)
      - noseField * noseFalloff * (1 - 4 * noseX4) - mouthField * mouthFalloff * (1 - 4 * mouthX4);
    const widthY = -2 * (y + 0.38) / (0.55 ** 2) * cheekField
      - 2 * (y - 0.265) / (0.4 ** 2) * eyeField * eyeFalloff
      + 2 * (y + 0.185) / (0.16 ** 2) * noseField * noseFalloff
      + 2 * (y + 0.57) / (0.18 ** 2) * mouthField * mouthFalloff;
    const depthField = 0.3 * Math.exp(-(((y - 0.15) / 0.55) ** 2));
    const depthY = -2 * (y - 0.15) / (0.55 ** 2) * depthField;
    const depthArgument = 16 * (z - 0.9);
    const softDepth = Math.log1p(Math.exp(depthArgument)) / 16;
    const depthDerivative = 1 / (1 + Math.exp(-depthArgument));
    shapeResult.x = x * width; shapeResult.y = finalY; shapeResult.z = z - depthField * softDepth;
    shapeResult.xx = derivativeX; shapeResult.xy = x * widthY; shapeResult.yy = derivativeY;
    shapeResult.zy = -depthY * softDepth; shapeResult.zz = 1 - depthField * depthDerivative;
    return shapeResult;
  }

  function captureRestShape() {
    const objects = [...trackedMeshes, tongueGroove];
    const counts = new Map();
    for (const object of objects) counts.set(object.geometry, (counts.get(object.geometry) || 0) + 1);
    const dynamicGeometry = new Set([frontGeometry, backGeometry, lipGeometry, cavityGeometry, tongueGeometry, lineGeometry]);
    for (const object of objects) {
      // Ellipsoids share one unit sphere during authoring. Each needs its own
      // buffer before a deformation is baked in its individual local space.
      if (counts.get(object.geometry) > 1) {
        object.geometry = object.geometry.clone(); geometries.add(object.geometry);
      }
      const geometry = object.geometry;
      geometry.computeBoundingBox();
      restShapeEntries.push({
        object, geometry, positions: geometry.attributes.position.array.slice(),
        normals: geometry.attributes.normal?.array.slice(), box: geometry.boundingBox.clone(),
        matrix: new THREE.Matrix4(), inverse: new THREE.Matrix4(),
        normalMatrix: new THREE.Matrix3(), inverseNormal: new THREE.Matrix3(),
        dynamic: dynamicGeometry.has(geometry), lastMatrix: null,
      });
    }
    restShapeReady = true;
  }

  function restoreRestShape() {
    if (!restShapeReady) return;
    for (const entry of restShapeEntries) {
      entry.geometry.attributes.position.array.set(entry.positions);
      if (entry.normals) entry.geometry.attributes.normal.array.set(entry.normals);
      entry.geometry.boundingBox.copy(entry.box);
    }
  }

  function applyRestShape() {
    if (!restShapeReady) return;
    for (const entry of restShapeEntries) {
      const { object, geometry, matrix, inverse, normalMatrix, inverseNormal } = entry;
      object.updateMatrix(); matrix.copy(object.matrix);
      let parent = object.parent;
      while (parent && parent !== group) { parent.updateMatrix(); matrix.premultiply(parent.matrix); parent = parent.parent; }
      if (!entry.dynamic && entry.lastMatrix?.equals(matrix)) {
        geometry.attributes.position.array.set(entry.finalPositions);
        if (entry.finalNormals) geometry.attributes.normal.array.set(entry.finalNormals);
        geometry.attributes.position.needsUpdate = true;
        if (entry.finalNormals) geometry.attributes.normal.needsUpdate = true;
        geometry.boundingBox.copy(entry.finalBox); geometry.boundingSphere.copy(entry.finalSphere);
        continue;
      }
      inverse.copy(matrix).invert();
      normalMatrix.getNormalMatrix(matrix); inverseNormal.copy(normalMatrix).invert();
      const m = matrix.elements, im = inverse.elements, nm = normalMatrix.elements, inn = inverseNormal.elements;
      const p = geometry.attributes.position.array, normals = geometry.attributes.normal?.array;
      for (let i = 0; i < p.length; i += 3) {
        const px = p[i], py = p[i + 1], pz = p[i + 2];
        const x = m[0] * px + m[4] * py + m[8] * pz + m[12];
        const y = m[1] * px + m[5] * py + m[9] * pz + m[13];
        const z = m[2] * px + m[6] * py + m[10] * pz + m[14];
        const f = referenceShape(x, y, z);
        p[i] = im[0] * f.x + im[4] * f.y + im[8] * f.z + im[12];
        p[i + 1] = im[1] * f.x + im[5] * f.y + im[9] * f.z + im[13];
        p[i + 2] = im[2] * f.x + im[6] * f.y + im[10] * f.z + im[14];
        if (!normals) continue;
        const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
        const gx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
        const gy = nm[1] * nx + nm[4] * ny + nm[7] * nz;
        const gz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const wx = gx / f.xx, wz = gz / f.zz, wy = (gy - f.xy * wx - f.zy * wz) / f.yy;
        const lx = inn[0] * wx + inn[3] * wy + inn[6] * wz;
        const ly = inn[1] * wx + inn[4] * wy + inn[7] * wz;
        const lz = inn[2] * wx + inn[5] * wy + inn[8] * wz;
        const length = Math.hypot(lx, ly, lz) || 1;
        normals[i] = lx / length; normals[i + 1] = ly / length; normals[i + 2] = lz / length;
      }
      geometry.attributes.position.needsUpdate = true;
      if (normals) geometry.attributes.normal.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      if (!entry.dynamic) {
        entry.finalPositions ||= new Float32Array(p.length); entry.finalPositions.set(p);
        if (normals) { entry.finalNormals ||= new Float32Array(normals.length); entry.finalNormals.set(normals); }
        entry.lastMatrix ||= new THREE.Matrix4(); entry.lastMatrix.copy(matrix);
        entry.finalBox ||= new THREE.Box3(); entry.finalBox.copy(geometry.boundingBox);
        entry.finalSphere ||= new THREE.Sphere(); entry.finalSphere.copy(geometry.boundingSphere);
      }
    }
  }

  let previous = '';
  function update(input = {}) {
    for (const key of keys) state[key] = clamp(Number.isFinite(input[key]) ? input[key] : 0, key === 'tongueLeft' ? -1 : 0, 1);
    const signature = keys.map(key => state[key].toFixed(4)).join(',');
    if (signature === previous) return;
    previous = signature;
    restoreRestShape();
    updateMouth(); updateHead(); containDentalArches(); containTongue();
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
    applyRestShape();
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
  function setCutaway(value) {
    cutaway = Boolean(value); previous = ''; update({ ...state }); applyAppearance();
  }
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
  captureRestShape(); applyRestShape();
  group.userData.restShape = { method: 'shared-monotone-reference-cage', landmarks: { eyeY: 0.265, mouthY: -0.38, chinY: -0.92 } };
  return { group, update, setWireframe, setCutaway, dispose };
}
