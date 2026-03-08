# PLAN: v23 — Globe 3D Effects 고도화 (이벤트 확장 + 3D 오브젝트 + 위치 보정)

## 1. 개요

v15에서 구현한 지구본 이벤트 이펙트(전쟁, 교역, 충격파, 미사일)가 있으나 3가지 근본 문제가 있음:

1. **이벤트 종류 부족** — 전쟁/교역만 있고, 동맹/제재/자원채굴/스파이/핵실험 등 다양한 국제 이벤트가 없음
2. **2D 느낌의 이펙트** — 미사일 헤드가 작은 구체, 폭발이 포인트 스프라이트, 교역 화물이 작은 공. 실감나는 3D 오브젝트가 아님
3. **카메라 포커스 위치 불일치** — centroidsMap이 최대 폴리곤 꼭짓점 평균이라 불규칙 국가(칠레, 인도네시아 등)에서 시각 중심과 다름

### 현재 상태 (AS-IS)

| 항목 | 현재 | 문제 |
|------|------|------|
| 이벤트 종류 | 전쟁(war), 교역(trade), 충격파, 이벤트펄스 | 동맹, 제재, 자원, 스파이 등 없음 |
| 미사일 | SphereGeometry(0.8) 구체 | 미사일 형태 아님, 연기 트레일 없음 |
| 폭발 | Points 30개 포인트 스프라이트 | 3D 파티클 볼륨감 없음 |
| 교역 화물 | SphereGeometry(0.6) 구체 | 자원 종류 구분 불가 |
| 전쟁 안개 | PlaneGeometry 빌보드 20개 | 볼륨메트릭 안개 아님 |
| 카메라 포커스 | 최대 폴리곤 꼭짓점 평균 centroid | 불규칙 국가에서 위치 불일치 |
| 승리 불꽃 | Points 300개 | 3D 불꽃놀이 느낌 부족 |

### 목표 (TO-BE)

```
🚀 미사일 → 원뿔+원기둥 3D 모델 + 연기 트레일 파티클
💥 폭발 → 3단계 3D 파티클 (섬광→화염구→파편)
📦 교역 화물 → 자원별 3D 아이콘 (유조선/비행기/컨테이너)
🌫️ 전쟁 안개 → 볼륨메트릭 셰이더 구체
🎯 카메라 포커스 → 보정된 시각 중심 centroid
🤝 동맹 → 2국가 연결 파란 빛줄기
🚫 제재 → 빨간 X 마크 + 차단선
⚡ 자원 채굴 → 지표면 빛나는 원 + 상승 파티클
🕵️ 첩보 → 은밀한 점선 + 깜빡이는 아이콘
☢️ 핵실험 → 거대 충격파 + 버섯구름 파티클
```

## 2. 요구사항

### 기능 요구사항
- [FR-1] 미사일을 원뿔+원기둥 조합 3D 메시로 교체, 연기 트레일 파티클 추가
- [FR-2] 폭발을 3단계 3D 파티클 시스템으로 교체 (섬광→화염구→파편 스프레드)
- [FR-3] 교역 화물을 자원 타입별 3D 아이콘으로 교체 (oil→탱커, tech→비행기, food→컨테이너, metal→광석)
- [FR-4] 전쟁 안개를 볼륨메트릭 셰이더 구체로 교체
- [FR-5] 승리 불꽃을 3D 로켓 파티클로 고도화 (상승→폭발 2단계)
- [FR-6] 신규 이벤트: 동맹(alliance beam), 제재(sanction barrier), 자원채굴(resource glow), 첩보(spy trail), 핵실험(nuke mushroom)
- [FR-7] 카메라 포커스 centroid를 시각 중심 가중 centroid로 보정
- [FR-8] CameraAutoFocus와 OrbitControls 충돌 방지 (포커스 중 유저 입력 시 즉시 중단)

### 비기능 요구사항
- [NFR-1] 60fps 유지 (동시 전쟁 5개 + 교역 30개 기준)
- [NFR-2] 추가 외부 3D 모델 없음 (프로시져럴 geometry만 사용)
- [NFR-3] 모바일 LOD: 파티클 수 50% 감소, 볼륨 안개 비활성화
- [NFR-4] GC 방지: 모듈 스코프 temp 객체 사전 할당

## 3. 기술 방향

- **프레임워크**: React Three Fiber v9 + @react-three/postprocessing (기존)
- **3D 오브젝트**: `BufferGeometry` 프로시져럴 생성 (ConeGeometry + CylinderGeometry 조합 등)
- **파티클 시스템**: InstancedMesh 기반 (Points 대체 → 크기/회전/색상 개별 제어)
- **셰이더**: Custom ShaderMaterial (볼륨 안개, 3D 폭발 등)
- **Centroid 보정**: Largest polygon → 면적 가중 중심 (area-weighted centroid)

## 4. 아키텍처 개요

```
GlobeScene
├── GlobeWarEffects (고도화)
│   ├── WarArcLine (기존 유지, 색상/두께 미세 조정)
│   ├── TerritoryBlink (기존 유지)
│   ├── ★ Missile3D (원뿔+원기둥 InstancedMesh + 연기 트레일)
│   ├── ★ Explosion3D (3단계 InstancedMesh 파티클)
│   ├── ★ WarFog3D (볼륨메트릭 셰이더 구체)
│   ├── ★ VictoryFireworks3D (로켓 상승→폭발)
│   └── CameraShake (기존 유지)
│
├── GlobeTradeRoutes (고도화)
│   ├── 교역 라인 (기존 ShaderMaterial 유지)
│   └── ★ CargoIcons3D (자원별 3D 메시: 탱커/비행기/컨테이너/광석)
│
├── ★ GlobeAllianceBeam (NEW — 동맹 빛줄기)
├── ★ GlobeSanctionBarrier (NEW — 제재 차단선)
├── ★ GlobeResourceGlow (NEW — 자원 채굴 지표 이펙트)
├── ★ GlobeSpyTrail (NEW — 첩보 점선 트레일)
├── ★ GlobeNukeEffect (NEW — 핵실험 버섯구름)
│
├── GlobeConflictIndicators (기존 유지)
├── GlobeEventPulse (기존 유지, 신규 이벤트 타입 추가)
├── GlobeShockwave (기존 유지)
│
├── ★ CameraAutoFocus (보정)
│   └── OrbitControls 충돌 방지 로직
│
└── ★ centroidsMap 보정 (면적 가중 중심)
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| InstancedMesh 과다 (이벤트 5+종 동시) | 드로우콜 폭증 → fps 하락 | 이벤트당 최대 인스턴스 수 제한 + LOD |
| 프로시져럴 3D 메시 품질 | 너무 단순해 보일 수 있음 | MC 복셀 스타일 유지 (프로젝트 아이덴티티) |
| 볼륨메트릭 안개 셰이더 성능 | 모바일 GPU 부담 | 모바일 LOD에서 비활성화 (enableWarFog 활용) |
| centroid 보정 시 기존 컴포넌트 영향 | 라벨/이펙트 위치 전체 변경 | 기존 centroid와 비교 검증 후 일괄 교체 |
| CameraAutoFocus + OrbitControls 충돌 | 카메라 떨림/점프 | 포커스 중 OrbitControls.enabled = false, 유저 입력 시 즉시 중단 |

## 구현 로드맵

### Phase 1: Centroid 보정 + CameraAutoFocus 수정
| Task | 설명 |
|------|------|
| 면적 가중 centroid 계산 | computeCentroid를 면적 가중 중심(area-weighted)으로 교체 |
| centroidsMap 일괄 교체 | GlobeView의 centroidsMap이 보정된 좌표 사용하도록 수정 |
| CameraAutoFocus 충돌 방지 | 포커스 중 OrbitControls.enabled=false, 유저 입력 감지 시 즉시 중단 |
| 카메라 포커스 위치 검증 | 주요 20개국(불규칙 형태 포함)에서 포커스 위치가 시각 중심에 맞는지 확인 |

- **design**: N
- **verify**: 빌드 성공, 칠레/인도네시아/러시아 등 불규칙 국가에서 카메라 포커스가 영토 시각 중심에 정확히 위치

### Phase 2: 미사일 3D 메시 + 연기 트레일
| Task | 설명 |
|------|------|
| Missile3D geometry | ConeGeometry(0.3,1.5) + CylinderGeometry(0.15,0.15,0.8) 조합 프로시져럴 미사일 메시 |
| InstancedMesh 교체 | 기존 SphereGeometry InstancedMesh를 Missile3D로 교체, 진행방향 정렬 |
| 연기 트레일 | InstancedMesh PlaneGeometry 빌보드 파티클 (미사일 뒤에 8~12개, 크기 감소+투명도 감소) |
| GlobeMissileEffect 통합 | 기존 Points tail 삭제, Missile3D + SmokeTrail로 교체 |

- **design**: N
- **verify**: 빌드 성공, 미사일이 원뿔 형태로 비행 경로 방향을 향하며 연기 트레일이 뒤따름

### Phase 3: 폭발 3D 파티클 시스템
| Task | 설명 |
|------|------|
| Explosion3D 컴포넌트 | 3단계 InstancedMesh 파티클: 섬광(0~0.2s 백색 구체 팽창), 화염구(0.1~0.8s 오렌지 구체들), 파편(0.3~1.5s 작은 큐브 스프레드) |
| 섬광 단계 | 중심에서 구체가 빠르게 팽창 (scale 0→5→0), 백색 → 노란색, AdditiveBlending |
| 화염구 단계 | 20~30개 작은 구체가 바깥으로 퍼짐, 오렌지→검정 색상 전이 |
| 파편 단계 | 15~20개 BoxGeometry(0.3) 큐브가 랜덤 방향으로 사출, 중력(구면) 적용 |
| ExplosionParticles 교체 | 기존 Points 30개 → Explosion3D로 교체 |

- **design**: N
- **verify**: 빌드 성공, 미사일 착탄 시 3단계 폭발 시퀀스가 시각적으로 확인됨, Bloom과 자연스러운 조합

### Phase 4: 교역 화물 3D 아이콘 + 전쟁 안개 고도화
| Task | 설명 |
|------|------|
| CargoIcon geometry | 자원별 프로시져럴 3D 메시: oil→BoxGeometry 탱커, tech→ConeGeometry 비행기, food→BoxGeometry 컨테이너, metal→OctahedronGeometry 광석 |
| 교역 화물 교체 | 기존 SphereGeometry(0.6) → 자원별 CargoIcon으로 교체, 진행방향 정렬 |
| WarFog3D | InstancedMesh SphereGeometry(2) + 커스텀 ShaderMaterial (노이즈 기반 볼륨감, 반투명 빨간색, 느린 회전) |
| 기존 WarFog 교체 | PlaneGeometry 빌보드 20개 → WarFog3D (구체 10개, 볼륨감) |

- **design**: N
- **verify**: 빌드 성공, 교역 화물이 자원 종류별로 다른 형태, 전쟁 안개가 입체감 있는 볼륨으로 표시

### Phase 5: 신규 이벤트 이펙트 (동맹, 제재, 자원, 첩보, 핵)
| Task | 설명 |
|------|------|
| GlobeAllianceBeam | 2국가 centroid 사이 파란 빛 기둥 (TubeGeometry 곡선 + AdditiveBlending + 파동 애니메이션) |
| GlobeSanctionBarrier | 대상국 centroid에 빨간 X 마크 (LineSegments) + 주변 빨간 점선 원 (DashedLineMaterial) |
| GlobeResourceGlow | 자원 산출국 지표면에 빛나는 원 (RingGeometry + ShaderMaterial pulse) + 상승 파티클 (InstancedMesh) |
| GlobeSpyTrail | 2국가 사이 은밀한 점선 (LineDashedMaterial, 낮은 opacity) + 깜빡이는 눈 아이콘 (CanvasTexture Sprite) |
| GlobeNukeEffect | 거대 충격파 링 (GlobeShockwave 확장, scale 2배) + 버섯구름 파티클 (InstancedMesh 구체 상승+확산) |
| GlobeView 통합 | 신규 5개 컴포넌트를 GlobeScene에 마운트, props 연결 |
| 테스트 데이터 확장 | page.tsx 더미 데이터 생성기에 신규 이벤트 타입 추가 |

- **design**: N
- **verify**: 빌드 성공, 5종 신규 이벤트가 각각 독립적으로 렌더링, Bloom과 자연스러운 조합, 60fps 유지

### Phase 6: 승리 불꽃 고도화 + 성능 최적화
| Task | 설명 |
|------|------|
| VictoryFireworks3D | 로켓 상승 단계 (InstancedMesh 원뿔, 3~5개 동시 발사) → 정점에서 구형 폭발 (각 50개 파티클) |
| GC 방지 정리 | 모든 이펙트 컴포넌트에서 매 프레임 new Vector3/Quaternion 제거, 모듈 스코프 temp 객체로 교체 |
| 모바일 LOD 통합 | useGlobeLOD 훅에 신규 이펙트 LOD 플래그 추가 (enableAllianceBeam, enableNuke 등) |
| 오브젝트 풀링 | 자주 생성/삭제되는 이펙트(폭발, 불꽃)에 오브젝트 풀 적용 |
| GlobeTradeRoutes 최적화 | 라우트 변경 시 전체 재생성 → diff 기반 증분 업데이트 |

- **design**: N
- **verify**: 빌드 성공, 동시 전쟁 5개 + 교역 30개 + 신규 이벤트 5개에서 60fps 유지, Chrome DevTools로 GC spike 없음 확인
