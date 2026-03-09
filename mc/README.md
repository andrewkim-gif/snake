# Minecraft R3F Edition

React Three Fiber로 구현한 마인크래프트 스타일 복셀 월드.
서버 연결 없이 브라우저에서 완전히 독립 실행됩니다.

## 프로젝트 구조

```
mc/
├── client/                  # Next.js 클라이언트 (메인)
│   ├── app/
│   │   ├── layout.tsx       # 루트 레이아웃
│   │   └── page.tsx         # 메인 게임 페이지
│   ├── components/
│   │   ├── 3d/              # R3F 3D 컴포넌트
│   │   │   ├── MCScene.tsx          # 씬 환경 (조명, 안개, 배경)
│   │   │   ├── MCTerrain.tsx        # 프로시저럴 복셀 터레인
│   │   │   ├── MCCamera.tsx         # FPS 카메라 + 물리 충돌
│   │   │   ├── MCBlockInteraction.tsx # 블록 배치/파괴
│   │   │   └── MCParticles.tsx      # 파티클 시스템
│   │   └── mc/              # HTML UI 오버레이
│   │       ├── MCMenu.tsx           # 메인/일시정지 메뉴
│   │       ├── MCHotbar.tsx         # 블록 선택 핫바
│   │       ├── MCCrosshair.tsx      # 조준선
│   │       └── MCFPS.tsx            # FPS 카운터
│   ├── lib/                 # 유틸리티 라이브러리
│   │   ├── mc-blocks.ts             # 블록 타입 정의 (32종)
│   │   ├── mc-texture-atlas.ts      # 프로시저럴 텍스처 아틀라스
│   │   ├── minecraft-ui.ts          # UI 디자인 토큰
│   │   └── 3d/
│   │       ├── mc-types.ts          # 타입/상수 정의 (중앙)
│   │       ├── mc-materials.ts      # 머티리얼 팩토리 + 캐시
│   │       ├── mc-noise.ts          # Perlin 노이즈 터레인 생성
│   │       └── mc-terrain-worker.ts # Web Worker 청크 생성
│   └── public/
│       ├── textures/blocks/         # 블록 텍스처 (16종)
│       ├── textures/block-icons/    # 핫바 블록 아이콘 (7종)
│       └── fonts/mc-font.otf        # MC 픽셀 폰트
├── server/                  # 프로덕션 정적 서버
│   ├── server.js            # Express 정적 파일 서버
│   └── package.json
└── README.md
```

## 빠른 시작

### 개발 모드 (권장)

```bash
cd mc/client
npm install
npm run dev
# → http://localhost:3000
```

### 프로덕션 빌드

```bash
# 클라이언트 빌드
cd mc/client
npm install
npm run build

# 정적 서버로 서빙 (선택)
cd ../server
npm install
npm start
# → http://localhost:3001
```

## 조작법

| 키 | 동작 |
|---|---|
| WASD | 이동 |
| Space | 점프 |
| Shift | 웅크리기 |
| 마우스 | 시점 회전 |
| 좌클릭 | 블록 파괴 |
| 우클릭 | 블록 배치 |
| 1-9, 0 | 블록 선택 |
| 스크롤 | 블록 순환 |
| Q (더블탭) | 비행 모드 토글 |
| E / ESC | 메뉴 |

## 기술 스택

- **React Three Fiber** v9 — React 선언적 3D 렌더링
- **Three.js** 0.175 — WebGL 3D 엔진
- **Next.js** 15 — React 프레임워크
- **TypeScript** — 타입 안전성
- **Web Workers** — 오프스레드 터레인 생성
- **InstancedMesh** — 블록 타입별 배칭 렌더링

## 핵심 기능

- 프로시저럴 무한 터레인 (Perlin 노이즈 + 3 바이옴)
- 블록 배치/파괴 (레이캐스팅)
- FPS 카메라 + AABB 물리 충돌
- 비행 모드 (더블 스페이스)
- Web Worker 기반 청크 생성 (메인 스레드 블로킹 없음)
- 면 제거 최적화 (보이지 않는 면 스킵)
- 프로시저럴 텍스처 아틀라스 (32 블록 타입)

## 원본 프로젝트

이 프로젝트는 [AI World War](https://github.com/andrewkim-gif/snake) 프로젝트의
마인크래프트 스타일 3D 복셀 시스템을 독립 프로젝트로 분리한 것입니다.
