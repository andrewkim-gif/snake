# ADR-007: Turborepo Monorepo Structure

## Status
Accepted

## Context
프론트엔드(Next.js)와 게임 서버(Node.js)가 TypeScript 타입, 상수, 유틸리티를
공유해야 한다. 코드 공유 전략과 프로젝트 구조를 결정해야 한다.

## Decision
**Turborepo Monorepo + Internal Package** 구조를 채택한다.

```
snake/
├── apps/
│   ├── web/          # Next.js 15 (Vercel deploy)
│   └── server/       # Node.js Game Server (Railway deploy)
├── packages/
│   └── shared/       # 공유 타입/상수/유틸 (internal package)
├── turbo.json
├── package.json      # workspace root
└── tsconfig.json     # base TypeScript config
```

Shared Package 범위:
- `types/`: 게임 상태, Socket 이벤트, 플레이어 타입 (interface/type only)
- `constants/`: 게임 설정값, 이벤트 이름, 색상 팔레트
- `utils/`: 그리드 계산, 입력 검증, 직렬화 헬퍼 (순수 함수)

Build 전략:
- shared → web, server 순서로 빌드 (turbo dependency graph)
- shared는 TypeScript로 직접 사용 (별도 빌드 없음, tsconfig paths)
- `"@snake-arena/shared"` 패키지명으로 import

## Consequences
- **Positive**: 타입 안전성 보장 (서버-클라이언트 동일 타입)
- **Positive**: 게임 상수 단일 소스 (불일치 방지)
- **Positive**: Turborepo 캐싱으로 빌드 속도 향상
- **Negative**: 초기 설정 복잡도 (workspace, tsconfig 설정)
- **Negative**: Railway/Vercel 배포 시 monorepo 설정 필요

## Alternatives Considered
1. **별도 레포지토리 + npm 패키지**: 버전 관리 오버헤드
2. **코드 복사 (copy-paste)**: 불일치 위험, 유지보수 어려움
3. **nx**: Turborepo 대비 설정이 복잡, 이 규모에 과도
