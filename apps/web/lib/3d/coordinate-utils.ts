import * as THREE from 'three'

/** 서버 Position {x,y} → Three.js Vector3 (y→z, height=y) */
export function toWorld(x: number, y: number, height = 0): THREE.Vector3 {
  return new THREE.Vector3(x, height, y)
}

/** 서버 heading (0=위, 시계방향) → Three.js Y축 회전 */
export function headingToRotY(heading: number): number {
  return -heading
}

/** 서버 segments [[x,y],...] → 각 세그먼트의 다음 세그먼트 방향 Y축 회전 */
export function segmentRotY(
  segments: [number, number][],
  index: number,
): number {
  if (index + 1 >= segments.length) {
    // 마지막 세그먼트: 이전 세그먼트에서 현재 방향
    if (index > 0) {
      const prev = segments[index - 1]
      const cur = segments[index]
      return Math.atan2(cur[0] - prev[0], cur[1] - prev[1])
    }
    return 0
  }
  const cur = segments[index]
  const next = segments[index + 1]
  return Math.atan2(next[0] - cur[0], next[1] - cur[1])
}
