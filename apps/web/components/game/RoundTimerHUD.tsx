'use client';

interface RoundTimerHUDProps {
  timeRemaining: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RoundTimerHUD({ timeRemaining }: RoundTimerHUDProps) {
  const isLow = timeRemaining <= 30;

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      fontFamily: '"Patrick Hand", "Inter", sans-serif',
      fontSize: isLow ? '1.4rem' : '1.2rem',
      fontWeight: 700,
      color: isLow ? '#C75B5B' : '#3A3028',
      backgroundColor: 'rgba(245, 240, 232, 0.85)',
      padding: '4px 16px',
      borderRadius: '4px',
      border: `1.5px solid ${isLow ? '#C75B5B' : '#6B5E52'}`,
      letterSpacing: '0.05em',
      transition: 'all 300ms',
    }}>
      {formatTime(timeRemaining)}
    </div>
  );
}
