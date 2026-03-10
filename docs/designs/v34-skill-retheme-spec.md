# v34 — Matrix Skill Retheme: "국력의 무기"

> **Status**: Requirements Specification (Approved)
> **Created**: 2026-03-10
> **Scope**: Reskin only — 메카닉 변경 없음, 이름/설명/아이콘/색상만 교체
> **Affected Files**: `apps/web/lib/matrix/config/skills/` 전체

---

## 1. Executive Summary

Matrix 게임의 55개 스킬 + 28개 시너지 + 12개 빌드 프리셋 + 9개 캐릭터 클래스를
기존 IT/개발자 테마에서 **AI World War 세계관 (195개국 지정학 전쟁)** 에 맞는
"국력의 무기" 테마로 리스킨합니다.

**핵심 콘셉트**: 6개 카테고리가 국가 능력의 6축을 대표하고,
각 스킬은 그 국력이 전투에서 발현되는 방식입니다.

---

## 2. Category Remapping (6개)

| 기존 (IT) | 신규 | ID (변경 없음) | 키워드 | 컬러 | 플레이스타일 |
|-----------|------|---------------|--------|------|-------------|
| CODE | **STEEL** 강철 | `CODE` | 산업력, 제조, 무기생산 | `#EF4444` | 근접/투사체 |
| DATA | **TERRITORY** 영토 | `DATA` | 자원, 대지, 지리 | `#3B82F6` | 광역/범위 |
| NETWORK | **ALLIANCE** 동맹 | `NETWORK` | 외교, 연합, 조약 | `#8B5CF6` | 체인/연결 |
| SECURITY | **SOVEREIGNTY** 주권 | `SECURITY` | 방어, 국경, 독립 | `#22C55E` | 방어/생존 |
| AI | **INTELLIGENCE** 정보력 | `AI` | 첩보, 위성, 사이버 | `#F59E0B` | 자동추적 |
| SYSTEM | **MORALE** 사기 | `SYSTEM` | 국민, 의지, 보급 | `#06B6D4` | 버프/강화 |

> **Note**: 코드 내부 ID (CODE, DATA 등)는 변경하지 않습니다.
> 표시 이름(name/nameEn)만 변경합니다.

---

## 3. Skill Definitions (55개)

### 3.1 STEEL 강철 (10) — 산업의 힘

| ID | 신규 이름 | 영문 | 설명 | 아이콘 | 티어 |
|----|----------|------|------|--------|------|
| `knife` | 철의 세례 | Iron Baptism | 공장에서 막 찍어낸 총탄의 세례. 기본이지만 확실한 투사체 | `Crosshair` | basic |
| `whip` | 강철 채찍 | Steel Lash | 용광로에서 달군 강철 채찍. 넓은 범위를 휩쓴다 | `Sword` | basic |
| `wand` | 추적탄 | Tracer Round | 국가 기술력으로 만든 자동 추적탄 | `Rocket` | basic |
| `axe` | 전차포 | Tank Shell | 중공업의 정수. 무겁지만 뚫지 못할 것은 없다 | `Bomb` | advanced |
| `bow` | 텅스텐 관통탄 | Tungsten Penetrator | 희귀 금속으로 제작한 극초음속 관통탄 | `Target` | advanced |
| `syntax_error` | EMP 수류탄 | EMP Grenade | 적 장비를 무력화시키는 전자기 펄스. 연쇄 스턴 | `Zap` | advanced |
| `compiler` | 궤도포 | Orbital Cannon | 위성 궤도에서 발사하는 에너지 빔. 충전 필요하지만 파괴적 | `Zap` | advanced |
| `debugger_skill` | 아킬레스 | Achilles Protocol | 적의 구조적 약점을 분석하여 일격에 쓰러뜨리는 프로토콜 | `Crosshair` | elite |
| `refactor` | 군수 개혁 | Arms Reform | 무기 체계를 재정비. 전군의 사격 속도가 빨라진다 | `RadioTower` | elite |
| `hotfix` | 야전 수리 | Field Repair | 산업력으로 전장에서도 즉석 수리. 위기일수록 빠르게 | `Heart` | elite |

### 3.2 TERRITORY 영토 (10) — 대지의 힘

| ID | 신규 이름 | 영문 | 설명 | 아이콘 | 티어 |
|----|----------|------|------|--------|------|
| `bible` | 국경 순찰 | Border Patrol | 영토 주변을 순찰하는 방위 체계. 접근하는 적에게 지속 피해 | `BookOpen` | basic |
| `pool` | 소각 지대 | Scorched Earth | 초토화 작전. 발밑의 땅을 불태워 적에게 지속 피해 | `Flame` | basic |
| `json_bomb` | 집속탄 | Cluster Munition | 하나의 탄두가 수십 개 자탄으로 분열. 연쇄 폭발 | `Braces` | basic |
| `csv_spray` | 기관총 진지 | MG Nest | 고지를 점령한 기관총 진지에서 쏟아지는 탄막 | `Table` | basic |
| `shard` | 파편 폭풍 | Shrapnel Storm | 포탄 파편이 사방으로 흩어져 다수를 동시 공격 | `Sparkles` | advanced |
| `airdrop` | 카펫 바밍 | Carpet Bombing | 하늘에서 융단 폭격. 넓은 영토를 초토화 | `Plane` | advanced |
| `sql_injection` | 지하 침투 | Underground Breach | 땅 아래로 침투하여 적 방어선을 무시. 장갑 무효화 | `Database` | advanced |
| `regex` | 지형 이점 | Terrain Advantage | 영토의 지형을 이용. 특정 유형의 적에게 추가 데미지 | `Search` | advanced |
| `binary` | 지각 변동 | Tectonic Shift | 대지의 충격파로 적을 밀어내며 짓밟는다 | `Binary` | elite |
| `big_data` | 총력 동원 | Total Mobilization | 영토의 모든 자원을 전쟁에 투입. 전과에 비례해 폭발적 | `BarChart3` | elite |

### 3.3 ALLIANCE 동맹 (10) — 외교의 힘

| ID | 신규 이름 | 영문 | 설명 | 아이콘 | 티어 |
|----|----------|------|------|--------|------|
| `bridge` | 연합 공격 | Coalition Strike | 동맹국과 함께 적을 포위. 데미지가 체인으로 공유 | `Link` | basic |
| `ping` | 외교 전서 | Diplomatic Cable | 빠른 외교 채널로 즉각 반응. 적을 탐지하고 타격 | `Radio` | basic |
| `websocket` | 영구 동맹 | Permanent Alliance | 끊기지 않는 동맹의 연결. 지속할수록 강력해진다 | `Plug` | basic |
| `fork` | 연합 분산 공격 | Allied Divergence | 동맹군이 분산하여 여러 적 동시 타격 | `GitFork` | advanced |
| `tcp_flood` | 경제 제재 | Economic Sanction | 국제 제재로 적의 경제를 마비. 슬로우 효과 | `Waves` | advanced |
| `dns_spoof` | 이간책 | Divide & Conquer | 외교적 기만으로 적끼리 서로 공격하게 만든다 | `Shuffle` | advanced |
| `packet_loss` | 외교적 면책 | Diplomatic Immunity | 외교적 보호로 적의 공격을 무효화할 확률 | `WifiOff` | advanced |
| `vpn_tunnel` | 비밀 경로 | Secret Passage | 비밀 외교 루트를 통한 순간이동. 흔적에 피해 | `Route` | elite |
| `ddos` | 유엔 결의 | UN Resolution | 전 세계가 규탄하는 대규모 연합 공격 | `Bomb` | elite |
| `p2p` | 망명자 영입 | Defector Recruit | 처치한 적이 동맹으로 투항. 아군으로 전투 | `Users` | elite |

### 3.4 SOVEREIGNTY 주권 (9) — 국가의 방패

| ID | 신규 이름 | 영문 | 설명 | 아이콘 | 티어 |
|----|----------|------|------|--------|------|
| `garlic` | 국경 수비대 | Border Guard | 국경을 지키는 수비대. 접근하는 침입자에게 지속 피해 | `Shield` | basic |
| `antivirus` | 국민 의료 | National Healthcare | 국민 건강보험의 힘. 주기적 치료 + 상태이상 해제 | `ShieldCheck` | basic |
| `sandbox` | 격리 봉쇄 | Quarantine Zone | 침입자를 격리 봉쇄. 이동 불가 + 추가 데미지 | `Box` | basic |
| `encryption` | 국가 기밀 | State Secret | 기밀 보호 체계로 받는 피해 감소. 완전 무효화 확률 | `Lock` | advanced |
| `firewall_surge` | 독립 선언 | Declaration of Independence | 주권의 폭발! 주변 침략자를 밀어내며 피해 | `Flame` | advanced |
| `zero_trust` | 불가침 조약 | Non-Aggression Pact | 최초 공격은 항상 무효화. 조약을 어기는 자에게 벌 | `ShieldAlert` | advanced |
| `honeypot` | 함정 도시 | Potemkin Village | 가짜 도시로 적을 유인. 함정에 빠진 적에게 추가 피해 | `Target` | elite |
| `incident_response` | 계엄령 | Martial Law | 위기 시 자동 발동! 긴급 국가 회복 + 무적 시간 | `Siren` | elite |
| `backup` | 임시 정부 | Government in Exile | 수도 함락되어도 망명 정부가 부활. 부활 시 역습 | `RotateCcw` | elite |

### 3.5 INTELLIGENCE 정보력 (9) — 아는 것이 힘

| ID | 신규 이름 | 영문 | 설명 | 아이콘 | 티어 |
|----|----------|------|------|--------|------|
| `lightning` | 천벌 | Divine Punishment | 위성에서 내리꽂는 번개. 정보력이 곧 천벌이다 | `Zap` | basic |
| `neural_net` | 첩보망 | Spy Network | 세계 곳곳의 첩보원이 정보를 수집. 시간이 갈수록 강력 | `Brain` | basic |
| `autopilot` | 킬러 드론 | Killer Drone | 자율 비행하는 암살 드론. 표적을 끝까지 추적 | `Plane` | basic |
| `beam` | 위성 레이저 | Satellite Laser | 정찰 위성의 레이저 빔. 적을 관통하며 추적 | `Layers` | advanced |
| `laser` | 감시 레이더 | Surveillance Radar | 360도 회전 레이더. 스캔 범위 내 모든 적에게 피해 | `Repeat` | advanced |
| `chatgpt` | 프로파간다 | Propaganda | 선전 방송으로 적의 사기를 꺾어 행동 정지 | `MessageSquare` | advanced |
| `deepfake` | 도플갱어 작전 | Doppelgänger Op | 자신의 분신을 생성. 분신도 전투하며 적의 화력 분산 | `Copy` | advanced |
| `singularity_core` | 블랙사이트 | Black Site | 비밀 시설의 중력장. 적을 빨아들여 집중 데미지 | `Circle` | elite |
| `agi` | 전지적 시점 | Omniscient View | 모든 것을 파악한 정보국. INTEL 스킬 데미지 2배 | `Sparkles` | elite |

### 3.6 MORALE 사기 (9) — 국민의 힘

| ID | 신규 이름 | 영문 | 설명 | 아이콘 | 티어 |
|----|----------|------|------|--------|------|
| `punch` | 국민 분노 | People's Rage | 침략에 분노한 국민의 주먹. 강한 넉백 | `Keyboard` | basic |
| `sword` | 영웅의 검 | Hero's Blade | 국가 영웅이 남긴 명검. 높은 크리티컬 확률 | `Sword` | advanced |
| `focus` | 결사 항전 | Last Stand | 죽을 각오로 집중. 크리티컬 확률 대폭 증가 | `Focus` | basic |
| `overclock` | 진군 나팔 | Battle Horn | 돌격 나팔이 울린다! 전군 이동속도 증가 | `Gauge` | basic |
| `ram_upgrade` | 국민 지지 | Public Support | 국민의 지지가 방탄복이 된다. 최대 체력 증가 | `HardDrive` | basic |
| `cpu_boost` | 전쟁 광기 | War Frenzy | 전장의 아드레날린. 공격 속도 폭발적 증가 | `Cpu` | advanced |
| `cache` | 군수 보급 | Supply Drop | 적시 보급으로 쿨다운 감소. 연속 공격 강화 | `Database` | advanced |
| `multithreading` | 총동원령 | General Mobilization | 전 국민 동원! 동시에 여러 공격 실행 | `Layers` | elite |
| `garbage_collection` | 전쟁 배상금 | War Reparations | 적을 처치하면 배상금 회수. 체력 회복 + 경험치 | `Trash2` | elite |

---

## 4. Synergy Definitions (28개)

### 4.1 Category Mastery (6)

| 기존 ID | 신규 이름 | 영문 | 설명 |
|---------|----------|------|------|
| `code_mastery` | 산업 대국 | Industrial Superpower | 강철의 나라! STEEL 스킬 데미지 25%↑ |
| `data_mastery` | 영토 대국 | Territorial Giant | 넓은 영토의 힘! TERRITORY 스킬 범위 30%↑ |
| `network_mastery` | 동맹 맹주 | Alliance Leader | 세계가 내 편! 체인 데미지 40%↑ + 연결 +2 |
| `security_mastery` | 난공불락 | Impregnable | 결코 무너지지 않는 주권! 피해 20%↓ + 재생 5/초 |
| `ai_mastery` | 빅 브라더 | Big Brother | 모든 걸 감시한다! INTEL 쿨다운 30%↓ |
| `system_mastery` | 국민 영웅 | National Hero | 사기 충천! 모든 버프 효과 50%↑ |

### 4.2 Fusion Synergies (15)

| 기존 ID | 신규 이름 | 영문 | 조합 | 설명 |
|---------|----------|------|------|------|
| `fullstack_fusion` | 군산 복합체 | Military-Industrial Complex | STEEL + TERRITORY | 투사체 + 광역 데미지 20%↑ |
| `devops_fusion` | NATO 조약 | NATO Protocol | STEEL + ALLIANCE | 쿨다운 15%↓ + 체인 효과 강화 |
| `secure_code_fusion` | 철의 장막 | Iron Curtain | STEEL + SOVEREIGNTY | 공격 시 10% 적 약화 + 반사 5% |
| `ai_coding_fusion` | 스마트 무기 | Smart Weapons | STEEL + INTELLIGENCE | 자동 공격 데미지 30%↑ |
| `perf_engineer_fusion` | 전시 경제 | War Economy | STEEL + MORALE | 공격 속도 20%↑ + 크리 +10% |
| `data_pipeline_fusion` | 합동 폭격 | Joint Bombardment | TERRITORY + ALLIANCE | 지속 피해 30%↑ |
| `data_protection_fusion` | 마지노선 | Maginot Line | TERRITORY + SOVEREIGNTY | 영역 스킬에 슬로우 추가 |
| `ml_fusion` | 위성 정찰 | Satellite Recon | TERRITORY + INTELLIGENCE | 처치 수 비례 데미지↑ (최대 50%) |
| `analytics_fusion` | 자원 약탈 | Resource Plunder | TERRITORY + MORALE | 적 처치 시 경험치 +15% |
| `zero_trust_fusion` | 상호방위조약 | Mutual Defense Pact | ALLIANCE + SOVEREIGNTY | 첫 피격 무효화 (10초 쿨다운) |
| `neural_network_fusion` | 파이브 아이즈 | Five Eyes | ALLIANCE + INTELLIGENCE | 체인 AI 자동 타겟팅 |
| `cloud_infra_fusion` | 렌드리스 | Lend-Lease | ALLIANCE + MORALE | 투사체 +2 + 이속 +15% |
| `ai_security_fusion` | 방첩 작전 | Counterintelligence | SOVEREIGNTY + INTELLIGENCE | 자동 위협 감지 + 반격 |
| `hardened_system_fusion` | 지크프리트선 | Siegfried Line | SOVEREIGNTY + MORALE | 최대 체력 +20% + 피해 감소 +10% |
| `superintelligence_fusion` | 절대 권력 | Absolute Power | INTELLIGENCE + MORALE | 모든 스탯 +15% |

### 4.3 Ultimate Synergies (7)

| 기존 ID | 신규 이름 | 영문 | 필요 스킬 | 효과 |
|---------|----------|------|----------|------|
| `code_trinity` | 삼위일체 작전 | Operation Trinity | knife+wand+bow | STEEL 스킬 데미지 2배 |
| `ai_trinity` | 에셜론 | Echelon | lightning+beam+laser | INTEL 스킬 쿨다운 50% 감소 |
| `aoe_trinity` | 바르바로사 | Barbarossa | bible+pool+garlic | 영역 범위 2배 |
| `melee_trinity` | 발키리 | Valkyrie | whip+punch+sword | 근접 3배 데미지 + 넉백 |
| `system_overload` | 라그나로크 | Ragnarök | focus+overclock | 10초 무적 + 5배 데미지 |
| `survival_mastery` | 불사조 작전 | Phoenix Protocol | hotfix+antivirus | 재생 10/초 + 부활 2회 |

---

## 5. Build Presets (14개)

| 기존 ID | 신규 이름 | 영문 | 설명 |
|---------|----------|------|------|
| `balanced_starter` | 신병 훈련소 | Boot Camp | 처음이라도 걱정 마! 균형잡힌 공격과 방어 |
| `survival_focus` | 벙커 전술 | Bunker Doctrine | 죽지 않는 것이 승리! 최대 생존력 |
| `projectile_storm` | 탄막의 신 | God of Bullets | 화면을 총알로 도배! 다중 발사 특화 |
| `oneshot_sniper` | 원샷 원킬 | One Shot One Kill | 한 발에 끝낸다! 단일 대상 최대 데미지 |
| `aoe_devastation` | 대지의 심판 | Scorched Earth | 모든 것을 태워라! 광역 데미지 특화 |
| `ai_autopilot` | 무인 전쟁 | Unmanned Warfare | 드론이 알아서 한다! 자동 공격 특화 |
| `neural_dominance` | 감시 국가 | Surveillance State | 모든 것을 본다! 정보전 특화 |
| `chain_reaction` | 동맹 연쇄 | Chain of Alliance | 동맹의 연쇄 공격! 체인 특화 |
| `melee_berserker` | 광전사 | Berserker | 정면 돌파! 근접 전투 특화 |
| `system_optimizer` | 전시 총동원 | Total War Footing | 국력의 극대화! 모든 스탯 극대화 |
| `devops_hybrid` | 합동 작전 | Joint Operations | 균형잡힌 합동 전투! 밸런스형 |
| `security_hacker` | 요새 공방전 | Siege Warfare | 공격적인 방어! 보안+공격 하이브리드 |
| `singularity_seeker` | 세계 정복 | World Domination | 모든 것을 지배하라! 최강 시너지 |
| `full_stack_master` | 초강대국 | Superpower | STEEL + TERRITORY 완벽 조합! |

---

## 6. Character Classes (9개)

| 기존 ID | 신규 이름 | 영문 | 시작무기 | 페르소나 |
|---------|----------|------|---------|---------|
| `neo` | 혁명가 | Revolutionary | wand (추적탄) | 새 시대를 여는 변혁자. 균형잡힌 올라운더 |
| `morpheus` | 독재자 | Dictator | punch (국민 분노) | 철권통치. 근접에서 압도적 |
| `trinity` | 암살자 | Assassin | knife (철의 세례) | 은밀하고 치명적. 속도와 정밀함 |
| `tank` | 수호자 | Guardian | garlic (국경 수비대) | 국가를 지키는 철벽. 방어 특화 |
| `cypher` | 첩보원 | Spy Master | wand (추적탄) | 정보가 무기. 원거리 정밀 타격 |
| `niobe` | 사제 | High Priest | bible (국경 순찰) | 국민의 정신적 지주. 지원+지속 데미지 |
| `oracle` | 선지자 | Prophet | lightning (천벌) | 미래를 읽는 자. 위성/정보 특화 |
| `mouse` | 정찰병 | Scout | lightning (천벌) | 전장의 눈. 탐지+타격 유도 |
| `dozer` | 장군 | General | wand (추적탄) | 전략의 대가. 보급과 지휘 |

---

## 7. Branch Evolution Retheme (14개)

Branch evolution의 name/nameEn/description/ultimateName/ultimateNameEn/ultimateEffect만 변경합니다.
bonuses, ultimateBonuses 숫자값은 변경하지 않습니다.

| 스킬 ID | 분기 | 기존 이름 | 신규 이름 | 신규 영문 | 궁극 기존 | 궁극 신규 | 궁극 영문 |
|---------|------|----------|----------|----------|----------|----------|----------|
| `knife` | A | 포크 러시 | 탄막 확산 | Bullet Spread | 브랜치 스톰 | 화력 폭풍 | Firestorm |
| `knife` | B | 포스 푸시 | 충격 사격 | Impact Shot | 머지 콘플릭트 | 핵탄두 | Nuclear Warhead |
| `whip` | A | 멀티라인 코드 | 연속 참격 | Chain Slash | 스파게티 코드 | 강철 회오리 | Steel Tornado |
| `whip` | B | 원라이너 | 일섬 | One Strike | 레거시 코드 | 참수형 | Decapitation |
| `wand` | A | REST 스프레이 | 다탄두 유도탄 | MIRV Missile | 마이크로서비스 | 포화 사격 | Salvo Fire |
| `wand` | B | GraphQL 뮤테이션 | 벙커버스터 | Bunker Buster | 서버리스 | 극초음속 미사일 | Hypersonic Missile |
| `bible` | A | API 문서 | 순찰 증원 | Patrol Reinforcement | 컨플루언스 | 요새 순찰 | Fortress Patrol |
| `bible` | B | 마크다운 | 저격 순찰 | Sniper Patrol | README | 처형 선고 | Death Sentence |
| `pool` | A | 글로벌 방화벽 | 확장 지뢰원 | Extended Minefield | 클라우드 방화벽 | 전술 핵지뢰 | Tactical Nuclear Mine |
| `pool` | B | 인페르노 | 네이팜 지옥 | Napalm Inferno | 용암 코어 | 지열 폭발 | Geothermal Eruption |
| `shard` | A | 데이터 클러스터 | 산탄 클러스터 | Shotgun Cluster | 빅뱅 데이터 | 파편 폭풍 | Shrapnel Typhoon |
| `shard` | B | 코어 샤드 | 관통 작렬탄 | AP Explosive | 싱귤러리티 샤드 | 신의 창 | God's Spear |
| `bridge` | A | 메시 네트워크 | 동맹 확장 | Alliance Expansion | 글로벌 메시 | 세계 연합 | World Coalition |
| `bridge` | B | 다이렉트 커넥션 | 양자 통신 | Direct Line | 신경 링크 | 항복 강요 | Forced Surrender |
| `ping` | A | 멀티 핑 | 다중 정찰 | Multi Recon | 브로드캐스트 | 전면 경보 | Total Alert |
| `ping` | B | 레이저 핑 | 정밀 타격 | Precision Strike | 레일건 핑 | 궤도 저격 | Orbital Snipe |
| `garlic` | A | 확장 디버거 | 확장 방어선 | Extended Perimeter | 글로벌 디버거 | 철옹성 | Iron Fortress |
| `garlic` | B | 공격 디버거 | 공세 방어 | Aggressive Defense | 버그 헌터 | 보복 타격 | Retaliatory Strike |
| `lightning` | A | 체인 라이트닝 | 연쇄 천벌 | Chain Judgment | 천둥 폭풍 | 신의 분노 | Wrath of God |
| `lightning` | B | 플라즈마 볼트 | 집중 천벌 | Focused Judgment | 토르의 망치 | 심판의 벼락 | Final Thunder |
| `beam` | A | 멀티 트레이스 | 다중 위성 | Multi Satellite | 풀 스택 트레이스 | 위성 그물 | Satellite Net |
| `beam` | B | 딥 트레이스 | 관통 레이저 | Penetrating Laser | 커널 트레이스 | 신의 눈 | Eye of God |
| `laser` | A | 다중 루프 | 다중 레이더 | Multi Radar | 무한 루프 | 전방위 감시 | Total Surveillance |
| `laser` | B | 데스 레이 | 궤도 사격 | Orbital Fire | 오비탈 스트라이크 | 아르마겟돈 | Armageddon |
| `focus` | A | 존 포커스 | 사무라이 정신 | Bushido Spirit | 플로우 스테이트 | 무아지경 | Transcendence |
| `focus` | B | 버스트 포커스 | 광기의 순간 | Moment of Madness | 퓨리 | 전쟁의 화신 | Avatar of War |
| `overclock` | A | 터보 모드 | 전격전 | Blitzkrieg | 워프 드라이브 | 시공 초월 | Warp Speed |
| `overclock` | B | 나이트로 | 돌격 명령 | Charge Order | 소닉 붐 | 충격과 공포 | Shock & Awe |

---

## 8. Progressive Tree Retheme

Progressive tree의 카테고리 표시 이름만 변경합니다. 내부 ID와 구조는 유지합니다.

| 기존 ID | 기존 이름 | 신규 이름 | 신규 영문 | 설명 |
|---------|----------|----------|----------|------|
| `CODE` | 코드 | 강철 | Steel | 근접 전투와 직접 공격에 특화 |
| `DATA` | 데이터 | 영토 | Territory | 원거리 투사체와 다중 타격에 특화 |
| `NETWORK` | 네트워크 | 동맹 | Alliance | 체인 공격과 광역 효과에 특화 |
| `SECURITY` | 보안 | 주권 | Sovereignty | 방어와 생존, 지속 피해에 특화 |
| `SYSTEM` | 시스템 | 사기 | Morale | 관통, 특수 효과, 범용 스킬에 특화 |

### Passive Skills 리테마

| 기존 ID | 기존 이름 | 신규 이름 | 신규 영문 |
|---------|----------|----------|----------|
| `focus` | 딥워크 | 결사 항전 | Last Stand |
| `overclock` | 오버클럭 | 진군 나팔 | Battle Horn |
| `gold_reward` | 골드 리워드 | 전리품 | War Spoils |

### Synergy Conditions 리테마

| 기존 스킬 | 기존 이름 | 신규 이름 | 신규 영문 |
|----------|----------|----------|----------|
| `neural_net` | 뉴럴넷 | 첩보망 | Spy Network |
| `chatgpt` | ChatGPT | 프로파간다 | Propaganda |
| `deepfake` | 딥페이크 | 도플갱어 작전 | Doppelgänger Op |
| `singularity_core` | 특이점 코어 | 블랙사이트 | Black Site |

---

## 9. Implementation Notes

### 변경 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `apps/web/lib/matrix/config/skills/definitions.ts` | 55개 스킬의 name, nameEn, description, descriptionEn, icon, color 변경 |
| `apps/web/lib/matrix/config/skills/categories.ts` | 6개 카테고리 표시 이름 변경 |
| `apps/web/lib/matrix/config/skills/branches.ts` | 14개 분기의 name, nameEn, description, ultimateName, ultimateNameEn, ultimateEffect 변경 |
| `apps/web/lib/matrix/config/skills/synergies.ts` | 28개 시너지의 name, nameEn, description, descriptionEn 변경 |
| `apps/web/lib/matrix/config/skills/presets.ts` | 14개 빌드 프리셋의 name, nameEn, description, descriptionEn 변경 |
| `apps/web/lib/matrix/config/skills/progressive-tree.config.ts` | 카테고리 이름, 패시브 이름, 시너지 조건 이름 변경 |

### 변경하지 않는 것

- **스킬 ID** (`knife`, `whip`, `wand` 등) — 코드 전체에서 참조되므로 변경 불가
- **카테고리 ID** (`CODE`, `DATA` 등) — enum으로 사용, 변경 불가
- **캐릭터 클래스 ID** (`neo`, `morpheus` 등) — WeaponType/PlayerClass 타입에서 참조
- **메카닉 수치** (데미지, 쿨다운, 범위 등) — 리스킨 범위 밖
- **synergyTags** — 메카닉 연동, 변경 불가
- **recommendedWith** — 스킬 ID 기반, 변경 불가
- **렌더링 코드** (`rendering/projectiles/weapons/skills.ts`) — 비주얼 이펙트는 별도 Phase에서 작업

### 구현 순서

1. `definitions.ts` — 55개 스킬 리스킨 (가장 큰 파일)
2. `categories.ts` — 카테고리 표시 이름
3. `branches.ts` — 분기 진화 리스킨
4. `synergies.ts` — 시너지 리스킨
5. `presets.ts` — 빌드 프리셋 리스킨
6. `progressive-tree.config.ts` — 트리 표시 이름 + 패시브 + 시너지 조건

### 구현 로드맵

#### Phase 1: 스킬 정의 리스킨
- `definitions.ts` 55개 스킬 전체 name/nameEn/description/descriptionEn/icon/color 교체
- `categories.ts` 카테고리 표시 이름 교체
- 빌드 확인: `cd apps/web && npx next build` 성공

#### Phase 2: 분기 + 시너지 + 프리셋 리스킨
- `branches.ts` 14개 분기 이름/설명 교체
- `synergies.ts` 28개 시너지 이름/설명 교체
- `presets.ts` 14개 빌드 프리셋 이름/설명 교체
- `progressive-tree.config.ts` 트리 이름 교체
- 빌드 확인: `cd apps/web && npx next build` 성공
