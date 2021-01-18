const ffmpegPath = require("ffmpeg-static")
const child_process = require("child_process")

function extractFrames({inputPath, startFrame, endFrame}) {
	console.time("Run")
	let res = child_process.spawnSync(ffmpegPath, [
		"-i",
		inputPath,
		"-vf",
		`select='between(n,${startFrame},${endFrame})'`,
		"-pix_fmt",
		"rgb24",
		"-f",
		"rawvideo",
		"-"
	], {
		maxBuffer: Infinity //Do not cap buffer.
	})
	return res
}
