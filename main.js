
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      { label: 'Configuration' },
      { label: 'Exit', role: 'quit' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      { label: 'About' }
    ]
  }
];

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
