const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  fetchModels: (apiKey) => ipcRenderer.invoke('fetch-models', apiKey),
  sendChatRequest: (apiKey, model, systemPrompt, userMessage) => 
    ipcRenderer.invoke('send-chat-request', apiKey, model, systemPrompt, userMessage),
  copyToClipboard: (text) => clipboard.writeText(text),
  closeApp: () => ipcRenderer.invoke('close-app'),
});
