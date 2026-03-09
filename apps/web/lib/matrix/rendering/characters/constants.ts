/**
 * game/rendering/characters/constants.ts - 캐릭터 렌더링 상수
 *
 * 3등신 비율 (80% 축소 버전):
 * - 머리 14, 몸통 9, 다리 6 = 총 ~29px
 */

// 체형 상수 (3등신, 80% 스케일)
export const HEAD_SIZE = 14;  // 17 * 0.8 = 14
export const HEAD_Y = -HEAD_SIZE + 2;  // = -12

export const BODY_WIDTH = 10;   // 13 * 0.8 = 10
export const BODY_HEIGHT = 9;   // 11 * 0.8 = 9
export const LIMB_WIDTH = 2;    // 3 * 0.8 = 2
export const LIMB_LENGTH = 6;   // 7 * 0.8 = 6

// 사지 위치 (80% 스케일)
export const LEG_X = 2;        // 다리 간격 (3 * 0.8 = 2)
export const ARM_X = 4;        // 팔 위치 (어깨) - 5 * 0.8 = 4
export const ARM_Y = 2;        // 팔 높이 (어깨) - 3 * 0.8 = 2

// 얼굴 좌표 (HEAD_SIZE 비례)
export const EYE_X = HEAD_SIZE * 0.25;       // 눈 간격
export const EYE_BASE_X = EYE_X;             // alias
export const EYE_Y = HEAD_Y + HEAD_SIZE * 0.55;
export const FACE_WIDTH = HEAD_SIZE / 2 - 1;
export const JAW_EXTEND = 1;

// 외곽선
export const OUTLINE_WIDTH = 0.5;

// 애니메이션 (3등신 최적화)
export const WALK_PERIOD = 600;       // 한 걸음 주기 (ms)
export const IDLE_PERIOD = 8000;      // idle 루프 주기
export const BREATHE_PERIOD = 2000;   // 호흡 주기

// 캔버스 캐시 (80% 스케일)
export const CAT_CANVAS_BASE_SIZE = 46;  // 58 * 0.8 = 46
