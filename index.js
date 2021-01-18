const { app, BrowserWindow, screen } = require('electron')

function createWindow () {
    let display = screen.getPrimaryDisplay()

    const win = new BrowserWindow({
        width: Math.ceil(display.bounds.width*0.8),
        height: Math.ceil(display.bounds.height*0.9),
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
