require("./js/devtools.js")

const electron = require('electron');

const path = require("path")
const fs = require("fs")

const bodyPix = require("@tensorflow-models/body-pix")
const mime = require('mime-types')

const loadbodypix = require("./js/loadbodypix.js")

const storageDir = path.join(__dirname, "../", "data")
if (!fs.existsSync(storageDir)) {fs.mkdirSync(storageDir)}

require("./js/video.js")

let selectFile = document.getElementById("selectFile")
let previewDiv = document.getElementById("previewDiv")
let modelSelector = document.getElementById("modelSelector")
let processButton = document.getElementById("processButton")
let outputDiv = document.getElementById("output")

let baseUrl = "https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/"
let options = [
	{
		name: "ResNet50 - Stride 16",
		url: "resnet50/float/model-stride16.json",
		default: true
	}
]

options.forEach((item, index) => {
	let option = document.createElement("option")
	option.innerHTML = item.name
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
					outputDiv.innerHTML += "Image Prepared for Processing. "
					window.file.width = elem.width
					window.file.height = elem.height
				}
			}
			else if (type.startsWith("video")) {
				elem = document.createElement("video")
				elem.controls = "controls"
				elem.onloadeddata = function() {
					outputDiv.innerHTML += "Video Prepared for Processing. "
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
	  quantBytes: 2,
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
})
