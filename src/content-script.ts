import type { CapturedImage, CapturedPage, CapturedTweet } from "./types";

const DISCOVERY_MARKERS = [
  "discover more",
  "sourced from across",
  "who to follow",
  "you might like",
  "more tweets",
  "related tweets",
  "suggested for you",
];

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanUrl(value: string): string {
  const url = new URL(value, location.href);
  url.search = "";
  url.hash = "";
  return url.href;
}

function meaningfulDescription(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  if (!cleaned || /^(image|photo)$/i.test(cleaned)) return null;
  return cleaned;
}

function backgroundImageUrl(element: Element): string | null {
  const styled = [element, ...Array.from(element.querySelectorAll<HTMLElement>("[style]"))];
  for (const item of styled) {
    const style = item instanceof HTMLElement ? item.style.backgroundImage : "";
    const match = style.match(/url\(["']?(.*?)["']?\)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function imagesFrom(root: Element): CapturedImage[] {
  const images: CapturedImage[] = [];
  const seen = new Set<string>();
  const mediaRoots = root.querySelectorAll<HTMLElement>(
    '[data-testid="tweetPhoto"], [data-testid="videoPlayer"]',
  );

  for (const media of Array.from(mediaRoots)) {
    const img = media.querySelector<HTMLImageElement>("img");
    const url = img?.currentSrc || img?.src || backgroundImageUrl(media);
    if (!url || seen.has(url) || url.includes("profile_images") || url.includes("emoji")) continue;
    seen.add(url);
    images.push({
      url,
      description:
        meaningfulDescription(img?.alt) ?? meaningfulDescription(media.getAttribute("aria-label")),
    });
  }

  return images;
}

function usernameFrom(root: Element): string {
  const text = Array.from(root.querySelectorAll("span, a"))
    .map((element) => element.textContent?.trim() ?? "")
    .find((value) => /^@[A-Za-z0-9_]{1,15}$/.test(value));
  return text ?? "";
}

function displayNameFrom(root: Element, username: string): string {
  const profile = username.replace(/^@/, "").toLowerCase();
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"));
  const match = links.find((link) => {
    const text = link.textContent?.trim() ?? "";
    const path = new URL(link.href, location.href).pathname.replace(/^\//, "").toLowerCase();
    return path === profile && text && !text.startsWith("@") && text.length < 80;
  });
  return match?.textContent?.trim() || username || "Unavailable";
}

function publishedAtFrom(root: Element): string | null {
  return root.querySelector<HTMLTimeElement>("time[datetime]")?.dateTime || null;
}

function originalPostUrlFrom(root: Element): string | null {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'));
  const match = links.map((link) => cleanUrl(link.href)).find((url) => /\/status\/\d+/.test(url));
  return match?.replace(/\/(analytics|photo\/\d+|video\/\d+)$/, "") ?? null;
}

function articleSourceUrl(root: Element): string {
  const link = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="/article/"]'))
    .map((element) => cleanUrl(element.href))
    .find((url) => /\/article\/\d+/.test(url));
  return link?.replace(/\/media\/\d+$/, "") ?? cleanUrl(location.href);
}

function extractArticle(): CapturedPage | null {
  const root = document.querySelector<HTMLElement>('[data-testid="twitterArticleReadView"]');
  if (!root) return null;

  const title = root.querySelector<HTMLElement>('[data-testid="twitter-article-title"]')
    ?.innerText.trim();
  const username = usernameFrom(root);
  const richText = root.querySelector<HTMLElement>('[data-testid="longformRichTextComponent"]');
  const blocks = richText
    ? Array.from(richText.querySelectorAll<HTMLElement>('[data-block="true"]'))
        .map((block) => block.innerText.trim())
        .filter(Boolean)
    : [];
  const paragraphs = blocks.length
    ? blocks
    : (richText?.innerText ?? "").split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
  const warnings: string[] = [];

  if (!title) warnings.push("The article title was unavailable.");
  if (!username) warnings.push("The author handle was unavailable.");
  if (!richText || paragraphs.length === 0) {
    warnings.push("PARTIAL CAPTURE: X did not expose the long-form article body in the page.");
  }

  return {
    kind: "article",
    title: title || "Untitled X article",
    displayName: displayNameFrom(root, username),
    username: username || "@unknown",
    sourceUrl: articleSourceUrl(root),
    originalPostUrl: originalPostUrlFrom(root),
    publishedAt: publishedAtFrom(root),
    capturedOn: localDate(),
    paragraphs,
    tweets: [],
    images: imagesFrom(root),
    warnings,
  };
}

function isDiscoverySectionVisible(): boolean {
  const elements = document.querySelectorAll(
    'h2, section, aside, [role="heading"], [data-testid="sidebarColumn"]',
  );
  return Array.from(elements).some((element) => {
    const text = element.textContent?.toLowerCase().trim() || "";
    if (!DISCOVERY_MARKERS.some((marker) => text.includes(marker))) return false;
    const rect = element.getBoundingClientRect();
    return rect.top >= -50 && rect.top < window.innerHeight + 50;
  });
}

function extractVisibleTweets(): CapturedTweet[] {
  const tweetElements = document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]');
  const tweets: CapturedTweet[] = [];

  tweetElements.forEach((element) => {
    const text = element.querySelector<HTMLElement>('[data-testid="tweetText"]')?.innerText.trim();
    if (!text) return;
    const username = usernameFrom(element);
    tweets.push({
      index: 0,
      text,
      displayName: displayNameFrom(element, username),
      username: username || "@unknown",
      publishedAt: publishedAtFrom(element),
      images: imagesFrom(element),
    });
  });

  return tweets;
}

async function extractThread(maxScrolls: number): Promise<CapturedPage> {
  const allTweets: CapturedTweet[] = [];
  const seen = new Set<string>();
  const originalScrollTop = window.scrollY;
  let noNewCount = 0;
  let scrolls = 0;

  window.scrollTo(0, 0);
  await new Promise((resolve) => setTimeout(resolve, 450));

  while (noNewCount < 3 && scrolls < maxScrolls) {
    const current = extractVisibleTweets();
    let added = 0;
    for (const tweet of current) {
      const key = `${tweet.username}|${tweet.publishedAt ?? ""}|${tweet.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allTweets.push(tweet);
      added += 1;
    }
    noNewCount = added === 0 ? noNewCount + 1 : 0;
    if (isDiscoverySectionVisible()) break;
    window.scrollBy(0, window.innerHeight * 0.75);
    await new Promise((resolve) => setTimeout(resolve, 450));
    scrolls += 1;
  }

  window.scrollTo(0, originalScrollTop);
  allTweets.forEach((tweet, index) => { tweet.index = index + 1; });

  const first = allTweets[0];
  const titleText = first?.text.replace(/\s+/g, " ").trim() || "X post";
  const warnings: string[] = [];
  if (!allTweets.length) warnings.push("PARTIAL CAPTURE: No post text was available in the page.");
  if (scrolls >= maxScrolls) {
    warnings.push(`The capture stopped after the configured ${maxScrolls} scrolls; verify very long threads.`);
  }

  return {
    kind: allTweets.length > 1 ? "thread" : "post",
    title: titleText.length > 100 ? `${titleText.slice(0, 97).trim()}…` : titleText,
    displayName: first?.displayName ?? "Unavailable",
    username: first?.username ?? "@unknown",
    sourceUrl: cleanUrl(location.href),
    originalPostUrl: null,
    publishedAt: first?.publishedAt ?? null,
    capturedOn: localDate(),
    paragraphs: [],
    tweets: allTweets,
    images: [],
    warnings,
  };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "EXTRACT_PAGE") return false;
  const article = extractArticle();
  const result = article
    ? Promise.resolve(article)
    : extractThread(Math.max(1, Math.min(Number(request.maxScrolls) || 12, 100)));
  result
    .then((capture) => sendResponse({ capture }))
    .catch((error: unknown) => {
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    });
  return true;
});
