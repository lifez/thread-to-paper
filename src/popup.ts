import type { CapturedPage } from "./types";

const extractButton = document.getElementById("extractBtn") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;
const maxScrollsInput = document.getElementById("maxScrolls") as HTMLInputElement;

async function requestCapture(
  tabId: number,
  maxScrolls: number,
): Promise<{ capture?: CapturedPage; error?: string }> {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: "EXTRACT_PAGE", maxScrolls });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return await chrome.tabs.sendMessage(tabId, { action: "EXTRACT_PAGE", maxScrolls });
  }
}

extractButton.addEventListener("click", async () => {
  extractButton.disabled = true;
  status.dataset.state = "working";
  status.textContent = "Reading the current X page…";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (
    !tab?.id ||
    !tab.url?.match(/^https:\/\/(x|twitter)\.com\/[^/]+\/(status|article)\/\d+/)
  ) {
    status.dataset.state = "error";
    status.textContent = "Open one specific X post, thread, or article first—not a profile or feed.";
    extractButton.disabled = false;
    return;
  }

  try {
    const maxScrolls = Math.max(1, Math.min(Number(maxScrollsInput.value) || 12, 100));
    const response = await requestCapture(tab.id, maxScrolls);
    if (!response.capture || response.error) {
      throw new Error(response.error || "No readable X content was found.");
    }
    await chrome.storage.session.set({ captureData: response.capture });
    await chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
    status.dataset.state = "success";
    status.textContent = "Opening archive preview…";
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = error instanceof Error ? error.message : String(error);
    extractButton.disabled = false;
  }
});
