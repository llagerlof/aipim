
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const fsPromises = fs.promises;

/**
 * Fetch available OpenAI models using the given API key.
 * @param {string} apiKey
 * @returns {Promise<Array<{id: string}>>}
 */
function fetchModels(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: 'api.openai.com',
      path: '/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            resolve(result.data || []);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Error fetching models: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      { label: 'Configuration', click: createConfigWindow },
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

/**
 * Create the configuration window.
 */
function createConfigWindow() {
  const configWin = new BrowserWindow({
    width: 400,
    height: 350,
    resizable: false,
    title: 'Configuration',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  configWin.removeMenu();
  configWin.loadFile('config.html');
}

// IPC handlers for reading, saving configuration, and fetching models.
ipcMain.handle('get-config', async () => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    const data = await fsPromises.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
});

ipcMain.handle('save-config', async (event, config) => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    await fsPromises.mkdir(path.dirname(configPath), { recursive: true });
    await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save config', err);
    throw err;
  }
});

ipcMain.handle('fetch-models', async (event, apiKey) => fetchModels(apiKey));

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
