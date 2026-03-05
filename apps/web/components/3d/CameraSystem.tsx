'use client'

import type { MutableRefObject } from 'react'
import { PlayCamera } from './PlayCamera'

export type CameraMode = 'play' | 'free' | 'follow' | 'overview'

interface CameraSystemProps {
  mode: CameraMode
  cameraTargetRef: MutableRefObject<{ x: number; z: number; mass: number }>
}

/** 카메라 모드 전환기 — Phase 1에서는 Play만 구현 */
export function CameraSystem({ mode, cameraTargetRef }: CameraSystemProps) {
  switch (mode) {
    case 'play':
      return <PlayCamera cameraTargetRef={cameraTargetRef} />
    // Phase 2에서 추가:
    // case 'free': return <FreeCamera />
    // case 'follow': return <FollowCamera target={...} />
    // case 'overview': return <OverviewCamera />
    default:
      return <PlayCamera cameraTargetRef={cameraTargetRef} />
  }
}
