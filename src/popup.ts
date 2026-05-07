const extractBtn = document.getElementById('extractBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

async function extractThread(tabId: number): Promise<{ tweets: any[] } | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_THREAD' });
    return response;
  } catch {
    // Content script not loaded; inject it and retry once
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    // Wait briefly to ensure the script is ready
    await new Promise((r) => setTimeout(r, 200));
    return await chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_THREAD' });
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
    const response = await extractThread(tab.id);
    if (response?.tweets?.length) {
      await chrome.storage.session.set({ threadData: response.tweets });
      await chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') });
      statusDiv.textContent = 'Opening preview...';
    } else {
      statusDiv.textContent = 'No tweets found. Try scrolling down to load more.';
    }
  } catch (err) {
    statusDiv.textContent = 'Error: ' + (err as Error).message;
  }
});
