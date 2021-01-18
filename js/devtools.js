//Dev Tools for Development
function toggleDevTools() {
	require('electron').remote.getCurrentWindow().toggleDevTools()
}

document.addEventListener("keydown", function(event) {
    if (event.key === "I" && event.ctrlKey && event.shiftKey) {
		toggleDevTools()
    }
})
toggleDevTools()
