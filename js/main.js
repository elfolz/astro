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
controls.enableZoom = false

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
		video: {
			facingMode: 'user',
			aspectRatio: 1/1
		}
	})
	.then(stream => {
		document.querySelector('#screenshot svg:last-of-type').style.removeProperty('display')
		document.querySelector('#screenshot svg:first-of-type').style.setProperty('display', 'none')
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
		sphere.position.set(0.04, 1.2, 0.9)
		sphere.rotation.x = 0.35
		sphere.rotation.y = -0.03
		astro.getObjectByName('mixamorig_Head_06').attach(sphere)
		videoStarted = true
	})
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
	document.querySelector('#screenshot').style.removeProperty('display')
	resizeScene()
	animate()
}

function resizeScene() {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
	//renderer.setPixelRatio(window.devicePixelRatio)
	renderer.setSize(window.innerWidth, window.innerHeight)
	document.querySelector('#picture').setAttribute('width', `${pictureSize()}px`)
	document.querySelector('#picture').setAttribute('height', `${pictureSize()}px`)
	if (window.innerWidth < 390) camera.position.z = 3.5
	else if (window.innerWidth <= 800) camera.position.z = 4
	else camera.position.z = 4
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

function takePicture() {
	if (!videoStarted) return
	let canvas = document.querySelector('#picture')
	let ctx = canvas.getContext('2d')
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
	gradient.addColorStop(0, '#000036')
	gradient.addColorStop(1, '#4b0082')
	ctx.fillStyle = gradient
	ctx.fillRect(0, 0, canvas.width, canvas.height)
	let aspect = Math.round((window.innerWidth / window.innerHeight) * 10) / 10
	let scale = aspect >= 0.7 ? 1.5 : 1.75
	let x = parseInt((renderer.domElement.width / 2) - (pictureSize() / scale / 2)) + (canvas.width / 60)
	let cut = aspect == 0.6 ? 16 : 8
	let y = parseInt(renderer.domElement.height / cut)
	ctx.drawImage(renderer.domElement, x, y, pictureSize() / scale, pictureSize() / scale, 0, 0, canvas.width, canvas.height)
	let link = document.createElement('a')
	link.download = 'Astro.png'
	link.href = canvas.toDataURL('image/jpeg')
	document.documentElement.appendChild(link)
	link.click()
	setTimeout(() => {document.documentElement.removeChild(link), 100})
}

function pictureSize() {
	return Math.min(document.body.clientWidth, 512)
}

window.onresize = () => resizeScene()
window.oncontextmenu = e => {e.preventDefault(); return false}

document.onreadystatechange = () => {
	if (document.readyState != 'complete') return
	document.querySelector('#screenshot').onclick = () => takePicture()
}
document.onclick = () => {
	initCamera()
	initAudio()
}
document.onvisibilitychange = () => {
	if (document.hidden) audio?.pause()
	else audio?.play()
}
document.body.appendChild(renderer.domElement)