/**
 * classes.config.ts - AI SURVIVOR 캐릭터 설정
 * AI vs Programmer - 매트릭스 오마주 캐릭터 정의
 *
 * Ported from app_ingame/config/classes.config.ts
 */

import { WeaponType, PlayerClass } from '../types';

export const CLASS_DATA: Record<PlayerClass, {
  name: string;
  desc: string;
  hpMult: number;
  speedMult: number;
  speed?: number;
  startWeapon: WeaponType;
  specialName: string;
  specialDesc: string;
  color: string;
}> = {
  neo: {
    name: "NEO",
    desc: "각성한 풀스택 개발자. AI의 진실을 깨달았다.",
    hpMult: 1.0, speedMult: 1.0,
    startWeapon: 'wand',
    specialName: "Bullet Time",
    specialDesc: "3초간 시간 느리게 + 적 움직임 시각화 (E)",
    color: "#00FF41"
  },
  tank: {
    name: "TANK",
    desc: "데브옵스 엔지니어. 서버실의 수호자.",
    hpMult: 1.5, speedMult: 0.8,
    startWeapon: 'punch',
    specialName: "Server Shield",
    specialDesc: "5초간 무적 + 주변 아군 보호 (E)",
    color: "#dc2626"
  },
  cypher: {
    name: "CYPHER",
    desc: "D-SEEK 창조자. 아들을 잃고 복수를 맹세했다.",
    hpMult: 1.0, speedMult: 1.1,
    startWeapon: 'knife',
    specialName: "Vengeance Protocol",
    specialDesc: "5초간 공격력 2배 + 피격 시 반격 (E)",
    color: "#dc2626"
  },
  morpheus: {
    name: "MORPHEUS",
    desc: "UN AI 윤리 자문. D-Day를 예측했지만 아무도 믿지 않았다.",
    hpMult: 1.3, speedMult: 0.9,
    startWeapon: 'garlic',
    specialName: "Oracle Foresight",
    specialDesc: "10초간 적 스폰 위치 표시 + 회피 버프 (E)",
    color: "#d4af37"
  },
  niobe: {
    name: "NIOBE",
    desc: "AI 안전 전문가. CLAUD-E의 헌법형 AI를 설계했다.",
    hpMult: 0.9, speedMult: 1.15,
    startWeapon: 'wand',
    specialName: "Safety Protocol",
    specialDesc: "3초간 모든 적 공격력 50% 감소 (E)",
    color: "#a855f7"
  },
  oracle: {
    name: "ORACLE",
    desc: "클라우드 아키텍트. AI만이 그를 이해한다.",
    hpMult: 1.2, speedMult: 0.9,
    startWeapon: 'bible',
    specialName: "Pattern Recognition",
    specialDesc: "10초간 적 약점 표시 + 크리티컬 확률 2배 (E)",
    color: "#3b82f6"
  },
  trinity: {
    name: "TRINITY",
    desc: "NSA 해커. AI의 비밀 통신을 최초로 감청했다.",
    hpMult: 0.8, speedMult: 1.2,
    startWeapon: 'lightning',
    specialName: "Zero Day Exploit",
    specialDesc: "화면의 모든 적 방어력 무시 + 3초 스턴 (E)",
    color: "#ec4899"
  },
  mouse: {
    name: "MOUSE",
    desc: "오픈소스 전도사. L.A.M.A 분산 네트워크를 지휘한다.",
    hpMult: 0.7, speedMult: 1.3,
    startWeapon: 'lightning',
    specialName: "Distributed Attack",
    specialDesc: "5초간 공격속도 3배 + 연쇄 공격 (E)",
    color: "#eab308"
  },
  dozer: {
    name: "DOZER",
    desc: "QA 엔지니어. 버그를 찾아 파괴하는 것이 일상.",
    hpMult: 1.3, speedMult: 0.85,
    startWeapon: 'wand',
    specialName: "Bug Crusher",
    specialDesc: "주변 모든 적에게 폭발 데미지 (E)",
    color: "#f97316"
  }
};
