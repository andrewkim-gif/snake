import * as THREE from 'three'
import type { SnakeSkin } from '@snake-arena/shared'

// 텍스처 캐시 — 동일 스킨 재생성 방지
const skinCache = new Map<number, THREE.CanvasTexture>()
const faceCache = new Map<string, THREE.CanvasTexture>()

function applyPixelFilter(tex: THREE.CanvasTexture): THREE.CanvasTexture {
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 16×16 뱀 몸통 스킨 텍스처 생성 */
export function createBodyTexture(skin: SnakeSkin): THREE.CanvasTexture {
  const cached = skinCache.get(skin.id)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!

  // primaryColor 배경
  ctx.fillStyle = skin.primaryColor
  ctx.fillRect(0, 0, 16, 16)

  // 패턴 오버레이
  ctx.fillStyle = skin.secondaryColor
  switch (skin.pattern) {
    case 'striped':
      for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 2)
      break
    case 'dotted':
      for (let x = 2; x < 16; x += 5)
        for (let y = 2; y < 16; y += 5) ctx.fillRect(x, y, 2, 2)
      break
    case 'gradient': {
      // 위에서 아래로 secondaryColor 블렌딩
      for (let y = 0; y < 16; y++) {
        const alpha = y / 16
        ctx.globalAlpha = alpha * 0.6
        ctx.fillRect(0, y, 16, 1)
      }
      ctx.globalAlpha = 1
      break
    }
    // solid: primaryColor만
  }

  // 마크 느낌의 노이즈 (3-4 어두운 픽셀)
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  const seed = skin.id * 7
  for (let i = 0; i < 4; i++) {
    const px = ((seed + i * 13) % 14) + 1
    const py = ((seed + i * 7) % 14) + 1
    ctx.fillRect(px, py, 1, 1)
  }

  const tex = applyPixelFilter(new THREE.CanvasTexture(canvas))
  skinCache.set(skin.id, tex)
  return tex
}

/** 16×16 뱀 얼굴 텍스처 생성 */
export function createFaceTexture(skin: SnakeSkin): THREE.CanvasTexture {
  const key = `${skin.id}-${skin.eyeStyle}`
  const cached = faceCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!

  // 배경 = primaryColor
  ctx.fillStyle = skin.primaryColor
  ctx.fillRect(0, 0, 16, 16)

  // 눈 흰자
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(3, 4, 4, 4)  // 왼눈
  ctx.fillRect(9, 4, 4, 4)  // 오른눈

  // 동공 (눈 스타일별)
  ctx.fillStyle = '#222222'
  switch (skin.eyeStyle) {
    case 'default':
      ctx.fillRect(4, 5, 2, 2)
      ctx.fillRect(10, 5, 2, 2)
      break
    case 'angry':
      ctx.fillRect(4, 6, 2, 2)
      ctx.fillRect(10, 6, 2, 2)
      // 눈썹
      ctx.fillRect(3, 3, 4, 1)
      ctx.fillRect(9, 3, 4, 1)
      break
    case 'cute':
      ctx.fillRect(4, 5, 3, 3)
      ctx.fillRect(10, 5, 3, 3)
      // 하이라이트
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(5, 5, 1, 1)
      ctx.fillRect(11, 5, 1, 1)
      break
    case 'cool':
      // 선글라스
      ctx.fillStyle = '#333333'
      ctx.fillRect(2, 4, 5, 3)
      ctx.fillRect(9, 4, 5, 3)
      ctx.fillRect(7, 5, 2, 1)
      break
    case 'dot':
      ctx.fillRect(5, 6, 1, 1)
      ctx.fillRect(10, 6, 1, 1)
      break
    case 'wink':
      ctx.fillRect(4, 5, 2, 2)
      // 오른쪽 윙크
      ctx.fillRect(9, 6, 4, 1)
      break
  }

  // 입
  ctx.fillStyle = '#444444'
  ctx.fillRect(6, 11, 4, 1)

  const tex = applyPixelFilter(new THREE.CanvasTexture(canvas))
  faceCache.set(key, tex)
  return tex
}

/** 잔디 블록 상단 텍스처 (16×16) */
export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!

  // 기본 초록
  ctx.fillStyle = '#5D9B3E'
  ctx.fillRect(0, 0, 16, 16)

  // 약간 밝은/어두운 픽셀 산재 (마크 잔디 느낌)
  const greens = ['#6BA84A', '#4E8B30', '#68A645', '#538F35']
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = greens[i % greens.length]
    ctx.fillRect((i * 7 + 3) % 16, (i * 11 + 5) % 16, 1, 1)
  }

  return applyPixelFilter(new THREE.CanvasTexture(canvas))
}

/** 베드록 텍스처 (16×16) */
export function createBedrockTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#3C3C3C'
  ctx.fillRect(0, 0, 16, 16)

  const grays = ['#4A4A4A', '#333333', '#505050', '#2A2A2A']
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = grays[i % grays.length]
    const x = (i * 7 + 2) % 15
    const y = (i * 11 + 3) % 15
    ctx.fillRect(x, y, 1 + (i % 2), 1 + ((i + 1) % 2))
  }

  return applyPixelFilter(new THREE.CanvasTexture(canvas))
}

/** 텍스처 캐시 클리어 */
export function clearTextureCache(): void {
  for (const tex of skinCache.values()) tex.dispose()
  for (const tex of faceCache.values()) tex.dispose()
  skinCache.clear()
  faceCache.clear()
}
