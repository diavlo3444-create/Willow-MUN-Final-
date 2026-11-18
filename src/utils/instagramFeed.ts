export const WILLOW_INSTAGRAM_HANDLE = '@willow.mun';
export const WILLOW_INSTAGRAM_USERNAME = 'willow.mun';
export const WILLOW_INSTAGRAM_URL = 'https://www.instagram.com/willow.mun/';

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramMediaItem {
  id: string;
  caption: string;
  captionExcerpt: string;
  mediaType: InstagramMediaType;
  imageUrl: string;
  permalink: string;
  timestamp: string;
  formattedDate: string;
}

export interface InstagramAccountInfo {
  username: string;
  handle: string;
  profileUrl: string;
}

export interface InstagramFeedResponse {
  configured: boolean;
  account: InstagramAccountInfo;
  posts: InstagramMediaItem[];
}

export const DEFAULT_INSTAGRAM_ACCOUNT: InstagramAccountInfo = {
  username: WILLOW_INSTAGRAM_USERNAME,
  handle: WILLOW_INSTAGRAM_HANDLE,
  profileUrl: WILLOW_INSTAGRAM_URL,
};

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatCaptionExcerpt(caption: string, maxChars = 128): string {
  const cleaned = caption.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxChars) return cleaned;
  const sliced = cleaned.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const base = lastSpace > Math.floor(maxChars * 0.55) ? sliced.slice(0, lastSpace) : sliced;
  return `${base.trimEnd()}…`;
}

export function formatInstagramDate(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Normalizes raw Instagram Graph API `media` nodes into safe renderable items.
 * Never fabricates missing posts, and filters out unrenderable video URLs lacking thumbnails.
 */
export function normalizeInstagramGraphResponse(
  rawItems: unknown,
  limit = 6,
): InstagramMediaItem[] {
  if (!Array.isArray(rawItems)) return [];

  const normalized: InstagramMediaItem[] = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') continue;
    const node = entry as Record<string, unknown>;

    const id = typeof node.id === 'string' ? node.id.trim() : '';
    const rawType = typeof node.media_type === 'string' ? node.media_type.toUpperCase() : 'IMAGE';
    const mediaType: InstagramMediaType =
      rawType === 'VIDEO' || rawType === 'CAROUSEL_ALBUM' ? rawType : 'IMAGE';

    // Instagram VIDEO nodes return an .mp4 in media_url; require thumbnail_url for crisp <img> display
    const candidateImage =
      mediaType === 'VIDEO'
        ? (node.thumbnail_url ?? node.imageUrl)
        : (node.media_url ?? node.imageUrl ?? node.thumbnail_url);

    const permalink = node.permalink;
    if (!id || !isSafeHttpsUrl(candidateImage) || !isSafeHttpsUrl(permalink)) {
      continue;
    }

    const caption = typeof node.caption === 'string' ? node.caption.trim() : '';
    const timestamp = typeof node.timestamp === 'string' ? node.timestamp : '';

    normalized.push({
      id,
      caption,
      captionExcerpt: formatCaptionExcerpt(caption),
      mediaType,
      imageUrl: candidateImage.trim(),
      permalink: permalink.trim(),
      timestamp,
      formattedDate: formatInstagramDate(timestamp),
    });

    if (normalized.length >= limit) break;
  }

  return normalized;
}

export async function fetchOfficialInstagramFeed(
  limit = 6,
): Promise<InstagramFeedResponse> {
  const fallback: InstagramFeedResponse = {
    configured: false,
    account: DEFAULT_INSTAGRAM_ACCOUNT,
    posts: [],
  };

  try {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.functions.invoke('willow-instagram', {
      body: { action: 'list_media', limit },
    });

    if (error || !data || typeof data !== 'object') {
      return fallback;
    }

    const payload = data as {
      configured?: unknown;
      account?: Partial<InstagramAccountInfo>;
      posts?: unknown;
    };

    const posts = normalizeInstagramGraphResponse(payload.posts, limit);
    const configured = Boolean(payload.configured) && posts.length > 0;

    return {
      configured,
      account: {
        username: payload.account?.username || WILLOW_INSTAGRAM_USERNAME,
        handle: payload.account?.handle || WILLOW_INSTAGRAM_HANDLE,
        profileUrl:
          isSafeHttpsUrl(payload.account?.profileUrl)
            ? payload.account.profileUrl
            : WILLOW_INSTAGRAM_URL,
      },
      posts,
    };
  } catch {
    return fallback;
  }
}
