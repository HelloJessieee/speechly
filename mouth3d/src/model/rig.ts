import * as THREE from 'three'
import { blush, faceBoundary, lipContours, skinDepth, skinOpacity, type LipContours, type Mouth3DParams } from './surface'

// Procedural lower-face model. Topology is fixed at construction; update()
// only rewrites vertex positions, so animating it every frame is cheap.

/** Samples along the mouth, corner to corner. */
const NU = 48
/** Samples across each lip, outer edge to inner edge. */
const NV = 14
/** Rings of skin between the lips and the face outline. */
const NR = 22
const TEETH_SEGMENTS = 40
const TEETH_HALF_WIDTH = 0.62
const TEETH_HEIGHT = 0.42
/** How far (in 3D units) lip movement drags the surrounding skin. */
const SKIN_PULL = 0.4
/** How fast the dental arch curves back. */
const ARCH = 0.55

// t for sample i, clustered toward the corners where the lips curve most.
const tAt = (i: number) => -Math.cos((Math.PI * i) / NU)

// Soft cartoon palette: peach skin, coral lips, warm dark interior.
export const COLORS = {
  skin: '#f9d6bf',
  blush: '#f4a99c',
  upperLip: '#dc7b76',
  lowerLip: '#ea8b82',
  teeth: '#fffdf8',
  teethLine: '#ece3d8',
  interior: '#7a2c38',
}

const SKIN = new THREE.Color(COLORS.skin)
const BLUSH = new THREE.Color(COLORS.blush)

export class MouthRig {
  readonly group = new THREE.Group()
  private readonly skin: THREE.BufferGeometry
  private readonly upperLip: THREE.BufferGeometry
  private readonly lowerLip: THREE.BufferGeometry
  private readonly upperTeeth: THREE.BufferGeometry
  private readonly lowerTeeth: THREE.BufferGeometry
  private readonly interior: THREE.Mesh
  private readonly materials: THREE.MeshStandardMaterial[]
  private readonly skinColor = new THREE.Color()

  constructor() {
    // Color and fade-out come from per-vertex RGBA (see updateSkin).
    const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.8 })
    const upperMat = lipMaterial(COLORS.upperLip)
    const lowerMat = lipMaterial(COLORS.lowerLip)
    const upperTeethMat = teethMaterial('upper')
    const lowerTeethMat = teethMaterial('lower')
    // Seen from inside, so only its far wall draws: a dark backdrop, no tongue.
    const interiorMat = new THREE.MeshStandardMaterial({ color: COLORS.interior, roughness: 1, side: THREE.BackSide })
    this.materials = [skinMat, upperMat, lowerMat, upperTeethMat, lowerTeethMat, interiorMat]

    this.skin = gridGeometry(2 * NU, NR, true)
    this.skin.setAttribute('color', new THREE.BufferAttribute(new Float32Array(2 * NU * (NR + 1) * 4), 4))
    this.upperLip = gridGeometry(NU, NV, false)
    this.lowerLip = gridGeometry(NU, NV, false)
    this.upperTeeth = gridGeometry(TEETH_SEGMENTS, 1, false)
    this.lowerTeeth = gridGeometry(TEETH_SEGMENTS, 1, false)
    setTeethUVs(this.upperTeeth)
    setTeethUVs(this.lowerTeeth)

    this.interior = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), interiorMat)
    // Small and far enough forward that the face always hides it from the side.
    this.interior.scale.set(0.7, 0.4, 0.3)

    this.group.add(
      this.interior,
      new THREE.Mesh(this.upperTeeth, upperTeethMat),
      new THREE.Mesh(this.lowerTeeth, lowerTeethMat),
      new THREE.Mesh(this.skin, skinMat),
      new THREE.Mesh(this.lowerLip, lowerMat),
      new THREE.Mesh(this.upperLip, upperMat),
    )
  }

  update(p: Mouth3DParams) {
    const c = lipContours(p)
    this.updateSkin(c)
    this.updateLip(this.upperLip, c, 'upper')
    this.updateLip(this.lowerLip, c, 'lower')
    this.updateTeeth(p, c)
    this.interior.position.set(0, c.centerY, 1.12)
  }

  setWireframe(on: boolean) {
    for (const m of this.materials) m.wireframe = on
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    for (const m of this.materials) {
      m.map?.dispose()
      m.dispose()
    }
  }

  /** How far the skin at the lip edge is pushed from rest; fades out across the face. */
  private edgeOffset(c: LipContours, t: number, lower: boolean) {
    return c.forward(t) - (lower ? c.lowerBack * Math.sqrt(Math.max(0, 1 - t * t)) : 0)
  }

  private updateSkin(c: LipContours) {
    const pos = this.skin.getAttribute('position') as THREE.BufferAttribute
    const color = this.skin.getAttribute('color') as THREE.BufferAttribute
    for (let j = 0; j < 2 * NU; j++) {
      // j 0..NU walks the upper lip right→left, NU..2NU the lower lip left→right.
      const lower = j > NU
      const t = Math.cos((Math.PI * j) / NU)
      const ex = c.halfWidth * t
      const ey = lower ? c.outerBottom(t) : c.outerTop(t)
      const len = Math.hypot(ex, ey) || 1
      const edge = faceBoundary(ex / len, ey / len)
      const offset = this.edgeOffset(c, t, lower)
      const span = Math.hypot(edge.x - ex, edge.y - ey)
      for (let k = 0; k <= NR; k++) {
        const s = Math.pow(k / NR, 1.7)
        const x = ex + (edge.x - ex) * s
        const y = ey + (edge.y - ey) * s
        // Lip movement drags the nearby skin along, fading out over ~0.4 units.
        const pull = Math.exp(-(((s * span) / SKIN_PULL) ** 2))
        const n = j * (NR + 1) + k
        pos.setXYZ(n, x, y, skinDepth(x, y) + offset * pull)
        this.skinColor.copy(SKIN).lerp(BLUSH, blush(x, y))
        color.setXYZW(n, this.skinColor.r, this.skinColor.g, this.skinColor.b, skinOpacity(s))
      }
    }
    pos.needsUpdate = true
    color.needsUpdate = true
    this.skin.computeVertexNormals()
  }

  /**
   * Each lip's cross-section is three quarters of an ellipse: from the outer
   * edge (where it meets the skin), over the front, to the inner edge, then
   * back into the mouth. That closes the lip, so it looks solid from the side.
   */
  private updateLip(geo: THREE.BufferGeometry, c: LipContours, which: 'upper' | 'lower') {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const lower = which === 'lower'
    // +1: the outer edge is above the inner one (upper lip); -1 for the lower lip.
    const dir = lower ? -1 : 1
    for (let i = 0; i <= NU; i++) {
      const t = tAt(i)
      const x = c.halfWidth * t
      const yOut = lower ? c.outerBottom(t) : c.outerTop(t)
      const yIn = lower ? c.innerBottom(t) : c.innerTop(t)
      const thick = lower ? c.lowerThickness(t) : c.upperThickness(t)
      const middle = Math.max(0, 1 - t * t)
      const offset = this.edgeOffset(c, t, lower)
      const zOut = skinDepth(x, yOut) + offset
      // For /f/ the lower lip's inner edge tucks in behind the upper teeth.
      const zIn = skinDepth(x, yIn) + offset - (lower ? c.lowerBack * 1.2 * Math.pow(middle, 0.4) : 0)
      const yMid = (yOut + yIn) / 2
      const halfSpan = Math.abs(yOut - yIn) / 2
      // Plump cartoon lips; the lower one is the fuller of the two.
      const bulge = thick * (lower ? 1.2 : 1.05) + c.fullness(t)
      for (let k = 0; k <= NV; k++) {
        const phi = 1.5 * Math.PI * (k / NV)
        const y = yMid + dir * halfSpan * Math.cos(phi)
        const base = zOut + (zIn - zOut) * Math.min(1, phi / Math.PI)
        // The part inside the mouth is a little flatter than the front.
        const depth = phi > Math.PI ? bulge * 0.8 : bulge
        pos.setXYZ(i * (NV + 1) + k, x, y, base + depth * Math.sin(phi))
      }
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }

  private updateTeeth(p: Mouth3DParams, c: LipContours) {
    // Teeth belong to the skull: they stay put while the lips move around them.
    const front = skinDepth(0, 0) - 0.14
    // At 0 the edge hides just behind the upper lip; at 1 it shows fully.
    const upperEdge = c.innerTop(0) - p.upperTeeth * (0.15 - p.tuck * 0.03) + 0.03 * (1 - p.upperTeeth)
    const lowerEdge = c.innerBottom(0) + p.lowerTeeth * 0.1 - 0.03 * (1 - p.lowerTeeth)
    writeArch(this.upperTeeth, upperEdge, upperEdge + TEETH_HEIGHT, front)
    writeArch(this.lowerTeeth, lowerEdge - TEETH_HEIGHT, lowerEdge, front - 0.06)
  }
}

/** A (cols+1) × (rows+1) vertex grid; `wrap` joins the last column to the first. */
function gridGeometry(cols: number, rows: number, wrap: boolean): THREE.BufferGeometry {
  const columns = wrap ? cols : cols + 1
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(columns * (rows + 1) * 3), 3))
  const index: number[] = []
  for (let j = 0; j < cols; j++) {
    const j1 = wrap ? (j + 1) % cols : j + 1
    for (let k = 0; k < rows; k++) {
      const a = j * (rows + 1) + k
      const b = j1 * (rows + 1) + k
      // Counterclockwise when columns run counterclockwise and rows run outward.
      index.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  geo.setIndex(index)
  return geo
}

function setTeethUVs(geo: THREE.BufferGeometry) {
  const uv = new Float32Array((TEETH_SEGMENTS + 1) * 2 * 2)
  for (let i = 0; i <= TEETH_SEGMENTS; i++) {
    const u = i / TEETH_SEGMENTS
    uv.set([u, 0, u, 1], i * 4)
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

function writeArch(geo: THREE.BufferGeometry, bottom: number, top: number, front: number) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i <= TEETH_SEGMENTS; i++) {
    const x = -TEETH_HALF_WIDTH + (2 * TEETH_HALF_WIDTH * i) / TEETH_SEGMENTS
    const z = front - ARCH * x * x
    pos.setXYZ(i * 2, x, bottom, z)
    pos.setXYZ(i * 2 + 1, x, top, z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
}

/** Soft, glossy cartoon lips. */
function lipMaterial(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.5,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
  })
}

/**
 * Cartoon teeth: one smooth white band with faint lines between teeth and tiny
 * notches along the biting edge. Upper teeth bite at the bottom, lower at the top.
 */
function teethMaterial(which: 'upper' | 'lower'): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const W = canvas.width
    const H = canvas.height
    const upper = which === 'upper'
    // Tooth edges in 3D x units, center outward: incisors, canines, premolars.
    const edges = upper ? [0.09, 0.165, 0.24, 0.315, 0.39, 0.47] : [0.06, 0.12, 0.19, 0.27, 0.35, 0.43]
    const toCanvas = (x: number) => ((x + TEETH_HALF_WIDTH) / (2 * TEETH_HALF_WIDTH)) * W
    const bite = upper ? H : 0
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, upper ? [0, 0, 120, 120] : [120, 120, 0, 0])
    ctx.fill()
    // Notches and lines between teeth.
    const xs = [0, ...edges.flatMap((e) => [e, -e])].map(toCanvas)
    ctx.globalCompositeOperation = 'destination-out'
    for (const x of xs) {
      ctx.beginPath()
      ctx.moveTo(x - 9, bite)
      ctx.lineTo(x, upper ? H - 14 : 14)
      ctx.lineTo(x + 9, bite)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = COLORS.teethLine
    ctx.lineWidth = 3
    for (const x of xs) {
      ctx.beginPath()
      ctx.moveTo(x, upper ? 0 : H)
      ctx.lineTo(x, upper ? H - 14 : 14)
      ctx.stroke()
    }
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  return new THREE.MeshStandardMaterial({
    color: COLORS.teeth,
    map,
    alphaTest: 0.5,
    roughness: 0.3,
    side: THREE.DoubleSide,
  })
}
