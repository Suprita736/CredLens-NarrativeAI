// src/content/index.tsx — CredLens NarrativeAI Phase 1
//
// Content script for YouTube Shorts.
// Uses TranscriptStabilizer for proper caption accumulation.

import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { CaptionExtractor } from '../utils/captionExtractor';
import { TranscriptStabilizer } from '../utils/transcriptStabilizer';
import type { VideoState, BackgroundResponse } from '../types';
import CredibilityOverlay from '../components/CredibilityOverlay';
import { Loader2, AlertCircle, X } from 'lucide-react';
import '../index.css';

const YouTubeShortsDetector = () => {
  const [activeVideo, setActiveVideo] = useState<VideoState | null>(null);
  const swipeLockRef = useRef(true);
  const stabilizerRef = useRef(new TranscriptStabilizer({ minWords: 40, stabilityDelayMs: 2000 }));
  const analysisTriggered = useRef(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  const processedVideoRef = useRef<string | null>(null);
  const reconnectingRef = useRef(false);

  const lastAnalyzedProgressRef = useRef<number>(0);
  const lastAnalyzedLengthRef = useRef<number>(0);
  const lastAnalyzedAtEndRef = useRef<boolean>(false);

  // 1. Establish long-lived Port connection with Background Service Worker
  useEffect(() => {
    const connectPort = () => {
      console.log('[Content] Connecting to CredLens background port...');
      const port = chrome.runtime.connect({ name: 'credlens-verification' });
      portRef.current = port;

      port.onMessage.addListener((message: BackgroundResponse) => {
        const { status, videoId, analysis, error } = message;
        console.log(`[Content] Port Message: ${status} for video ${videoId}`, message);

        setActiveVideo((prev) => {
          if (!prev || prev.videoId !== videoId) return prev;
          return {
            ...prev,
            status,
            processed: status === 'completed',
            analysis: status === 'completed' ? analysis : prev.analysis,
          };
        });

        if (status === 'error' && error) {
          console.warn('[Content] Background pipeline reported error:', error);
        }
      });

      port.onDisconnect.addListener(() => {
        console.warn('[Content] Background port disconnected.');
        portRef.current = null;
        if (reconnectingRef.current) return;
        reconnectingRef.current = true;
        setTimeout(() => {
          console.log('[Content] Reconnecting background port...');
          connectPort();
          reconnectingRef.current = false;
        }, 3000);
      });
    };

    connectPort();
    return () => {
      if (portRef.current) portRef.current.disconnect();
    };
  }, []);

  // 2. Detect YouTube Shorts URL navigation
  useEffect(() => {
    const handleUrlChange = () => {
      const url = window.location.href;
      if (url.includes('/shorts/')) {
        const videoId = url.split('/shorts/')[1].split('?')[0];
        console.log('[Content] Detected Shorts video:', videoId);
        if (activeVideo?.videoId !== videoId) {
          resetAndStartNewVideo(videoId);
        }
      } else {
        setActiveVideo(null);
      }
    };

    window.addEventListener('yt-navigate-finish', handleUrlChange);
    handleUrlChange();
    return () => window.removeEventListener('yt-navigate-finish', handleUrlChange);
  }, [activeVideo]);

  const resetAndStartNewVideo = (videoId: string) => {
    console.log(`[Transcript] Reset for new video: ${videoId}`);

    // Do NOT send CANCEL_VERIFICATION.
    // If verification started, let it finish and cache the result in the background.

    // Reset state
    stabilizerRef.current.reset();
    analysisTriggered.current = false;
    swipeLockRef.current = true;
    CaptionExtractor.reset();
    processedVideoRef.current = null;
    lastAnalyzedProgressRef.current = 0;
    lastAnalyzedLengthRef.current = 0;
    lastAnalyzedAtEndRef.current = false;

    setActiveVideo({
      videoId,
      viewTime: 0,
      processed: false,
    });

    console.log(`[Content] Swipe lock started for: ${videoId}`);
    setTimeout(() => {
      swipeLockRef.current = false;
      console.log('[Content] Swipe lock released. Ready for captions.');
    }, 3000);
  };

  // Send stabilized transcript to Background Service Worker
  const triggerBackgroundVerification = (videoId: string, transcript: string, currentProgress: number) => {
    if (!portRef.current) {
      console.warn('[Content] Port not established.');
      return;
    }

    if (transcript.split(/\s+/).length < 15) {
      console.log('[Content] Transcript too short after cleaning.');
      return;
    }

    console.log(`[Transcript] Final Transcript Length: ${transcript.length}`);
    console.log(`[Transcript] Final Transcript Preview: ${transcript.substring(0, 500)}`);

    const titleElement = document.querySelector('ytd-reel-video-renderer[is-active] h2.title');
    const videoTitle = titleElement ? titleElement.textContent?.trim() : 'Unknown Title';

    const channelElement = document.querySelector('ytd-reel-video-renderer[is-active] ytd-channel-name .yt-simple-endpoint');
    const channelName = channelElement ? channelElement.textContent?.trim() : 'Unknown Channel';

    try {
      setActiveVideo(prev => prev ? { ...prev, status: 'loading' } : null);
      
      portRef.current.postMessage({
        action: 'VERIFY_TRANSCRIPT',
        videoId,
        transcript,
        transcriptLength: transcript.length,
        currentProgress,
        videoTitle,
        channelName
      });
    } catch (err) {
      console.error('[Content] Port error sending verification request:', err);
    }
  };

  // 3. Capture and stabilize transcripts
  useEffect(() => {
    const observer = CaptionExtractor.observeCaptions((text) => {
      if (!text || !activeVideo) return;
      if (swipeLockRef.current) return;

      // Feed into stabilizer (handles dedup internally)
      stabilizerRef.current.addSegment(text);
    });

    return () => observer.disconnect();
  }, [activeVideo]);

  // 4. Watch completion and Cache refresh gate
  useEffect(() => {
    if (!activeVideo) return;

    const interval = setInterval(() => {
      if (swipeLockRef.current) return;
      // Do not trigger if currently verifying
      if (activeVideo.status === 'loading') return;

      const videos = document.querySelectorAll('video');
      let activeVid: HTMLVideoElement | null = null;
      let ratio = 0;
      let isEnded = false;

      for (const v of Array.from(videos)) {
        if (v.duration > 0 && !v.paused) {
           activeVid = v;
           ratio = v.currentTime / v.duration;
           isEnded = v.ended;
           break;
        } else if (v.duration > 0 && v.ended) {
           activeVid = v;
           ratio = 1;
           isEnded = true;
           break;
        }
      }

      if (!activeVid) return;

      const duration = activeVid.duration || 0;
      const watchedSeconds = activeVid.currentTime || 0;

      if (watchedSeconds < 3 && !isEnded) {
        console.log('[WatchGate] Skip: insufficient_view_time');
        return;
      }

      const isStable = stabilizerRef.current.hasMinimumContent();

      let thresholdMet = false;
      if (duration <= 15) {
        thresholdMet = ratio >= 0.60 && watchedSeconds >= 4;
      } else if (duration <= 30) {
        thresholdMet = ratio >= 0.70 && watchedSeconds >= 10;
      } else if (duration <= 60) {
        thresholdMet = ratio >= 0.80 && watchedSeconds >= 20;
      } else {
        thresholdMet = ratio >= 0.85 && watchedSeconds >= 30;
      }

      if (isEnded || thresholdMet) {
        console.log('[WatchGate] Trigger: watch_threshold_met');
      } else if (isStable) {
        console.log('[WatchGate] Trigger: transcript_complete');
      } else {
        return;
      }

      // Determine if this is the first analysis OR a cache refresh
      const isFirstAnalysis = lastAnalyzedProgressRef.current === 0 && !lastAnalyzedAtEndRef.current;
      
      let shouldTrigger = false;
      
      const currentLength = stabilizerRef.current.getCleanTranscript().length;
      
      if (isFirstAnalysis) {
        shouldTrigger = true;
        if (isEnded) {
          console.log(`[WatchGate] Final verification triggered at completion`);
        } else {
          console.log(`[WatchGate] Verification triggered at threshold`);
        }
      } else {
        // Cache refresh logic
        // 1. Natural end (and we haven't analyzed at end yet)
        if (isEnded && !lastAnalyzedAtEndRef.current) {
          shouldTrigger = true;
          console.log(`[WatchGate] Final verification triggered at completion`);
        } 
        // 2. Continued watching: progress increased AND transcript increased > 15%
        else if (
          ratio > lastAnalyzedProgressRef.current && 
          currentLength > lastAnalyzedLengthRef.current * 1.15
        ) {
          shouldTrigger = true;
          console.log(`[WatchGate] Verification triggered for cache refresh`);
        }
      }

      if (shouldTrigger && stabilizerRef.current.hasMinimumContent()) {
        stabilizerRef.current.waitForStability((stableTranscript) => {
          console.log(`[Content] Watch gate met. Progress: ${ratio.toFixed(2)}, Ended: ${isEnded}. Triggering verification.`);
          
          lastAnalyzedProgressRef.current = ratio;
          lastAnalyzedLengthRef.current = stableTranscript.length;
          if (isEnded) lastAnalyzedAtEndRef.current = true;

          triggerBackgroundVerification(activeVideo.videoId, stableTranscript, ratio);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeVideo]);

  if (!activeVideo) return null;

  const renderStatusView = () => {
    if (activeVideo.status === 'loading') {
      return (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-950/85 backdrop-blur-lg border border-slate-800/80 shadow-lg text-slate-300 animate-pulse text-xs select-none">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <span className="font-semibold uppercase tracking-wider">
            CredLens: Analyzing Narrative...
          </span>
        </div>
      );
    }

    if (activeVideo.status === 'error') {
      return (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-rose-950/85 backdrop-blur-lg border border-rose-800/50 shadow-lg text-rose-200 text-xs select-none">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold uppercase tracking-wider text-[8px] opacity-75 leading-none">
              CredLens Error
            </span>
            <span className="font-medium mt-0.5 leading-tight">
              Click extension to setup
            </span>
          </div>
          <button
            onClick={() => setActiveVideo(null)}
            className="ml-1 p-0.5 hover:bg-rose-900/50 rounded-full transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      );
    }

    if (activeVideo.status === 'completed' && activeVideo.analysis) {
      return (
        <CredibilityOverlay
          analysis={activeVideo.analysis}
          onClose={() => setActiveVideo(null)}
        />
      );
    }

    return null;
  };

  return renderStatusView();
};

// Shadow DOM styling sync
const syncStylesIntoShadow = (shadowRoot: ShadowRoot) => {
  const syncNode = (node: Node) => {
    if (node.nodeName === 'LINK') {
      const link = node as HTMLLinkElement;
      if (link.rel === 'stylesheet' && link.href.startsWith('chrome-extension://')) {
        shadowRoot.appendChild(link.cloneNode(true));
      }
    } else if (node.nodeName === 'STYLE') {
      shadowRoot.appendChild(node.cloneNode(true));
    }
  };

  document.querySelectorAll("style, link[rel='stylesheet']").forEach(syncNode);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'LINK' || node.nodeName === 'STYLE') {
          syncNode(node);
        }
      });
    }
  });

  observer.observe(document.head, { childList: true });
  return observer;
};

// Initialize Shadow DOM Container
const init = () => {
  if (document.getElementById('credlens-root')) return;

  console.log('[Content] Initializing CredLens NarrativeAI...');
  const container = document.createElement('div');
  container.id = 'credlens-root';
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: 'open' });
  const shadowWrapper = document.createElement('div');
  shadowWrapper.id = 'credlens-shadow-wrapper';
  shadowRoot.appendChild(shadowWrapper);

  const style = document.createElement('style');
  style.textContent = `
    #credlens-shadow-wrapper {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      pointer-events: auto;
    }
  `;
  shadowRoot.appendChild(style);

  const styleObserver = syncStylesIntoShadow(shadowRoot);

  const root = ReactDOM.createRoot(shadowWrapper);
  root.render(<YouTubeShortsDetector />);

  window.addEventListener('unload', () => {
    styleObserver.disconnect();
  });
};

if (document.body) {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
