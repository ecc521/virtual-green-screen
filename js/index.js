require("./js/devtools.js")

const electron = require('electron');

const path = require("path")
const fs = require("fs")

const bodyPix = require("@tensorflow-models/body-pix")
const mime = require('mime-types')

const loadbodypix = require("./js/loadbodypix.js")

const storageDir = path.join(__dirname, "../", "data")
if (!fs.existsSync(storageDir)) {fs.mkdirSync(storageDir)}

const {frameExtractor, VideoGenerator} = require("./js/video.js")

let selectFile = document.getElementById("selectFile")
let previewDiv = document.getElementById("previewDiv")
let modelSelector = document.getElementById("modelSelector")
let qualitySelector = document.getElementById("qualitySelector")
let processButton = document.getElementById("processButton")
let outputDiv = document.getElementById("output")

let baseUrl = "https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/"

//TODO: We should offer outputStride, multiplier (on resnet), and quantBytes
let options = [
	{
		name: "ResNet50 - Stride 16",
		notes: "Highest Quality",
		url: "resnet50/float/model-stride16.json",
		default: true
	}
]

options.forEach((item, index) => {
	let option = document.createElement("option")
	option.innerHTML = item.name + ` (${item.notes})`
	option.selected = option.default
	option.value = index
	modelSelector.appendChild(option)
})


function openFileHandler() {
	electron.remote.dialog.showOpenDialog({properties: ['openFile'] }).then(function (response) {
		console.log(response)
		if (!response.canceled) {
			while (previewDiv.firstChild) {previewDiv.firstChild.remove()} //Clear preview div.

			previewDiv.innerHTML = "<br>Preview of your file: <br>"

			let filePath = response.filePaths[0]
			let type = mime.lookup(filePath) || ""

			window.file = {}
			let elem, width, height;
			if (type.startsWith("image")) {
				elem = document.createElement("img")
				elem.onload = function() {
					outputDiv.innerHTML += "Image Prepared for Processing. <br>"
					window.file.width = elem.width
					window.file.height = elem.height
				}
			}
			else if (type.startsWith("video")) {
				elem = document.createElement("video")
				elem.controls = "controls"
				elem.onloadeddata = function() {
					outputDiv.innerHTML += "Video Prepared for Processing. <br>"
					window.file.width = elem.videoWidth
					window.file.height = elem.videoHeight
				}
			}
			else {
				return alert("Unknown image/video type. ")
			}

			window.file.filePath = filePath

			elem.src = "file://" + filePath
			previewDiv.appendChild(elem)
		}
		else {
			console.log("no file selected");
		}
	});
}
openFileHandler()
selectFile.addEventListener("click", openFileHandler)

processButton.addEventListener("click", async function() {
	outputDiv.innerHTML = ""

	let model = options[Number(modelSelector.value)]
	let modelDir = path.join(storageDir, model.name)

	outputDiv.innerHTML += "Checking for Model...<br>"

	if (!fs.existsSync(path.join(modelDir, "complete.txt"))) {
		outputDiv.innerHTML += "Model Not Found...<br>"
		outputDiv.innerHTML += "Downloading Model...<br>"
		try {
			await loadbodypix(baseUrl + model.url, modelDir, outputDiv)
		}
		catch (e) {
			outputDiv.innerHTML += "Error Loading: " + e.message + "<br>"
			throw e
		}
	}
	outputDiv.innerHTML += "Model Downloaded...<br>"

	let modelFilepath = path.join(modelDir, path.basename(model.url))

	outputDiv.innerHTML += "Preparing Model...<br>"
	let net = await bodyPix.load({
	  architecture: 'ResNet50',
	  outputStride: 16,
	  quantBytes: 4,
	  modelUrl: "file://" + modelFilepath
	});
	outputDiv.innerHTML += "Model Ready...<br>"
	if (window.file.width) {
		outputDiv.innerHTML += "Found File to Process...<br>"
	}
	else {
		outputDiv.innerHTML += "Error... Please select a file to Process...<br>"
		outputDiv.innerHTML += "If you selected a large video, or extremely large image, it might still be being prepared. <br>"
		return
	}
	window.net = net
	let iterator = frameExtractor(window.file.filePath, 0)
	//TODO: Give a cancel button.
	let frames = 0
	outputDiv.innerHTML += "The first frame may take unusually long, while performance optimizations are being made. <br>"
	let videoGenerator;
	while (true) {
		let step = iterator.next()
		if (step.done) {break}

		if (!videoGenerator) {
			//First step gives frame rate.
			outputDiv.innerHTML += "Detected Frame Rate as " + step.value + " fps<br>"
			videoGenerator = new VideoGenerator({
				width: window.file.width,
				height: window.file.height,
				ext: path.extname(window.file.filePath).slice(1),
				frameRate: step.value || 30
			})
			continue
		}

		outputDiv.innerHTML += `Reading Frame ${++frames}...<br>`
		let frame = step.value

		let imageData = new ImageData(new Uint8ClampedArray(frame), window.file.width, window.file.height)

		let start = Date.now()
		let res = await net.segmentPerson(imageData, {
			internalResolution: qualitySelector.value,
			//scoreThreshold: 0.1, //Default was 0.4, but it wasn't sensitive enough. (For multi person)
			flipHorizontal: false,
			segmentationThreshold: 0.9
		})
		console.log(res)
		//throw ""
		outputDiv.innerHTML += `Processed Frame ${frames} (${Math.round(Date.now() - start)}ms)...<br>`

		let maskData = res.data
		let imageDataData = imageData.data
		for (let i=0;i<maskData.length;i++) {
			console.log
			if (maskData[i] === 0) {
				let offset = i*4
				imageDataData[offset] = 0
				imageDataData[offset + 1] = 255 //Green
				imageDataData[offset + 2] = 0
			}
		}

		/*let canvas = document.createElement("canvas")
		canvas.width = 1280
		canvas.height = 720
		let ctx = canvas.getContext("2d")
		ctx.putImageData(imageData, 0, 0)
		document.body.appendChild(canvas)*/

		videoGenerator.write(Buffer.from(imageDataData))
	}

	//TODO: AUDIO!!!
	let results = await videoGenerator.end()
	console.log(results)

	const element = document.createElement("a");
	const file = new Blob([results]);
	element.href = URL.createObjectURL(file);
	element.download = path.basename(window.file.filePath).replace(path.extname(window.file.filePath), "") + "-green-screen" + path.extname(window.file.filePath);
	element.click();

	//Just for eventual memory clearing.
	setTimeout(function() {
		URL.revokeObjectURL(element.href)
	}, 60000)
})
