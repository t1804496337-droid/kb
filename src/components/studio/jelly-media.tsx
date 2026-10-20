"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { JELLY_ANIM_SRC } from "./module-jelly";

/** True when the OS asks for reduced motion — jellies then stay stills,
 *  the same gate the `.jelly-alive` CSS animations already honour. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** A node's jellyfish media. Every node plays the same shared animation
 *  loop (JELLY_ANIM_SRC, see module-jelly.ts); the node's own still is the
 *  video's poster and its fallback — shown if the video fails to load and
 *  whenever reduced motion is preferred.
 *
 *  The wrapper keeps the `.jelly-alive` life-motion, but in video mode the
 *  extra `.jelly-alive-video` class (globals.css) drops the CSS breathe /
 *  bell-pulse — the clip already pulses on its own, so only drift + sway
 *  remain. The clip feathers its own black backing away via `.jelly-video`. */
export function JellyMedia({
  still,
  stillClassName,
  onStillError,
}: {
  still: string;
  /** Feather-mask class for the still rendering (custom-module cutouts). */
  stillClassName?: string;
  /** Called when the fallback still itself fails (workspace map swaps in
   *  its glass-orb placeholder). */
  onStillError?: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [videoFailed, setVideoFailed] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const showVideo = !reduced && !videoFailed;

  // Muted-autoplay insurance, same pattern as the landing orb loop:
  // set the property directly and nudge play() once mounted.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    void v.play().catch(() => {});
  }, [showVideo]);

  return (
    <span
      className={cn("jelly-alive", showVideo && "jelly-alive-video")}
      aria-hidden
    >
      {showVideo ? (
        <video
          ref={videoRef}
          className="jelly-video"
          src={JELLY_ANIM_SRC}
          poster={still}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className={stillClassName}
          src={still}
          alt=""
          draggable={false}
          onError={onStillError}
        />
      )}
    </span>
  );
}
