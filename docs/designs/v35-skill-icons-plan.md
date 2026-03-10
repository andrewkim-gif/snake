# PLAN: v35 — Gemini AI 스킬 아이콘 생성

> **Status**: Draft
> **Created**: 2026-03-10
> **Scope**: 55개 Matrix 스킬 아이콘을 Gemini로 생성 → 배경 제거 → 게임에 적용

---

## 1. 개요

Matrix 게임의 55개 스킬이 현재 **lucide-react 벡터 아이콘**(Crosshair, Shield 등 범용 아이콘)을 사용 중입니다.
v34에서 "국력의 무기" 세계관으로 리테마했으므로, 아이콘도 세계관에 맞는 **커스텀 AI 생성 아이콘**으로 교체합니다.

**목표**:
- Gemini `gemini-3.1-flash-image-preview`로 55개 스킬 아이콘 생성
- sharp BFS 배경 제거로 투명 PNG 확보
- 64×64px 최종 사이즈 (HUD/레벨업 UI 표시용)
- 기존 lucide-react 아이콘 → 커스텀 이미지 아이콘으로 렌더링 전환

**핵심 콘셉트**: 6개 카테고리별 통일된 비주얼 랭귀지
- STEEL(강철): 붉은 금속, 산업, 무기공장
- TERRITORY(영토): 푸른 대지, 지형, 폭격
- ALLIANCE(동맹): 보라색 외교, 연결, 조약
- SOVEREIGNTY(주권): 초록 방패, 국경, 요새
- INTELLIGENCE(정보력): 황금 첩보, 위성, 드론
- MORALE(사기): 시안 국민, 사기, 영웅

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] 55개 스킬 각각에 대한 고유 커스텀 아이콘 이미지 생성
- [FR-2] 6개 카테고리 아이콘 (STEEL/TERRITORY/ALLIANCE/SOVEREIGNTY/INTELLIGENCE/MORALE)
- [FR-3] 3개 패시브 스킬 아이콘 (focus, overclock, gold_reward)
- [FR-4] 투명 배경 PNG (알파 채널)
- [FR-5] 기존 WEAPON_ICONS (lucide 컴포넌트 맵) → 이미지 기반 렌더링으로 전환
- [FR-6] 레벨업 모달, HUD 무기슬롯, 브랜치 선택 모달에서 동일 아이콘 사용

### 비기능 요구사항
- [NFR-1] 아이콘 크기: 64×64px (게임 UI 적합 사이즈)
- [NFR-2] 파일 포맷: PNG (투명 배경)
- [NFR-3] 스타일 일관성: 같은 카테고리 내 스킬들은 동일한 컬러 팔레트/스타일
- [NFR-4] 생성 비용: Gemini API 무료 티어 범위 (rate limit 2초/요청 준수)
- [NFR-5] 파일 크기: 아이콘당 <50KB (총 55개 × 50KB = ~2.7MB 이하)
- [NFR-6] 빌드 영향 없음: Next.js Image 또는 `<img>` 태그로 로드

---

## 3. 현황 분석

### 3.1 현재 아이콘 시스템

**config 파일** (`definitions.ts`): 각 스킬에 `icon: string` 필드 (lucide-react 이름)
```
knife → 'Crosshair', whip → 'Sword', garlic → 'Shield', ...
```

**렌더링** (`MatrixLevelUp.tsx`): `WEAPON_ICONS` Record가 weaponType → lucide 컴포넌트로 매핑
- **26개만 매핑**, 나머지 29개는 `Zap` 폴백 → 대부분 스킬이 동일 아이콘으로 표시되는 문제

**사용처**:
| 컴포넌트 | 파일 | 용도 |
|----------|------|------|
| MatrixLevelUp.tsx | 레벨업 선택 모달 | 스킬 선택지 3개 표시 |
| MatrixHUD.tsx | 하단 HUD 바 | 보유 스킬 6슬롯 표시 |
| BranchSelectModal.tsx | 브랜치 진화 모달 | A/B 분기 아이콘 |

### 3.2 기존 Gemini 생성 인프라

| 항목 | 상태 |
|------|------|
| Gemini API Key | `apps/web/.env.local`에 설정 완료 |
| 생성 스크립트 참조 | `scripts/regen-iso-assets.mjs` (44개 에셋 생성 경험) |
| 배경 제거 | sharp BFS flood fill 구현 완료 (tolerance 기반) |
| 리사이즈 | sharp Lanczos3 다운스케일 구현 완료 |
| 모델 | `gemini-3.1-flash-image-preview` (아이콘용 최적) |
| Rate Limit | 2초/요청 (무료 티어) |

### 3.3 생성 필요 수량

| 분류 | 수량 | 비고 |
|------|------|------|
| STEEL 스킬 | 10 | knife, whip, wand, axe, bow, syntax_error, compiler, debugger_skill, refactor, hotfix |
| TERRITORY 스킬 | 10 | bible, pool, json_bomb, csv_spray, shard, airdrop, sql_injection, regex, binary, big_data |
| ALLIANCE 스킬 | 10 | bridge, ping, websocket, fork, tcp_flood, dns_spoof, packet_loss, vpn_tunnel, ddos, p2p |
| SOVEREIGNTY 스킬 | 9 | garlic, antivirus, sandbox, encryption, firewall_surge, zero_trust, honeypot, incident_response, backup |
| INTELLIGENCE 스킬 | 9 | lightning, neural_net, autopilot, beam, laser, chatgpt, deepfake, singularity_core, agi |
| MORALE 스킬 | 9 | punch, sword, focus, overclock, ram_upgrade, cpu_boost, cache, multithreading, garbage_collection |
| **합계** | **57** | 55 스킬 + gold_reward 패시브 + 여유분 |

**예상 소요 시간**: 57개 × (API 호출 ~3초 + 후처리 ~1초 + 대기 2초) = **약 6분**

---

## 4. 기술 방향

### 생성
- **모델**: `gemini-3.1-flash-image-preview` (아이콘/UI 에셋 최적)
- **호출 방식**: REST API (fetch) — 기존 `regen-iso-assets.mjs` 패턴 재사용
- **생성 해상도**: 512×512 (Gemini 기본) → 후처리로 64×64 다운스케일

### 후처리
- **배경 제거**: sharp BFS flood fill (기존 구현 재사용, tolerance=50)
- **리사이즈**: sharp Lanczos3 → 64×64 `contain` (투명 패딩)
- **포맷**: PNG, compressionLevel=9

### 저장 위치
```
apps/web/public/assets/skills/
├── steel/          # STEEL 카테고리 (10)
│   ├── knife.png
│   ├── whip.png
│   └── ...
├── territory/      # TERRITORY 카테고리 (10)
├── alliance/       # ALLIANCE 카테고리 (10)
├── sovereignty/    # SOVEREIGNTY 카테고리 (9)
├── intelligence/   # INTELLIGENCE 카테고리 (9)
└── morale/         # MORALE 카테고리 (9)
```

### 렌더링 전환
**Before** (lucide 컴포넌트):
```tsx
const Icon = WEAPON_ICONS[opt.type] || Zap;
<Icon size={24} />
```

**After** (이미지):
```tsx
// 새로운 유틸: getSkillIconPath(weaponType) → '/assets/skills/steel/knife.png'
<img src={getSkillIconPath(opt.type)} alt={opt.name} width={24} height={24} />
// 또는 Next.js Image 컴포넌트
```

**폴백 전략**: 이미지 로드 실패 시 → 기존 lucide 아이콘으로 폴백 (WEAPON_ICONS 유지)

---

## 5. 아이콘 정의 (55개)

### 5.1 STEEL 강철 (10) — 붉은 금속 + 산업 + 무기

| # | ID | 이름 | 아이콘 묘사 | 비주얼 키워드 |
|---|-----|------|------------|-------------|
| 1 | knife | 철의 세례 | 빛나는 금속 총알 3발이 공장 연기 속에서 발사되는 모습 | bullet, factory smoke, red glow |
| 2 | whip | 강철 채찍 | 용광로에서 달궈진 빨간 쇠사슬 채찍이 휘어지는 모습 | red-hot chain whip, sparks |
| 3 | wand | 추적탄 | 열추적 미사일이 빨간 궤적을 남기며 날아가는 모습 | homing missile, red trail |
| 4 | axe | 전차포 | 무거운 전차 포탄이 폭발하는 모습 | tank shell, explosion, heavy |
| 5 | bow | 텅스텐 관통탄 | 날카로운 텅스텐 화살탄이 금속판을 관통하는 모습 | tungsten dart, piercing, metallic |
| 6 | syntax_error | EMP 수류탄 | 전자기 펄스 수류탄이 파란 전기 아크를 방출하는 모습 | EMP grenade, electric arc, blue sparks |
| 7 | compiler | 궤도포 | 위성에서 붉은 에너지 빔이 지상으로 내려오는 모습 | orbital beam, satellite, red laser |
| 8 | debugger_skill | 아킬레스 | 표적의 약점을 표시하는 빨간 레이저 조준경 | red laser sight, crosshair, weak point |
| 9 | refactor | 군수 개혁 | 빨간 기어가 맞물려 회전하는 군수 공장 기계장치 | red gears, mechanical, factory |
| 10 | hotfix | 야전 수리 | 불꽃 튀는 용접봉으로 수리하는 군 장갑차 | welding sparks, armored vehicle repair |

### 5.2 TERRITORY 영토 (10) — 푸른 대지 + 지형 + 폭격

| # | ID | 이름 | 아이콘 묘사 | 비주얼 키워드 |
|---|-----|------|------------|-------------|
| 11 | bible | 국경 순찰 | 파란 레이저 울타리가 경계를 따라 빛나는 모습 | blue laser fence, patrol, perimeter |
| 12 | pool | 소각 지대 | 불타는 초토화된 땅에서 푸른 연기가 피어오르는 모습 | scorched earth, blue smoke, flames |
| 13 | json_bomb | 집속탄 | 하나의 푸른 탄두가 수십 자탄으로 분열되는 순간 | cluster bomb, blue sub-munitions, split |
| 14 | csv_spray | 기관총 진지 | 모래주머니 진지에서 파란 예광탄이 쏟아지는 모습 | MG nest, sandbags, blue tracers |
| 15 | shard | 파편 폭풍 | 푸른 금속 파편이 폭발로 사방에 흩어지는 모습 | blue shrapnel, explosion, fragments |
| 16 | airdrop | 카펫 바밍 | 폭격기 편대가 푸른 폭탄을 투하하는 하늘 모습 | bomber squadron, carpet bombing, blue bombs |
| 17 | sql_injection | 지하 침투 | 땅 아래 터널을 통해 침투하는 병사 실루엣 | tunnel, underground, soldier silhouette |
| 18 | regex | 지형 이점 | 산악 지형에서 유리한 고지를 점령한 깃발 | mountain terrain, flag, high ground |
| 19 | binary | 지각 변동 | 땅이 갈라지며 푸른 에너지 충격파가 퍼지는 모습 | earthquake, blue shockwave, cracked earth |
| 20 | big_data | 총력 동원 | 수많은 자원(곡식/철/석유)이 전선으로 모이는 모습 | total mobilization, resources converging, blue glow |

### 5.3 ALLIANCE 동맹 (10) — 보라색 외교 + 연결 + 조약

| # | ID | 이름 | 아이콘 묘사 | 비주얼 키워드 |
|---|-----|------|------------|-------------|
| 21 | bridge | 연합 공격 | 보라색 빛으로 연결된 여러 국기가 하나의 적을 향하는 모습 | purple chains linking flags, target |
| 22 | ping | 외교 전서 | 봉인된 보라색 외교 서신이 빠르게 날아가는 모습 | sealed purple letter, swift, diplomatic |
| 23 | websocket | 영구 동맹 | 끊어지지 않는 보라색 사슬로 연결된 두 악수 | purple chain link, unbreakable handshake |
| 24 | fork | 연합 분산 공격 | 하나의 보라 화살이 3방향으로 갈라지는 모습 | purple arrow splitting three-way |
| 25 | tcp_flood | 경제 제재 | 금괴에 빨간 금지 마크가 씌워진 제재 도장 | gold bars, sanctions stamp, banned |
| 26 | dns_spoof | 이간책 | 가면을 쓴 외교관이 두 적 사이에서 속삭이는 실루엣 | masked diplomat, whispering, divide |
| 27 | packet_loss | 외교적 면책 | 보라색 방어막이 공격을 튕겨내는 외교관 실루엣 | purple shield, deflecting, diplomat |
| 28 | vpn_tunnel | 비밀 경로 | 보라색 포탈/웜홀로 순간이동하는 모습 | purple portal, wormhole, teleport |
| 29 | ddos | 유엔 결의 | 수많은 국기가 동심원으로 모여 한 점을 공격하는 모습 | many flags converging, UN-style, circular |
| 30 | p2p | 망명자 영입 | 적 진영에서 넘어온 병사가 아군 보라색 깃발을 받는 모습 | defector, receiving purple flag, crossing line |

### 5.4 SOVEREIGNTY 주권 (9) — 초록 방패 + 국경 + 요새

| # | ID | 이름 | 아이콘 묘사 | 비주얼 키워드 |
|---|-----|------|------------|-------------|
| 31 | garlic | 국경 수비대 | 초록 빛나는 방패를 든 국경 수비대 병사 실루엣 | green shield, border guard, sentinel |
| 32 | antivirus | 국민 의료 | 초록 십자가가 빛나는 의료 키트 | green cross, medical kit, healing glow |
| 33 | sandbox | 격리 봉쇄 | 초록 에너지 장벽으로 둘러싸인 격리 구역 | green barrier, quarantine zone, contained |
| 34 | encryption | 국가 기밀 | 초록 빛나는 자물쇠에 "극비" 도장이 찍힌 문서 | green lock, classified stamp, secret document |
| 35 | firewall_surge | 독립 선언 | 초록 에너지 폭발파가 사방으로 퍼지며 침략자를 밀어내는 모습 | green explosion wave, repelling, independence |
| 36 | zero_trust | 불가침 조약 | 금이 간 양피지 위의 초록 조약 인장 | cracked parchment, green treaty seal |
| 37 | honeypot | 함정 도시 | 멀리서는 화려하지만 가까이 보면 가짜인 마을 (초록 유령 빛) | fake town, ghostly green, Potemkin |
| 38 | incident_response | 계엄령 | 초록 경고등이 빛나는 비상 사이렌 | green emergency siren, martial law, alert |
| 39 | backup | 임시 정부 | 폐허 속에서 초록 깃발을 꽂는 손 (임시 정부 부활) | hand planting green flag, ruins, rise |

### 5.5 INTELLIGENCE 정보력 (9) — 황금 첩보 + 위성 + 드론

| # | ID | 이름 | 아이콘 묘사 | 비주얼 키워드 |
|---|-----|------|------------|-------------|
| 40 | lightning | 천벌 | 위성에서 황금 번개가 내려꽂는 모습 | golden lightning, satellite, divine strike |
| 41 | neural_net | 첩보망 | 세계지도 위에 황금 거미줄처럼 퍼진 정보 네트워크 | golden web on world map, spy network |
| 42 | autopilot | 킬러 드론 | 황금 빛나는 무인 정찰/공격 드론이 비행하는 모습 | golden drone, unmanned, surveillance |
| 43 | beam | 위성 레이저 | 위성에서 황금 레이저 빔이 지상을 관통하는 모습 | golden laser beam, satellite, penetrating |
| 44 | laser | 감시 레이더 | 360도 회전하며 황금 스캔파를 쏘는 레이더 접시 | golden radar dish, rotating scan, 360° |
| 45 | chatgpt | 프로파간다 | 확성기에서 황금 음파가 퍼지는 선전 방송탑 | golden sound waves, loudspeaker, propaganda tower |
| 46 | deepfake | 도플갱어 작전 | 한 사람의 실루엣이 여러 분신으로 갈라지는 모습 | silhouette splitting, doppelgänger, golden |
| 47 | singularity_core | 블랙사이트 | 황금 중력장이 모든 것을 빨아들이는 비밀 시설 | golden vortex, black site, gravity well |
| 48 | agi | 전지적 시점 | 모든 것을 내려다보는 황금 눈 (전지적 시점) | golden all-seeing eye, omniscient, watching |

### 5.6 MORALE 사기 (9) — 시안 국민 + 사기 + 영웅

| # | ID | 이름 | 아이콘 묘사 | 비주얼 키워드 |
|---|-----|------|------------|-------------|
| 49 | punch | 국민 분노 | 시안 빛나는 주먹이 돌진하는 모습 (분노의 에너지) | cyan fist, rage, energy burst |
| 50 | sword | 영웅의 검 | 시안 빛 아우라를 가진 전설의 명검 | cyan glowing legendary sword, heroic |
| 51 | focus | 결사 항전 | 시안 조준경이 적에게 고정된 집중 상태 | cyan crosshair, locked on, focused |
| 52 | overclock | 진군 나팔 | 시안 에너지 파동을 내뿜는 전쟁 나팔 | cyan war horn, energy waves, charge |
| 53 | ram_upgrade | 국민 지지 | 수많은 시안 빛 실루엣 국민이 함께 서 있는 모습 | cyan citizen silhouettes, united, support |
| 54 | cpu_boost | 전쟁 광기 | 시안 아드레날린 효과로 눈이 빛나는 전사 | cyan glowing eyes, warrior, adrenaline |
| 55 | cache | 군수 보급 | 시안 빛 낙하산으로 투하되는 보급 상자 | cyan parachute, supply crate, airdrop |
| 56 | multithreading | 총동원령 | 시안 깃발 아래 정렬된 대규모 군대 실루엣 | cyan banner, massive army, mobilization |
| 57 | garbage_collection | 전쟁 배상금 | 황금 주화가 적 실루엣에서 쏟아지는 모습 | gold coins falling from enemy, reparations |

---

## 6. 프롬프트 전략

### 6.1 공통 스타일 DNA (모든 프롬프트 접두사)

```
Create a 512x512 game skill icon with a dark background.
Military war theme, detailed weapon/equipment illustration.
Clean centered composition, single object/concept, bold silhouette.
Slight metallic sheen, dramatic lighting, game UI quality.
NO text, NO letters, NO watermark, NO border.
```

### 6.2 카테고리별 컬러 지시

| 카테고리 | 컬러 지시 | 배경 톤 |
|----------|----------|---------|
| STEEL | `Red metallic glow (#EF4444), iron/steel textures, factory sparks` | 어두운 회색 + 붉은 하이라이트 |
| TERRITORY | `Blue energy (#3B82F6), terrain/earth tones, explosive blue effects` | 어두운 갈색 + 푸른 하이라이트 |
| ALLIANCE | `Purple glow (#8B5CF6), diplomatic/chain motifs, violet energy` | 어두운 남색 + 보라 하이라이트 |
| SOVEREIGNTY | `Green glow (#22C55E), shield/fortress motifs, emerald energy` | 어두운 군록 + 초록 하이라이트 |
| INTELLIGENCE | `Golden/amber glow (#F59E0B), satellite/tech motifs, gold energy` | 어두운 갈색 + 황금 하이라이트 |
| MORALE | `Cyan glow (#06B6D4), human/spirit motifs, teal energy` | 어두운 청색 + 시안 하이라이트 |

### 6.3 티어별 복잡도 지시

| 티어 | 복잡도 지시 |
|------|------------|
| basic | `Simple icon, single object, clean silhouette, minimal details` |
| advanced | `Moderate complexity, some particle effects, medium detail` |
| elite | `Epic tier, intense glow effects, dramatic composition, legendary feel` |

### 6.4 프롬프트 조합 공식

```
{공통 스타일 DNA}
{카테고리 컬러 지시}
{티어 복잡도 지시}
Depict: {아이콘 묘사 (섹션 5의 description)}
Visual keywords: {비주얼 키워드}
```

### 6.5 생성 품질 보장

- **재시도 전략**: 파일 크기 < 1KB면 재생성 (빈 이미지 방지)
- **배경 제거 tolerance**: 50 (기존 iso 에셋과 동일)
- **다크 배경 처리**: Gemini에 "dark background" 요청 → BFS가 다크 배경 자동 감지/제거
- **일관성**: 같은 카테고리 아이콘은 연속 생성하여 스타일 drift 최소화

---

## 7. 파이프라인 설계

### 7.1 생성 스크립트 (`scripts/gen-skill-icons.mjs`)

기존 `regen-iso-assets.mjs` 패턴을 재사용하되, 스킬 아이콘에 최적화:

```
입력: 55개 스킬 정의 (id, name, category, tier, description)
  ↓
[1] 프롬프트 조합 (공통 DNA + 카테고리 컬러 + 티어 복잡도 + 개별 묘사)
  ↓
[2] Gemini API 호출 (512×512 생성, 2초 rate limit)
  ↓
[3] 품질 검증 (파일 크기 > 1KB, 이미지 dimensions 확인)
  ↓
[4] sharp 배경 제거 (BFS flood fill, tolerance=50)
  ↓
[5] sharp 리사이즈 (512→64, Lanczos3, contain, 투명 패딩)
  ↓
[6] PNG 저장 (compressionLevel=9)
  ↓
출력: apps/web/public/assets/skills/{category}/{id}.png
```

### 7.2 아이콘 로드 유틸 (`lib/matrix/utils/skill-icons.ts`)

```typescript
// weaponType → 이미지 경로 매핑
const CATEGORY_DIR: Record<SkillCategory, string> = {
  CODE: 'steel',
  DATA: 'territory',
  NETWORK: 'alliance',
  SECURITY: 'sovereignty',
  AI: 'intelligence',
  SYSTEM: 'morale',
};

export function getSkillIconPath(weaponType: WeaponType): string {
  const skill = ALL_SKILLS.find(s => s.id === weaponType);
  if (!skill) return '/assets/skills/fallback.png';
  const dir = CATEGORY_DIR[skill.category];
  return `/assets/skills/${dir}/${weaponType}.png`;
}
```

### 7.3 UI 컴포넌트 전환

**SkillIcon 컴포넌트** (신규):
```tsx
// 이미지 아이콘 + lucide 폴백
function SkillIcon({ type, size = 24 }: { type: WeaponType; size?: number }) {
  const [error, setError] = useState(false);
  const path = getSkillIconPath(type);
  const FallbackIcon = WEAPON_ICONS[type] || Zap;

  if (error) return <FallbackIcon size={size} />;
  return <img src={path} width={size} height={size} onError={() => setError(true)} />;
}
```

**교체 대상**:
1. `MatrixLevelUp.tsx` — `WEAPON_ICONS[opt.type]` → `<SkillIcon type={opt.type} />`
2. `MatrixHUD.tsx` — HUD 슬롯 아이콘
3. `BranchSelectModal.tsx` — 브랜치 아이콘

---

## 8. 리스크

| 리스크 | 영향 | 확률 | 완화 전략 |
|--------|------|------|----------|
| Gemini 이미지 품질 불일치 | 카테고리 내 스타일 차이 | 중 | 같은 카테고리 연속 생성, 프롬프트 엔지니어링 강화 |
| 배경 제거 실패 (다크 배경) | 투명 영역 잔여 | 중 | tolerance 조정, 코너+엣지 샘플링 포인트 추가 |
| Rate Limit 초과 | 생성 중단 | 저 | 2초 대기 (무료 티어), 카테고리별 배치 실행 |
| 아이콘 파일 크기 초과 | 로딩 지연 | 저 | compressionLevel=9, 64px 강제, WebP 고려 |
| 일부 스킬의 추상적 컨셉 | 아이콘 의미 전달 약함 | 중 | 프롬프트에 구체적 오브젝트 지정, 재생성 허용 |
| 이미지 로드 실패 (CDN/네트워크) | UI 빈 공간 | 저 | lucide 아이콘 폴백 유지 |

---

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: 생성 스크립트 + 디렉토리 구조
| Task | 설명 |
|------|------|
| 디렉토리 생성 | `apps/web/public/assets/skills/{steel,territory,alliance,sovereignty,intelligence,morale}/` |
| gen-skill-icons.mjs 작성 | regen-iso-assets.mjs 패턴 재사용, 55개 스킬 정의 + 프롬프트 조합 + Gemini 호출 + sharp 후처리 파이프라인 |
| 카테고리 필터 CLI | `node scripts/gen-skill-icons.mjs steel` 처럼 카테고리별 단독 실행 지원 |
| 재시도 로직 | 파일크기 <1KB면 1회 재시도, 2회 실패 시 skip + 로그 |

- **design**: N (스크립트 개발)
- **verify**: `node scripts/gen-skill-icons.mjs --dry-run` 으로 프롬프트 출력 확인

### Phase 2: 아이콘 일괄 생성 (Gemini API)
| Task | 설명 |
|------|------|
| STEEL 10개 생성 | `node scripts/gen-skill-icons.mjs steel` |
| TERRITORY 10개 생성 | `node scripts/gen-skill-icons.mjs territory` |
| ALLIANCE 10개 생성 | `node scripts/gen-skill-icons.mjs alliance` |
| SOVEREIGNTY 9개 생성 | `node scripts/gen-skill-icons.mjs sovereignty` |
| INTELLIGENCE 9개 생성 | `node scripts/gen-skill-icons.mjs intelligence` |
| MORALE 9개 생성 | `node scripts/gen-skill-icons.mjs morale` |
| 품질 검수 | 전체 57개 파일 존재 + 크기 확인 + 비정상 파일 재생성 |

- **design**: N (API 호출 실행)
- **verify**: 57개 PNG 파일 존재, 각각 >1KB, 64×64 dimensions 확인

### Phase 3: 렌더링 전환 (코드 수정)
| Task | 설명 |
|------|------|
| skill-icons.ts 유틸 | `getSkillIconPath(weaponType)` 함수 + 카테고리-디렉토리 매핑 |
| SkillIcon 컴포넌트 | 이미지 렌더링 + onError lucide 폴백 |
| MatrixLevelUp.tsx 전환 | WEAPON_ICONS 제거 → SkillIcon 컴포넌트 사용 |
| MatrixHUD.tsx 전환 | HUD 슬롯 아이콘을 SkillIcon으로 교체 |
| BranchSelectModal.tsx 전환 | getBranchIcon() 제거 → SkillIcon 사용 |

- **design**: N (코드 리팩토링)
- **verify**: `cd apps/web && npx next build` 성공, 게임 실행 후 아이콘 표시 확인

### Phase 4: 품질 확인 + 커밋
| Task | 설명 |
|------|------|
| 전체 빌드 확인 | Next.js 빌드 성공 |
| 파일 크기 감사 | 전체 스킬 아이콘 총 크기 <3MB 확인 |
| Git 커밋 | 아이콘 에셋 + 코드 변경 커밋 |

- **design**: N
- **verify**: 빌드 성공 + 아이콘 57개 전체 존재 확인
