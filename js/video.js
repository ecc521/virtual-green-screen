const ffmpegPath = require("ffmpeg-static")

const child_process = require("child_process")
const os = require("os")
const path = require("path")
const fs = require("fs")

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(),"virtual-green-screen-save"))

function extractFrames(inputPath, startFrame, endFrame) {
	let tag = `Extract ${endFrame - startFrame + 1} Frames`
	console.time(tag)
	let args = [
		"-i",
		inputPath,
		"-vf",
		`select='between(n,${startFrame},${endFrame})'`,
		"-vsync",
		0,
		"-pix_fmt",
		"rgb32", //ImageData expects this.
		"-f",
		"rawvideo",
		"-"
	]
	console.log(args.join(" "))
	let res = child_process.spawnSync(ffmpegPath, args, {
		maxBuffer: Infinity //Do not cap buffer.
	})
	console.timeEnd(tag)
	let frameRate = /(\d*[.]?\d+) (fps|tbr)/.exec(res.stderr)?.[1]
	if (!frameRate) {
		console.error("Can't get frame rate. STDERR below:")
		console.error(res.stderr)
	}
	return {frameRate, frames: res.stdout}
}

function* frameExtractor(inputPath, startFrame, endFrame = Infinity, step = 1) {
	//cacheSize is additional frames to cache at once. 0 cacheSize will load 1 frame at a time.
	console.log(inputPath)
	let frameSize = extractFrames(inputPath, startFrame, startFrame) //Extract first frame.
	let frameRate = frameSize.frameRate
	frameSize = frameSize.frames.length //Get bytes per frame. (We weren't passed width and height)
	let cacheSize = Math.max(10, Math.round(Math.min(os.freemem()/4, 2e9)/frameSize))

	if (frameSize === 0) {return} //No frames.

	yield frameRate;

	let bufferIndex = 0
	let cacheBuffer = extractFrames(inputPath, startFrame, startFrame+cacheSize).frames;

    for (;startFrame <= endFrame; startFrame += step) {
		if (bufferIndex === cacheBuffer.length / frameSize) {
			//TODO: Can cacheBuffer.length / frameSize return a 3.000000003 type number?
			bufferIndex = 0
			cacheBuffer = extractFrames(inputPath, startFrame, startFrame+cacheSize).frames
		}
		let buff = cacheBuffer.slice(bufferIndex * frameSize, (bufferIndex + 1) * frameSize)
		bufferIndex++

		//Test for caching code.
		//let bufftest = extractFrames(inputPath, startFrame, startFrame).frames
		//if (!bufftest.equals(buff)) {throw "Not Equal"}

		if (buff.length !== frameSize) {
			return;
		}
		else {
			yield buff;
		}
    }
}

class VideoGenerator {
	constructor({
		width, height, ext, frameRate
	}) {
		let saveFile = path.join(tempDir, "writecache-" + ext)
		let args = [
			"-f",
			"rawvideo",
			"-framerate",
			frameRate,
			"-pixel_format",
			"rgb32",
			"-video_size",
			`${width}x${height}`,
			"-i", //Input
			"-", //Is Stdin
			"-b",
			Math.round(width * height * 2 * frameRate / 30 * 8), //Decent bitrate. 50MB/s for full 4k 60fps video, standard HD 30fps is 2MB/s
			"-f",
			ext,
			saveFile //MP4 and some other formats write seek data at the file start, not end,
			//meaning that they can't write to a stream.
		]
		console.log(args.join(" "))
		this.process = child_process.spawn(ffmpegPath, args)
		/*this.results = []
		this.process.stdout.on("data", (function(buf) {
			this.results.push(buf)
		}).bind(this))*/
		this.process.stderr.on("data", function(data) {console.log(data.toString())})

		this.write = function(data) {
			this.process.stdin.write(data)
		}

		let close = new Promise((resolve, reject) => {
			this.process.on("exit", resolve)
		})

		this.end = async function() {
			this.process.stdin.end()
			await close
			return fs.readFileSync(saveFile)
		}
	}
}

module.exports = {
	frameExtractor,
	VideoGenerator,
}
