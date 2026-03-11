'use client';

/**
 * CountryWidePanel — v40 국가 와이드 패널 (2-column 레이아웃)
 *
 * 글로브에서 국가를 클릭하면 표시되는 와이드 패널.
 * 좌측 400px: 국가 헤더, 핵심 통계 4종, 자원 바
 * 우측 500px: CountryRegionMap (SVG 타일 기반 지역 지도)
 *
 * 기존 CountryPanel(520px 세로)과 RegionSelector(380px 사이드)를
 * 하나의 900px 와이드 패널로 통합하여 UX 단축.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import { SK, SKFont, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { OVERLAY, overlayPanelStyle, KEYFRAMES_FADE_IN } from '@/lib/overlay-tokens';
import { tierColors, resourceLabels, resourceIcons } from '@/lib/map-style';
import type { CountryClientState } from '@/lib/globe-data';
import { useMatrixSocket, type RegionListEntry, type RegionListResponse, type RegionJoinedPayload } from '@/hooks/useMatrixSocket';
import CountryRegionMap from './CountryRegionMap';

// ─── 모바일 판별 훅 ───
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

// ─── Props ───────────────────────────────────────────────

interface CountryWidePanelProps {
  /** 국가 상태 데이터 (글로브에서 전달) */
  country: CountryClientState | null;
  /** 패널 열림/닫힘 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 지역 선택 완료 콜백 (regionId 전달 → matrix 모드 진입) */
  onRegionSelect: (regionId: string) => void;
  /** 뒤로가기 (로비 복귀) */
  onBack: () => void;
  /** 국가 ISO3 코드 */
  countryCode: string;
  /** 국가 이름 */
  countryName: string;
}

// ─── 자원 아이콘 매핑 (이모지) ───

const RESOURCE_EMOJI: Record<string, string> = {
  oil: '🛢️',
  minerals: '💎',
  food: '🌽',
  tech: '💻',
  manpower: '👥',
};

// ─── 자원 바 색상 ───

const RESOURCE_COLORS: Record<string, string> = {
  oil: '#F59E0B',
  minerals: '#6366F1',
  food: '#10B981',
  tech: '#3B82F6',
  manpower: '#EF4444',
};

// ─── 통계 포맷터 ───

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── 핵심 통계 카드 ───

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: SK.cardBg,
      border: `1px solid ${SK.border}`,
      padding: '10px 12px',
      clipPath: apexClip.sm,
      flex: '1 1 0',
      minWidth: '80px',
    }}>
      <div style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textMuted,
        letterSpacing: '0.5px',
        marginBottom: '4px',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: headingFont,
        fontSize: SKFont.h3,
        color,
        fontWeight: 700,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── 자원 바 아이템 ───

function ResourceBar({ name, value, maxValue }: { name: string; value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  const emoji = RESOURCE_EMOJI[name] ?? '📦';
  const color = RESOURCE_COLORS[name] ?? SK.textSecondary;
  const label = resourceLabels[name] ?? name;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{emoji}</span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textSecondary,
        width: '40px',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {/* 바 배경 */}
      <div style={{
        flex: 1,
        height: '6px',
        background: 'rgba(255,255,255,0.04)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          background: color,
          transition: 'width 300ms ease',
        }} />
      </div>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textMuted,
        width: '32px',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── CountryWidePanel 메인 ───

export default function CountryWidePanel({
  country,
  open,
  onClose,
  onRegionSelect,
  onBack,
  countryCode,
  countryName,
}: CountryWidePanelProps) {
  // 모바일 감지
  const isMobile = useIsMobile();

  // 표시 상태 (애니메이션용)
  const [visible, setVisible] = useState(false);

  // 소켓 상태: 지역 목록
  const [regions, setRegions] = useState<RegionListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  // 서버 URL
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9000';

  // ─── 소켓 연결 (RegionSelector 패턴 재사용) ───

  const { connect, disconnect, requestRegionList, joinRegion, connectionState } = useMatrixSocket({
    onRegionList: useCallback((data: RegionListResponse) => {
      if (data.countryCode === countryCode) {
        setRegions(data.regions);
        setLoading(false);
      }
    }, [countryCode]),
    onRegionJoined: useCallback((data: RegionJoinedPayload) => {
      setJoining(null);
      if (data.success) {
        onRegionSelect(data.regionId);
      }
    }, [onRegionSelect]),
    onRegionState: useCallback((data: RegionListEntry[]) => {
      // 실시간 지역 상태 업데이트 (접속 인원 등)
      setRegions(data);
    }, []),
  });

  // 마운트 시 소켓 연결
  const connectedRef = useRef(false);
  useEffect(() => {
    if (open && !connectedRef.current) {
      connectedRef.current = true;
      connect(serverUrl);
    }
    return () => {
      if (connectedRef.current) {
        disconnect();
        connectedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 연결 완료 후 지역 목록 요청
  useEffect(() => {
    if (connectionState === 'connected' && countryCode) {
      setLoading(true);
      requestRegionList(countryCode);
    }
  }, [connectionState, countryCode, requestRegionList]);

  // 열림/닫힘 애니메이션
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // 지역 클릭 핸들러
  const handleSelectRegion = useCallback((regionId: string) => {
    setJoining(regionId);
    joinRegion(countryCode, regionId);
  }, [countryCode, joinRegion]);

  // 자원 최대값 계산 (바 비율용)
  const maxResource = useMemo(() => {
    if (!country) return 100;
    const vals = Object.values(country.resources);
    return Math.max(...vals, 1);
  }, [country]);

  // 티어 컬러
  const tColor = country ? (tierColors as Record<string, string>)[country.tier] ?? SK.textSecondary : SK.textSecondary;

  if (!open) return null;

  return (
    <>
      <style>{KEYFRAMES_FADE_IN}</style>
      {/* 배경 딤 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 99,
          opacity: visible ? 1 : 0,
          transition: `opacity ${OVERLAY.transition}`,
        }}
      />

      {/* 메인 패널 — 모바일: 풀스크린, 데스크탑: 900px 중앙 팝업 */}
      <div style={{
        ...overlayPanelStyle(),
        position: 'fixed',
        zIndex: 100,
        padding: '0',
        overflowY: 'auto',
        ...(isMobile
          ? {
              // 모바일: 풀스크린 바텀시트
              left: 0,
              right: 0,
              bottom: 0,
              top: '40px',
              borderTop: `1px solid ${SK.accentBorder}`,
              transform: visible ? 'translateY(0)' : 'translateY(100%)',
              opacity: 1,
            }
          : {
              // 데스크탑: 900px 중앙 팝업
              left: '50%',
              top: '50%',
              width: '900px',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 80px)',
              transform: visible
                ? 'translate(-50%, -50%) scale(1)'
                : 'translate(-50%, -50%) scale(0.96)',
              opacity: visible ? 1 : 0,
            }),
        transition: `all ${OVERLAY.transition}`,
      }}>
        {/* ── 상단 헤더 바 ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: `1px solid ${SK.border}`,
          background: 'rgba(0,0,0,0.3)',
        }}>
          {/* 뒤로가기 + 국가명 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: `1px solid ${SK.border}`,
                color: SK.textSecondary,
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: `all ${OVERLAY.transition}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = SK.textPrimary;
                e.currentTarget.style.borderColor = SK.accentBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = SK.textSecondary;
                e.currentTarget.style.borderColor = SK.border;
              }}
            >
              {'<'} BACK
            </button>

            <div>
              <div style={{
                fontFamily: headingFont,
                fontSize: SKFont.h2,
                color: SK.textPrimary,
                letterSpacing: '1px',
              }}>
                {countryName}
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textSecondary,
                letterSpacing: '0.5px',
              }}>
                SELECT A REGION TO ENTER
              </div>
            </div>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: `1px solid ${SK.border}`,
              color: SK.textSecondary,
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: `all ${OVERLAY.transition}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = SK.accent;
              e.currentTarget.style.borderColor = SK.accentBorder;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = SK.textSecondary;
              e.currentTarget.style.borderColor = SK.border;
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 악센트 라인 */}
        <div style={{
          height: '1px',
          background: `linear-gradient(to right, ${SK.accent}, transparent)`,
        }} />

        {/* ── 2-column 본문 (모바일: 상하 스택) ── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          minHeight: isMobile ? 'auto' : '440px',
        }}>
          {/* ── 좌측: 국가 정보 (데스크탑 400px / 모바일 100%) ── */}
          <div style={{
            width: isMobile ? '100%' : '400px',
            minWidth: isMobile ? 'auto' : '320px',
            padding: isMobile ? '16px' : '20px',
            borderRight: isMobile ? 'none' : `1px solid ${SK.border}`,
            borderBottom: isMobile ? `1px solid ${SK.border}` : 'none',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '12px' : '16px',
          }}>
            {/* 국가 헤더: 이름 + 티어 뱃지 + 주권 팩션 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                {/* 티어 뱃지 */}
                <span style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.body,
                  color: tColor,
                  background: `${tColor}15`,
                  border: `1px solid ${tColor}40`,
                  padding: '2px 10px',
                  letterSpacing: '2px',
                  fontWeight: 700,
                }}>
                  TIER {country?.tier ?? '-'}
                </span>
                {/* 대륙 */}
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textMuted,
                }}>
                  {country?.continent ?? ''}
                </span>
              </div>
              {/* 주권 팩션 */}
              {country?.sovereignFaction && (
                <div style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: SK.accent,
                  }} />
                  Sovereign: {country.sovereignFaction}
                  <span style={{ color: SK.textMuted, marginLeft: '4px' }}>
                    Lv.{country.sovereigntyLevel}
                  </span>
                </div>
              )}
            </div>

            {/* 핵심 통계 4종 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}>
              <StatCard
                label="GDP"
                value={country ? formatNumber(country.gdp) : '-'}
                color={SK.gold}
              />
              <StatCard
                label="Population"
                value={country ? formatNumber(country.population) : '-'}
                color={SK.blue}
              />
              <StatCard
                label="Military"
                value={country ? `${country.activeAgents}/${country.maxAgents}` : '-'}
                color={SK.accent}
              />
              <StatCard
                label="Sovereignty"
                value={country ? `Lv.${country.sovereigntyLevel}` : '-'}
                color={SK.green}
              />
            </div>

            {/* 자원 바 */}
            <div>
              <div style={{
                fontFamily: headingFont,
                fontSize: SKFont.sm,
                color: SK.textSecondary,
                letterSpacing: '1px',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}>
                Resources
              </div>
              {country && Object.entries(country.resources).map(([key, val]) => (
                <ResourceBar
                  key={key}
                  name={key}
                  value={val}
                  maxValue={maxResource}
                />
              ))}
              {!country && (
                <div style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textMuted,
                  padding: '12px 0',
                }}>
                  No data available
                </div>
              )}
            </div>

            {/* 수도 + 지형 정보 */}
            {country && (
              <div style={{
                display: 'flex',
                gap: '16px',
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textMuted,
                borderTop: `1px solid ${SK.border}`,
                paddingTop: '12px',
              }}>
                <span>Capital: <span style={{ color: SK.textSecondary }}>{country.capitalName}</span></span>
                <span>Terrain: <span style={{ color: SK.textSecondary }}>{country.terrainTheme}</span></span>
              </div>
            )}
          </div>

          {/* ── 우측: 지역 지도 (데스크탑 500px / 모바일 100%) ── */}
          <div style={{
            flex: 1,
            minWidth: isMobile ? 'auto' : '300px',
            padding: isMobile ? '16px' : '20px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* 지역 맵 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <div style={{
                fontFamily: headingFont,
                fontSize: SKFont.sm,
                color: SK.textSecondary,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>
                Regions
              </div>
              {/* 연결 상태 인디케이터 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: connectionState === 'connected' ? SK.green : SK.textMuted,
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: connectionState === 'connected' ? SK.green : SK.textMuted,
                }} />
                {connectionState === 'connected' ? 'LIVE' : connectionState === 'connecting' ? 'CONNECTING...' : 'OFFLINE'}
              </div>
            </div>

            {/* CountryRegionMap (SVG 기반 지역 지도) */}
            <div style={{ flex: 1, minHeight: '360px' }}>
              <CountryRegionMap
                regions={regions}
                loading={loading || connectionState !== 'connected'}
                joining={joining}
                onSelectRegion={handleSelectRegion}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
