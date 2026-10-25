/**
 * Articulation Studio motion protocol 0.1.
 * Illustrative animation controls, not a clinical or phonetic anatomy model.
 * Dependency-free browser ES module.
 */
export const protocolVersion = '0.1';

export const parameterSchema = Object.freeze([
  { key: 'jawOpen', label: '下颌张开', group: '嘴唇与下颌', min: 0, max: 1, default: 0 },
  { key: 'lipRound', label: '嘴唇圆拢', group: '嘴唇与下颌', min: 0, max: 1, default: 0 },
  { key: 'lipSpread', label: '嘴角展开', group: '嘴唇与下颌', min: 0, max: 1, default: 0 },
  { key: 'lipClose', label: '双唇闭合', group: '嘴唇与下颌', min: 0, max: 1, default: 0 },
  { key: 'upperLipRaise', label: '上唇抬起', group: '嘴唇与下颌', min: 0, max: 1, default: 0 },
  { key: 'lowerLipDepress', label: '下唇下移', group: '嘴唇与下颌', min: 0, max: 1, default: 0 },
  { key: 'tongueOut', label: '舌头前伸', group: '舌头', min: 0, max: 1, default: 0 },
  { key: 'tongueUp', label: '舌尖抬起', group: '舌头', min: 0, max: 1, default: 0 },
  { key: 'tongueBack', label: '舌头后收', group: '舌头', min: 0, max: 1, default: 0 },
  { key: 'tongueLeft', label: '舌头左右', group: '舌头', min: -1, max: 1, default: 0 },
  { key: 'cheekPuffLeft', label: '左脸颊鼓起', group: '脸颊与表情', min: 0, max: 1, default: 0 },
  { key: 'cheekPuffRight', label: '右脸颊鼓起', group: '脸颊与表情', min: 0, max: 1, default: 0 },
  { key: 'cheekRaiseLeft', label: '左脸颊上提', group: '脸颊与表情', min: 0, max: 1, default: 0 },
  { key: 'cheekRaiseRight', label: '右脸颊上提', group: '脸颊与表情', min: 0, max: 1, default: 0 },
  { key: 'blinkLeft', label: '左眼闭合', group: '脸颊与表情', min: 0, max: 1, default: 0 },
  { key: 'blinkRight', label: '右眼闭合', group: '脸颊与表情', min: 0, max: 1, default: 0 },
  { key: 'smile', label: '微笑', group: '脸颊与表情', min: 0, max: 1, default: 0 },
].map((parameter) => Object.freeze(parameter)));

const schemaByKey = new Map(parameterSchema.map((parameter) => [parameter.key, parameter]));
const defaultState = Object.freeze(Object.fromEntries(parameterSchema.map((parameter) => [parameter.key, parameter.default])));
const makePreset = (id, ipa, label, word, hint, pose) => Object.freeze({
  id, ipa, label, word, hint, state: Object.freeze({ ...defaultState, ...pose }),
});

export const presets = Object.freeze([
  makePreset('neutral', '—', '自然放松', 'neutral', '回到初始表情，作为动作之间的过渡。', {}),
  makePreset('aa', '/ɑː/', '张口 · AH', 'father', '较大开口，观察下颌与下唇的联动。', { jawOpen: 0.78, lowerLipDepress: 0.26, tongueBack: 0.16 }),
  makePreset('ee', '/iː/', '展开 · EE', 'see', '嘴角向两侧展开，舌头位置仅作示意。', { jawOpen: 0.18, lipSpread: 0.8, upperLipRaise: 0.12, tongueUp: 0.2, tongueBack: 0.1 }),
  makePreset('ih', '/ɪ/', '轻开 · IH', 'sit', '较小开口，嘴角适度展开。', { jawOpen: 0.26, lipSpread: 0.4, tongueUp: 0.2 }),
  makePreset('eh', '/ɛ/', '半开 · EH', 'bed', '半张口，嘴角轻轻展开。', { jawOpen: 0.42, lipSpread: 0.42, lowerLipDepress: 0.12 }),
  makePreset('oh', '/oʊ/', '圆口 · OH', 'go', '嘴唇逐渐圆拢，配合中等开口。', { jawOpen: 0.43, lipRound: 0.7, lowerLipDepress: 0.06, tongueBack: 0.2 }),
  makePreset('oo', '/uː/', '收圆 · OO', 'blue', '嘴唇进一步收圆，保持小开口。', { jawOpen: 0.18, lipRound: 0.94, tongueBack: 0.25 }),
  makePreset('fv', '/f, v/', '唇齿 · F / V', 'fan · van', '示意下唇靠近上齿；清浊音不能仅靠口形区分。', { jawOpen: 0.12, lipSpread: 0.18, upperLipRaise: 0.28, lowerLipDepress: 0.08, lipClose: 0.5 }),
  makePreset('th', '/θ, ð/', '齿间 · TH', 'think · this', '舌尖向前伸出，显示舌头与唇部的关系。', { jawOpen: 0.24, lipSpread: 0.12, tongueOut: 0.55, tongueUp: 0.16 }),
  makePreset('l', '/l/', '舌尖抬起 · L', 'light', '抬起舌尖，作为后续发音时序的可控姿态。', { jawOpen: 0.4, lipSpread: 0.16, tongueUp: 0.9, tongueOut: 0.08 }),
  makePreset('r', '/ɹ/', '舌头后收 · R', 'red', '舌头轻轻后收，不接触上颚。', { jawOpen: 0.28, lipRound: 0.28, tongueBack: 0.58, tongueUp: 0.35 }),
  makePreset('kg', '/k, g, ŋ/', '舌根抬起 · K / G / NG', 'key · go · sing', '舌根向软腭抬起；这是内部动作的示意。', { jawOpen: 0.27, tongueBack: 0.78, tongueUp: 0.6 }),
  makePreset('m', '/m, p, b/', '双唇闭合 · M / P / B', 'map · pat · bat', '双唇闭合；爆破和声带振动需要额外音频时序。', { jawOpen: 0, lipClose: 1, lipSpread: 0.08 }),
  makePreset('sz', '/s, z/', '窄口 · S / Z', 'see · zoo', '牙齿接近，嘴角略展开；这里是可视化近似。', { jawOpen: 0.1, lipSpread: 0.62, upperLipRaise: 0.22, tongueUp: 0.45, tongueBack: 0.14 }),
  makePreset('sh', '/ʃ, ʒ/', '轻圆 · SH', 'she', '嘴唇轻度圆拢，舌头适度抬起和后收。', { jawOpen: 0.24, lipRound: 0.5, tongueUp: 0.42, tongueBack: 0.32 }),
]);

const presetsById = new Map(presets.map((preset) => [preset.id, preset]));
const freezeFrames = (frames) => Object.freeze(frames.map((frame) => Object.freeze(frame)));

export const sampleSequences = Object.freeze({
  hello: Object.freeze({
    id: 'hello', label: 'Hello', description: '口形节奏示意 · 不含语音',
    frames: freezeFrames([
      { viseme: 'neutral', duration: 250 },
      { viseme: 'aa', duration: 170 },
      { viseme: 'eh', duration: 300 },
      { viseme: 'l', duration: 250 },
      { viseme: 'oh', duration: 480 },
      { viseme: 'neutral', duration: 350 },
    ]),
  }),
  goodMorning: Object.freeze({
    id: 'goodMorning', label: 'Good morning', description: '口形节奏示意 · 不含语音',
    frames: freezeFrames([
      { viseme: 'neutral', duration: 220 },
      { viseme: 'oo', duration: 360 },
      { viseme: 'l', duration: 170 },
      { viseme: 'm', duration: 210 },
      { viseme: 'oh', duration: 420 },
      { viseme: 'sh', duration: 180 },
      { viseme: 'l', duration: 190 },
      { viseme: 'ih', duration: 300 },
      { viseme: 'neutral', duration: 380 },
    ]),
  }),
});

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const now = () => globalThis.performance?.now?.() ?? Date.now();
const requestFrame = (callback) => typeof globalThis.requestAnimationFrame === 'function'
  ? globalThis.requestAnimationFrame(callback)
  : globalThis.setTimeout(() => callback(now()), 16);
const cancelFrame = (handle) => typeof globalThis.cancelAnimationFrame === 'function'
  ? globalThis.cancelAnimationFrame(handle)
  : globalThis.clearTimeout(handle);
const ease = (progress) => progress * progress * (3 - 2 * progress);

function validatePose(pose) {
  if (!isRecord(pose)) throw new TypeError('pose 必须是参数对象。');
  const result = {};
  for (const [key, value] of Object.entries(pose)) {
    const parameter = schemaByKey.get(key);
    if (!parameter) throw new TypeError(`未知动作参数：${key}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} 必须是有限数字。`);
    result[key] = Math.min(parameter.max, Math.max(parameter.min, value));
  }
  return result;
}

function validateDuration(duration, name = 'duration') {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
    throw new RangeError(`${name} 必须是大于等于 0 的有限毫秒数。`);
  }
  return duration;
}

function validateFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) throw new TypeError('frames 必须是非空数组。');
  if (frames.length > 10000) throw new RangeError('单次序列最多支持 10000 帧。');
  return frames.map((frame, index) => {
    if (!isRecord(frame)) throw new TypeError(`第 ${index + 1} 帧必须是对象。`);
    const hasPose = Object.hasOwn(frame, 'pose');
    const hasViseme = Object.hasOwn(frame, 'viseme');
    if (hasPose === hasViseme) throw new TypeError(`第 ${index + 1} 帧必须且只能包含 pose 或 viseme 之一。`);
    let pose;
    if (hasViseme) {
      const preset = presetsById.get(frame.viseme);
      if (!preset) throw new TypeError(`未知口形：${String(frame.viseme)}`);
      pose = { ...preset.state };
    } else {
      pose = validatePose(frame.pose);
    }
    return { pose, viseme: hasViseme ? frame.viseme : null, duration: validateDuration(frame.duration, `frames[${index}].duration`) };
  });
}

function makeEvent(type, detail) {
  if (typeof globalThis.CustomEvent === 'function') return new CustomEvent(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

/**
 * One controller owns one animation loop. Pose changes replace current playback.
 * Motion promises always settle with { status, state, reason? } on cancellation.
 */
export function createController(onUpdate = () => {}) {
  if (typeof onUpdate !== 'function') throw new TypeError('onUpdate 必须是函数。');
  const events = new EventTarget();
  let state = { ...defaultState };
  let active = null;
  let frameHandle = null;
  let destroyed = false;
  let nextOperationId = 1;

  const assertLive = () => {
    if (destroyed) throw new Error('此动作控制器已销毁。');
  };
  const emit = (type, detail) => {
    events.dispatchEvent(makeEvent(type, detail));
    if (globalThis.document?.dispatchEvent) {
      globalThis.document.dispatchEvent(makeEvent(`articulation:${type}`, detail));
    }
  };
  const apply = (pose, source, force = false) => {
    const changed = force || parameterSchema.some(({ key }) => state[key] !== pose[key]);
    state = { ...pose };
    if (changed) {
      onUpdate({ ...state });
      emit('change', { protocolVersion, state: { ...state }, source });
    }
  };
  const resultFor = (status, reason) => ({ status, state: { ...state }, ...(reason ? { reason } : {}) });
  const finish = (operation, status, reason) => {
    if (active !== operation) return;
    if (frameHandle !== null) cancelFrame(frameHandle);
    frameHandle = null;
    active = null;
    const result = resultFor(status, reason);
    if (operation.kind === 'sequence') {
      emit('sequence:end', { ...result, id: operation.id, loopsCompleted: operation.loopsCompleted });
    }
    operation.resolve(result);
    return result;
  };
  const cancelActive = (reason) => active ? finish(active, 'cancelled', reason) : resultFor('idle');
  const interpolate = (from, to, progress) => Object.fromEntries(parameterSchema.map(({ key }) => [key, from[key] + (to[key] - from[key]) * ease(progress)]));

  const beginSequenceFrame = (operation, startTime) => {
    const frame = operation.frames[operation.index];
    operation.from = { ...state };
    operation.to = { ...state, ...frame.pose };
    operation.start = startTime;
    operation.duration = frame.duration / operation.speed;
    // Each frame includes an eased movement followed by a hold.
    operation.transition = Math.min(180, frame.duration * 0.45) / operation.speed;
  };

  const step = (timestamp) => {
    frameHandle = null;
    const operation = active;
    if (!operation) return;
    if (operation.kind === 'pose') {
      const progress = operation.duration === 0 ? 1 : Math.min(1, Math.max(0, (timestamp - operation.start) / operation.duration));
      apply(progress === 1 ? operation.to : interpolate(operation.from, operation.to, progress), 'pose');
      if (active !== operation) return;
      if (progress === 1) finish(operation, 'completed');
      else frameHandle = requestFrame(step);
      return;
    }

    while (active === operation && timestamp >= operation.start + operation.duration) {
      apply(operation.to, 'sequence');
      if (active !== operation) return;
      const nextStart = operation.start + operation.duration;
      operation.index += 1;
      if (operation.index === operation.frames.length) {
        operation.loopsCompleted += 1;
        if (!operation.loop) {
          finish(operation, 'completed');
          return;
        }
        operation.index = 0;
        // Hidden tabs can resume far ahead. Completed full cycles are stable,
        // so skip missed cycles without performing thousands of stale frames.
        const missedCycles = Math.floor(Math.max(0, timestamp - nextStart) / operation.totalDuration);
        operation.loopsCompleted += missedCycles;
        beginSequenceFrame(operation, nextStart + missedCycles * operation.totalDuration);
      } else {
        beginSequenceFrame(operation, nextStart);
      }
    }
    if (active !== operation) return;
    const progress = operation.transition === 0 ? 1 : Math.min(1, Math.max(0, (timestamp - operation.start) / operation.transition));
    apply(progress === 1 ? operation.to : interpolate(operation.from, operation.to, progress), 'sequence');
    if (active === operation) frameHandle = requestFrame(step);
  };

  const setPose = (partial, { duration = 180 } = {}) => {
    assertLive();
    const pose = validatePose(partial);
    validateDuration(duration);
    cancelActive('replaced');
    const target = { ...state, ...pose };
    if (duration === 0) {
      apply(target, 'pose');
      return Promise.resolve(resultFor('completed'));
    }
    return new Promise((resolve) => {
      active = { kind: 'pose', id: nextOperationId++, from: { ...state }, to: target, start: now(), duration, resolve };
      frameHandle = requestFrame(step);
    });
  };

  const setViseme = (id, options) => {
    assertLive();
    const preset = presetsById.get(id);
    if (!preset) throw new TypeError(`未知口形：${String(id)}`);
    return setPose(preset.state, options);
  };

  const playSequence = (frames, { loop = false, speed = 1 } = {}) => {
    assertLive();
    const validatedFrames = validateFrames(frames);
    if (typeof loop !== 'boolean') throw new TypeError('loop 必须是布尔值。');
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) throw new RangeError('speed 必须是大于 0 的有限数字。');
    const totalDuration = validatedFrames.reduce((sum, frame) => sum + frame.duration / speed, 0);
    if (!Number.isFinite(totalDuration)) throw new RangeError('序列总时长超出范围。');
    if (loop && totalDuration === 0) throw new RangeError('循环序列的总时长必须大于 0。');
    cancelActive('replaced');
    return new Promise((resolve) => {
      const operation = {
        kind: 'sequence', id: nextOperationId++, frames: validatedFrames, loop, speed,
        totalDuration, index: 0, loopsCompleted: 0, resolve,
      };
      active = operation;
      beginSequenceFrame(operation, now());
      emit('sequence:start', { protocolVersion, id: operation.id, frameCount: validatedFrames.length, loop, speed });
      if (active === operation) frameHandle = requestFrame(step);
    });
  };

  const api = Object.freeze({
    protocolVersion,
    events,
    setPose,
    setViseme,
    getState: () => ({ ...state }),
    reset: (options) => setPose(defaultState, options),
    playSequence,
    stop: () => cancelActive('stopped'),
    destroy: () => {
      if (destroyed) return;
      cancelActive('destroyed');
      destroyed = true;
    },
  });
  apply(state, 'initial', true);
  return api;
}
