window.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const systemPromptTextarea = document.getElementById('systemPrompt');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  async function loadModels(key) {
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option>Loading...</option>';
    try {
      const models = await window.electronAPI.fetchModels(key);
      modelSelect.innerHTML = models.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
      modelSelect.disabled = false;
    } catch (err) {
      console.error(err);
      modelSelect.innerHTML = '<option value="">Error loading models</option>';
      modelSelect.disabled = true;
    }
  }

  (async () => {
    const config = await window.electronAPI.getConfig();
    if (config.apiKey) {
      apiKeyInput.value = config.apiKey;
      await loadModels(config.apiKey);
      if (config.model) {
        modelSelect.value = config.model;
      }
    }
    if (config.systemPrompt) {
      systemPromptTextarea.value = config.systemPrompt;
    }
  })();

  apiKeyInput.addEventListener('change', async () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      await loadModels(key);
    } else {
      modelSelect.innerHTML = '<option value="">-- Enter API key first --</option>';
      modelSelect.disabled = true;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const newConfig = {
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      systemPrompt: systemPromptTextarea.value.trim(),
    };
    await window.electronAPI.saveConfig(newConfig);
    window.close();
  });

  cancelBtn.addEventListener('click', () => window.close());
});