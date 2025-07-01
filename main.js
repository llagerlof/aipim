const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
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
      { 
        label: 'About', 
        click: () => {
          shell.openExternal('https://github.com/llagerlof/aipim');
        }
      }
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
    // Config file doesn't exist, create it with default system prompt
    const defaultConfig = {
      systemPrompt: 'Answer briefly.'
    };
    
    try {
      await fsPromises.mkdir(path.dirname(configPath), { recursive: true });
      await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    } catch (err) {
      console.error('Failed to create default config file', err);
      return defaultConfig; // Return the default config even if file creation fails
    }
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

/**
 * Send a chat request to OpenAI API
 * @param {string} apiKey
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
function sendChatRequest(apiKey, model, systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    });

    const options = {
      method: 'POST',
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            if (result.choices && result.choices[0] && result.choices[0].message) {
              resolve(result.choices[0].message.content);
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`API Error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

ipcMain.handle('send-chat-request', async (event, apiKey, model, systemPrompt, userMessage) => {
  return sendChatRequest(apiKey, model, systemPrompt, userMessage);
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  const { clipboard } = require('electron');
  const { spawn } = require('child_process');
  
  try {
    // Method 1: Use Electron's clipboard
    clipboard.clear();
    clipboard.writeText(text);
    
    // Method 2: Also try system clipboard (for Linux) as backup
    if (process.platform === 'linux') {
      try {
        const xclip = spawn('xclip', ['-selection', 'clipboard']);
        xclip.stdin.write(text);
        xclip.stdin.end();
        
        await new Promise((resolve) => {
          xclip.on('close', () => resolve());
          xclip.on('error', () => resolve()); // Don't fail if xclip unavailable
        });
      } catch (xclipError) {
        // xclip not available, but Electron clipboard should still work
      }
    }
    
    // Delay to ensure system clipboard is properly updated
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    throw error;
  }
});

ipcMain.handle('close-app', async () => {
  app.quit();
});

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
