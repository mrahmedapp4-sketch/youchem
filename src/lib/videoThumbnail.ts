const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
]);

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function getYouTubeVideoId(videoUrl: string | null | undefined): string | null {
  const value = videoUrl?.trim();
  if (!value) return null;
  if (YOUTUBE_VIDEO_ID_PATTERN.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] || null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v');
    } else {
      const [, route, id] = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/]+)/) || [];
      if (route) videoId = id;
    }
  }

  return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
}

export function getYouTubeThumbnailUrl(
  platform: string | null | undefined,
  videoUrl: string | null | undefined,
): string | null {
  if (platform !== 'youtube') return null;
  const videoId = getYouTubeVideoId(videoUrl);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}
