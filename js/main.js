import * as THREE from '/js/three.module.js'
import { GLTFLoader } from '/js/gltfLoader.module.js'
import { OrbitControls } from '/js/orbitControls.js'

if (location.protocol.startsWith('https')) {
	navigator.serviceWorker.register('service-worker.js')
	navigator.serviceWorker.onmessage = m => {
		console.info('Update found!')
		if (m?.data == 'update') location.reload(true)
	}
}

const clock = new THREE.Clock()
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true})
const camera = new THREE.PerspectiveCamera(75, window.innerWidth /window.innerHeight, 0.1, 1000)
const hemisphereLight = new THREE.HemisphereLight(0xddeeff, 0x000000, 0.25)
const gltfLoader = new GLTFLoader()
const scene = new THREE.Scene()
const controls = new OrbitControls(camera, renderer.domElement)

var fpsLimit = 1 / 60

var progress = new Proxy({}, {
	set: function(target, key, value) {
		target[key] = value
		let values = Object.values(target).slice()
		let progressbar = document.querySelector('progress')
		let total = values.reduce((a, b) => a + b, 0)
		total = total / 1
		if (progressbar) progressbar.value = parseInt(total || 0)
		if (total >= 100) setTimeout(() => initGame(), 500)
		return true
	}
})

scene.background = null
renderer.outputEncoding = THREE.sRGBEncoding
renderer.physicallyCorrectLights = true
renderer.setClearColor(0x000000, 0)
scene.add(hemisphereLight)
controls.screenSpacePanning = true

var clockDelta = 0
var gameStarted = false
var astro
var mixer
var video
var audio
var videoStarted
var audioStarted

gltfLoader.load('/models/astro.glb',
	gltf => {
		astro = gltf.scene
		astro.encoding = THREE.sRGBEncoding
		astro.position.y -= 2.25
		astro.traverse(el => {if (el.isMesh) el.castShadow = true})
		mixer = new THREE.AnimationMixer(astro)
		mixer.clipAction(gltf.animations[0]).play()
		camera.position.z += 4
		scene.add(astro)
	}, xhr => {
		progress['astro'] = (xhr.loaded / xhr.total) * 100
	}, error => {
		console.error(error)
	}
)

function initCamera() {
	if (videoStarted) return
	navigator.mediaDevices.getUserMedia({
		audio: false,
		video: {facingMode: 'user'}
	})
	.then(stream => {
		video = document.querySelector('video')
		video.srcObject = stream
		video.loop = true
		video.play()
		const texture = new THREE.VideoTexture(video)
		let sphere = new THREE.Mesh(
			new THREE.SphereGeometry(1, 32, 16, 0, Math.PI, 0, Math.PI),
			new THREE.MeshBasicMaterial({map: texture, opacity: 0.5, transparent: true})
		)
		sphere.scale.set(0.38, 0.38, 0.25)
		sphere.position.set(0.038, 1.19, 0.9)
		sphere.rotation.x = 0.35
		sphere.rotation.y = -0.03
		astro.getObjectByName('mixamorig_Head_06').attach(sphere)
	})
	videoStarted = true
}

function initAudio() {
	if (audioStarted) return
	audio = new Audio('/audio/bgm.mp3')
	audio.volume = 0.5
	audio.loop = true
	audio.play()
	audioStarted = true
}

function initGame() {
	if (gameStarted) return
	gameStarted = true
	document.body.classList.add('loaded')
	document.body.removeChild(document.querySelector('figure'))
	resizeScene()
	animate()
}

function resizeScene() {
	camera.aspect = window.innerWidth /window.innerHeight
	camera.updateProjectionMatrix()
	renderer.setPixelRatio(window.devicePixelRatio)
	renderer.setSize(window.innerWidth,window.innerHeight)
}

function animate() {
	requestAnimationFrame(animate)
	if (document.hidden) return
	clockDelta += clock.getDelta()
	if (fpsLimit && clockDelta < fpsLimit) return
	renderer.render(scene, camera)
	controls.update()
	mixer?.update(clockDelta)
	clockDelta = fpsLimit ? clockDelta % fpsLimit : clockDelta
}

window.onresize = () => resizeScene()
window.oncontextmenu = e => {e.preventDefault(); return false}

/* document.onreadystatechange = () => {
	if (document.readyState != 'complete') return
} */
document.onclick = () => {
	initCamera()
	initAudio()
}
document.body.appendChild(renderer.domElement)