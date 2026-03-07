'use client';

/**
 * SettingsContent — 설정 탭 콘텐츠
 * Language, Sound, Visual Effects, Controls 설정
 *
 * v16 Phase 7: SoundEngine / FX Quality 설정 통합
 */

import { useState, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import { getSoundEngine, type FXQuality } from '@/lib/3d/sound-engine';

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: `1px solid ${SK.borderDark}`,
    }}>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '13px',
        fontWeight: 600,
        color: SK.textSecondary,
        letterSpacing: '1px',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

/** 슬라이더 스타일 (range input) */
function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
      style={{
        width: 120,
        height: 4,
        accentColor: SK.gold,
        cursor: 'pointer',
      }}
    />
  );
}

/** 토글 버튼 */
function ToggleButton({ active, onToggle, labelOn = 'ON', labelOff = 'OFF' }: {
  active: boolean;
  onToggle: () => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        fontFamily: bodyFont,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1px',
        padding: '4px 14px',
        border: `1px solid ${active ? SK.gold : SK.borderDark}`,
        borderRadius: 0,
        backgroundColor: active ? `${SK.gold}22` : 'transparent',
        color: active ? SK.gold : SK.textMuted,
        cursor: 'pointer',
        transition: 'all 200ms',
      }}
    >
      {active ? labelOn : labelOff}
    </button>
  );
}

/** FX 품질 선택 버튼 그룹 */
function QualitySelector({ value, onChange }: { value: FXQuality; onChange: (v: FXQuality) => void }) {
  const options: { key: FXQuality; label: string }[] = [
    { key: 'off', label: 'OFF' },
    { key: 'low', label: 'LOW' },
    { key: 'high', label: 'HIGH' },
  ];

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1px',
            padding: '4px 10px',
            border: `1px solid ${value === opt.key ? SK.gold : SK.borderDark}`,
            borderRadius: 0,
            backgroundColor: value === opt.key ? `${SK.gold}22` : 'transparent',
            color: value === opt.key ? SK.gold : SK.textMuted,
            cursor: 'pointer',
            transition: 'all 200ms',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsContent() {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  // SoundEngine 설정 읽기 (초기값)
  const engine = getSoundEngine();
  const initialSettings = engine.getSettings();

  const [muted, setMuted] = useState(initialSettings.muted);
  const [sfxVol, setSfxVol] = useState(initialSettings.sfxVolume);
  const [bgmVol, setBgmVol] = useState(initialSettings.bgmVolume);
  const [fxQuality, setFxQuality] = useState<FXQuality>(initialSettings.fxQuality);

  const handleToggleMute = useCallback(() => {
    const newMuted = engine.toggleMute();
    setMuted(newMuted);
  }, [engine]);

  const handleSfxVolume = useCallback((v: number) => {
    engine.setSFXVolume(v);
    setSfxVol(v);
  }, [engine]);

  const handleBgmVolume = useCallback((v: number) => {
    engine.setBGMVolume(v);
    setBgmVol(v);
  }, [engine]);

  const handleFxQuality = useCallback((q: FXQuality) => {
    engine.setFXQuality(q);
    setFxQuality(q);
  }, [engine]);

  return (
    <DashboardPage
      icon={Settings}
      title={tNav('settings')}
      description={tCommon('configurePreferences')}
      accentColor={SK.textSecondary}
    >
      <div style={{
        background: SK.glassBg,
        border: `1px solid ${SK.glassBorder}`,
        borderRadius: 0,
        padding: '20px 24px',
      }}>
        <SettingRow label={tCommon('language')}>
          <LanguageSwitcher />
        </SettingRow>

        {/* v16 Phase 7: Sound settings */}
        <SettingRow label={tCommon('sound')}>
          <ToggleButton
            active={!muted}
            onToggle={handleToggleMute}
          />
        </SettingRow>

        <SettingRow label="SFX VOLUME">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <VolumeSlider value={sfxVol} onChange={handleSfxVolume} />
            <span style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              color: SK.textMuted,
              minWidth: 32,
              textAlign: 'right',
            }}>
              {Math.round(sfxVol * 100)}%
            </span>
          </div>
        </SettingRow>

        <SettingRow label="BGM VOLUME">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <VolumeSlider value={bgmVol} onChange={handleBgmVolume} />
            <span style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              color: SK.textMuted,
              minWidth: 32,
              textAlign: 'right',
            }}>
              {Math.round(bgmVol * 100)}%
            </span>
          </div>
        </SettingRow>

        <SettingRow label="VISUAL EFFECTS">
          <QualitySelector value={fxQuality} onChange={handleFxQuality} />
        </SettingRow>

        <SettingRow label={tCommon('controls')}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '12px',
            color: SK.textMuted,
            letterSpacing: '1px',
          }}>
            WASD + MOUSE
          </span>
        </SettingRow>
      </div>
    </DashboardPage>
  );
}
