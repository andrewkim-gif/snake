'use client';

import { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  initialCount: number;
}

export function CountdownOverlay({ initialCount }: CountdownOverlayProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
    if (initialCount <= 0) return;

    const interval = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialCount]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(245, 240, 232, 0.75)',
      zIndex: 30,
      fontFamily: '"Patrick Hand", "Inter", sans-serif',
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 700,
        color: '#D4914A',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '0.5rem',
      }}>
        GET READY!
      </div>
      <div style={{
        fontSize: count <= 3 ? '6rem' : '4.5rem',
        fontWeight: 900,
        color: count <= 3 ? '#C75B5B' : '#3A3028',
        lineHeight: 1,
        transition: 'all 200ms',
      }}>
        {count > 0 ? count : 'GO!'}
      </div>
    </div>
  );
}
