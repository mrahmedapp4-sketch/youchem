import { useEffect, useRef } from 'react';

type BunnyPlayer = {
  on: (event: string, callback: (data?: { seconds?: number; currentTime?: number }) => void) => void;
  off?: (event: string, callback?: (data?: { seconds?: number; currentTime?: number }) => void) => void;
  setCurrentTime: (seconds: number) => void;
};

type PlayerJs = {
  Player: new (iframe: HTMLIFrameElement) => BunnyPlayer;
};

declare global {
  interface Window {
    playerjs?: PlayerJs;
  }
}

const PLAYER_JS_URL = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js';
const CUT_VIDEO_MARKER = '/712182/9d022807-a8d3-4d21-a6a6-59d2b79b283e';
const DEFAULT_CUT_FROM_SECONDS = 13;
const DEFAULT_CUT_TO_SECONDS = 63;

let playerScriptPromise: Promise<void> | null = null;

function loadPlayerScript(): Promise<void> {
  if (window.playerjs) return Promise.resolve();
  if (playerScriptPromise) return playerScriptPromise;

  playerScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLAYER_JS_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Bunny Player API')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PLAYER_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Bunny Player API'));
    document.head.appendChild(script);
  });

  return playerScriptPromise;
}

function toEmbedUrl(videoUrl: string): string {
  return videoUrl.replace('player.mediadelivery.net/play/', 'iframe.mediadelivery.net/embed/');
}

export function BunnyVideo({ videoUrl, title, className = '', skipFromSeconds, skipToSeconds }: {
  videoUrl: string;
  title: string;
  className?: string;
  skipFromSeconds?: number | null;
  skipToSeconds?: number | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const usesDefaultCut = skipFromSeconds === undefined && skipToSeconds === undefined && videoUrl.includes(CUT_VIDEO_MARKER);
  const cutFrom = usesDefaultCut ? DEFAULT_CUT_FROM_SECONDS : skipFromSeconds;
  const cutTo = usesDefaultCut ? DEFAULT_CUT_TO_SECONDS : skipToSeconds;
  const shouldCut = typeof cutFrom === 'number' && typeof cutTo === 'number' && cutTo > cutFrom;

  useEffect(() => {
    if (!shouldCut) return;
    let disposed = false;
    let player: BunnyPlayer | null = null;

    const handleTimeUpdate = (data?: { seconds?: number; currentTime?: number }) => {
      const seconds = data?.seconds ?? data?.currentTime;
      if (!player || seconds === undefined || seconds < cutFrom! || seconds >= cutTo!) return;
      player.setCurrentTime(cutTo!);
    };

    loadPlayerScript()
      .then(() => {
        if (disposed || !iframeRef.current || !window.playerjs) return;
        player = new window.playerjs.Player(iframeRef.current);
        player.on('ready', () => {
          player?.on('timeupdate', handleTimeUpdate);
          player?.on('seeked', handleTimeUpdate);
        });
      })
      .catch((error) => {
        console.error('Bunny Player API failed to load:', error);
      });

    return () => {
      disposed = true;
      if (player?.off) {
        player.off('timeupdate', handleTimeUpdate);
        player.off('seeked', handleTimeUpdate);
      }
      player = null;
    };
  }, [shouldCut, videoUrl, cutFrom, cutTo]);

  return (
    <iframe
      ref={iframeRef}
      src={toEmbedUrl(videoUrl)}
      className={className}
      allowFullScreen
      allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
      title={title}
    />
  );
}