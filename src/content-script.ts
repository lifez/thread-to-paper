type ExtractedTweet = {
  index: number;
  text: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  imageUrls: string[];
};

function getAvatarUrl(el: Element): string | null {
  const img = el.querySelector(
    'img[src*="profile_images"]',
  ) as HTMLImageElement | null;
  if (img?.src) return img.src;
  const firstImg = el.querySelector("img") as HTMLImageElement | null;
  return firstImg?.src || null;
}

function getUsername(el: Element): string {
  const link = el.querySelector('a[href^="/"]') as HTMLAnchorElement | null;
  if (link) {
    const parts = link.getAttribute("href")?.split("/") || [];
    if (parts.length >= 2) {
      return "@" + parts[1];
    }
  }
  return "";
}

function getDisplayName(el: Element): string {
  const possible = el.querySelectorAll('a[role="link"]');
  for (const a of Array.from(possible)) {
    const text = a.textContent?.trim();
    if (text && !text.startsWith("@") && text.length > 0 && text.length < 50) {
      return text;
    }
  }
  const allText = el.querySelectorAll("span, div");
  for (const t of Array.from(allText)) {
    const text = t.textContent?.trim();
    if (text && !text.startsWith("@") && text.length > 0 && text.length < 50) {
      return text;
    }
  }
  return "Unknown";
}

function getImageUrls(el: Element): string[] {
  const images = el.querySelectorAll("img");
  const urls: string[] = [];
  const seen = new Set<string>();

  images.forEach((img) => {
    const src = img.src;
    if (!src) return;
    if (src.includes("profile_images")) return;
    if (src.includes("emoji")) return;
    if (seen.has(src)) return;
    seen.add(src);
    urls.push(src);
  });

  return urls;
}

const DISCOVERY_MARKERS = [
  "discover more",
  "sourced from across",
  "who to follow",
  "you might like",
  "more tweets",
  "related tweets",
  "suggested for you",
];

function isDiscoverySectionVisible(): boolean {
  const elements = document.querySelectorAll(
    'div, h2, span, a, button, heading, section, aside, *[role="heading"]',
  );
  for (const el of Array.from(elements)) {
    const text = el.textContent?.toLowerCase().trim() || "";
    if (DISCOVERY_MARKERS.some((m) => text.includes(m))) {
      const rect = el.getBoundingClientRect();
      if (rect.top >= -50 && rect.top < window.innerHeight + 50) {
        return true;
      }
    }
  }
  return false;
}

function extractVisibleTweets(): ExtractedTweet[] {
  const tweetElements = document.querySelectorAll(
    'article[data-testid="tweet"]',
  );
  const tweets: ExtractedTweet[] = [];

  tweetElements.forEach((el) => {
    const textEl = el.querySelector('[data-testid="tweetText"]');
    if (!textEl) return;

    const text = textEl.textContent?.trim() || "";
    if (!text) return;

    tweets.push({
      index: 0, // renumbered later
      text,
      displayName: getDisplayName(el),
      username: getUsername(el),
      avatarUrl: getAvatarUrl(el),
      imageUrls: getImageUrls(el),
    });
  });

  return tweets;
}

async function extractAllTweets(maxScrolls: number = 3): Promise<ExtractedTweet[]> {
  const allTweets: ExtractedTweet[] = [];
  const seenKeys = new Set<string>();

  const originalScrollTop = window.scrollY;

  // Start at the top so we can scroll through everything
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 500));

  let noNewCount = 0;
  const maxNoNew = 3;
  let scrolls = 0;

  while (noNewCount < maxNoNew && scrolls < maxScrolls) {
    const currentTweets = extractVisibleTweets();
    let newFound = 0;

    for (const tweet of currentTweets) {
      const key = tweet.text + "|" + tweet.username;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allTweets.push(tweet);
        newFound++;
      }
    }

    if (newFound === 0) {
      noNewCount++;
    } else {
      noNewCount = 0;
    }

    if (isDiscoverySectionVisible()) {
      break;
    }

    // Scroll down by ~75% of viewport to load more tweets
    window.scrollBy(0, window.innerHeight * 0.75);
    await new Promise((r) => setTimeout(r, 500));
    scrolls++;
  }

  // Restore original scroll position
  window.scrollTo(0, originalScrollTop);

  // Safety net: if we somehow got nothing, try one final extraction at current position
  if (allTweets.length === 0) {
    const fallbackTweets = extractVisibleTweets();
    for (const tweet of fallbackTweets) {
      const key = tweet.text + "|" + tweet.username;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allTweets.push({ ...tweet });
      }
    }
  }

  // Renumber sequentially
  allTweets.forEach((t, i) => {
    t.index = i + 1;
  });

  return allTweets;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "EXTRACT_THREAD") {
    const maxScrolls = request.maxScrolls ?? 3;
    extractAllTweets(maxScrolls).then((tweets) => {
      sendResponse({ tweets });
    });
    return true; // async response
  }
  return false;
});
