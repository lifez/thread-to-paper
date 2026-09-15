import { captureFilename, captureToMarkdown, indexRow } from "./markdown";
import type { CapturedPage } from "./types";

const DATABASE = "x-archive-capture";
const STORE = "settings";
const ROOT_HANDLE_KEY = "archive-root";

type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredRoot(): Promise<WritableDirectoryHandle | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as WritableDirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function storeRoot(handle: FileSystemDirectoryHandle): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(handle, ROOT_HANDLE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function ensurePermission(handle: WritableDirectoryHandle): Promise<boolean> {
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

async function readOptionalFile(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<string | null> {
  try {
    const handle = await directory.getFileHandle(name);
    return await (await handle.getFile()).text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
}

async function writeFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  content: string,
): Promise<void> {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function availableFilename(
  directory: FileSystemDirectoryHandle,
  preferred: string,
  sourceUrl: string,
): Promise<{ filename: string; duplicate: boolean }> {
  const stem = preferred.replace(/\.md$/i, "");
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const filename = suffix === 0 ? preferred : `${stem}-${suffix + 1}.md`;
    const existing = await readOptionalFile(directory, filename);
    if (existing === null) return { filename, duplicate: false };
    if (existing.includes(sourceUrl)) return { filename, duplicate: true };
  }
  throw new Error("Could not find an available filename in articles/.");
}

export async function chooseArchiveRoot(): Promise<string> {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await storeRoot(handle);
  return handle.name;
}

export async function archiveConnection(): Promise<{ name: string; permission: PermissionState } | null> {
  const handle = await getStoredRoot();
  if (!handle) return null;
  const permission = await handle.queryPermission({ mode: "readwrite" });
  return { name: handle.name, permission };
}

export type SaveResult =
  | { status: "saved"; filename: string; indexUpdated: true }
  | { status: "duplicate"; filename: string | null };

export async function saveCapture(capture: CapturedPage): Promise<SaveResult> {
  const root = await getStoredRoot();
  if (!root) throw new Error("Connect the archive folder first.");
  if (!(await ensurePermission(root))) throw new Error("Write access to the archive folder was not granted.");

  const indexText = (await readOptionalFile(root, "index.md")) ?? "";
  const duplicateUrl = [capture.sourceUrl, capture.originalPostUrl]
    .filter((value): value is string => Boolean(value))
    .find((url) => indexText.includes(url));
  if (duplicateUrl) return { status: "duplicate", filename: null };

  const articles = await root.getDirectoryHandle("articles", { create: true });
  const candidate = await availableFilename(articles, captureFilename(capture), capture.sourceUrl);
  if (candidate.duplicate) return { status: "duplicate", filename: candidate.filename };

  await writeFile(articles, candidate.filename, captureToMarkdown(capture));

  const header = [
    "# Saved X articles and posts",
    "",
    "| Captured | Author | Title | Source | Local file |",
    "| --- | --- | --- | --- | --- |",
  ].join("\n");
  const normalizedIndex = indexText.trim() || header;
  const updatedIndex = `${normalizedIndex}\n${indexRow(capture, candidate.filename)}\n`;
  await writeFile(root, "index.md", updatedIndex);

  return { status: "saved", filename: candidate.filename, indexUpdated: true };
}
