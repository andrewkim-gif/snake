'use client';

/**
 * SettingsContent — 설정 탭 콘텐츠
 * Language, Sound, Controls 등 기본 설정
 */

import { Settings } from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';
import { useTranslations } from 'next-intl';

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

export default function SettingsContent() {
  const tNav = useTranslations('nav');

  return (
    <DashboardPage
      icon={Settings}
      title={tNav('settings')}
      description="Configure your game preferences"
      accentColor={SK.textSecondary}
    >
      <div style={{
        background: SK.glassBg,
        border: `1px solid ${SK.glassBorder}`,
        borderRadius: '12px',
        padding: '20px 24px',
      }}>
        <SettingRow label="Language">
          <LanguageSwitcher />
        </SettingRow>

        <SettingRow label="Sound">
          <span style={{
            fontFamily: bodyFont,
            fontSize: '12px',
            color: SK.textMuted,
            letterSpacing: '1px',
          }}>
            Coming soon
          </span>
        </SettingRow>

        <SettingRow label="Controls">
          <span style={{
            fontFamily: bodyFont,
            fontSize: '12px',
            color: SK.textMuted,
            letterSpacing: '1px',
          }}>
            Mouse / Touch
          </span>
        </SettingRow>
      </div>
    </DashboardPage>
  );
}
