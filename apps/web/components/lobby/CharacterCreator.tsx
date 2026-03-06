'use client';

/**
 * CharacterCreator — 에이전트 캐릭터 커스터마이저
 * 좌: 미니 R3F Canvas 3D 캐릭터 프리뷰 / 우: 스킨 그리드 선택
 * Phase 2: 2D canvas → 3D R3F 프리뷰
 */

import { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_SKINS } from '@snake-arena/shared';
import { MC, MCModern, pixelFont } from '@/lib/minecraft-ui';
import { VoxelCharacter } from '@/components/3d/VoxelCharacter';

const SKINS_PER_PAGE = 8;

interface CharacterCreatorProps {
  skinId: number;
  onSelect: (id: number) => void;
}

export function CharacterCreator({ skinId, onSelect }: CharacterCreatorProps) {
  const [activeTab, setActiveTab] = useState<'skin' | 'color' | 'face' | 'equip'>('skin');

  return (
    <div style={{
      display: 'flex',
      gap: '0.8rem',
      alignItems: 'flex-start',
      width: '100%',
    }}>
      {/* 좌: 3D 캐릭터 프리뷰 */}
      <AgentPreview3D skinId={skinId} />

      {/* 우: 탭 + 스킨 그리드 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* 탭 헤더 */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['skin', 'color', 'face', 'equip'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              fontFamily: pixelFont,
              fontSize: '0.25rem',
              padding: '3px 8px',
              backgroundColor: activeTab === tab ? 'rgba(255,170,0,0.2)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab ? MC.textGold : MC.textGray,
              border: activeTab === tab ? `1px solid ${MC.textGold}40` : `1px solid transparent`,
              borderRadius: MCModern.radiusSm,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: MCModern.transitionFast,
            }}>
              {tab === 'skin' ? 'SKIN' : tab === 'color' ? 'COLOR' : tab === 'face' ? 'FACE' : 'EQUIP'}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        {activeTab === 'skin' && (
          <>
            <div style={{
              fontFamily: pixelFont, fontSize: '0.3rem',
              color: MC.textSecondary, letterSpacing: '0.06em',
            }}>
              SELECT SKIN
            </div>
            <SkinGrid skinId={skinId} onSelect={onSelect} />
          </>
        )}
        {activeTab !== 'skin' && (
          <div style={{
            fontFamily: pixelFont, fontSize: '0.25rem',
            color: MC.textGray, padding: '1rem 0', textAlign: 'center',
          }}>
            COMING SOON
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 3D Agent 프리뷰 (미니 R3F Canvas) ── */
function PreviewCamera() {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.5;
    const radius = 3.5;
    camera.position.set(
      Math.cos(t) * radius,
      2.2,
      Math.sin(t) * radius,
    );
    camera.lookAt(0, 1.0, 0);
  });

  return null;
}

function AgentPreview3D({ skinId }: { skinId: number }) {
  return (
    <div style={{
      width: '120px',
      height: '120px',
      borderRadius: MCModern.radiusSm,
      border: `1px solid ${MCModern.glassBorder}`,
      backgroundColor: 'rgba(0,0,0,0.3)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.7} />
        <PreviewCamera />
        <Suspense fallback={null}>
          <VoxelCharacter
            skinId={skinId}
            position={[0, 0, 0]}
            rotation={0}
            phaseOffset={0}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ── 스킨 썸네일 ── */
function SkinThumbnail({ skinId, selected, onClick }: {
  skinId: number; selected: boolean; onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skin = DEFAULT_SKINS[skinId];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !skin) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = skin.primaryColor;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = skin.secondaryColor;
    switch (skin.pattern) {
      case 'striped':
        for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 2);
        break;
      case 'dotted':
        for (let x = 2; x < 16; x += 5)
          for (let y = 2; y < 16; y += 5) ctx.fillRect(x, y, 2, 2);
        break;
      case 'gradient':
        for (let y = 0; y < 16; y++) {
          ctx.globalAlpha = (y / 16) * 0.6;
          ctx.fillRect(0, y, 16, 1);
        }
        ctx.globalAlpha = 1;
        break;
    }
  }, [skin]);

  return (
    <button
      onClick={onClick}
      aria-label={`Skin ${skinId + 1}`}
      style={{
        width: 28, height: 28, padding: 0,
        border: selected ? `2px solid ${MC.textGold}` : `1px solid rgba(255,255,255,0.1)`,
        borderRadius: 0,
        backgroundColor: 'transparent',
        cursor: 'pointer',
        imageRendering: 'pixelated',
        opacity: selected ? 1 : 0.7,
        transition: MCModern.transitionFast,
        transform: selected ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      <canvas
        ref={canvasRef}
        width={16} height={16}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </button>
  );
}

/* ── 스킨 그리드 (8개씩, 페이지 도트) ── */
function SkinGrid({ skinId, onSelect }: { skinId: number; onSelect: (id: number) => void }) {
  const totalPages = Math.ceil(DEFAULT_SKINS.length / SKINS_PER_PAGE);
  const currentPage = Math.floor(skinId / SKINS_PER_PAGE);
  const pageStart = currentPage * SKINS_PER_PAGE;
  const pageSkins = DEFAULT_SKINS.slice(pageStart, pageStart + SKINS_PER_PAGE);

  const goPage = (dir: number) => {
    const newPage = (currentPage + dir + totalPages) % totalPages;
    onSelect(newPage * SKINS_PER_PAGE);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button onClick={() => goPage(-1)} style={{
          background: 'none', border: 'none', color: MC.textSecondary,
          fontSize: '1rem', cursor: 'pointer', padding: '0 2px',
        }}>&lt;</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
          {pageSkins.map((_, i) => (
            <SkinThumbnail
              key={pageStart + i}
              skinId={pageStart + i}
              selected={skinId === pageStart + i}
              onClick={() => onSelect(pageStart + i)}
            />
          ))}
        </div>
        <button onClick={() => goPage(1)} style={{
          background: 'none', border: 'none', color: MC.textSecondary,
          fontSize: '1rem', cursor: 'pointer', padding: '0 2px',
        }}>&gt;</button>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '3px' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <div key={i} style={{
              width: currentPage === i ? 10 : 4, height: 3,
              borderRadius: '2px',
              backgroundColor: currentPage === i ? MC.textGold : MC.textGray,
              transition: 'all 150ms ease',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
