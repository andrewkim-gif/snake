'use client';

/**
 * EventTicker — v14 Phase 8 S35: Global Event Rolling News Band
 * Displays real-time global events (domination changes, wars, hegemony)
 * below the LobbyHeader as a horizontal scrolling ticker.
 * Click on an event to focus the globe/arena on the relevant country.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SK, bodyFont } from '@/lib/sketch-ui';

// ─── Types ───

export type GlobalEventType =
  | 'domination_change'
  | 'war_declared'
  | 'war_ended'
  | 'hegemony_achieved'
  | 'sovereignty_achieved'
  | 'alliance_formed'
  | 'policy_changed'
  | 'epoch_complete'
  | 'capture_point_taken';

export interface GlobalEventItem {
  id: string;
  type: GlobalEventType;
  message: string;
  countryCode?: string;
  countryName?: string;
  targetCode?: string;
  targetName?: string;
  nation?: string;
  score?: number;
  timestamp: number; // unix ms
}

// ─── Event Type Config ───

interface EventTypeConfig {
  icon: string;
  color: string;
  tag: string;
}

const EVENT_CONFIGS: Record<GlobalEventType, EventTypeConfig> = {
  domination_change: { icon: '\u{1F451}', color: '#F59E0B', tag: 'DOMINATION' },
  war_declared: { icon: '\u{2694}\uFE0F', color: '#EF4444', tag: 'WAR' },
  war_ended: { icon: '\u{1F54A}\uFE0F', color: '#10B981', tag: 'PEACE' },
  hegemony_achieved: { icon: '\u{1F3C6}', color: '#F59E0B', tag: 'HEGEMONY' },
  sovereignty_achieved: { icon: '\u{1F3F0}', color: '#6366F1', tag: 'SOVEREIGNTY' },
  alliance_formed: { icon: '\u{1F91D}', color: '#3B82F6', tag: 'ALLIANCE' },
  policy_changed: { icon: '\u{1F4DC}', color: '#8B5CF6', tag: 'POLICY' },
  epoch_complete: { icon: '\u{23F0}', color: '#8888AA', tag: 'EPOCH' },
  capture_point_taken: { icon: '\u{1F6A9}', color: '#CC9933', tag: 'CAPTURE' },
};

// ─── Time formatting ───

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}M`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

// ─── Demo events (before server connection) ───

function generateDemoEvents(): GlobalEventItem[] {
  const now = Date.now();
  return [
    {
      id: 'demo-1',
      type: 'domination_change',
      message: 'USA takes South Korea from Japan',
      countryCode: 'KOR',
      nation: 'USA',
      timestamp: now - 60000,
    },
    {
      id: 'demo-2',
      type: 'war_declared',
      message: 'Germany declared war on France',
      countryCode: 'DEU',
      targetCode: 'FRA',
      timestamp: now - 180000,
    },
    {
      id: 'demo-3',
      type: 'hegemony_achieved',
      message: 'China achieved HEGEMONY over Russia',
      countryCode: 'RUS',
      nation: 'CHN',
      timestamp: now - 300000,
    },
    {
      id: 'demo-4',
      type: 'war_ended',
      message: 'Brazil wins war against Argentina',
      countryCode: 'BRA',
      targetCode: 'ARG',
      timestamp: now - 480000,
    },
    {
      id: 'demo-5',
      type: 'capture_point_taken',
      message: 'India captured resource point in Pakistan',
      countryCode: 'PAK',
      nation: 'IND',
      timestamp: now - 720000,
    },
  ];
}

// ─── Props ───

interface EventTickerProps {
  events?: GlobalEventItem[];
  onEventClick?: (countryCode: string) => void;
}

// ─── Single Ticker Item ───

function TickerEventItem({
  event,
  onClick,
}: {
  event: GlobalEventItem;
  onClick?: (countryCode: string) => void;
}) {
  const config = EVENT_CONFIGS[event.type] || EVENT_CONFIGS.epoch_complete;
  const clickable = !!(event.countryCode && onClick);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        marginRight: '40px',
        cursor: clickable ? 'pointer' : 'default',
        padding: '2px 0',
        transition: 'opacity 150ms',
      }}
      onClick={() => {
        if (clickable && event.countryCode) {
          onClick!(event.countryCode);
        }
      }}
      onMouseEnter={(e) => {
        if (clickable) (e.currentTarget as HTMLElement).style.opacity = '0.7';
      }}
      onMouseLeave={(e) => {
        if (clickable) (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: '12px' }}>{config.icon}</span>

      {/* Type tag */}
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: config.color,
          fontWeight: 700,
          letterSpacing: '1px',
          padding: '1px 5px',
          border: `1px solid ${config.color}40`,
          borderRadius: '2px',
        }}
      >
        {config.tag}
      </span>

      {/* Message */}
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: '11px',
          color: SK.textPrimary,
          fontWeight: 500,
        }}
      >
        {event.message}
      </span>

      {/* Time */}
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: SK.textMuted,
          fontWeight: 600,
          letterSpacing: '1px',
        }}
      >
        {formatTimeAgo(event.timestamp)}
      </span>

      {/* Separator */}
      <span style={{ color: SK.textMuted, opacity: 0.2, fontSize: '10px' }}>|</span>
    </span>
  );
}

// ─── Main Component ───

export function EventTicker({ events: externalEvents, onEventClick }: EventTickerProps) {
  const [internalEvents, setInternalEvents] = useState<GlobalEventItem[]>([]);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Determine event source
  const allEvents = externalEvents && externalEvents.length > 0 ? externalEvents : internalEvents;

  // Init demo events if no external events
  useEffect(() => {
    if (!externalEvents || externalEvents.length === 0) {
      setInternalEvents(generateDemoEvents());
    }
  }, [externalEvents]);

  // Ticker scroll animation
  useEffect(() => {
    if (!tickerRef.current || allEvents.length === 0) return;

    const el = tickerRef.current;
    let animFrame: number;
    let offset = 0;
    const speed = 0.4; // px per frame

    const animate = () => {
      offset += speed;
      if (offset >= el.scrollWidth / 2) {
        offset = 0;
      }
      el.style.transform = `translateX(-${offset}px)`;
      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [allEvents]);

  return (
    <div
      style={{
        width: '100%',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(to bottom, rgba(9,9,11,0.6) 0%, rgba(9,9,11,0.3) 100%)',
        borderBottom: `1px solid ${SK.borderDark}`,
        pointerEvents: 'auto',
      }}
    >
      {/* LIVE indicator */}
      <div
        style={{
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          borderRight: `1px solid ${SK.borderDark}`,
          height: '100%',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#EF4444',
            animation: 'eventTickerPulse 1.5s infinite',
          }}
        />
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: '#EF4444',
            fontWeight: 700,
            letterSpacing: '1.5px',
          }}
        >
          LIVE
        </span>
      </div>

      {/* Scrolling ticker */}
      <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div ref={tickerRef} style={{ display: 'inline-block' }}>
          {/* Duplicate for infinite scroll */}
          {[...allEvents, ...allEvents].map((event, i) => (
            <TickerEventItem
              key={`${event.id}-${i}`}
              event={event}
              onClick={onEventClick}
            />
          ))}
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes eventTickerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
