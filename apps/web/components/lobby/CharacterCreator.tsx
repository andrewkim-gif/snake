'use client';

/**
 * CharacterCreator — 작전 지도 스타일 에이전트 커스터마이저
 * 다크 프리뷰 + 손그림 보더 스킨 그리드
 */

import { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { DEFAULT_SKINS } from '@agent-survivor/shared';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
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
      flexDirection: 'column',
      gap: '10px',
      width: '100%',
    }}>
      {/* 프리뷰 + 유닛명 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <AgentPreview3D skinId={skinId} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: headingFont, fontSize: '11px',
            color: SK.textMuted, letterSpacing: '2px',
            marginBottom: '4px',
          }}>
            UNIT {String(skinId + 1).padStart(2, '0')}
          </div>
          <div style={{
            fontFamily: bodyFont, fontSize: SKFont.sm,
            color: SK.textPrimary, fontWeight: 600,
          }}>
            {DEFAULT_SKINS[skinId]?.pattern?.toUpperCase() || 'SOLID'} TYPE
          </div>
          {/* 탭 */}
          <div style={{ display: 'flex', gap: '2px', marginTop: '8px' }}>
            {(['skin', 'color', 'face', 'equip'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                fontFamily: bodyFont,
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: '9px',
                padding: '3px 7px',
                backgroundColor: 'transparent',
                color: activeTab === tab ? SK.gold : SK.textMuted,
                border: activeTab === tab
                  ? `1px solid ${SK.gold}40`
                  : `1px solid transparent`,
                borderRadius: '2px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 150ms ease',
              }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'skin' && (
        <SkinGrid skinId={skinId} onSelect={onSelect} />
      )}
      {activeTab !== 'skin' && (
        <div style={{
          fontFamily: bodyFont, fontSize: SKFont.xs, fontWeight: 500,
          color: SK.textMuted, padding: '12px 0', textAlign: 'center',
          letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          Classified
        </div>
      )}
    </div>
  );
}

function PreviewCamera() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.5;
    const r = 3.5;
    camera.position.set(Math.cos(t) * r, 2.2, Math.sin(t) * r);
    camera.lookAt(0, 1.0, 0);
  });
  return null;
}

function AgentPreview3D({ skinId }: { skinId: number }) {
  return (
    <div style={{
      width: '90px',
      height: '90px',
      borderRadius: '4px',
      border: `1px solid rgba(100, 160, 220, 0.15)`,
      backgroundColor: 'rgba(12, 18, 32, 0.6)',
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
          <VoxelCharacter skinId={skinId} position={[0, 0, 0]} rotation={0} phaseOffset={0} />
        </Suspense>
      </Canvas>
    </div>
  );
}

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
        width: '100%', aspectRatio: '1', padding: 0,
        border: selected ? `1.5px solid ${SK.gold}` : `1px solid ${SK.border}`,
        borderRadius: '3px',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        imageRendering: 'pixelated',
        opacity: selected ? 1 : 0.6,
        transition: 'all 150ms ease',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
        boxShadow: selected ? `0 0 0 1px ${SK.gold}30` : 'none',
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
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '6px',
      padding: '8px',
      borderRadius: '4px',
      backgroundColor: 'rgba(12, 18, 32, 0.4)',
      border: `1px solid rgba(100, 160, 220, 0.08)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={() => goPage(-1)} style={{
          background: 'none', border: 'none', color: SK.textSecondary,
          fontSize: '14px', cursor: 'pointer', padding: '0 2px',
          fontFamily: bodyFont, fontWeight: 700,
        }}>&lt;</button>
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
        }}>
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
          background: 'none', border: 'none', color: SK.textSecondary,
          fontSize: '14px', cursor: 'pointer', padding: '0 2px',
          fontFamily: bodyFont, fontWeight: 700,
        }}>&gt;</button>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <div key={i} style={{
              width: currentPage === i ? 12 : 4, height: 2,
              backgroundColor: currentPage === i ? SK.gold : SK.textMuted,
              transition: 'all 150ms ease',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
