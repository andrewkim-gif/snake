package db

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PGPool wraps a pgxpool.Pool for direct PostgreSQL access (Railway).
// This exists alongside the Supabase REST client (DB struct) for parallel use.
type PGPool struct {
	Pool *pgxpool.Pool
}

// NewPGPool creates a new connection pool from a DATABASE_URL string.
// Recommended pool settings for Railway PostgreSQL:
//   - MaxConns: 20, MinConns: 5
//   - MaxConnIdleTime: 5 min, HealthCheckPeriod: 30s
func NewPGPool(ctx context.Context, databaseURL string) (*PGPool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is empty")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	// Pool configuration
	config.MaxConns = 20
	config.MinConns = 5
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}

	// Verify connectivity
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping PostgreSQL: %w", err)
	}

	slog.Info("PostgreSQL pool initialized",
		"host", config.ConnConfig.Host,
		"port", config.ConnConfig.Port,
		"database", config.ConnConfig.Database,
		"maxConns", config.MaxConns,
		"minConns", config.MinConns,
	)

	return &PGPool{Pool: pool}, nil
}

// Close gracefully shuts down the connection pool.
func (p *PGPool) Close() {
	if p.Pool != nil {
		p.Pool.Close()
		slog.Info("PostgreSQL pool closed")
	}
}

// Ping verifies the database connection is alive.
func (p *PGPool) Ping(ctx context.Context) error {
	return p.Pool.Ping(ctx)
}
