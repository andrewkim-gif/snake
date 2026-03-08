# PLAN: v20 — 3D Globe Landmark System

> 상세 기획: `docs/designs/v20-globe-landmarks-plan.md` 참조
> 검증 보고서: `docs/designs/v20-verification-report.md` (14개 이슈 → 전체 반영 완료)

## 요약

세계 42개 주요 랜드마크를 3D 지구본 위에 프로시저럴 로우폴리로 표시하는 시스템.
3단계 LOD + **InstancedMesh ×12 기본 (BatchedMesh progressive enhancement)**으로 +2~13 draw calls 추가.

## 구현 로드맵

### Phase 1: 기반 인프라 — 공통 유틸 + 데이터 정의
| Task | 설명 |
|------|------|
| latLngToVector3 공통 유틸 추출 | `lib/globe-utils.ts` — 7곳 3가지 변형 통합 + supportsMultiDraw() |
| 기존 컴포넌트 import 경로 변경 | 7개 파일의 로컬 함수 제거 → globe-utils import |
| 랜드마크 데이터 정의 | `lib/landmark-data.ts` — 42개 랜드마크 (좌표, Archetype, Tier, ISO3) |
| useGlobeLOD 확장 | 기존 훅에 landmark 설정 추가 |

- **design**: N
- **verify**: 빌드 성공, 기존 GlobeView 7개 파일 regression 없음

### Phase 2: Far LOD — 스프라이트 레이어
| Task | 설명 |
|------|------|
| LandmarkSprites.tsx | InstancedMesh + PlaneGeo + CanvasTexture 아틀라스 |
| GlobeLandmarks.tsx | LOD 매니저 컴포넌트 |
| GlobeView 마운트 | GlobeCountryLabels 아래, renderOrder=98 |

- **design**: N
- **verify**: 줌아웃 시 Tier1 15개 스프라이트 표시

### Phase 3: Mid/Close LOD — InstancedMesh + BatchedMesh
| Task | 설명 |
|------|------|
| Archetype 지오메트리 팩토리 | 12종 프로시저럴 형상 생성 |
| LandmarkMeshes.tsx | InstancedMesh ×12 기본 + BatchedMesh 최적화 (imperative 패턴) |
| LOD 전환 + 히스테리시스 | Far↔Mid↔Close, renderOrder=95 |

- **design**: N
- **verify**: 줌인 시 3D 형상, Firefox 폴백 정상, 60fps

### Phase 4: 인터랙션 + 국가 연동
| Task | 설명 |
|------|------|
| 호버 라벨 + Raycasting | 마우스 호버 시 정보 표시 |
| 국가 색상 틴팅 | ISO3 기반 dominationStates 연동 |
| Decluttering + 모바일 최적화 | 5쌍 밀집 처리 (기자/DC/NYC) + 디바이스 적응 |

- **design**: Y
- **verify**: 호버 표시, 색상 연동, 모바일 30fps+

### Phase 5: 폴리시 + 최적화
| Task | 설명 |
|------|------|
| 등장 애니메이션 | scale 0→1 easeOutBack |
| 야간 조명 | emissive glow 효과 |
| 랜드마크 전용 Tier 축소 | FPS 기반 useGlobeLOD 내 간단한 축소 로직 |
| Canvas DPR 제어 (선택적) | 모바일 3x 렌더링 방지 |

- **design**: N
- **verify**: 전 기기 60fps, Firefox 폴백 정상, 애니메이션 정상
