/**
 * hooks/useTileMap.ts - 이소메트릭 타일맵 렌더링 훅
 *
 * v7.2: Object + StreetLamp 스프라이트 시스템
 * - Simplex Noise 기반 구역 생성
 * - Object1-28 + StreetLamp 1-2 스프라이트 사용
 * - 바이옴별 적절한 스프라이트 자동 선택
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  loadAllGroundTiles,
  areTilesLoaded,
  getGroundTile,
  TILE_IMG_WIDTH,
  TILE_IMG_HEIGHT,
  TILE_DIAMOND_HEIGHT,
  // v6.8: 새 타일 시스템
  loadAllNewTiles,
  areNewTilesLoaded,
  drawNewTile,
  getNewTileSize,
  type TileDirection,
} from '../tiles';
import {
  loadAllObjectSprites,
  areObjectSpritesLoaded,
  getObjectSprite,
} from '../tiles/objectLoader';
import {
  getTileDecisionAt,
  getStageMapConfig,
  getObjectsInView,
  type StageMapConfig,
  type MapObject,
} from '../map';

export interface TileMapConfig {
  tileSize: number;  // 게임 그리드 크기 (32)
  stageId: number;
  gameMode?: 'stage' | 'singularity' | 'tutorial';
  seed?: number;     // 맵 시드 (같은 시드 = 같은 맵)
}

// v7.3: 깊이 정렬용 오브젝트 정보
export interface VisibleObject {
  sprite: HTMLImageElement;
  screenX: number;
  screenY: number;
  renderWidth: number;
  renderHeight: number;
  worldX: number;  // 깊이 정렬용 월드 X좌표
  worldY: number;  // 깊이 정렬용 월드 Y좌표
  depth: number;   // 이소메트릭 깊이 (x + y)
  zIndex: number;
  // v7.17 DEBUG: 충돌 박스 정보
  hasCollision?: boolean;
  collisionWidth?: number;
  collisionHeight?: number;
}

export interface TileMapRenderer {
  isLoaded: boolean;
  drawTiles: (
    ctx: CanvasRenderingContext2D,
    playerX: number,
    playerY: number,
    canvasWidth: number,
    canvasHeight: number,
    zoom?: number
  ) => void;
  drawObjects: (
    ctx: CanvasRenderingContext2D,
    playerX: number,
    playerY: number,
    canvasWidth: number,
    canvasHeight: number,
    zoom?: number
  ) => void;
  // v7.3: 엔티티와 깊이 정렬을 위한 오브젝트 목록 반환
  getVisibleObjects: (
    playerX: number,
    playerY: number,
    canvasWidth: number,
    canvasHeight: number,
    zoom?: number
  ) => VisibleObject[];
}

/**
 * useTileMap - 바이옴 기반 이소메트릭 타일 렌더링 훅
 *
 * v7.0: Simplex Noise로 자연스러운 구역 생성
 * - 같은 타일 타입이 자연스럽게 뭉쳐서 배치
 * - 구역 경계에서 방향 자연스럽게 변화
 *
 * 이소메트릭 변환 공식 (GameCanvas의 ctx.transform과 동일):
 * - isoX = worldX - worldY
 * - isoY = (worldX + worldY) * 0.5
 */
export function useTileMap(config: TileMapConfig): TileMapRenderer {
  const { tileSize, stageId, gameMode, seed = 0 } = config;
  const loadAttemptedRef = useRef(false);
  const mapConfigRef = useRef<StageMapConfig>(getStageMapConfig(stageId, gameMode));

  // v7.3: useRef로 항상 최신 gameMode 참조 (closure 문제 해결)
  const gameModeRef = useRef(gameMode);
  const stageIdRef = useRef(stageId);
  const seedRef = useRef(seed);

  // 스테이지/모드 변경 시 ref 업데이트
  // NOTE: 이 useEffect는 gameMode 변경 시 즉시 실행되어야 함
  useEffect(() => {
    gameModeRef.current = gameMode;
    stageIdRef.current = stageId;
    seedRef.current = seed;
    mapConfigRef.current = getStageMapConfig(stageId, gameMode);
  }, [stageId, gameMode, seed]);

  // v7.3: 컴포넌트 마운트/언마운트 시점에서도 ref 동기화
  // (useEffect보다 먼저 실행되어 첫 렌더링에서도 올바른 값 보장)
  gameModeRef.current = gameMode;
  stageIdRef.current = stageId;
  seedRef.current = seed;

  // 타일 + 오브젝트 스프라이트 로드 (한 번만)
  useEffect(() => {
    if (loadAttemptedRef.current) return;
    loadAttemptedRef.current = true;

    Promise.all([
      loadAllGroundTiles(),
      loadAllObjectSprites(),
    ]).then(() => {
      console.log(`[useTileMap v7.2] Tiles: ${areTilesLoaded()}, Objects: ${areObjectSpritesLoaded()}`);
    });
  }, []);

  // 바이옴 기반 이소메트릭 타일 렌더링
  // v7.3: useRef로 항상 최신 gameMode 참조 (closure 문제 해결)
  const drawTiles = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      playerX: number,
      playerY: number,
      canvasWidth: number,
      canvasHeight: number,
      zoom: number = 1
    ): void => {
      // v7.3: ref에서 최신 값 읽기 (closure 문제 해결)
      const currentGameMode = gameModeRef.current;
      const currentStageId = stageIdRef.current;
      const currentSeed = seedRef.current;

      // 타일 미로드 시 기본 색상
      if (!areTilesLoaded()) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        return;
      }

      // 화면 중심
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // 타일 배치 간격 (원본 타일 크기에 맞춤)
      // 128px 타일 다이아몬드가 isometric에서 올바르게 겹치도록 배치
      // 32x32 world grid → 64x32 iso diamond → 128x64 tile diamond covers 2x2 cells
      const tileStep = tileSize * 2;  // 64 world units per tile

      // 이소메트릭 변환에서의 뷰 범위 계산
      const viewRadius = Math.max(canvasWidth, canvasHeight) / zoom;
      const gridRadius = Math.ceil(viewRadius / tileStep) + 3;

      // 플레이어 위치의 타일 그리드 좌표
      const playerGridX = Math.floor(playerX / tileStep);
      const playerGridY = Math.floor(playerY / tileStep);

      // 타일 렌더링 (back to front 정렬을 위해 row 우선)
      // 이소메트릭에서 뒤쪽 타일이 먼저 그려져야 함
      for (let row = playerGridY - gridRadius; row <= playerGridY + gridRadius; row++) {
        for (let col = playerGridX - gridRadius; col <= playerGridX + gridRadius; col++) {
          // 타일 중심의 월드 좌표
          const worldX = col * tileStep + tileStep / 2;
          const worldY = row * tileStep + tileStep / 2;

          // 플레이어 기준 상대 좌표
          const relX = worldX - playerX;
          const relY = worldY - playerY;

          // 이소메트릭 변환 (GameCanvas의 ctx.transform과 동일 로직)
          // ctx.transform(1, 0.5, -1, 0.5, 0, 0) → x' = x - y, y' = 0.5x + 0.5y
          const isoX = relX - relY;
          const isoY = (relX + relY) * 0.5;

          // 화면 좌표 (줌 적용)
          const screenX = centerX + isoX * zoom;
          const screenY = centerY + isoY * zoom;

          // 화면 밖 타일 스킵 (여유 마진 포함)
          const margin = TILE_IMG_HEIGHT * zoom;
          if (screenX < -margin || screenX > canvasWidth + margin ||
              screenY < -margin || screenY > canvasHeight + margin) {
            continue;
          }

          // v7.0: 바이옴 시스템으로 타일 타입/방향 결정
          // v7.3: ref에서 최신 gameMode 사용
          const tileDecision = getTileDecisionAt(
            worldX,
            worldY,
            currentStageId,
            currentGameMode,
            currentSeed + currentStageId * 1000  // 스테이지마다 다른 시드
          );

          const tile = getGroundTile(tileDecision.type, tileDecision.direction);

          // v6.2: 타일 원본 크기로 렌더링 (128x256)
          // 타일이 이소메트릭 다이아몬드이므로 자연스럽게 겹쳐서 배치됨
          const renderScale = zoom;  // 원본 크기 유지
          const renderWidth = TILE_IMG_WIDTH * renderScale;
          const renderHeight = TILE_IMG_HEIGHT * renderScale;

          // 타일 앵커 포인트 조정
          // 타일 이미지의 다이아몬드 중심이 screenX, screenY에 위치하도록
          // 다이아몬드는 이미지 하단에 위치 (높이 64px)
          const anchorOffsetX = renderWidth / 2;
          const anchorOffsetY = renderHeight - (TILE_DIAMOND_HEIGHT * renderScale / 2);

          const drawX = screenX - anchorOffsetX;
          const drawY = screenY - anchorOffsetY;

          if (tile && tile.complete) {
            ctx.drawImage(tile, drawX, drawY, renderWidth, renderHeight);
          } else {
            // Fallback: 바이옴 색상으로 다이아몬드 그리기
            ctx.fillStyle = '#1a1a2e';
            const halfW = tileSize * zoom;
            const halfH = tileSize * zoom * 0.5;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - halfH);
            ctx.lineTo(screenX + halfW, screenY);
            ctx.lineTo(screenX, screenY + halfH);
            ctx.lineTo(screenX - halfW, screenY);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    },
    [tileSize]  // v7.3: ref 사용으로 dependency 최소화
  );

  // v7.3: 스프라이트 기반 맵 오브젝트 렌더링 (이소메트릭 좌표 직접 계산)
  // 스프라이트가 이미 이소메트릭으로 렌더링되어 있으므로 ctx 변환 없이 화면 좌표 계산
  // v7.3: useRef로 항상 최신 gameMode 참조 (closure 문제 해결)
  const drawObjects = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      playerX: number,
      playerY: number,
      canvasWidth: number,
      canvasHeight: number,
      zoom: number = 1
    ): void => {
      // 스프라이트 미로드 시 스킵
      if (!areObjectSpritesLoaded()) return;

      // v7.3: ref에서 최신 값 읽기
      const currentGameMode = gameModeRef.current;
      const currentStageId = stageIdRef.current;
      const currentSeed = seedRef.current;

      // 화면 중심
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // 월드 좌표 기준 뷰 범위 (이소메트릭 변환 고려)
      const viewRadius = Math.max(canvasWidth, canvasHeight) / zoom;
      const cameraX = playerX - viewRadius;
      const cameraY = playerY - viewRadius;

      const objects = getObjectsInView(
        cameraX,
        cameraY,
        viewRadius * 2,
        viewRadius * 2,
        currentStageId,
        currentGameMode,
        currentSeed + currentStageId * 1000
      );

      // 이소메트릭 깊이 정렬 (y + x 기준으로 뒤에서 앞으로)
      objects.sort((a, b) => {
        const depthA = a.x + a.y;
        const depthB = b.x + b.y;
        if (Math.abs(depthA - depthB) > 10) return depthA - depthB;
        return a.def.zIndex - b.def.zIndex;
      });

      for (const obj of objects) {
        // 스프라이트 타입과 방향 가져오기
        const spriteObj = obj as MapObject & { spriteType?: string; direction?: string };
        const spriteType = spriteObj.spriteType || (obj.type as string);
        const direction = (spriteObj.direction || 'N') as 'N' | 'E' | 'S' | 'W';

        // 스프라이트 이미지 가져오기
        const sprite = getObjectSprite(spriteType, direction);

        if (sprite && sprite.complete) {
          // 플레이어 기준 상대 좌표
          const relX = obj.x - playerX;
          const relY = obj.y - playerY;

          // 이소메트릭 변환 (drawTiles와 동일 공식)
          // ctx.transform(1, 0.5, -1, 0.5, 0, 0) → x' = x - y, y' = 0.5x + 0.5y
          const isoX = relX - relY;
          const isoY = (relX + relY) * 0.5;

          // 화면 좌표 (줌 적용)
          const screenX = centerX + isoX * zoom;
          const screenY = centerY + isoY * zoom;

          // 화면 밖 오브젝트 스킵
          const margin = 300 * zoom;
          if (screenX < -margin || screenX > canvasWidth + margin ||
              screenY < -margin || screenY > canvasHeight + margin) {
            continue;
          }

          // 스프라이트 크기 계산
          const scale = (obj.scale || 0.5) * zoom;
          const renderWidth = sprite.width * scale;
          const renderHeight = sprite.height * scale;

          // 스프라이트 앵커 포인트 (하단 중앙)
          // 이소메트릭 스프라이트는 바닥 중심이 오브젝트 위치
          const drawX = screenX - renderWidth / 2;
          const drawY = screenY - renderHeight + renderHeight * 0.15;

          ctx.drawImage(sprite, drawX, drawY, renderWidth, renderHeight);
        }
      }
    },
    []  // v7.3: ref 사용으로 dependency 최소화
  );

  // v7.3: 깊이 정렬을 위한 오브젝트 목록 반환
  // GameCanvas에서 엔티티와 함께 정렬하여 그리기 위함
  // v7.3: useRef로 항상 최신 gameMode 참조 (closure 문제 해결)
  const getVisibleObjects = useCallback(
    (
      playerX: number,
      playerY: number,
      canvasWidth: number,
      canvasHeight: number,
      zoom: number = 1
    ): VisibleObject[] => {
      if (!areObjectSpritesLoaded()) return [];

      // v7.3: ref에서 최신 값 읽기
      const currentGameMode = gameModeRef.current;
      const currentStageId = stageIdRef.current;
      const currentSeed = seedRef.current;

      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const viewRadius = Math.max(canvasWidth, canvasHeight) / zoom;
      const cameraX = playerX - viewRadius;
      const cameraY = playerY - viewRadius;
      const rendererSeed = currentSeed + currentStageId * 1000;

      const objects = getObjectsInView(
        cameraX,
        cameraY,
        viewRadius * 2,
        viewRadius * 2,
        currentStageId,
        currentGameMode,
        rendererSeed
      );

      const visibleObjects: VisibleObject[] = [];

      for (const obj of objects) {
        const spriteObj = obj as MapObject & { spriteType?: string; direction?: string };
        const spriteType = spriteObj.spriteType || (obj.type as string);
        const direction = (spriteObj.direction || 'N') as 'N' | 'E' | 'S' | 'W';
        const sprite = getObjectSprite(spriteType, direction);

        if (sprite && sprite.complete) {
          const relX = obj.x - playerX;
          const relY = obj.y - playerY;
          const isoX = relX - relY;
          const isoY = (relX + relY) * 0.5;
          const screenX = centerX + isoX * zoom;
          const screenY = centerY + isoY * zoom;

          const margin = 300 * zoom;
          if (screenX < -margin || screenX > canvasWidth + margin ||
              screenY < -margin || screenY > canvasHeight + margin) {
            continue;
          }

          const scale = (obj.scale || 0.5) * zoom;
          const renderWidth = sprite.width * scale;
          const renderHeight = sprite.height * scale;

          // v7.3: 이소메트릭 스프라이트 발 위치 보정
          // 이소메트릭 스프라이트의 실제 "발"(바닥 다이아몬드)은 이미지 하단에서 약 35-40% 위에 있음
          // 현재 앵커(0.15)와 실제 발 위치(0.4) 차이만큼 depth 보정 필요
          // screenY 차이를 월드 좌표로 변환: screenY = 0.5 * (worldX + worldY) * zoom
          // 따라서 depth 차이 = screenY차이 * 2 / zoom
          const actualFootAnchor = 0.4;  // 실제 발 위치 (스프라이트 하단에서 40%)
          const renderAnchor = 0.15;     // 렌더링 앵커
          const anchorDiff = actualFootAnchor - renderAnchor;  // 0.25
          const depthCorrection = (renderHeight * anchorDiff * 2) / zoom;

          visibleObjects.push({
            sprite,
            screenX: screenX - renderWidth / 2,
            screenY: screenY - renderHeight + renderHeight * renderAnchor,
            renderWidth,
            renderHeight,
            worldX: obj.x,
            worldY: obj.y,
            depth: obj.x + obj.y - depthCorrection,  // 발 위치 기준 depth (보정됨)
            zIndex: obj.def.zIndex,
            // v7.19 FIX: 실제 충돌 크기 사용 (def.collisionWidth ?? def.width)
            hasCollision: obj.def.hasCollision,
            collisionWidth: obj.def.collisionWidth ?? obj.def.width,
            collisionHeight: obj.def.collisionHeight ?? obj.def.height,
          });
        }
      }

      return visibleObjects;
    },
    []  // v7.3: ref 사용으로 dependency 최소화
  );

  return {
    isLoaded: areTilesLoaded() && areObjectSpritesLoaded(),
    drawTiles,
    drawObjects,
    getVisibleObjects,
  };
}

export default useTileMap;
