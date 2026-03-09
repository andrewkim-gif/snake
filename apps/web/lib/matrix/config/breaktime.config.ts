/**
 * breaktime.config.ts - 데이터 버스트 시스템 설정
 * CODE SURVIVOR v4.0 - AI vs Programmer (Matrix meets Office Space)
 *
 * 컨셉: AI 시스템의 대규모 데이터 동기화 시도
 * - 버스트 동안 AI 봇들이 대거 스폰 (동기화 패킷 = 적)
 * - 버그 데이터(젬)가 더 많이 생성됨
 * - 궁극기: 커널 패닉 (시스템 전체 리셋)
 */

import { BreakTimeState } from '../types';

export const BREAK_TIME_CONFIG = {
  // 기본 설정
  interval: 60,            // 데이터 버스트 간격 (초)
  duration: 10,            // 버스트 지속 시간 (초)
  warningTime: 3,          // 예고 시간 (초)
  firstBreakDelay: 45,     // 첫 버스트까지 대기 (초) - 게임 시작 직후는 제외

  // 버프 효과
  effects: {
    spawnMultiplier: 3,      // AI 스폰 배율 (동기화 트래픽)
    xpMultiplier: 2,         // 경험치 배율 (데이터 수확)
    comboGaugeMultiplier: 2, // 콤보 타이머 충전 배율 (버퍼링)
    gemValueMultiplier: 1.5  // 버그 데이터 가치 배율
  },

  // 커널 패닉 궁극기
  ultimate: {
    gaugePerKill: 2,           // 킬당 게이지 증가 (버스트 중)
    gaugePerKillNormal: 0.5,   // 일반 시간 킬당 게이지 증가
    maxGauge: 100,             // 최대 게이지
    damage: 9999,              // 전체화면 공격 데미지
    slowDuration: 1.5,         // 시간 정지 연출 (초)
    slowFactor: 0.1,           // 슬로우 배율 (10%로 느려짐)
    invincibleDuration: 0.5,   // 발동 중 무적 시간
    screenFlashDuration: 0.3,  // 화면 플래시 시간
    shakeIntensity: 10         // 화면 흔들림 강도
  },

  // 시각 효과 (매트릭스 그린 테마)
  visual: {
    // 예고 (시스템 경고)
    warningBorderColor: 'rgba(0, 255, 65, 0.8)',  // 매트릭스 그린
    warningPulseSpeed: 2,      // 초당 펄스 횟수

    // 버스트 활성화
    activeBorderColor: 'rgba(0, 255, 65, 1)',     // 매트릭스 그린
    activeBorderWidth: 8,
    activeGlowIntensity: 20,

    // 게이지 바
    gaugeBarWidth: 200,
    gaugeBarHeight: 12,
    gaugeBarColor: '#00FF41',  // 매트릭스 그린
    gaugeBarBgColor: 'rgba(0, 0, 0, 0.5)',

    // 커널 패닉 준비
    ultimateReadyPulse: true,
    ultimateReadyColor: '#ff4444'  // 위험 빨강
  },

  // 사운드
  sounds: {
    warning: 'breaktime_warning',     // 시스템 경고음
    start: 'breaktime_start',         // 데이터 버스트 시작
    end: 'breaktime_end',             // 버스트 종료 (DDoS 시작)
    ultimate: 'breaktime_ultimate',   // 커널 패닉 발동
    gaugeUp: 'breaktime_gauge',       // 게이지 충전
    gaugeFull: 'breaktime_gaugefull'  // 게이지 가득 참
  },

  // 텍스트
  texts: {
    warning: {
      ko: '데이터 버스트 {seconds}초 전!',
      en: 'Data Burst in {seconds}s!'
    },
    start: {
      ko: '데이터 버스트!',
      en: 'Data Burst!'
    },
    end: {
      ko: 'AI 웨이브!',
      en: 'AI Wave!'
    },
    ultimateReady: {
      ko: '커널 패닉 준비!',
      en: 'Kernel Panic Ready!'
    },
    ultimateUse: {
      ko: '커널 패닉!',
      en: 'Kernel Panic!'
    }
  }
};

// 초기 안전지대 상태 생성
export function createInitialBreakTimeState(): BreakTimeState {
  return {
    isActive: false,
    gauge: 0,
    timer: 0,
    nextBreakTime: BREAK_TIME_CONFIG.firstBreakDelay,
    warningTimer: 0,
    isWarning: false,
    ultimateReady: false,
    totalBreaks: 0,
    killsDuringBreak: 0
  };
}

// 게이지 계산 (킬 시)
export function calculateGaugeIncrease(isBreakTimeActive: boolean): number {
  return isBreakTimeActive
    ? BREAK_TIME_CONFIG.ultimate.gaugePerKill
    : BREAK_TIME_CONFIG.ultimate.gaugePerKillNormal;
}
