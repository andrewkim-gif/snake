"use client";

import { useEffect, useState, useCallback } from "react";

// ============================================================
// Coach Bubble (S57)
// Displays real-time coaching advice from the Coach Agent.
// Bubbles appear at bottom of screen, auto-dismiss after 3s.
// Max 2 bubbles visible at once.
// ============================================================

export interface CoachMessage {
  type: "warning" | "tip" | "strategy" | "opportunity" | "efficiency";
  message: string;
  icon: string;
}

interface BubbleItem {
  id: number;
  message: CoachMessage;
  exiting: boolean;
}

const ICON_MAP: Record<string, string> = {
  warning: "\u26A0\uFE0F",
  tip: "\uD83D\uDCA1",
  strategy: "\uD83D\uDD04",
  opportunity: "\uD83C\uDFAF",
};

const BG_MAP: Record<string, string> = {
  warning: "bg-red-900/80 border-red-500/60",
  tip: "bg-blue-900/80 border-blue-500/60",
  strategy: "bg-purple-900/80 border-purple-500/60",
  opportunity: "bg-green-900/80 border-green-500/60",
};

let nextBubbleId = 0;

export function CoachBubble({
  messages,
  maxVisible = 2,
}: {
  messages: CoachMessage[];
  maxVisible?: number;
}) {
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);

  // Track last processed message index
  const [lastIdx, setLastIdx] = useState(0);

  // Add new messages as bubbles
  useEffect(() => {
    if (messages.length > lastIdx) {
      const newMessages = messages.slice(lastIdx);
      setLastIdx(messages.length);

      setBubbles((prev) => {
        const newBubbles = newMessages.map((msg) => ({
          id: nextBubbleId++,
          message: msg,
          exiting: false,
        }));

        // Keep only maxVisible most recent
        const combined = [...prev.filter((b) => !b.exiting), ...newBubbles];
        return combined.slice(-maxVisible);
      });
    }
  }, [messages, lastIdx, maxVisible]);

  // Auto-dismiss bubbles after 3 seconds
  useEffect(() => {
    if (bubbles.length === 0) return;

    const timers = bubbles
      .filter((b) => !b.exiting)
      .map((bubble) => {
        return setTimeout(() => {
          // Start exit animation
          setBubbles((prev) =>
            prev.map((b) => (b.id === bubble.id ? { ...b, exiting: true } : b))
          );
          // Remove after animation
          setTimeout(() => {
            setBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
          }, 300);
        }, 3000);
      });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [bubbles]);

  const dismissBubble = useCallback((id: number) => {
    setBubbles((prev) =>
      prev.map((b) => (b.id === id ? { ...b, exiting: true } : b))
    );
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 300);
  }, []);

  if (bubbles.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className={`
            pointer-events-auto
            flex items-center gap-2 px-4 py-2
            rounded-lg border backdrop-blur-sm
            text-white text-sm font-medium
            shadow-lg
            transition-all duration-300
            ${BG_MAP[bubble.message.type] || "bg-gray-900/80 border-gray-500/60"}
            ${bubble.exiting ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}
            animate-slide-up
          `}
          onClick={() => dismissBubble(bubble.id)}
          role="alert"
          aria-live="polite"
        >
          <span className="text-lg flex-shrink-0">
            {ICON_MAP[bubble.message.icon] || ICON_MAP[bubble.message.type] || "\uD83E\uDD16"}
          </span>
          <span className="max-w-[320px] leading-snug">
            {bubble.message.message}
          </span>
        </div>
      ))}

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default CoachBubble;
