'use client';

/**
 * v26 Phase 1 — IsoCanvas
 * PixiJS 8 기반 아이소메트릭 캔버스 (Next.js dynamic import, ssr: false)
 *
 * - PixiJS Application 생성/파괴 lifecycle
 * - 마우스/휠/키보드 입력 처리
 * - 카메라 팬/줌 컨트롤
 * - 건물 배치 UI (팔레트 + 클릭)
 * - Globe 복귀 버튼
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Application } from 'pixi.js';
import { IsoTilemap } from './IsoTilemap';
import {
  BUILDING_DEFS,
  TILE_DEFS,
  type MapTier,
  type BuildingDef,
  type TileCoord,
} from './types';
import { SK, bodyFont } from '@/lib/sketch-ui';

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
}

export function IsoCanvas({
  countryIso3,
  countryName,
  mapTier = 'C',
  onBackToGlobe,
}: IsoCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const tilemapRef = useRef<IsoTilemap | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ tileX: number; tileY: number; tileType: string } | null>(null);

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

      // 초기 카메라 적용
      tilemap.applyCamera(app.screen.width, app.screen.height);

      // 게임 루프: 카메라 업데이트
      app.ticker.add(() => {
        if (tilemapRef.current) {
          tilemapRef.current.applyCamera(app.screen.width, app.screen.height);
        }
      });
    };

    init().catch(console.error);

    return () => {
      destroyed = true;
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

  // ─── 건물 선택 ───

  const handleSelectBuilding = useCallback((defId: string) => {
    const tilemap = tilemapRef.current;
    if (!tilemap) return;

    if (selectedBuilding === defId) {
      // 동일 건물 재클릭 → 배치 모드 취소
      tilemap.cancelPlacing();
      setSelectedBuilding(null);
    } else {
      tilemap.startPlacing(defId);
      setSelectedBuilding(defId);
    }
  }, [selectedBuilding]);

  // ─── ESC 키 → 배치 취소 또는 Globe 복귀 ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const tilemap = tilemapRef.current;
        if (tilemap?.getPlacingBuilding()) {
          tilemap.cancelPlacing();
          setSelectedBuilding(null);
        } else {
          onBackToGlobe();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToGlobe]);

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

      {/* 상단 바: 국가 이름 + Back to Globe */}
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

      {/* 하단: 건물 팔레트 */}
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
            onClick={() => handleSelectBuilding(def.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              backgroundColor: selectedBuilding === def.id
                ? 'rgba(204, 153, 51, 0.3)'
                : 'rgba(255,255,255,0.05)',
              border: selectedBuilding === def.id
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
              color: selectedBuilding === def.id ? '#CC9933' : SK.textSecondary,
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
    </div>
  );
}
