package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RunMigrations executes all .sql files found in migrationsDir against the pool,
// ordered by filename. It uses a simple migrations tracking table to avoid re-running.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool, migrationsDir string) error {
	// migration 추적 테이블 생성
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS _migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create _migrations table: %w", err)
	}

	// 적용 완료된 migration 조회
	rows, err := pool.Query(ctx, `SELECT filename FROM _migrations ORDER BY filename`)
	if err != nil {
		return fmt.Errorf("query _migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scan _migrations: %w", err)
		}
		applied[name] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate _migrations: %w", err)
	}

	// migration 파일 목록 로드
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations dir %s: %w", migrationsDir, err)
	}

	var sqlFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			sqlFiles = append(sqlFiles, e.Name())
		}
	}
	sort.Strings(sqlFiles)

	// 미적용 migration 순차 실행
	for _, filename := range sqlFiles {
		if applied[filename] {
			slog.Debug("migration already applied, skipping", "file", filename)
			continue
		}

		sqlPath := filepath.Join(migrationsDir, filename)
		sqlBytes, err := os.ReadFile(sqlPath)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", filename, err)
		}

		sql := string(sqlBytes)
		if strings.TrimSpace(sql) == "" {
			slog.Warn("empty migration file, skipping", "file", filename)
			continue
		}

		slog.Info("applying migration", "file", filename)

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin tx for %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, sql); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("execute migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, `INSERT INTO _migrations (filename) VALUES ($1)`, filename); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", filename, err)
		}

		slog.Info("migration applied successfully", "file", filename)
	}

	return nil
}
