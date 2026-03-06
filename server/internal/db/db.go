package db

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// Config holds PostgreSQL connection parameters.
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// DefaultConfig returns database config from environment variables with defaults.
func DefaultConfig() Config {
	cfg := Config{
		Host:    getEnvOrDefault("DB_HOST", "localhost"),
		Port:    5432,
		User:    getEnvOrDefault("DB_USER", "postgres"),
		Password: getEnvOrDefault("DB_PASSWORD", "postgres"),
		DBName:  getEnvOrDefault("DB_NAME", "aiworldwar"),
		SSLMode: getEnvOrDefault("DB_SSLMODE", "disable"),
	}
	return cfg
}

// DSN returns the PostgreSQL connection string.
func (c Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}

// DB wraps a sql.DB connection pool with application-specific helpers.
type DB struct {
	*sql.DB
	config Config
}

// New creates a new database connection pool.
func New(cfg Config) (*DB, error) {
	sqlDB, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("db open: %w", err)
	}

	// Connection pool settings
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	sqlDB.SetConnMaxIdleTime(1 * time.Minute)

	// Verify connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}

	slog.Info("database connected",
		"host", cfg.Host,
		"port", cfg.Port,
		"db", cfg.DBName,
	)

	return &DB{DB: sqlDB, config: cfg}, nil
}

// Close closes the database connection pool.
func (d *DB) Close() error {
	slog.Info("closing database connection")
	return d.DB.Close()
}

// HealthCheck verifies the database is reachable.
func (d *DB) HealthCheck(ctx context.Context) error {
	return d.PingContext(ctx)
}

// getEnvOrDefault returns the env value or a default.
func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
