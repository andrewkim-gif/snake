'use client';

/**
 * v26 Phase 1+4 — IsoCanvas
 * PixiJS 8 기반 아이소메트릭 캔버스 (Next.js dynamic import, ssr: false)
 *
 * - PixiJS Application 생성/파괴 lifecycle
 * - 마우스/휠/키보드 입력 처리
 * - 카메라 팬/줌 컨트롤
 * - Phase 4: 경제 UI + 생산 시각화 오버레이 통합
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Application } from 'pixi.js';
import { IsoTilemap } from './IsoTilemap';
import { IsoCitizenLayer } from './IsoCitizenLayer';
import {
  BUILDING_DEFS,
  TILE_DEFS,
  type MapTier,
} from './types';
import type { CitizenSnapshot, Building } from '@agent-survivor/shared/types/city';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { useCityStore } from '@/stores/cityStore';
import { preloadIsoTextures } from '@/lib/iso-texture-loader';

// Phase 4+5 UI 컴포넌트
import { ResourceHUD } from './ui/ResourceHUD';
import { BuildingInfoPanel } from './ui/BuildingInfoPanel';
import { ConstructionPanel } from './ui/ConstructionPanel';
import { EconomyDashboard } from './ui/EconomyDashboard';
import { ProductionChainOverlay } from './ui/ProductionChainOverlay';
import { PoliticsPanel } from './ui/PoliticsPanel';
import { ElectionPanel } from './ui/ElectionPanel';

// ─── Props ───

interface IsoCanvasProps {
  /** 국가 ISO3 코드 */
  countryIso3: string;
  /** 국가 이름 */
  countryName: string;
  /** 맵 크기 tier */
  mapTier?: MapTier;
  /** Globe 복귀 콜백 */
  onBackToGlobe: () => void;
  /** 시민 스냅샷 (city_state에서 2Hz로 수신) */
  citizens?: CitizenSnapshot[];
}

export function IsoCanvas({
  countryIso3,
  countryName,
  mapTier = 'C',
  onBackToGlobe,
  citizens,
}: IsoCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const tilemapRef = useRef<IsoTilemap | null>(null);
  const citizenLayerRef = useRef<IsoCitizenLayer | null>(null);
  const [placingDefId, setPlacingDefId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ tileX: number; tileY: number; tileType: string } | null>(null);

  // Phase 4: Zustand store 바인딩
  const selectedBuildingId = useCityStore(s => s.selectedBuildingId);
  const selectBuilding = useCityStore(s => s.selectBuilding);
  const showEconomyDashboard = useCityStore(s => s.showEconomyDashboard);
  const toggleEconomyDashboard = useCityStore(s => s.toggleEconomyDashboard);
  const showConstructionPanel = useCityStore(s => s.showConstructionPanel);
  const toggleConstructionPanel = useCityStore(s => s.toggleConstructionPanel);
  const showProductionChain = useCityStore(s => s.showProductionChain);
  const toggleProductionChain = useCityStore(s => s.toggleProductionChain);
  const serverBuildings = useCityStore(s => s.serverBuildings);
  const showPoliticsPanel = useCityStore(s => s.showPoliticsPanel);
  const togglePoliticsPanel = useCityStore(s => s.togglePoliticsPanel);
  const showElectionPanel = useCityStore(s => s.showElectionPanel);
  const toggleElectionPanel = useCityStore(s => s.toggleElectionPanel);
  const electionPhase = useCityStore(s => s.election?.phase ?? 'none');

  // 선택된 건물 인스턴스 조회
  const selectedBuilding: Building | null = selectedBuildingId
    ? serverBuildings.find(b => b.id === selectedBuildingId) ?? null
    : null;

  // 마우스 드래그 상태
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });

  // ─── PixiJS 초기화 ───
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    let destroyed = false;
    const app = new Application();

    const init = async () => {
      await app.init({
        background: 0x1a1a2e,
        resizeTo: container,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
        preference: 'webgl',
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);
      appRef.current = app;

      // 타일맵 생성
      const seed = countryIso3.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const tilemap = new IsoTilemap(mapTier, seed);
      tilemapRef.current = tilemap;
      app.stage.addChild(tilemap.container);

      // 시민 레이어 생성
      const citizenLayer = new IsoCitizenLayer();
      citizenLayerRef.current = citizenLayer;
      tilemap.container.addChild(citizenLayer.container);

      // 초기 카메라 적용
      tilemap.applyCamera(app.screen.width, app.screen.height);

      // Phase 7: 텍스처 프리로드 → 성공 시 타일맵 재렌더
      preloadIsoTextures().then((success) => {
        if (success && !destroyed && tilemapRef.current) {
          console.log('[IsoCanvas] Textures loaded, re-rendering tilemap with sprites');
          tilemapRef.current.renderTiles();
        }
      }).catch(() => {
        // 텍스처 로드 실패 시 기존 Graphics 유지 (이미 렌더됨)
      });

      // 게임 루프: 카메라 + 시민 보간 업데이트
      app.ticker.add(() => {
        if (tilemapRef.current) {
          tilemapRef.current.applyCamera(app.screen.width, app.screen.height);
        }
        if (citizenLayerRef.current) {
          citizenLayerRef.current.tick();
        }
      });
    };

    init().catch(console.error);

    return () => {
      destroyed = true;
      if (citizenLayerRef.current) {
        citizenLayerRef.current.destroy();
        citizenLayerRef.current = null;
      }
      if (tilemapRef.current) {
        tilemapRef.current.destroy();
        tilemapRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [countryIso3, mapTier]);

  // ─── 시민 스냅샷 업데이트 (2Hz) ───
  useEffect(() => {
    if (citizenLayerRef.current && citizens && citizens.length > 0) {
      citizenLayerRef.current.updateFromSnapshot(citizens);
    }
  }, [citizens]);

  // ─── 마우스 이벤트 핸들러 ───

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const tilemap = tilemapRef.current;
    const app = appRef.current;
    if (!tilemap || !app) return;

    // 드래그 → 팬
    if (dragRef.current.dragging) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      tilemap.pan(-dx, -dy);
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    // 호버 업데이트
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const tile = tilemap.screenToTileCoord(screenX, screenY, app.screen.width, app.screen.height);
    tilemap.updateHover(tile.tileX, tile.tileY);

    // 호버 정보 업데이트
    const tileType = tilemap.getTileType(tile.tileX, tile.tileY);
    if (tileType) {
      setHoverInfo({
        tileX: tile.tileX,
        tileY: tile.tileY,
        tileType: TILE_DEFS[tileType].label,
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const tilemap = tilemapRef.current;
    const app = appRef.current;
    if (!tilemap || !app) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const tile = tilemap.screenToTileCoord(screenX, screenY, app.screen.width, app.screen.height);

    const result = tilemap.handleClick(tile.tileX, tile.tileY);
    if (result?.action === 'placed') {
      // 건물 배치 완료 (연속 배치 모드 유지)
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const tilemap = tilemapRef.current;
    const app = appRef.current;
    if (!tilemap || !app) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // 스크린→월드 변환 후 줌 중심점 계산
    const worldX = (screenX - app.screen.width / 2) / tilemap.camera.zoom + tilemap.camera.x;
    const worldY = (screenY - app.screen.height / 2) / tilemap.camera.zoom + tilemap.camera.y;

    const delta = e.deltaY > 0 ? -1 : 1;
    tilemap.zoom(delta, worldX, worldY);
  }, []);

  // ─── 건물 선택 (Phase 1 팔레트 배치 모드) ───

  const handleSelectPlacingBuilding = useCallback((defId: string) => {
    const tilemap = tilemapRef.current;
    if (!tilemap) return;

    if (placingDefId === defId) {
      tilemap.cancelPlacing();
      setPlacingDefId(null);
    } else {
      tilemap.startPlacing(defId);
      setPlacingDefId(defId);
    }
  }, [placingDefId]);

  // ─── Phase 4: 건설 패널에서 건물 선택 → 배치 모드 ───
  const handleConstructionSelect = useCallback((defId: string) => {
    const tilemap = tilemapRef.current;
    if (!tilemap) return;

    if (placingDefId === defId) {
      tilemap.cancelPlacing();
      setPlacingDefId(null);
    } else {
      tilemap.startPlacing(defId);
      setPlacingDefId(defId);
    }
  }, [placingDefId]);

  // ─── ESC 키 → 배치 취소 / 패널 닫기 / Globe 복귀 ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 1순위: 배치 모드 취소
        const tilemap = tilemapRef.current;
        if (tilemap?.getPlacingBuilding()) {
          tilemap.cancelPlacing();
          setPlacingDefId(null);
          return;
        }
        // 2순위: 선거 패널 닫기
        if (showElectionPanel) {
          toggleElectionPanel();
          return;
        }
        // 3순위: 정치 패널 닫기
        if (showPoliticsPanel) {
          togglePoliticsPanel();
          return;
        }
        // 3순위: 경제 대시보드 닫기
        if (showEconomyDashboard) {
          toggleEconomyDashboard();
          return;
        }
        // 4순위: 건물 정보 패널 닫기
        if (selectedBuildingId) {
          selectBuilding(null);
          return;
        }
        // 4순위: 건설 패널 닫기
        if (showConstructionPanel) {
          toggleConstructionPanel();
          return;
        }
        // 5순위: Globe 복귀
        onBackToGlobe();
      }

      // 단축키: E = Economy, B = Build, P = Politics
      if (e.key === 'e' || e.key === 'E') {
        toggleEconomyDashboard();
      }
      if (e.key === 'b' || e.key === 'B') {
        toggleConstructionPanel();
      }
      if (e.key === 'p' || e.key === 'P') {
        togglePoliticsPanel();
      }
      if (e.key === 'v' || e.key === 'V') {
        toggleElectionPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToGlobe, showEconomyDashboard, selectedBuildingId, showConstructionPanel, showPoliticsPanel, showElectionPanel, toggleEconomyDashboard, selectBuilding, toggleConstructionPanel, togglePoliticsPanel, toggleElectionPanel]);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#1a1a2e',
    }}>
      {/* PixiJS Canvas 마운트 영역 */}
      <div
        ref={canvasContainerRef}
        style={{ width: '100%', height: '100%', cursor: dragRef.current.dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* ──── 상단 바: 국가 이름 + 툴바 ──── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'linear-gradient(180deg, rgba(9,9,11,0.95) 0%, rgba(9,9,11,0) 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
          <button
            onClick={onBackToGlobe}
            style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              fontWeight: 600,
              color: SK.textSecondary,
              backgroundColor: 'rgba(9,9,11,0.88)',
              border: `1px solid ${SK.glassBorder}`,
              borderRadius: 0,
              padding: '6px 12px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            BACK TO GLOBE
          </button>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '1px',
          }}>
            {countryName} ({countryIso3})
          </span>
        </div>

        {/* 우측: 도구 버튼 + 호버 정보 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {/* 건설 패널 토글 */}
          <button
            onClick={toggleConstructionPanel}
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: showConstructionPanel ? SK.gold : SK.textSecondary,
              backgroundColor: showConstructionPanel ? 'rgba(245, 158, 11, 0.12)' : 'rgba(9,9,11,0.88)',
              border: `1px solid ${showConstructionPanel ? 'rgba(245, 158, 11, 0.25)' : SK.glassBorder}`,
              borderRadius: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            BUILD [B]
          </button>
          {/* 경제 대시보드 토글 */}
          <button
            onClick={toggleEconomyDashboard}
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: showEconomyDashboard ? SK.gold : SK.textSecondary,
              backgroundColor: showEconomyDashboard ? 'rgba(245, 158, 11, 0.12)' : 'rgba(9,9,11,0.88)',
              border: `1px solid ${showEconomyDashboard ? 'rgba(245, 158, 11, 0.25)' : SK.glassBorder}`,
              borderRadius: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            ECONOMY [E]
          </button>
          {/* 정치 패널 토글 */}
          <button
            onClick={togglePoliticsPanel}
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: showPoliticsPanel ? SK.accent : SK.textSecondary,
              backgroundColor: showPoliticsPanel ? 'rgba(239, 68, 68, 0.12)' : 'rgba(9,9,11,0.88)',
              border: `1px solid ${showPoliticsPanel ? 'rgba(239, 68, 68, 0.25)' : SK.glassBorder}`,
              borderRadius: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            POLITICS [P]
          </button>
          {/* 선거 패널 토글 */}
          <button
            onClick={toggleElectionPanel}
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: showElectionPanel
                ? '#10B981'
                : electionPhase !== 'none'
                  ? '#F59E0B'
                  : SK.textSecondary,
              backgroundColor: showElectionPanel
                ? 'rgba(16, 185, 129, 0.12)'
                : electionPhase !== 'none'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(9,9,11,0.88)',
              border: `1px solid ${showElectionPanel
                ? 'rgba(16, 185, 129, 0.25)'
                : electionPhase !== 'none'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : SK.glassBorder}`,
              borderRadius: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {electionPhase !== 'none' ? `VOTE [V]` : 'ELECTION [V]'}
          </button>

          {/* 호버 타일 정보 */}
          {hoverInfo && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              pointerEvents: 'none',
            }}>
              [{hoverInfo.tileX}, {hoverInfo.tileY}] {hoverInfo.tileType}
            </span>
          )}
        </div>
      </div>

      {/* ──── Phase 6: 선거 배너 알림 ──── */}
      {electionPhase !== 'none' && !showElectionPanel && (
        <div
          onClick={toggleElectionPanel}
          style={{
            position: 'absolute',
            top: '52px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            background: electionPhase === 'voting'
              ? 'rgba(16, 185, 129, 0.15)'
              : electionPhase === 'results'
                ? 'rgba(59, 130, 246, 0.15)'
                : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${electionPhase === 'voting'
              ? 'rgba(16, 185, 129, 0.3)'
              : electionPhase === 'results'
                ? 'rgba(59, 130, 246, 0.3)'
                : 'rgba(245, 158, 11, 0.3)'}`,
            cursor: 'pointer',
            zIndex: 15,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 700,
            color: electionPhase === 'voting'
              ? '#10B981'
              : electionPhase === 'results'
                ? '#3B82F6'
                : '#F59E0B',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {electionPhase === 'campaign' && 'ELECTION: Campaign Period — Click to view candidates'}
            {electionPhase === 'voting' && 'ELECTION: Voting in Progress — Click to cast your vote'}
            {electionPhase === 'results' && 'ELECTION: Results Announced — Click to view'}
          </span>
        </div>
      )}

      {/* ──── Phase 4: 자원 HUD ──── */}
      <ResourceHUD />

      {/* ──── Phase 4: 건설 패널 (좌측) ──── */}
      {showConstructionPanel && (
        <ConstructionPanel
          onClose={toggleConstructionPanel}
          onSelectBuilding={handleConstructionSelect}
          selectedDefId={placingDefId}
        />
      )}

      {/* ──── Phase 4: 건물 정보 패널 (우측) ──── */}
      {selectedBuilding && (
        <BuildingInfoPanel
          building={selectedBuilding}
          onClose={() => selectBuilding(null)}
          onUpgrade={(id) => {
            // Phase 5+: city_command { type: 'upgrade', buildingId: id } 전송
            console.log('[IsoCanvas] upgrade building:', id);
          }}
          onToggle={(id) => {
            // Phase 5+: city_command { type: 'toggle', buildingId: id } 전송
            console.log('[IsoCanvas] toggle building:', id);
          }}
          onDemolish={(id) => {
            // Phase 5+: city_command { type: 'demolish', buildingId: id } 전송
            console.log('[IsoCanvas] demolish building:', id);
          }}
        />
      )}

      {/* ──── Phase 4: 생산 체인 오버레이 (하단) ──── */}
      {showProductionChain && selectedBuilding && (
        <ProductionChainOverlay
          building={selectedBuilding}
          onClose={toggleProductionChain}
        />
      )}

      {/* ──── Phase 4: 경제 대시보드 (중앙 모달) ──── */}
      {showEconomyDashboard && (
        <EconomyDashboard
          onClose={toggleEconomyDashboard}
        />
      )}

      {/* ──── Phase 5: 정치 패널 (중앙 모달) ──── */}
      {showPoliticsPanel && (
        <PoliticsPanel
          onClose={togglePoliticsPanel}
          onIssueEdict={(edictId) => {
            console.log('[IsoCanvas] issue edict:', edictId);
            // city_command { type: 'issue_edict', edictId } 전송
          }}
          onRevokeEdict={(edictId) => {
            console.log('[IsoCanvas] revoke edict:', edictId);
            // city_command { type: 'revoke_edict', edictId } 전송
          }}
        />
      )}

      {/* ──── Phase 6: 선거 패널 (중앙 모달) ──── */}
      {showElectionPanel && (
        <ElectionPanel
          onClose={toggleElectionPanel}
          onVote={(candidateId) => {
            console.log('[IsoCanvas] vote for candidate:', candidateId);
            // city_command { type: 'vote', candidateId } 전송
          }}
        />
      )}

      {/* ──── 하단: 건물 팔레트 (Phase 1 — 건설 패널이 열리지 않은 경우만 표시) ──── */}
      {!showConstructionPanel && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(9,9,11,0.92)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${SK.glassBorder}`,
          borderRadius: 0,
          zIndex: 10,
        }}>
          {BUILDING_DEFS.map((def) => (
            <button
              key={def.id}
              onClick={() => handleSelectPlacingBuilding(def.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                backgroundColor: placingDefId === def.id
                  ? 'rgba(204, 153, 51, 0.3)'
                  : 'rgba(255,255,255,0.05)',
                border: placingDefId === def.id
                  ? '1px solid #CC9933'
                  : `1px solid ${SK.glassBorder}`,
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                minWidth: '64px',
              }}
            >
              {/* 프로시저럴 건물 아이콘 (색상 박스) */}
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: `#${def.color.toString(16).padStart(6, '0')}`,
                border: `2px solid #${def.roofColor.toString(16).padStart(6, '0')}`,
              }} />
              <span style={{
                fontFamily: bodyFont,
                fontSize: '9px',
                color: placingDefId === def.id ? '#CC9933' : SK.textSecondary,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                {def.name}
              </span>
              <span style={{
                fontFamily: bodyFont,
                fontSize: '8px',
                color: SK.textMuted,
              }}>
                {def.sizeW}x{def.sizeH}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
