/**
 * Snake Arena — Validation Utilities v2.0
 * 입력 검증 (서버/클라이언트 공유)
 */

const TWO_PI = Math.PI * 2;

/** 유효한 각도인지 확인 (0~2π) */
export function isValidAngle(angle: unknown): angle is number {
  return typeof angle === 'number' && isFinite(angle) && angle >= 0 && angle <= TWO_PI;
}

/** 유효한 부스트 플래그인지 확인 */
export function isValidBoost(boost: unknown): boost is 0 | 1 {
  return boost === 0 || boost === 1;
}

/** 유효한 시퀀스 넘버인지 확인 */
export function isValidSequence(seq: unknown): seq is number {
  return typeof seq === 'number' && Number.isInteger(seq) && seq >= 0;
}

/** 플레이어 이름 검증 (1-16자, 영문/한글/숫자/언더스코어/하이픈) */
export function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 16) return false;
  return /^[a-zA-Z0-9가-힣_\-\s]+$/.test(name);
}

/** 유효한 스킨 ID인지 확인 */
export function isValidSkinId(skinId: unknown): skinId is number {
  return typeof skinId === 'number' && Number.isInteger(skinId) && skinId >= 0 && skinId < 12;
}

/** XSS 방지를 위한 이름 sanitize */
export function sanitizeName(name: string): string {
  return name
    .replace(/[<>&"']/g, '')
    .trim()
    .slice(0, 16);
}
