import { archiveConnection, chooseArchiveRoot, saveCapture } from "./archive";
import { captureFilename, captureToMarkdown } from "./markdown";
import type { CapturedImage, CapturedPage, CapturedTweet } from "./types";

const summary = document.getElementById("captureSummary") as HTMLElement;
const content = document.getElementById("content") as HTMLElement;
const warnings = document.getElementById("warnings") as HTMLElement;
const connectionLabel = document.getElementById("connectionLabel") as HTMLElement;
const connectButton = document.getElementById("connectBtn") as HTMLButtonElement;
const downloadButton = document.getElementById("downloadBtn") as HTMLButtonElement;
const saveButton = document.getElementById("saveBtn") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLElement;

let capture: CapturedPage | null = null;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showStatus(message: string, state: "success" | "error" | "working" = "success"): void {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = false;
}

function renderImages(images: CapturedImage[]): HTMLElement {
  const grid = element("div", "image-grid");
  images.forEach((image, index) => {
    const figure = element("figure");
    const img = element("img");
    img.src = image.url;
    img.alt = image.description || "Image from the captured X page";
    img.loading = "lazy";
    const caption = element(
      "figcaption",
      undefined,
      image.description || `Image ${index + 1} — no description was available on X`,
    );
    figure.append(img, caption);
    grid.appendChild(figure);
  });
  return grid;
}

function renderTweet(tweet: CapturedTweet): HTMLElement {
  const section = element("section", "tweet");
  const label = [tweet.displayName, tweet.username].filter(Boolean).join(" ");
  section.appendChild(element("h2", undefined, `${tweet.index}. ${label}`));
  section.appendChild(element("p", undefined, tweet.text));
  if (tweet.images.length) section.appendChild(renderImages(tweet.images));
  return section;
}

function renderCapture(value: CapturedPage): void {
  document.title = `${value.title} — X Archive Capture`;

  const kind = element("p", "kind", value.kind);
  const title = element("h1", undefined, value.title);
  title.id = "title";
  const byline = element(
    "p",
    "byline",
    `${value.displayName} ${value.username} · ${value.publishedAt?.slice(0, 10) || "date unavailable"}`,
  );
  const file = element("p", "filename", captureFilename(value));
  summary.replaceChildren(kind, title, byline, file);

  if (value.warnings.length) {
    warnings.hidden = false;
    warnings.replaceChildren(
      element("h2", undefined, "Capture notes"),
      ...value.warnings.map((warning) => element("p", undefined, warning)),
    );
  }

  if (value.kind === "article") {
    const fragment = document.createDocumentFragment();
    if (value.images.length) fragment.appendChild(renderImages(value.images));
    for (const paragraph of value.paragraphs) {
      const isQuestion = /^Q:\s*/i.test(paragraph);
      const answer = paragraph.match(/^(A|Expert):\s*/i);
      if (isQuestion) {
        fragment.appendChild(element("h2", "question", paragraph));
      } else if (answer) {
        const node = element("p", "answer");
        node.append(
          element("strong", undefined, `${answer[1]}:`),
          document.createTextNode(` ${paragraph.slice(answer[0].length)}`),
        );
        fragment.appendChild(node);
      } else {
        fragment.appendChild(element("p", undefined, paragraph));
      }
    }
    content.replaceChildren(fragment);
  } else {
    content.replaceChildren(...value.tweets.map(renderTweet));
  }
}

async function refreshConnection(): Promise<void> {
  try {
    const connection = await archiveConnection();
    if (!connection) {
      connectionLabel.textContent = "No archive folder connected";
      saveButton.disabled = true;
      return;
    }
    connectionLabel.textContent = `Archive: ${connection.name}${
      connection.permission === "granted" ? "" : " · permission required"
    }`;
    saveButton.disabled = false;
  } catch (error) {
    connectionLabel.textContent = "Could not read the saved folder connection";
    saveButton.disabled = true;
    showStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

connectButton.addEventListener("click", async () => {
  try {
    const name = await chooseArchiveRoot();
    showStatus(`Connected “${name}”.`, "success");
    await refreshConnection();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    showStatus(error instanceof Error ? error.message : String(error), "error");
  }
});

saveButton.addEventListener("click", async () => {
  if (!capture) return;
  saveButton.disabled = true;
  showStatus("Checking the archive and saving…", "working");
  try {
    const result = await saveCapture(capture);
    if (result.status === "duplicate") {
      showStatus("This source URL is already in the archive. Nothing was changed.", "success");
    } else {
      showStatus(`Saved articles/${result.filename} and updated index.md.`, "success");
    }
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    saveButton.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!capture) return;
  const blob = new Blob([captureToMarkdown(capture)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = captureFilename(capture);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus("Markdown download started.", "success");
});

async function initialize(): Promise<void> {
  const result = await chrome.storage.session.get("captureData");
  capture = (result.captureData as CapturedPage | undefined) ?? null;
  if (!capture) {
    summary.replaceChildren(element("h1", undefined, "No capture found"));
    content.replaceChildren(
      element("p", undefined, "Return to an X page and use the extension’s Capture current page button."),
    );
    downloadButton.disabled = true;
    saveButton.disabled = true;
    return;
  }
  renderCapture(capture);
  await refreshConnection();
}

initialize().catch((error) => {
  showStatus(error instanceof Error ? error.message : String(error), "error");
});
