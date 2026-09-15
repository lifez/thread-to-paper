export type CaptureKind = "article" | "thread" | "post";

export type CapturedImage = {
  url: string;
  description: string | null;
};

export type CapturedTweet = {
  index: number;
  text: string;
  displayName: string;
  username: string;
  publishedAt: string | null;
  images: CapturedImage[];
};

export type CapturedPage = {
  kind: CaptureKind;
  title: string;
  displayName: string;
  username: string;
  sourceUrl: string;
  originalPostUrl: string | null;
  publishedAt: string | null;
  capturedOn: string;
  paragraphs: string[];
  tweets: CapturedTweet[];
  images: CapturedImage[];
  warnings: string[];
};
