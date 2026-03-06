'use client';

/**
 * CharacterCreator -- Phase 7 큐블링 캐릭터 에디터 UI
 *
 * 7 탭 커스터마이저:
 *   1. Body (체형 + 스킨톤)
 *   2. Colors (상의/하의 색상 + 패턴)
 *   3. Face (눈 12종 + 입 8종)
 *   4. Hair (헤어스타일 16종 + 머리카락 색 16색)
 *   5. Equipment (모자/무기/등/신발)
 *   6. Effects (이펙트 placeholder)
 *   7. Presets (8종 프리셋)
 *
 * 좌측 3D 프리뷰 (VoxelCharacterPreview) + 우측 탭 콘텐츠
 * 반응형: 모바일 세로 스택 / 데스크탑 가로 배치
 * MC 테마: SK 팔레트 + bodyFont
 */

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { CubelingAppearance, BodyType } from '@agent-survivor/shared';
import {
  createDefaultAppearance,
  VIVID_PALETTE,
  SKIN_TONES,
  HAIR_COLORS,
  EYE_STYLES,
  MOUTH_STYLES,
  HAT_DEFS,
  WEAPON_DEFS,
  BACK_ITEM_DEFS,
  FOOTWEAR_DEFS,
  PATTERN_DEFS,
  CHARACTER_PRESETS,
} from '@agent-survivor/shared';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';
import { VoxelCharacter } from '@/components/3d/VoxelCharacter';

// ─── 상수 ───

const STORAGE_KEY = 'cubeling-appearance';

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'standard', label: 'STD' },
  { value: 'slim', label: 'SLIM' },
  { value: 'chunky', label: 'CHKY' },
  { value: 'tall', label: 'TALL' },
];

type TabId = 'body' | 'colors' | 'face' | 'hair' | 'equip' | 'fx' | 'preset';

const TABS: { id: TabId; label: string }[] = [
  { id: 'body', label: 'BODY' },
  { id: 'colors', label: 'CLR' },
  { id: 'face', label: 'FACE' },
  { id: 'hair', label: 'HAIR' },
  { id: 'equip', label: 'EQP' },
  { id: 'fx', label: 'FX' },
  { id: 'preset', label: 'PRE' },
];

/** 16종 헤어스타일 이름 */
const HAIR_STYLE_NAMES = [
  'Buzz', 'Spiky', 'Side', 'Long', 'Curly', 'Mohawk', 'Bob', 'Ponytail',
  'Afro', 'Flat', 'Bowl', 'Parted', 'Shaggy', 'Braids', 'Bald', 'Cap',
];

// ─── Props ───

interface CharacterCreatorProps {
  skinId: number;
  onSelect: (id: number) => void;
  appearance?: CubelingAppearance;
  onAppearanceChange?: (appearance: CubelingAppearance) => void;
}

// ─── localStorage 유틸 ───

function loadAppearance(): CubelingAppearance {
  if (typeof window === 'undefined') return createDefaultAppearance();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 모든 필드 존재 여부 검증
      const def = createDefaultAppearance();
      return { ...def, ...parsed } as CubelingAppearance;
    }
  } catch { /* 무시 */ }
  return createDefaultAppearance();
}

function saveAppearance(a: CubelingAppearance): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch { /* 무시 */ }
}

// ─── 랜덤 생성 ───

function randomAppearance(): CubelingAppearance {
  const bodyTypes: BodyType[] = ['standard', 'slim', 'chunky', 'tall'];
  return {
    bodyType: bodyTypes[Math.floor(Math.random() * 4)],
    bodySize: 'medium',
    skinTone: Math.floor(Math.random() * 12),
    eyeStyle: Math.floor(Math.random() * 12),
    mouthStyle: Math.floor(Math.random() * 8),
    marking: 0,
    topColor: Math.floor(Math.random() * 12),
    bottomColor: Math.floor(Math.random() * 12),
    pattern: Math.floor(Math.random() * 8),
    hairStyle: Math.floor(Math.random() * 16),
    hairColor: Math.floor(Math.random() * 16),
    hat: Math.floor(Math.random() * 9),
    weapon: Math.floor(Math.random() * 7),
    backItem: Math.floor(Math.random() * 6),
    footwear: Math.floor(Math.random() * 9),
    trailEffect: 0,
    auraEffect: Math.floor(Math.random() * 6),
    emote: 0,
    spawnEffect: 0,
  };
}

// ─── 공통 스타일 ───

const colorCircleBase: React.CSSProperties = {
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  cursor: 'pointer',
  border: '2px solid transparent',
  transition: 'all 120ms ease',
  padding: 0,
  flexShrink: 0,
};

const gridItemBase: React.CSSProperties = {
  cursor: 'pointer',
  border: `1px solid ${SK.border}`,
  borderRadius: '3px',
  backgroundColor: 'transparent',
  fontFamily: bodyFont,
  fontSize: '9px',
  fontWeight: 600,
  color: SK.textSecondary,
  padding: '4px 6px',
  textAlign: 'center' as const,
  transition: 'all 120ms ease',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const selectedBorder = `2px solid ${SK.gold}`;
const selectedShadow = `0 0 0 1px ${SK.gold}40`;

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: '9px',
  fontWeight: 700,
  color: SK.textMuted,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  marginBottom: '6px',
};

// ─── 메인 컴포넌트 ───

export function CharacterCreator({ skinId, onSelect, appearance: externalAppearance, onAppearanceChange }: CharacterCreatorProps) {
  const [internalAppearance, setInternalAppearance] = useState<CubelingAppearance>(loadAppearance);
  const [activeTab, setActiveTab] = useState<TabId>('body');

  // 외부 appearance prop이 있으면 사용, 없으면 내부 state 사용
  const appearance = externalAppearance ?? internalAppearance;

  const updateAppearance = useCallback((partial: Partial<CubelingAppearance>) => {
    const updated = { ...appearance, ...partial };
    if (!externalAppearance) {
      setInternalAppearance(updated);
    }
    onAppearanceChange?.(updated);
    saveAppearance(updated);
  }, [appearance, externalAppearance, onAppearanceChange]);

  // 마운트 시 localStorage에서 불러오기
  useEffect(() => {
    if (!externalAppearance) {
      const loaded = loadAppearance();
      setInternalAppearance(loaded);
      onAppearanceChange?.(loaded);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRandom = useCallback(() => {
    const rnd = randomAppearance();
    if (!externalAppearance) setInternalAppearance(rnd);
    onAppearanceChange?.(rnd);
    saveAppearance(rnd);
  }, [externalAppearance, onAppearanceChange]);

  const handleReset = useCallback(() => {
    const def = createDefaultAppearance();
    if (!externalAppearance) setInternalAppearance(def);
    onAppearanceChange?.(def);
    saveAppearance(def);
  }, [externalAppearance, onAppearanceChange]);

  const handlePreset = useCallback((presetAppearance: CubelingAppearance) => {
    const copy = { ...presetAppearance };
    if (!externalAppearance) setInternalAppearance(copy);
    onAppearanceChange?.(copy);
    saveAppearance(copy);
  }, [externalAppearance, onAppearanceChange]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
    }}>
      {/* 프리뷰 + 정보 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <AgentPreview3D appearance={appearance} skinId={skinId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: '10px',
            color: SK.blue,
            letterSpacing: '2px',
            marginBottom: '2px',
          }}>
            CUBELING
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 600,
            color: SK.textSecondary,
            marginBottom: '6px',
          }}>
            {appearance.bodyType.toUpperCase()} / {HAIR_STYLE_NAMES[appearance.hairStyle] ?? 'DEFAULT'}
          </div>
          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <SmallButton onClick={handleRandom} color={SK.blue}>RND</SmallButton>
            <SmallButton onClick={handleReset} color={SK.red}>RST</SmallButton>
          </div>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{
        display: 'flex',
        gap: '2px',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontFamily: bodyFont,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '8px',
              padding: '3px 6px',
              backgroundColor: activeTab === tab.id ? `${SK.gold}15` : 'transparent',
              color: activeTab === tab.id ? SK.gold : SK.textMuted,
              border: activeTab === tab.id
                ? `1px solid ${SK.gold}40`
                : '1px solid transparent',
              borderRadius: '2px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 120ms ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{
        padding: '6px 8px',
        borderRadius: '8px',
        backgroundColor: SK.bgWarm,
        border: `1px solid ${SK.border}`,
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        {activeTab === 'body' && (
          <TabBody appearance={appearance} onChange={updateAppearance} />
        )}
        {activeTab === 'colors' && (
          <TabColors appearance={appearance} onChange={updateAppearance} />
        )}
        {activeTab === 'face' && (
          <TabFace appearance={appearance} onChange={updateAppearance} />
        )}
        {activeTab === 'hair' && (
          <TabHair appearance={appearance} onChange={updateAppearance} />
        )}
        {activeTab === 'equip' && (
          <TabEquipment appearance={appearance} onChange={updateAppearance} />
        )}
        {activeTab === 'fx' && (
          <TabEffects />
        )}
        {activeTab === 'preset' && (
          <TabPresets onSelect={handlePreset} />
        )}
      </div>
    </div>
  );
}

// ─── 소형 유틸 버튼 ───

function SmallButton({ onClick, children, color }: {
  onClick: () => void;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: bodyFont,
        fontWeight: 700,
        fontSize: '8px',
        padding: '3px 8px',
        backgroundColor: 'transparent',
        color,
        border: `1px solid ${color}40`,
        borderRadius: '2px',
        cursor: 'pointer',
        letterSpacing: '1px',
        transition: 'all 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

// ─── 3D 프리뷰 ───

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

function AgentPreview3D({ appearance, skinId }: { appearance: CubelingAppearance; skinId: number }) {
  return (
    <div style={{
      width: '90px',
      height: '90px',
      borderRadius: '8px',
      border: `1px solid ${SK.border}`,
      backgroundColor: SK.bgWarm,
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
            appearance={appearance}
            position={[0, 0, 0]}
            rotation={0}
            phaseOffset={0}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

// ─── 색상 원형 선택기 ───

function ColorCircle({ color, selected, onClick }: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...colorCircleBase,
        backgroundColor: color,
        border: selected ? selectedBorder : `2px solid ${SK.border}`,
        boxShadow: selected ? selectedShadow : 'none',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
      }}
      aria-label={`Color ${color}`}
    />
  );
}

// ─── 그리드 아이템 선택기 ───

function GridItem({ label, selected, onClick }: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...gridItemBase,
        border: selected ? `1.5px solid ${SK.gold}` : `1px solid ${SK.border}`,
        color: selected ? SK.gold : SK.textSecondary,
        backgroundColor: selected ? `${SK.gold}10` : 'transparent',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {label}
    </button>
  );
}

// ─── Tab 1: Body (체형 + 스킨톤) ───

function TabBody({ appearance, onChange }: {
  appearance: CubelingAppearance;
  onChange: (p: Partial<CubelingAppearance>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 바디 타입 */}
      <div>
        <div style={sectionLabelStyle}>BODY TYPE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {BODY_TYPES.map(bt => (
            <GridItem
              key={bt.value}
              label={bt.label}
              selected={appearance.bodyType === bt.value}
              onClick={() => onChange({ bodyType: bt.value })}
            />
          ))}
        </div>
      </div>
      {/* 스킨톤 */}
      <div>
        <div style={sectionLabelStyle}>SKIN TONE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {SKIN_TONES.map((color, i) => (
            <ColorCircle
              key={i}
              color={color}
              selected={appearance.skinTone === i}
              onClick={() => onChange({ skinTone: i })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Colors (상의/하의 + 패턴) ───

function TabColors({ appearance, onChange }: {
  appearance: CubelingAppearance;
  onChange: (p: Partial<CubelingAppearance>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 상의 색 */}
      <div>
        <div style={sectionLabelStyle}>TOP COLOR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {VIVID_PALETTE.map((color, i) => (
            <ColorCircle
              key={i}
              color={color}
              selected={appearance.topColor === i}
              onClick={() => onChange({ topColor: i })}
            />
          ))}
        </div>
      </div>
      {/* 하의 색 */}
      <div>
        <div style={sectionLabelStyle}>BOTTOM COLOR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {VIVID_PALETTE.map((color, i) => (
            <ColorCircle
              key={i}
              color={color}
              selected={appearance.bottomColor === i}
              onClick={() => onChange({ bottomColor: i })}
            />
          ))}
        </div>
      </div>
      {/* 패턴 */}
      <div>
        <div style={sectionLabelStyle}>PATTERN</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {PATTERN_DEFS.map(p => (
            <GridItem
              key={p.id}
              label={p.name.toUpperCase().slice(0, 5)}
              selected={appearance.pattern === p.id}
              onClick={() => onChange({ pattern: p.id })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Face (눈 12종 + 입 8종) ───

function FacePreview({ type, index, selected, onClick }: {
  type: 'eye' | 'mouth';
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 16, 16);
    // 배경 (피부톤 시뮬레이션)
    ctx.fillStyle = '#D4A574';
    ctx.fillRect(0, 0, 16, 16);

    if (type === 'eye') {
      const eyeDef = EYE_STYLES[index];
      if (eyeDef) {
        const colorMap: Record<string, string> = {
          b: '#3A3028', w: '#FFFFFF', h: '#CCDDFF',
          g: '#FFD700', r: '#FF4444', v: '#222222',
        };
        for (const [px, py, key] of eyeDef.pixels) {
          ctx.fillStyle = colorMap[key] ?? '#3A3028';
          // 왼쪽 눈 위치 매핑 (4,5 기준)
          ctx.fillRect(4 + px, 5 + py, 1, 1);
          // 오른쪽 눈
          if (index === 4) {
            // Wink: 오른쪽은 감은 눈
            ctx.fillStyle = '#3A3028';
            ctx.fillRect(9, 6, 1, 1);
            ctx.fillRect(10, 6, 1, 1);
            ctx.fillRect(11, 6, 1, 1);
          } else {
            ctx.fillRect(9 + px, 5 + py, 1, 1);
          }
        }
      }
    } else {
      const mouthDef = MOUTH_STYLES[index];
      if (mouthDef) {
        const colorMap: Record<string, string> = {
          d: '#8B4040', w: '#FFFFFF',
        };
        for (const [px, py, key] of mouthDef.pixels) {
          ctx.fillStyle = colorMap[key] ?? '#8B4040';
          ctx.fillRect(5 + px, 7 + py, 1, 1);
        }
      }
    }
  }, [type, index]);

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        aspectRatio: '1',
        padding: 0,
        border: selected ? `1.5px solid ${SK.gold}` : `1px solid ${SK.border}`,
        borderRadius: '3px',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        imageRendering: 'pixelated' as const,
        opacity: selected ? 1 : 0.65,
        transition: 'all 120ms ease',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
      }}
      aria-label={`${type} style ${index}`}
    >
      <canvas
        ref={canvasRef}
        width={16}
        height={16}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </button>
  );
}

function TabFace({ appearance, onChange }: {
  appearance: CubelingAppearance;
  onChange: (p: Partial<CubelingAppearance>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 눈 스타일 */}
      <div>
        <div style={sectionLabelStyle}>EYES ({EYE_STYLES[appearance.eyeStyle]?.name ?? 'Default'})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px' }}>
          {EYE_STYLES.map((_, i) => (
            <FacePreview
              key={i}
              type="eye"
              index={i}
              selected={appearance.eyeStyle === i}
              onClick={() => onChange({ eyeStyle: i })}
            />
          ))}
        </div>
      </div>
      {/* 입 스타일 */}
      <div>
        <div style={sectionLabelStyle}>MOUTH ({MOUTH_STYLES[appearance.mouthStyle]?.name ?? 'Smile'})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
          {MOUTH_STYLES.map((_, i) => (
            <FacePreview
              key={i}
              type="mouth"
              index={i}
              selected={appearance.mouthStyle === i}
              onClick={() => onChange({ mouthStyle: i })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Hair (헤어스타일 + 머리카락 색) ───

function TabHair({ appearance, onChange }: {
  appearance: CubelingAppearance;
  onChange: (p: Partial<CubelingAppearance>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 헤어스타일 */}
      <div>
        <div style={sectionLabelStyle}>HAIRSTYLE ({HAIR_STYLE_NAMES[appearance.hairStyle] ?? 'Buzz'})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
          {HAIR_STYLE_NAMES.map((name, i) => (
            <GridItem
              key={i}
              label={name.slice(0, 4).toUpperCase()}
              selected={appearance.hairStyle === i}
              onClick={() => onChange({ hairStyle: i })}
            />
          ))}
        </div>
      </div>
      {/* 머리카락 색 */}
      <div>
        <div style={sectionLabelStyle}>HAIR COLOR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {HAIR_COLORS.map((color, i) => (
            <ColorCircle
              key={i}
              color={color}
              selected={appearance.hairColor === i}
              onClick={() => onChange({ hairColor: i })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Equipment (모자/무기/등/신발) ───

function TabEquipment({ appearance, onChange }: {
  appearance: CubelingAppearance;
  onChange: (p: Partial<CubelingAppearance>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* 모자 */}
      <div>
        <div style={sectionLabelStyle}>HAT</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          <GridItem
            label="NONE"
            selected={appearance.hat === 0}
            onClick={() => onChange({ hat: 0 })}
          />
          {HAT_DEFS.map(h => (
            <GridItem
              key={h.id}
              label={h.name.split(' ')[0].slice(0, 5).toUpperCase()}
              selected={appearance.hat === h.id}
              onClick={() => onChange({ hat: h.id })}
            />
          ))}
        </div>
      </div>
      {/* 무기 */}
      <div>
        <div style={sectionLabelStyle}>WEAPON</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          <GridItem
            label="NONE"
            selected={appearance.weapon === 0}
            onClick={() => onChange({ weapon: 0 })}
          />
          {WEAPON_DEFS.map(w => (
            <GridItem
              key={w.id}
              label={w.name.split(' ')[0].slice(0, 5).toUpperCase()}
              selected={appearance.weapon === w.id}
              onClick={() => onChange({ weapon: w.id })}
            />
          ))}
        </div>
      </div>
      {/* 등 장비 */}
      <div>
        <div style={sectionLabelStyle}>BACK</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          <GridItem
            label="NONE"
            selected={appearance.backItem === 0}
            onClick={() => onChange({ backItem: 0 })}
          />
          {BACK_ITEM_DEFS.map(b => (
            <GridItem
              key={b.id}
              label={b.name.split(' ')[0].slice(0, 5).toUpperCase()}
              selected={appearance.backItem === b.id}
              onClick={() => onChange({ backItem: b.id })}
            />
          ))}
        </div>
      </div>
      {/* 신발 */}
      <div>
        <div style={sectionLabelStyle}>FOOTWEAR</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          <GridItem
            label="NONE"
            selected={appearance.footwear === 0}
            onClick={() => onChange({ footwear: 0 })}
          />
          {FOOTWEAR_DEFS.map(f => (
            <GridItem
              key={f.id}
              label={f.name.split(' ')[0].slice(0, 5).toUpperCase()}
              selected={appearance.footwear === f.id}
              onClick={() => onChange({ footwear: f.id })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 6: Effects (placeholder) ───

function TabEffects() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 0',
      gap: '8px',
    }}>
      <div style={{
        fontFamily: bodyFont,
        fontSize: '9px',
        fontWeight: 700,
        color: SK.textMuted,
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>
        CLASSIFIED
      </div>
      <div style={{
        fontFamily: bodyFont,
        fontSize: '8px',
        color: SK.textMuted,
        letterSpacing: '1px',
        opacity: 0.6,
      }}>
        Effects unlocked in future updates
      </div>
    </div>
  );
}

// ─── Tab 7: Presets ───

function TabPresets({ onSelect }: { onSelect: (a: CubelingAppearance) => void }) {
  return (
    <div>
      <div style={sectionLabelStyle}>PRESETS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
        {CHARACTER_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.appearance)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              border: `1px solid ${SK.border}`,
              borderRadius: '3px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 120ms ease',
              textAlign: 'left' as const,
            }}
          >
            {/* 색상 미니 아이콘 */}
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '2px',
              backgroundColor: VIVID_PALETTE[preset.appearance.topColor] ?? '#888',
              border: `1px solid ${VIVID_PALETTE[preset.appearance.bottomColor] ?? '#444'}`,
              flexShrink: 0,
            }} />
            <div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: '9px',
                fontWeight: 700,
                color: SK.textPrimary,
                letterSpacing: '1px',
              }}>
                {preset.name}
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: '7px',
                color: SK.textMuted,
                letterSpacing: '0.5px',
              }}>
                {preset.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
