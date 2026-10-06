import './style.css'
import * as THREE from 'three'
import { createPhoneModel, applyFloatWobble } from './phoneModel'

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: SpotifyIFrameAPI) => void
  }
}

interface SpotifyEmbedController {
  play: () => void
  pause: () => void
  resume: () => void
}

interface SpotifyIFrameAPI {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 5.2)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setClearColor(0x000000, 0)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

scene.add(new THREE.AmbientLight(0xfff4e0, 0.65))

const keyLight = new THREE.DirectionalLight(0xffffff, 1)
keyLight.position.set(2.5, 3, 4)
scene.add(keyLight)

const rimLight = new THREE.DirectionalLight(0xffffff, 3)
rimLight.position.set(-3, -1, -2)
scene.add(rimLight)

const phone = createPhoneModel()
// Bounds must be read before any rotation/position is applied to the group,
// so they reflect the phone's own local space rather than its world pose.
const phoneLocalBounds = new THREE.Box3().setFromObject(phone)
const phoneHalfWidth = (phoneLocalBounds.max.x - phoneLocalBounds.min.x) / 2
const phoneHalfHeight = (phoneLocalBounds.max.y - phoneLocalBounds.min.y) / 2

const BASE_ROTATION_Y = -0.8
const BASE_ROTATION_Z = -0.12
phone.rotation.set(0.05, BASE_ROTATION_Y, BASE_ROTATION_Z)
scene.add(phone)
phone.updateMatrixWorld(true)

const MOBILE_BREAKPOINT = 760

function layoutForViewport() {
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  if (isMobile) {
    phone.position.x = 0
    phone.position.y = 0
    phone.scale.setScalar(1)
  } else {
    phone.position.x = 1.35
    phone.position.y = 0.1
    phone.scale.setScalar(1)
  }
}

layoutForViewport()
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  layoutForViewport()
})

// --- Pointer/touch tilt ------------------------------------------------------
// Raycast the phone mesh to find exactly where the pointer or finger lands on
// it, then tilt proportionally to that spot. Mouse hover tracks continuously;
// touch only samples while the finger is actually down (a touch has no
// "hover" state, so it must ease back to neutral the instant contact ends).

const raycaster = new THREE.Raycaster()
const pointerNDC = new THREE.Vector2(-10, -10)
const MAX_TILT = 0.22
const tiltCurrent = { x: 0, y: 0 }
let isTouch = false
let pointerDown = false

function setPointerNDC(clientX: number, clientY: number) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1
}

window.addEventListener('pointermove', (e) => {
  isTouch = e.pointerType === 'touch'
  if (isTouch && !pointerDown) return
  setPointerNDC(e.clientX, e.clientY)
})
window.addEventListener('pointerdown', (e) => {
  isTouch = e.pointerType === 'touch'
  pointerDown = true
  setPointerNDC(e.clientX, e.clientY)
})
window.addEventListener('pointerup', () => {
  pointerDown = false
})
window.addEventListener('pointercancel', () => {
  pointerDown = false
})
window.addEventListener('pointerleave', () => {
  pointerDown = false
})

const startTime = performance.now()

function animate() {
  requestAnimationFrame(animate)
  const elapsed = (performance.now() - startTime) / 1000
  applyFloatWobble(phone, elapsed, {
    baseY: phone.position.x === 0 ? 0 : 0.1,
    baseRotationX: 0.05,
    baseRotationY: BASE_ROTATION_Y,
    baseRotationZ: BASE_ROTATION_Z,
  })

  let targetTiltX = 0
  let targetTiltY = 0
  const shouldSample = !isTouch || pointerDown
  if (shouldSample) {
    raycaster.setFromCamera(pointerNDC, camera)
    const hit = raycaster.intersectObject(phone, true)[0]
    if (hit) {
      const localPoint = phone.worldToLocal(hit.point.clone())
      targetTiltX = THREE.MathUtils.clamp(localPoint.y / phoneHalfHeight, -1, 1)
      targetTiltY = THREE.MathUtils.clamp(localPoint.x / phoneHalfWidth, -1, 1)
    }
  }
  tiltCurrent.x = THREE.MathUtils.lerp(tiltCurrent.x, targetTiltX, 0.08)
  tiltCurrent.y = THREE.MathUtils.lerp(tiltCurrent.y, targetTiltY, 0.08)
  phone.rotation.x -= tiltCurrent.x * MAX_TILT
  phone.rotation.y += tiltCurrent.y * MAX_TILT

  renderer.render(scene, camera)
}
animate()

// --- Spotify embed + mute toggle -------------------------------------------------

let spotifyController: SpotifyEmbedController | null = null

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const element = document.getElementById('spotify-embed')
  if (!element) return
  IFrameAPI.createController(
    element,
    { uri: 'spotify:track:2JJw0uh08pNLYzFzBUAX8Y', width: '100%', height: '352' },
    (controller) => {
      spotifyController = controller
    },
  )
}

let muted = false
let started = false
const muteToggle = document.querySelector<HTMLButtonElement>('#mute-toggle')!
const muteIcon = document.querySelector<HTMLImageElement>('#mute-icon')!

muteToggle.addEventListener('click', () => {
  // The embed has never loaded a track yet: `pause()`/`resume()` only act on
  // an already-loaded player, so the very first click must use `play()`
  // directly or it silently no-ops (previously requiring a second click).
  if (!started) {
    started = true
    muted = false
    spotifyController?.play()
  } else {
    muted = !muted
    // The Spotify embed's public IFrame API has no volume control, only
    // playback control, so mute/unmute is approximated as pause/resume.
    if (muted) {
      spotifyController?.pause()
    } else {
      spotifyController?.resume()
    }
  }
  // Asset naming is the inverse of the glyph: mute.png is the sound-on (waves)
  // icon, unmute.png is the slashed/silent icon — matches the Figma reference.
  muteIcon.src = muted ? '/icons/unmute.png' : '/icons/mute.png'
  muteToggle.setAttribute('aria-label', muted ? 'Unmute' : 'Mute')
})
