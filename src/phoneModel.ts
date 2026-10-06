import * as THREE from 'three'

const PHONE_WIDTH = 1
const PHONE_HEIGHT = 2.05
const PHONE_DEPTH = 0.045
const CORNER_RADIUS = 0.15
const BEZEL = 0.035

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  const w = width / 2
  const h = height / 2
  shape.moveTo(-w + radius, -h)
  shape.lineTo(w - radius, -h)
  shape.quadraticCurveTo(w, -h, w, -h + radius)
  shape.lineTo(w, h - radius)
  shape.quadraticCurveTo(w, h, w - radius, h)
  shape.lineTo(-w + radius, h)
  shape.quadraticCurveTo(-w, h, -w, h - radius)
  shape.lineTo(-w, -h + radius)
  shape.quadraticCurveTo(-w, -h, -w + radius, -h)
  return shape
}

export function createPhoneModel(): THREE.Group {
  const group = new THREE.Group()

  const chassisShape = roundedRectShape(PHONE_WIDTH, PHONE_HEIGHT, CORNER_RADIUS)
  const chassisGeometry = new THREE.ExtrudeGeometry(chassisShape, {
    depth: PHONE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 4,
    curveSegments: 12,
  })
  chassisGeometry.translate(0, 0, -PHONE_DEPTH / 2)

  const chassisMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f2f22,
    metalness: 0.8,
    roughness: 0.8,
  })
  const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial)
  chassis.castShadow = true
  group.add(chassis)

  const texture = new THREE.TextureLoader().load('/textures/screen.png')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  const screenShape = roundedRectShape(
    PHONE_WIDTH - BEZEL * 2,
    PHONE_HEIGHT - BEZEL * 2,
    CORNER_RADIUS * 0.7,
  )
  const screenGeometry = new THREE.ShapeGeometry(screenShape, 24)
  const uvAttr = screenGeometry.attributes.position
  const uv = new Float32Array(uvAttr.count * 2)
  const sw = PHONE_WIDTH - BEZEL * 2
  const sh = PHONE_HEIGHT - BEZEL * 2
  for (let i = 0; i < uvAttr.count; i++) {
    const x = uvAttr.getX(i)
    const y = uvAttr.getY(i)
    uv[i * 2] = (x + sw / 2) / sw
    uv[i * 2 + 1] = (y + sh / 2) / sh
  }
  screenGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

  const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, reflectivity: 4 })
  const screen = new THREE.Mesh(screenGeometry, screenMaterial)
  screen.position.z = PHONE_DEPTH / 16 + 0.032
  group.add(screen)

  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f2f22,
    metalness: 0.8,
    roughness: 0.8,
  })

  const volumeUp = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.13, 0.05), buttonMaterial)
  volumeUp.position.set(-PHONE_WIDTH / 2 - 0.006, 0.55, 0)
  group.add(volumeUp)

  const volumeDown = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.13, 0.05), buttonMaterial)
  volumeDown.position.set(-PHONE_WIDTH / 2 - 0.006, 0.35, 0)
  group.add(volumeDown)

  const powerButton = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.18, 0.05), buttonMaterial)
  powerButton.position.set(PHONE_WIDTH / 2 + 0.006, 0.45, 0)
  group.add(powerButton)

  return group
}

export interface FloatParams {
  baseY?: number
  baseRotationX?: number
  baseRotationY?: number
  baseRotationZ?: number
}

export function applyFloatWobble(
  object: THREE.Object3D,
  elapsed: number,
  params: FloatParams = {},
): void {
  const {
    baseY = 0,
    baseRotationX = 0,
    baseRotationY = 0,
    baseRotationZ = 0,
  } = params

  object.position.y = baseY + Math.sin(elapsed * 0.55) * 0.07
  object.rotation.x = baseRotationX + Math.sin(elapsed * 0.4 + 1.3) * 0.025
  object.rotation.y = baseRotationY + Math.sin(elapsed * 0.3 + 0.6) * 0.06
  object.rotation.z = baseRotationZ + Math.sin(elapsed * 0.45 + 2.1) * 0.035
}
