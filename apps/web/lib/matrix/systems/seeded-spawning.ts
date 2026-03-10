/**
 * seeded-spawning.ts — 시드 기반 결정론적 스폰 시스템
 *
 * v33 Phase 3: 서버에서 배포하는 시드를 사용하여
 * 모든 클라이언트가 동일한 몬스터를 동일한 위치에 스폰한다.
 *
 * 기존 spawning.ts는 Math.random() 직접 사용 → 클라이언트마다 다른 결과.
 * 이 모듈은 seedrandom 라이브러리로 결정론적 RNG를 제공하고,
 * 엔티티 ID도 seed+waveId+index로 결정론적 생성한다.
 *
 * 사용법:
 *   1. 서버에서 matrix_spawn_seed 수신 → onSeed() 호출
 *   2. 기존 spawning.ts의 Math.random() 호출을 seededRandom()으로 교체
 *   3. 엔티티 ID 생성 시 generateEntityId() 사용
 */

import seedrandom from 'seedrandom';
import type { EnemyType, Vector2 } from '../types';

// ─── 타입 ───

/** 시드 정보 (서버에서 수신) */
export interface SpawnSeedInfo {
  seed: number;
  waveId: number;
  tick: number;
}

/** 결정론적 스폰 결과 */
export interface DeterministicSpawnResult {
  entityId: string;
  position: Vector2;
  enemyType: EnemyType;
  angle: number;
}

// ─── 클래스 구현 ───

export class SeededSpawning {
  /** 현재 RNG 인스턴스 */
  private rng: seedrandom.PRNG | null = null;

  /** 현재 시드 정보 */
  private currentSeed: SpawnSeedInfo | null = null;

  /** 현재 웨이브 내 스폰 인덱스 (ID 생성용) */
  private spawnIndex = 0;

  /** 시드 히스토리 (디버깅용) */
  private seedHistory: SpawnSeedInfo[] = [];

  /** 오프라인 폴백 모드 (서버 미연결 시 Math.random 사용) */
  private offlineMode = true;

  /** 현재 시드 값 조회 */
  get seed(): number | null {
    return this.currentSeed?.seed ?? null;
  }

  /** 현재 웨이브 ID */
  get waveId(): number {
    return this.currentSeed?.waveId ?? 0;
  }

  /** 오프라인 모드 여부 */
  get isOffline(): boolean {
    return this.offlineMode;
  }

  /**
   * 서버에서 matrix_spawn_seed 수신 시 호출
   * 새 시드로 RNG를 초기화한다.
   */
  onSeed(info: SpawnSeedInfo): void {
    this.currentSeed = info;
    this.spawnIndex = 0;
    this.offlineMode = false;

    // seedrandom은 문자열 시드를 받으므로 숫자를 문자열로 변환
    this.rng = seedrandom(info.seed.toString());

    // 히스토리 기록 (최대 20개)
    this.seedHistory.push(info);
    if (this.seedHistory.length > 20) {
      this.seedHistory.shift();
    }
  }

  /**
   * 결정론적 난수 생성 (0 ~ 1)
   * 오프라인 모드에서는 Math.random() 폴백
   */
  random(): number {
    if (this.rng) {
      return this.rng();
    }
    return Math.random();
  }

  /**
   * 결정론적 정수 난수 (min 이상 max 미만)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * 결정론적 실수 난수 (min 이상 max 이하)
   */
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * 배열에서 결정론적으로 요소 선택
   */
  randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /**
   * 결정론적 엔티티 ID 생성
   * 형식: `s{seed}_w{waveId}_i{index}`
   * 오프라인 모드: `off_{timestamp}_{random}`
   */
  generateEntityId(): string {
    if (this.currentSeed && !this.offlineMode) {
      const id = `s${this.currentSeed.seed}_w${this.currentSeed.waveId}_i${this.spawnIndex}`;
      this.spawnIndex++;
      return id;
    }
    // 오프라인 폴백
    return `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 결정론적 스폰 위치 생성
   * 플레이어 주변 spawnRadius 거리에서 각도를 결정론적으로 선택
   */
  generateSpawnPosition(playerPos: Vector2, spawnRadius: number): Vector2 {
    const angle = this.random() * Math.PI * 2;
    return {
      x: playerPos.x + Math.cos(angle) * spawnRadius,
      y: playerPos.y + Math.sin(angle) * spawnRadius,
    };
  }

  /**
   * 결정론적 적 타입 선택
   * types 배열에서 시드 기반으로 하나 선택
   */
  selectEnemyType(types: readonly EnemyType[]): EnemyType {
    if (types.length === 0) return 'glitch' as EnemyType;
    return this.randomChoice(types);
  }

  /**
   * 웨이브 스폰 (배치 결정론적 스폰)
   * count만큼 적을 결정론적으로 생성하여 결과 배열 반환
   */
  generateWaveSpawns(
    playerPos: Vector2,
    spawnRadius: number,
    types: readonly EnemyType[],
    count: number,
  ): DeterministicSpawnResult[] {
    const results: DeterministicSpawnResult[] = [];

    for (let i = 0; i < count; i++) {
      results.push({
        entityId: this.generateEntityId(),
        position: this.generateSpawnPosition(playerPos, spawnRadius),
        enemyType: this.selectEnemyType(types),
        angle: this.random() * Math.PI * 2,
      });
    }

    return results;
  }

  /**
   * 온라인 모드 진입 (서버 연결 시)
   * 시드가 아직 수신되지 않았을 수 있으므로, 첫 시드 수신까지 대기
   */
  enterOnlineMode(): void {
    // 시드가 수신되면 offlineMode가 자동으로 false가 됨
    // 여기서는 명시적으로 상태만 표시
  }

  /**
   * 오프라인 모드로 복귀 (서버 연결 해제 시)
   */
  enterOfflineMode(): void {
    this.offlineMode = true;
    this.rng = null;
    this.currentSeed = null;
    this.spawnIndex = 0;
  }

  /** 전체 리셋 */
  reset(): void {
    this.rng = null;
    this.currentSeed = null;
    this.spawnIndex = 0;
    this.offlineMode = true;
    this.seedHistory = [];
  }
}

/**
 * 싱글톤 인스턴스 (게임 전체에서 공유)
 * MatrixApp에서 온라인 모드 진입 시 초기화
 */
export const seededSpawning = new SeededSpawning();
