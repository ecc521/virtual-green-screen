const fs = require('fs');
const util = require('util');
const path = require('path');

async function download(url, filePath, outputElem) {
	outputElem.innerHTML += `Downloading ${url} to ${filePath}<br>`;
	let request = await fetch(url);
	let buffer = await request.arrayBuffer()
	await fs.promises.writeFile(filePath, Buffer.from(buffer))
	outputElem.innerHTML += `Downloaded ${filePath}<br>`;
}

async function downloadTensorFlowJsGraphModel(url, dir, outputElem) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, {recursive: true})
	}
	let manifestFilepath = path.join(dir, path.basename(url))
	await download(url, manifestFilepath, outputElem);

	const model = JSON.parse(fs.readFileSync(manifestFilepath));

	await Promise.all(
		model.weightsManifest
		.flatMap(w => w.paths)
		.map(relativePath => download(
			new URL(relativePath, url),
			path.join(dir, relativePath),
			outputElem
	)));

	fs.writeFileSync(path.join(dir, "complete.txt"), "complete")
}

/*function getModelOptions() {
	let request = await fetch("https://storage.googleapis.com/tfjs-models/")
	let text = await request.text()
	let parser = new DOMParser()
	let xmlDoc = parser.parseFromString(text, "text/xml");
}*/

module.exports = downloadTensorFlowJsGraphModel
