import type { CapturedImage, CapturedPage } from "./types";

function publishedDate(capture: CapturedPage): string | null {
  return capture.publishedAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return slug || "x-capture";
}

function cleanHandle(value: string): string {
  return slugify(value.replace(/^@/, "")) || "unknown";
}

export function captureFilename(capture: CapturedPage): string {
  const date = publishedDate(capture) ?? capture.capturedOn;
  return `${date}-${cleanHandle(capture.username)}-${slugify(capture.title)}.md`;
}

function imageLine(image: CapturedImage, index: number): string {
  const label = image.description
    ? `Image ${index}: ${image.description}`
    : `Image ${index}: No description was available on X.`;
  return `- ${label} ([source image](${image.url}))`;
}

function formatParagraph(text: string): string {
  if (/^Q:\s*/i.test(text)) return text.replace(/^Q:\s*/i, "**Q:** ");
  if (/^A:\s*/i.test(text)) return text.replace(/^A:\s*/i, "**A:** ");
  if (/^Expert:\s*/i.test(text)) return text.replace(/^Expert:\s*/i, "**Expert:** ");
  return text;
}

export function captureToMarkdown(capture: CapturedPage): string {
  const lines = [
    `# ${capture.title}`,
    "",
    `- **Author:** ${capture.displayName || "Unavailable"}`,
    `- **Handle:** ${capture.username || "Unavailable"}`,
    `- **Source:** ${capture.sourceUrl}`,
  ];

  if (capture.originalPostUrl && capture.originalPostUrl !== capture.sourceUrl) {
    lines.push(`- **Original post:** ${capture.originalPostUrl}`);
  }

  lines.push(
    `- **Published:** ${publishedDate(capture) ?? "Unavailable"}`,
    `- **Captured:** ${capture.capturedOn}`,
    `- **Capture type:** ${capture.kind}`,
    "",
  );

  if (capture.warnings.length) {
    lines.push(
      "## Capture notes",
      "",
      ...capture.warnings.map((warning) => `- ${warning}`),
      "",
    );
  }

  if (capture.kind === "article") {
    if (capture.images.length) {
      lines.push("## Images", "", ...capture.images.map(imageLine), "");
    }
    lines.push(
      "## Article",
      "",
      ...capture.paragraphs.flatMap((paragraph) => [formatParagraph(paragraph), ""]),
    );
  } else {
    lines.push("## Thread", "");
    for (const tweet of capture.tweets) {
      const author = [tweet.displayName, tweet.username].filter(Boolean).join(" ");
      lines.push(`### ${tweet.index}. ${author}`, "", tweet.text, "");
      if (tweet.images.length) {
        lines.push(...tweet.images.map(imageLine), "");
      }
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function indexRow(capture: CapturedPage, filename: string): string {
  const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const author = capture.username
    ? `${capture.displayName || capture.username} (${capture.username})`
    : capture.displayName || "Unavailable";
  return `| ${capture.capturedOn} | ${cell(author)} | ${cell(capture.title)} | [X](${capture.sourceUrl}) | [Markdown](articles/${filename}) |`;
}
