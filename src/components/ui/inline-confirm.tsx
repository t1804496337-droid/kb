"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Popconfirm-style inline confirm (Ludi's popup taxonomy, polish batch 1):
 * for high-frequency, low-risk deletes the heavy modal / window.confirm is
 * the wrong weight — the first click arms the button in place, a second
 * click on the concrete-verb confirm actually deletes, and it disarms
 * itself after a few seconds. Rare, heavy, destructive actions keep a
 * full modal second step instead (see the step-detail delete).
 */
export function InlineConfirmButton({
  label,
  confirmLabel = "确认删除",
  onConfirm,
  className,
  testId,
  ariaLabel,
}: {
  label: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}) {
  const [arming, setArming] = React.useState(false);

  React.useEffect(() => {
    if (!arming) return;
    const t = window.setTimeout(() => setArming(false), 4000);
    return () => window.clearTimeout(t);
  }, [arming]);

  if (!arming) {
    return (
      <button
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        className={className}
        onClick={() => setArming(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        data-testid={testId ? `${testId}-confirm` : undefined}
        className={cn("xuan-btn xuan-btn-danger justify-center")}
        onClick={() => {
          setArming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        className="xuan-btn justify-center"
        onClick={() => setArming(false)}
      >
        取消
      </button>
    </span>
  );
}
