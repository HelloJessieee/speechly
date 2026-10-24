import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { MouthRig } from './rig'
import type { Mouth3DParams } from './surface'

/** Named camera angles. Azimuth is the left/right turn, elevation the up/down tilt (radians). */
export const VIEWS = {
  front: { azimuth: 0, elevation: 0 },
  threeQuarterLeft: { azimuth: -0.75, elevation: 0.08 },
  threeQuarterRight: { azimuth: 0.75, elevation: 0.08 },
  side: { azimuth: Math.PI / 2 - 0.12, elevation: 0 },
  below: { azimuth: 0.2, elevation: -0.55 },
} as const

export type ViewName = keyof typeof VIEWS

const TARGET = new THREE.Vector3(0, 0.05, 1)
const DISTANCE = 6.4
// Keep the learner from turning the face to an unreadable angle.
const MAX_AZIMUTH = 1.45
const MAX_ELEVATION = 0.7

/**
 * Owns the WebGL renderer, camera and drag controls around a MouthRig.
 * Throws from the constructor when WebGL is unavailable.
 */
export class MouthViewer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
  private readonly controls: OrbitControls
  private readonly rig = new MouthRig()
  private readonly resize: ResizeObserver
  private tween: { from: THREE.Spherical; to: THREE.Spherical; start: number; duration: number } | null = null
  /** Called whenever the camera angle changes, with azimuth and elevation in radians. */
  onViewChange: ((azimuth: number, elevation: number) => void) | null = null
  private readonly host: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    host.appendChild(this.renderer.domElement)

    // Soft, even light for a cartoon look: strong sky fill, gentle key.
    this.scene.add(new THREE.HemisphereLight('#fff8f0', '#e8b8a4', 2.1))
    const key = new THREE.DirectionalLight('#fff3e6', 1.7)
    key.position.set(2.5, 3, 5)
    const fill = new THREE.DirectionalLight('#e6efff', 0.9)
    fill.position.set(-4, 0.5, 2)
    const rim = new THREE.DirectionalLight('#ffffff', 0.5)
    rim.position.set(0, 2, -4)
    this.scene.add(key, fill, rim, this.rig.group)

    this.camera.position.copy(TARGET).add(new THREE.Vector3(0, 0, DISTANCE))
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.copy(TARGET)
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.minDistance = 3.2
    this.controls.maxDistance = 10
    this.controls.minAzimuthAngle = -MAX_AZIMUTH
    this.controls.maxAzimuthAngle = MAX_AZIMUTH
    this.controls.minPolarAngle = Math.PI / 2 - MAX_ELEVATION
    this.controls.maxPolarAngle = Math.PI / 2 + MAX_ELEVATION
    this.controls.addEventListener('start', () => (this.tween = null))
    this.controls.addEventListener('change', () => this.reportView())
    this.controls.update()

    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
    this.renderer.setAnimationLoop((now) => this.frame(now))
  }

  setParams(p: Mouth3DParams) {
    this.rig.update(p)
  }

  setWireframe(on: boolean) {
    this.rig.setWireframe(on)
  }

  /** Smoothly turn to a named view, or jump there when `animate` is false. */
  goTo(view: ViewName, animate = true) {
    const { azimuth, elevation } = VIEWS[view]
    this.turnTo(azimuth, elevation, DISTANCE, animate)
  }

  /** Turn by a step from the current angle (used for keyboard control). */
  rotateBy(dAzimuth: number, dElevation: number) {
    const s = this.spherical()
    this.turnTo(s.theta + dAzimuth, Math.PI / 2 - s.phi + dElevation, s.radius, true, 160)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resize.disconnect()
    this.controls.dispose()
    this.rig.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private turnTo(azimuth: number, elevation: number, radius: number, animate: boolean, duration = 550) {
    const to = new THREE.Spherical(
      radius,
      Math.PI / 2 - clamp(elevation, -MAX_ELEVATION, MAX_ELEVATION),
      clamp(azimuth, -MAX_AZIMUTH, MAX_AZIMUTH),
    )
    if (!animate) {
      this.tween = null
      this.place(to)
      return
    }
    this.tween = { from: this.spherical(), to, start: performance.now(), duration }
  }

  private spherical() {
    return new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target))
  }

  private place(s: THREE.Spherical) {
    this.camera.position.setFromSpherical(s).add(this.controls.target)
    this.camera.lookAt(this.controls.target)
    this.controls.update()
  }

  private frame(now: number) {
    if (this.tween) {
      const { from, to, start, duration } = this.tween
      const u = Math.min(1, (now - start) / duration)
      const e = u * u * (3 - 2 * u)
      this.place(
        new THREE.Spherical(
          from.radius + (to.radius - from.radius) * e,
          from.phi + (to.phi - from.phi) * e,
          from.theta + (to.theta - from.theta) * e,
        ),
      )
      if (u >= 1) this.tween = null
    } else {
      this.controls.update()
    }
    this.renderer.render(this.scene, this.camera)
  }

  private fit() {
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(width, height, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camera.aspect = width / height
    // Keep the whole face in frame on narrow screens.
    this.camera.fov = width < height ? 36 : 28
    this.camera.updateProjectionMatrix()
  }

  private reportView() {
    const s = this.spherical()
    this.onViewChange?.(s.theta, Math.PI / 2 - s.phi)
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
