const extractBtn = document.getElementById('extractBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const maxScrollsInput = document.getElementById('maxScrolls') as HTMLInputElement;

function getMaxScrolls(): number {
  const val = parseInt(maxScrollsInput.value, 10);
  return isNaN(val) || val < 1 ? 3 : val;
}

async function extractThread(tabId: number, maxScrolls: number): Promise<{ tweets: any[] } | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_THREAD', maxScrolls });
    return response;
  } catch {
    // Content script not loaded; inject it and retry once
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    // Wait briefly to ensure the script is ready
    await new Promise((r) => setTimeout(r, 200));
    return await chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_THREAD', maxScrolls });
  }
}

extractBtn.addEventListener('click', async () => {
  statusDiv.textContent = 'Extracting thread (scrolling to load all tweets)...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusDiv.textContent = 'Error: Cannot access current tab.';
    return;
  }

  try {
    const maxScrolls = getMaxScrolls();
    const response = await extractThread(tab.id, maxScrolls);
    if (response?.tweets?.length) {
      await chrome.storage.session.set({ threadData: response.tweets });
      await chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') });
      statusDiv.textContent = 'Opening preview...';
    } else {
      statusDiv.textContent = 'No tweets found. Make sure a tweet or thread is open and fully loaded.';
    }
  } catch (err) {
    statusDiv.textContent = 'Error: ' + (err as Error).message;
  }
});
