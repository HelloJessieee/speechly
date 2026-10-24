# Articulation Studio · 动作接口 0.1

这是为发音项目准备的网页角色动作原型，参照附图中的圆脸、深色短发与柔和表情建立。嘴唇、舌头、脸颊和表情可以独立控制。口形预设与示例序列用于展示接口与动作节奏；它们是示意近似，不能替代准确的发音教学或医学解剖模型。示例不附带语音，当前尚未接入语音识别、音素识别或自动音频对齐。

模型由 `rig.js` 在运行时程序化生成，并通过 JavaScript 动态修改网格与部件变换来运动。交付内容包含可继续修改的模型源码；目前没有导出为带 morph targets 的 GLB 资产。后续若需要在其他引擎中使用，可再建立对应的骨骼或形态键资产与参数映射。

## 本地打开

解压项目后，在包含 `dist` 文件夹的项目目录打开终端，运行：

```sh
python3 -m http.server 4173 --directory dist
```

然后用浏览器打开 [http://localhost:4173](http://localhost:4173)。启动后即可旋转模型、调节滑杆、选择口形和播放动作。保持这个终端窗口开启；结束时按 `Control + C`。如果 `4173` 端口已被占用，可将命令和网址中的端口一起改为 `4174`。

所有网页依赖均已随项目放在 `dist/vendor` 中，不需要执行 `npm install`，也不依赖 CDN。网页使用浏览器 ES module，需要通过上面的本地网址加载。建议使用支持 WebGL 2 的现代浏览器。

## 文件说明

| 文件 / 文件夹 | 用途 |
| --- | --- |
| `README.md` | 项目打开方法与完整接入说明，即本文 |
| `dist/index.html` | 网页入口 |
| `dist/style.css` | 工作台的界面样式 |
| `dist/app.js` | 将界面、场景与动作控制器连接起来 |
| `dist/rig.js` | 三维角色的程序化建模、动态变形与显示控制 |
| `dist/controller.js` | 独立动作接口、参数、口形预设与序列播放 |
| `dist/API.md` | 与本文内容相同的接入说明，方便与网页一起移交 |
| `dist/examples/hello.json` | 可直接导入网页的 Hello 口形序列 |
| `dist/examples/custom-pose.json` | 舌头、嘴唇、脸颊独立控制的序列样例 |
| `dist/assets/reference.png` | 用户提供的造型参考图 |
| `dist/vendor/` | 随附的 Three.js、视角控制与许可证 |

## 独立接入角色

动作控制器位于 `dist/controller.js`，不依赖第三方库；角色渲染使用随附的 Three.js。现有工作台已通过 `window.articulation` 暴露控制接口。若要把角色放进自己的 Three.js 项目，可以复制 `rig.js`、`controller.js` 和 `vendor`，使用以下浏览器模块代码。示例假设模块与这三个文件 / 文件夹位于同一目录，页面中使用 `<script type="module">` 加载它。

```js
import * as THREE from './vendor/three.module.js';
import { createCharacter } from './rig.js';
import {
  createController,
  parameterSchema,
  presets,
  sampleSequences,
  protocolVersion,
} from './controller.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eff3ee');
const camera = new THREE.PerspectiveCamera(37, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.05, 8.7);
camera.lookAt(0, -0.23, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = '0';
document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight('#fffbea', '#728a6d', 2.3));
const light = new THREE.DirectionalLight('#ffe8d0', 3.2);
light.position.set(-3, 5, 6);
scene.add(light);

const rig = createCharacter();
scene.add(rig.group);
const controller = createController((state) => {
  rig.update(state);
});
window.articulation = controller;
renderer.setAnimationLoop(() => renderer.render(scene, camera));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener('pagehide', () => {
  controller.destroy();
  renderer.setAnimationLoop(null);
  rig.dispose();
  renderer.dispose();
}, { once: true });

await controller.setViseme('th', { duration: 250 });
```

`createCharacter()` 返回 `{ group, update, setWireframe, setCutaway, dispose }`。`group` 可添加到现有场景；`update(state)` 接收完整状态；`setCutaway(true)` 开启口腔透视；`setWireframe(true)` 显示网格；`dispose()` 释放角色占用的网格和材质。坐标约定为 `+Y` 向上、`+Z` 面朝前、`+X` 为角色自身左侧。

## 参数

`parameterSchema` 是数组；每项包含 `key`、中文 `label`、中文 `group`、`min`、`max` 和 `default`。所有参数默认值为 `0`。左右均指角色自身的左右。

| 参数 | 作用 | 范围 |
| --- | --- | --- |
| `jawOpen` | 下颌张开 | 0–1 |
| `lipRound` | 嘴唇圆拢 | 0–1 |
| `lipSpread` | 嘴角展开 | 0–1 |
| `lipClose` | 双唇闭合 | 0–1 |
| `upperLipRaise` | 上唇抬起 | 0–1 |
| `lowerLipDepress` | 下唇下移 | 0–1 |
| `tongueOut` | 舌头前伸 | 0–1 |
| `tongueUp` | 舌尖抬起 | 0–1 |
| `tongueBack` | 舌头后收 | 0–1 |
| `tongueLeft` | 舌头横向运动；正值向角色左侧 | −1–1 |
| `cheekPuffLeft`, `cheekPuffRight` | 左右脸颊鼓起 | 0–1 |
| `cheekRaiseLeft`, `cheekRaiseRight` | 左右脸颊上提 | 0–1 |
| `blinkLeft`, `blinkRight` | 左右眼闭合 | 0–1 |
| `smile` | 微笑 | 0–1 |

合法数字会自动限制到参数范围。未知参数、非有限数字、非法时长和未知口形会立即抛出错误，且不打断正在播放的有效动作。参数强度没有物理单位；组合参数不保证对应真实的人体发音姿态。

## 设置姿态

`setPose(partial, { duration = 180 } = {})` 只修改传入的参数，其余参数保持当前值。`duration` 单位为毫秒，允许 `0` 立即生效。过渡使用平滑缓动。`getState()` 返回当前完整状态的副本，可安全修改副本。

```js
await window.articulation.setPose({
  jawOpen: 0.55,
  tongueOut: 0.4,
  tongueUp: 0.3,
  cheekPuffLeft: 0.25,
}, { duration: 300 });

await window.articulation.setPose({ tongueLeft: -0.5 }, { duration: 220 });
console.log(window.articulation.getState());
await window.articulation.reset({ duration: 250 });
```

`setViseme(id, options)` 应用预设的完整状态，因此会同时复位预设未使用的参数。可用 ID：`neutral`、`aa`、`ee`、`ih`、`eh`、`oh`、`oo`、`fv`、`th`、`l`、`m`、`sz`、`sh`。`presets` 每项有 `id`、`ipa`、`label`、`word`、`hint`、`state`；同一可视口形可能用于多个声音。

```js
await window.articulation.setViseme('th', { duration: 200 });
await window.articulation.setViseme('oo');
```

## 播放时间序列

`playSequence(frames, { loop = false, speed = 1 } = {})` 接受 JSON 兼容的帧数组。每帧必须且只能使用 `pose` 或 `viseme` 之一，且包含 `duration`。`pose` 可以是部分状态；`viseme` 使用完整预设。`duration` 包含动作过渡与停留：前 `min(180ms, duration × 0.45)` 用于过渡，其余时间保持。`speed` 同比例缩放过渡与停留，`2` 表示两倍速。

```js
const frames = [
  { viseme: 'm', duration: 250 },
  { viseme: 'aa', duration: 400 },
  { pose: { tongueUp: 0.85, jawOpen: 0.35 }, duration: 300 },
  { viseme: 'neutral', duration: 300 },
];
const result = await window.articulation.playSequence(frames, { speed: 1 });
console.log(result.status); // 'completed' 或 'cancelled'

// 内置样例；它们只是口形节奏演示。
await controller.playSequence(sampleSequences.hello.frames);
await controller.playSequence(sampleSequences.goodMorning.frames);
```

外部系统可保存以下 JSON 格式。`version` 属于调用方的协议包装；控制器接收其中的 `frames` 数组。加载 JSON 只解析数据，不执行代码。

```json
{
  "version": "0.1",
  "frames": [
    { "viseme": "m", "duration": 240 },
    { "pose": { "jawOpen": 0.6, "lipRound": 0.15 }, "duration": 420 },
    { "viseme": "neutral", "duration": 260 }
  ]
}
```

```js
const sequence = JSON.parse(jsonText);
if (sequence.version !== '0.1') throw new Error('不支持的动作协议版本');
await window.articulation.playSequence(sequence.frames);
```

在工作台中点击「查看控制接口」→「导入动作 JSON」，选择 `examples/hello.json` 或 `examples/custom-pose.json`，关闭弹窗后点击「播放动作」即可预览。也可以从代码加载随附样例：

```js
const sequence = await fetch('./examples/custom-pose.json').then((response) => response.json());
await window.articulation.playSequence(sequence.frames);
```

工作台的「导出姿态」保存单个 `{ version, character, pose }` 对象。恢复这类姿态时，读取 JSON 后调用 `window.articulation.setPose(data.pose)`；「导入动作 JSON」则使用上面的 `frames` 序列格式。

控制器单次序列最多 10000 帧，时长必须是大于等于 `0` 的有限毫秒数；速度必须是大于 `0` 的有限数字。循环序列的总时长必须大于 `0`。工作台的文件导入界面另限制为小于 1 MB、1–500 帧、单帧 0–60000 毫秒。

## 中断与事件

新姿态、口形或序列会替换当前动作。`stop()` 停在当前姿态；`reset()` 平滑回到默认姿态。每次动作返回的 Promise 在完成或取消时都会结束：`{ status: 'completed' | 'cancelled', state, reason? }`。取消原因为 `replaced`、`stopped` 或 `destroyed`。循环序列在停止或替换后结束 Promise。`stop()` 没有当前动作时返回 `{ status: 'idle', state }`。

```js
const playback = window.articulation.playSequence(frames, { loop: true });
window.articulation.stop();
console.log(await playback); // status: 'cancelled', reason: 'stopped'
```

控制器自己管理动画帧，无需外部调用 `tick()`。`controller.events` 是 `EventTarget`，提供 `change`、`sequence:start`、`sequence:end`。`change` 的 `event.detail` 包含 `state`、`source` 与 `protocolVersion`；序列开始事件包含 `id`、`frameCount`、`loop` 和 `speed`；结束事件包含 `id`、`status`、`state`、`loopsCompleted` 和可选 `reason`。`loopsCompleted` 对非循环播放完整结束时为 `1`。

```js
window.articulation.events.addEventListener('change', (event) => {
  console.log(event.detail.state);
});
window.articulation.events.addEventListener('sequence:end', (event) => {
  console.log(event.detail.status);
});

// 同样的事件也派发到 document，增加 articulation: 前缀。
document.addEventListener('articulation:sequence:start', (event) => {
  console.log(event.detail.frameCount);
});
```

页面卸载或移除角色时调用 `destroy()`，它会取消当前动作并释放动画帧；之后不能再启动动作。`getState()`、`stop()` 仍可安全读取或调用。
