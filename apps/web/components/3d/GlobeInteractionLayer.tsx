'use client';

/**
 * GlobeInteractionLayer — Raycast interaction sphere + SizeGate.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { loadGeoJSON } from '@/lib/globe-data';
import { xyzToGeo, findCountryAtPoint, GLOBE_RADIUS } from '@/lib/globe-geo';

// ─── Module-level hover state (useFrame read / event handler write) ───

let _hoveredIso3: string | null = null;

/** Get current hovered ISO3 code (module-level, for useFrame consumers) */
export function getHoveredIso3(): string | null {
  return _hoveredIso3;
}

// ─── GlobeInteraction ───

const CLICK_DRAG_THRESHOLD = 25; // 5px^2

export interface GlobeInteractionProps {
  onCountryClick?: (iso3: string, name: string) => void;
  onHover?: (iso3: string | null, name: string | null) => void;
}

export function GlobeInteraction({ onCountryClick, onHover }: GlobeInteractionProps) {
  const featuresRef = useRef<any[]>([]);
  const hoveredRef = useRef<{ iso3: string; name: string } | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadGeoJSON().then((data) => { featuresRef.current = data.features; }).catch(console.error);
    return () => { document.body.style.cursor = 'default'; };
  }, []);

  const handlePointerMove = useCallback((e: any) => {
    e.stopPropagation();
    const point = e.point as THREE.Vector3;
    const [lon, lat] = xyzToGeo(point, GLOBE_RADIUS);
    const hit = findCountryAtPoint(lon, lat, featuresRef.current);
    if (hit) {
      _hoveredIso3 = hit.iso3;
      hoveredRef.current = hit;
      document.body.style.cursor = 'pointer';
      onHover?.(hit.iso3, hit.name);
    } else {
      _hoveredIso3 = null;
      hoveredRef.current = null;
      document.body.style.cursor = 'default';
      onHover?.(null, null);
    }
  }, [onHover]);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    const ne = e.nativeEvent as PointerEvent;
    pointerDownPos.current = { x: ne.clientX, y: ne.clientY };
  }, []);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    const ne = e.nativeEvent as PointerEvent;
    if (pointerDownPos.current) {
      const dx = ne.clientX - pointerDownPos.current.x;
      const dy = ne.clientY - pointerDownPos.current.y;
      if (dx * dx + dy * dy > CLICK_DRAG_THRESHOLD) return;
    }
    if (hoveredRef.current && onCountryClick) {
      onCountryClick(hoveredRef.current.iso3, hoveredRef.current.name);
    }
  }, [onCountryClick]);

  const handlePointerLeave = useCallback(() => {
    _hoveredIso3 = null;
    hoveredRef.current = null;
    document.body.style.cursor = 'default';
    onHover?.(null, null);
  }, [onHover]);

  return (
    <mesh
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onPointerLeave={handlePointerLeave}
    >
      <sphereGeometry args={[GLOBE_RADIUS + 3, 64, 64]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} colorWrite={false} />
    </mesh>
  );
}

// ─── SizeGate (Canvas resize wait) ───

export function SizeGate({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready && size.width > 100 && size.height > 100) setReady(true);
  }, [size, ready]);
  return ready ? <>{children}</> : null;
}
