/**
 * camera-shake.ts — 카메라 셰이크 시스템
 *
 * v16 Phase 7: 피격/킬 시 R3F 카메라 흔들림 (감쇠 진동)
 * - 셰이크: 감쇠 사인파 오프셋 (XY)
 * - 줌 펀치: FOV or distance 일시적 변화
 *
 * TPSCamera에서 매 프레임 addShakeOffset() 호출하여 카메라에 적용
 */

// ─── Types ───

interface ShakeInstance {
  /** 남은 시간 (초) */
  timeLeft: number;
  /** 총 지속 시간 (초) */
  duration: number;
  /** 최대 진폭 (world units) */
  intensity: number;
  /** 주파수 (Hz) — 초당 진동 횟수 */
  frequency: number;
  /** 감쇠 속도 (1=선형, 2=빠른 감쇠) */
  decay: number;
}

interface ZoomPunch {
  /** 남은 시간 (초) */
  timeLeft: number;
  /** 총 지속 시간 (초) */
  duration: number;
  /** 줌 배수 (1.05 = 5% 줌인) */
  scale: number;
}

// ─── CameraShakeState (싱글턴) ───

class CameraShakeState {
  private static _instance: CameraShakeState | null = null;

  private shakes: ShakeInstance[] = [];
  private zoomPunches: ZoomPunch[] = [];
  private enabled = true;

  // 출력 — 매 프레임 계산
  public offsetX = 0;
  public offsetY = 0;
  public zoomMultiplier = 1;

  private constructor() {}

  static getInstance(): CameraShakeState {
    if (!CameraShakeState._instance) {
      CameraShakeState._instance = new CameraShakeState();
    }
    return CameraShakeState._instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.shakes = [];
      this.zoomPunches = [];
      this.offsetX = 0;
      this.offsetY = 0;
      this.zoomMultiplier = 1;
    }
  }

  // ─── 트리거 API ───

  /** 피격 셰이크: 강도는 대미지 비례 */
  triggerHit(damage: number): void {
    if (!this.enabled) return;
    const intensity = Math.min(2.0, 0.3 + damage * 0.015);
    this.shakes.push({
      timeLeft: 0.2,
      duration: 0.2,
      intensity,
      frequency: 25,
      decay: 2,
    });
  }

  /** 킬 시 줌 펀치 + 약한 셰이크 */
  triggerKill(): void {
    if (!this.enabled) return;
    this.shakes.push({
      timeLeft: 0.15,
      duration: 0.15,
      intensity: 0.5,
      frequency: 20,
      decay: 2,
    });
    this.zoomPunches.push({
      timeLeft: 0.3,
      duration: 0.3,
      scale: 1.05,
    });
  }

  /** 사망 시 큰 셰이크 */
  triggerDeath(): void {
    if (!this.enabled) return;
    this.shakes.push({
      timeLeft: 0.4,
      duration: 0.4,
      intensity: 3.0,
      frequency: 30,
      decay: 1.5,
    });
  }

  /** 대시 시 약한 줌 펀치 */
  triggerDash(): void {
    if (!this.enabled) return;
    this.zoomPunches.push({
      timeLeft: 0.2,
      duration: 0.2,
      scale: 0.97, // 약간 줌아웃 (속도감)
    });
  }

  /** 커스텀 셰이크 */
  triggerCustom(intensity: number, duration: number, frequency = 20): void {
    if (!this.enabled) return;
    this.shakes.push({
      timeLeft: duration,
      duration,
      intensity,
      frequency,
      decay: 2,
    });
  }

  // ─── 매 프레임 업데이트 ───

  update(dt: number): void {
    if (!this.enabled) {
      this.offsetX = 0;
      this.offsetY = 0;
      this.zoomMultiplier = 1;
      return;
    }

    let totalX = 0;
    let totalY = 0;

    // 셰이크 합산
    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        this.shakes.splice(i, 1);
        continue;
      }

      // 진행률 (1→0)
      const progress = s.timeLeft / s.duration;
      // 감쇠 진폭
      const amplitude = s.intensity * Math.pow(progress, s.decay);
      // 사인파 진동 (시간 기반 위상)
      const phase = (s.duration - s.timeLeft) * s.frequency * Math.PI * 2;
      totalX += amplitude * Math.sin(phase);
      totalY += amplitude * Math.cos(phase * 1.3); // 약간 다른 주파수 → 원형 흔들림
    }

    this.offsetX = totalX;
    this.offsetY = totalY;

    // 줌 펀치 합산
    let zoomMul = 1;
    for (let i = this.zoomPunches.length - 1; i >= 0; i--) {
      const z = this.zoomPunches[i];
      z.timeLeft -= dt;
      if (z.timeLeft <= 0) {
        this.zoomPunches.splice(i, 1);
        continue;
      }

      // 이즈아웃 (빠르게 펀치 → 천천히 복원)
      const progress = z.timeLeft / z.duration;
      const eased = progress * progress; // quadratic ease-out
      const currentScale = 1 + (z.scale - 1) * eased;
      zoomMul *= currentScale;
    }

    this.zoomMultiplier = zoomMul;
  }
}

// ─── Export ───

export function getCameraShake(): CameraShakeState {
  return CameraShakeState.getInstance();
}

export type { CameraShakeState };
