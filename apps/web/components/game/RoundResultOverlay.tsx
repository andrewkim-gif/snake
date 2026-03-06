'use client';

/**
 * RoundResultOverlay — 라운드 종료 결과 화면
 * v10: 빌드 요약, 시너지 배지, 데미지 소스 표시
 */

import type { RoundEndPayload, DeathPayload, TomeType, AbilityType } from '@snake-arena/shared';
import { MC, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const DAMAGE_SOURCE_LABELS: Record<string, string> = {
  aura: 'Aura Combat', dash: 'Dash Strike', boundary: 'Arena Boundary', venom: 'Venom DoT',
};

const TOME_COLORS: Record<string, string> = {
  xp: '#FFAA00', speed: '#55FFFF', damage: '#FF5555', armor: '#AAAAAA',
  magnet: '#FFFF55', luck: '#55FF55', regen: '#55FF55', cursed: '#AA00AA',
};

const ABILITY_COLORS: Record<string, string> = {
  venom_aura: '#55FF55', shield_burst: '#5555FF', lightning_strike: '#FFFF55',
  speed_dash: '#55FFFF', mass_drain: '#FF55FF', gravity_well: '#AA00AA',
};

export interface BuildSummary {
  tomes: Partial<Record<TomeType, number>>;
  abilities: Array<{ type: AbilityType; level: number }>;
  synergies: string[];
  finalLevel: number;
}

interface RoundResultOverlayProps {
  roundEnd: RoundEndPayload;
  deathInfo?: DeathPayload | null;
  buildSummary?: BuildSummary | null;
  analysisPanel?: React.ReactNode;
}

export function RoundResultOverlay({ roundEnd, deathInfo, buildSummary, analysisPanel }: RoundResultOverlayProps) {
  const { winner, yourRank, yourScore, finalLeaderboard } = roundEnd;
  const hasSynergies = buildSummary && buildSummary.synergies.length >= 2;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 40, fontFamily: bodyFont,
      gap: '0.6rem', overflowY: 'auto', padding: '1rem',
    }}>
      <h2 style={{
        fontFamily: pixelFont, fontSize: '1rem', color: MC.textGold, margin: 0,
        textTransform: 'uppercase', letterSpacing: '0.08em', textShadow: '2px 2px 0 #553300',
      }}>
        ROUND OVER!
      </h2>

      {winner && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
          <span style={{ fontFamily: pixelFont, fontSize: '0.35rem', color: MC.textSecondary }}>Winner</span>
          <span style={{ fontFamily: pixelFont, fontSize: '0.7rem', color: MC.textGold, textShadow: '1px 1px 0 #553300' }}>
            {winner.name}
          </span>
          <span style={{ fontSize: '0.85rem', color: MC.textSecondary }}>
            {winner.score} pts | {winner.kills} kills
          </span>
        </div>
      )}

      <div style={{
        display: 'flex', gap: '1rem', fontSize: '0.85rem', fontWeight: 700,
        backgroundColor: MC.panelBg, boxShadow: mcPanelShadow(),
        border: `2px solid ${MC.panelBorderDark}`, padding: '0.6rem 1.5rem', color: MC.textPrimary,
      }}>
        <span>Rank: <span style={{ color: MC.textGold }}>#{yourRank}</span></span>
        <span>Score: <span style={{ color: MC.textGold }}>{yourScore}</span></span>
        {buildSummary && (
          <span>Level: <span style={{ color: '#5B8DAD' }}>Lv.{buildSummary.finalLevel}</span></span>
        )}
      </div>

      {deathInfo && (
        <div style={{ fontSize: '0.8rem', color: MC.textSecondary, textAlign: 'center' }}>
          {deathInfo.killer ? (
            <span>
              Eliminated by <span style={{ color: MC.textRed, fontWeight: 700 }}>{deathInfo.killer}</span>
              {deathInfo.damageSource && (
                <span style={{ color: MC.textGray }}> ({DAMAGE_SOURCE_LABELS[deathInfo.damageSource] ?? deathInfo.damageSource})</span>
              )}
            </span>
          ) : deathInfo.damageSource === 'boundary' ? (
            <span style={{ color: MC.textRed }}>Eliminated by Arena Boundary</span>
          ) : null}
        </div>
      )}

      {buildSummary && (
        <div style={{
          backgroundColor: MC.panelBg, boxShadow: mcPanelShadow(),
          border: `2px solid ${MC.panelBorderDark}`, padding: '0.6rem 1rem', maxWidth: '350px', width: '100%',
        }}>
          <div style={{
            fontFamily: pixelFont, fontSize: '0.35rem', color: MC.textSecondary, marginBottom: '0.4rem',
            letterSpacing: '0.06em', borderBottom: `1px solid ${MC.panelBorderDark}`, paddingBottom: '0.3rem',
          }}>
            BUILD SUMMARY
            {hasSynergies && (
              <span style={{
                marginLeft: '8px', color: MC.textGold, backgroundColor: 'rgba(255,170,0,0.2)',
                padding: '1px 5px', fontSize: '0.25rem',
              }}>BEST BUILD</span>
            )}
          </div>

          {Object.entries(buildSummary.tomes).filter(([_, v]) => v && v > 0).length > 0 && (
            <div style={{ marginBottom: '0.3rem' }}>
              <div style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGray, marginBottom: '2px' }}>TOMES</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {Object.entries(buildSummary.tomes).filter(([_, v]) => v && v > 0).map(([type, stacks]) => (
                  <span key={type} style={{
                    fontFamily: pixelFont, fontSize: '0.25rem', color: TOME_COLORS[type] ?? MC.textPrimary,
                    backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 4px',
                  }}>{type.toUpperCase()} x{stacks}</span>
                ))}
              </div>
            </div>
          )}

          {buildSummary.abilities.length > 0 && (
            <div style={{ marginBottom: '0.3rem' }}>
              <div style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGray, marginBottom: '2px' }}>ABILITIES</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {buildSummary.abilities.map((a, i) => (
                  <span key={i} style={{
                    fontFamily: pixelFont, fontSize: '0.25rem', color: ABILITY_COLORS[a.type] ?? MC.textPrimary,
                    backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 4px',
                  }}>{a.type.replace(/_/g, ' ').toUpperCase()} Lv{a.level}</span>
                ))}
              </div>
            </div>
          )}

          {buildSummary.synergies.length > 0 && (
            <div>
              <div style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGray, marginBottom: '2px' }}>SYNERGIES</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {buildSummary.synergies.map((s) => (
                  <span key={s} style={{
                    fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGold,
                    backgroundColor: 'rgba(255,170,0,0.15)', padding: '1px 5px',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {finalLeaderboard.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.1rem',
          fontSize: '0.8rem', color: MC.textSecondary, minWidth: '200px',
          backgroundColor: MC.panelBg, boxShadow: mcPanelShadow(),
          border: `2px solid ${MC.panelBorderDark}`, padding: '0.5rem 0.8rem',
        }}>
          <div style={{
            fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textSecondary,
            marginBottom: '0.2rem', letterSpacing: '0.06em',
          }}>FINAL STANDINGS</div>
          {finalLeaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: '1rem',
              fontWeight: i === 0 ? 700 : 400, color: i === 0 ? MC.textGold : MC.textSecondary,
              fontSize: '0.8rem', padding: '1px 0',
            }}>
              <span>#{entry.rank} {entry.name}</span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {analysisPanel}

      <p style={{ fontFamily: pixelFont, fontSize: '0.35rem', color: MC.textGray, margin: 0 }}>
        Next round starting soon...
      </p>
    </div>
  );
}
