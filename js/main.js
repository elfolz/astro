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
const dirLight1 = new THREE.DirectionalLight(0xFFFFFF, 2)
const dirLight2 = new THREE.DirectionalLight(0xFFFFFF, 2)
const dirLight3 = new THREE.DirectionalLight(0xFFFFFF, 2)
const gltfLoader = new GLTFLoader()
const scene = new THREE.Scene()
const imageTextureLoader = new THREE.TextureLoader()
const controls = new OrbitControls(camera, renderer.domElement)
const fpsLimit = 1 / 60
const reader = new FileReader()

const progress = new Proxy({}, {
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
renderer.sortObjects = false
renderer.setClearColor(0x000000, 0)
scene.add(hemisphereLight)
controls.screenSpacePanning = true
controls.enableZoom = false
dirLight1.position.set(0, 0, 1)
dirLight2.position.set(5, -1, 1)
dirLight3.position.set(-5, -1, 1)
scene.add(dirLight1)
scene.add(dirLight2)
scene.add(dirLight3)

var clockDelta = 0
var gameStarted = false
var astro
var mixer
var photo
var video
var audio
var photoMesh
var videoMesh
var photoTexture
var videoTexture
var videoStarted
var audioStarted
var cameraStream

reader.onload = e => {
	photo.src = e.target.result
}

function loadModel() {
	gltfLoader.load('/models/astro.glb',
		gltf => {
			astro = gltf.scene
			astro.encoding = THREE.sRGBEncoding
			astro.position.y -= 2.25
			astro.traverse(el => {
				if (el.isMesh) {
					el.castShadow = true
					el.receiveShadow = true
				}
				if (el.name == 'Object_11') astro.face = el
				if (el.name == 'Object_8') astro.helm = el
			})
			mixer = new THREE.AnimationMixer(astro)
			mixer.clipAction(gltf.animations[0]).play()
			astro.face.parent.transparent = true
			astro.face.material.transparent = true
			astro.face.material.opacity = 0.5
			astro.face.material.needsUpdate = true
			astro.face.depthWrite = false
			astro.helm.depthWrite = false
			dirLight1.target = astro
			dirLight2.target = astro
			dirLight3.target = astro
			scene.add(astro)
			if (photo) createPhotoTexture()
			if (video) createVideoTexture()
		}, xhr => {
			progress['astro'] = (xhr.loaded / xhr.total) * 100
		}, error => {
			console.error(error)
		}
	)
}

function initCamera() {
	if (!video || videoStarted) return
	navigator.mediaDevices.getUserMedia({
		audio: false,
		video: {
			facingMode: 'user',
			aspectRatio: 1/1
		}
	})
	.then(stream => {
		cameraStream = stream
		video.srcObject = cameraStream
		/* video.src = '/video.mp4' */
		video.play()
		photoMesh.material.transparent = true
		videoMesh.material.transparent = false
		videoStarted = true
	})
}

function createPhotoTexture() {
	let base64 = THREE.ImageUtils.getDataURL(photo)
	photoTexture = imageTextureLoader.load(base64)
	photoTexture.encoding = THREE.sRGBEncoding
	photoMesh = new THREE.Mesh(
		new THREE.CircleGeometry(),
		new THREE.MeshBasicMaterial({map: photoTexture})
	)
	setMaskPosition(photoMesh)
	astro.helm.add(photoMesh)
	astro.getObjectByName('mixamorig_Head_06').attach(photoMesh)
}

function createVideoTexture() {
	videoTexture = new THREE.VideoTexture(video)
	videoTexture.encoding = THREE.sRGBEncoding
	videoMesh = new THREE.Mesh(
		new THREE.CircleGeometry(),
		new THREE.MeshBasicMaterial({map: videoTexture, transparent: true})
	)
	setMaskPosition(videoMesh)
	astro.helm.add(videoMesh)
	astro.getObjectByName('mixamorig_Head_06').attach(videoMesh)
}

function setMaskPosition(object) {
	object.scale.set(0.38, 0.38, 0.38)
	object.position.set(0.06, 3.45, 0.83)
	object.rotation.x = 0.35
	object.rotation.y = -0.03
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
	document.querySelector('footer').style.removeProperty('display')
	resizeScene()
	animate()
}

function resizeScene() {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
	renderer.setPixelRatio(window.devicePixelRatio)
	renderer.setSize(window.innerWidth, window.innerHeight)
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
	let canvas = document.createElement('canvas')
	canvas.width = video.videoWidth
	canvas.height = video.videoHeight
	let ctx = canvas.getContext('2d')
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
	photo.src = canvas.toDataURL('image/jpg')
	refreshPhoto()
	videoStarted = false
}

function refreshPhoto() {
	photoTexture = imageTextureLoader.load(photo.src)
	photoTexture.encoding = THREE.sRGBEncoding
	photoMesh.material.map = photoTexture
	photoMesh.material.needsUpdate = true
	cameraStream?.getTracks()?.forEach(el => el.stop())
	photoMesh.material.transparent = false
	videoMesh.material.transparent = true
}

function download() {
	let canvas = document.querySelector('#screenshot')
	canvas.width = pictureSize()
	canvas.height = pictureSize()
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
	canvas.classList.add('taken')
	setTimeout(() => {
		canvas.classList.remove('taken')
	}, 1000)
	let link = document.createElement('a')
	link.download = 'Astro.jpeg'
	link.href = canvas.toDataURL('image/jpeg')
	document.documentElement.appendChild(link)
	link.click()
	setTimeout(() => {document.documentElement.removeChild(link), 100})
}

function pictureSize() {
	return Math.min(document.body.clientWidth, 512) * window.devicePixelRatio
}

function toggleShutter() {
	if (videoStarted) {
		document.querySelector('button svg:first-of-type').classList.remove('hide')
		document.querySelector('button svg:last-of-type').classList.add('hide')
		takePicture()
	} else {
		document.querySelector('button svg:first-of-type').classList.add('hide')
		document.querySelector('button svg:last-of-type').classList.remove('hide')
		initCamera()
	}
}

function loadFile(files) {
	if (!files?.length) return
	reader.readAsDataURL(files[0])
}

window.onresize = () => resizeScene()
window.oncontextmenu = e => {e.preventDefault(); return false}

document.onreadystatechange = () => {
	if (document.readyState != 'complete') return
	video = document.querySelector('video')
	photo = document.querySelector('#photo')
	photo.onload = () => refreshPhoto()
	document.querySelector('#camera').onclick = () => toggleShutter()
	document.querySelector('#download').onclick = () => download()
	document.querySelector('input[type=file]').onchange = e => loadFile(e.target.files)
	loadModel()
}
document.onclick = () => {
	/* initAudio() */
}
document.onvisibilitychange = () => {
	if (document.hidden) audio?.pause()
	else audio?.play()
}
document.body.appendChild(renderer.domElement)