'use client';

import { useState, useEffect } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

interface QuestWithProgress {
  id: string;
  name: string;
  description: string;
  requirement: number;
  rpReward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

interface QuestPanelProps {
  playerName: string;
}

export function QuestPanel({ playerName }: QuestPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [quests, setQuests] = useState<QuestWithProgress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded || !playerName) return;

    const fetchQuests = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/meta/quests?name=${encodeURIComponent(playerName)}`);
        if (res.ok) {
          setQuests(await res.json());
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    fetchQuests();
  }, [expanded, loaded, playerName]);

  useEffect(() => {
    setLoaded(false);
  }, [playerName]);

  return (
    <McPanel style={{ padding: '0.8rem' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 0,
        }}
      >
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.5rem',
          color: MC.textGold,
          textShadow: '1px 1px 0 #553300',
          letterSpacing: '0.05em',
        }}>
          QUESTS
        </span>
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.4rem',
          color: MC.textGray,
        }}>
          {expanded ? '[-]' : '[+]'}
        </span>
      </button>

      {expanded && (
        <div style={{
          marginTop: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '280px',
          overflowY: 'auto',
        }}>
          {!playerName && (
            <div style={{
              fontFamily: pixelFont,
              fontSize: '0.3rem',
              color: MC.textGray,
              textAlign: 'center',
              padding: '0.5rem',
            }}>
              Enter agent name to track quests
            </div>
          )}

          {quests.map((quest) => {
            const progressPct = quest.requirement > 0
              ? Math.min(100, (quest.progress / quest.requirement) * 100)
              : 0;

            return (
              <div key={quest.id} style={{
                padding: '0.5rem',
                backgroundColor: quest.completed
                  ? 'rgba(255, 170, 0, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${quest.completed ? MC.textGold : MC.panelBorderDark}`,
              }}>
                {/* Quest header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    {quest.completed && (
                      <span style={{
                        color: MC.textGold,
                        fontSize: '0.8rem',
                      }}>
                        {'\u2713'}
                      </span>
                    )}
                    <span style={{
                      fontFamily: pixelFont,
                      fontSize: '0.35rem',
                      color: quest.completed ? MC.textGold : MC.textPrimary,
                    }}>
                      {quest.name}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: pixelFont,
                    fontSize: '0.3rem',
                    color: MC.textGold,
                    backgroundColor: 'rgba(255, 170, 0, 0.15)',
                    padding: '1px 6px',
                  }}>
                    +{quest.rpReward} RP
                  </span>
                </div>

                {/* Description */}
                <div style={{
                  fontFamily: bodyFont,
                  fontSize: '0.7rem',
                  color: MC.textSecondary,
                  marginBottom: '6px',
                }}>
                  {quest.description}
                </div>

                {/* Progress bar */}
                {!quest.completed && (
                  <div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${progressPct}%`,
                        height: '100%',
                        backgroundColor: MC.btnGreen,
                        transition: 'width 300ms ease',
                      }} />
                    </div>
                    <div style={{
                      fontFamily: bodyFont,
                      fontSize: '0.55rem',
                      color: MC.textGray,
                      textAlign: 'right',
                      marginTop: '2px',
                    }}>
                      {quest.progress}/{quest.requirement}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {quests.length === 0 && playerName && loaded && (
            <div style={{
              fontFamily: bodyFont,
              fontSize: '0.7rem',
              color: MC.textGray,
              textAlign: 'center',
              padding: '0.5rem',
            }}>
              No quest data yet. Play a round!
            </div>
          )}
        </div>
      )}
    </McPanel>
  );
}
