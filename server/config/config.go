package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all server configuration loaded from environment variables.
type Config struct {
	Port        int      // HTTP/WS listen port (default: 8000)
	CORSOrigins []string // Allowed CORS origins (comma-separated)
	TickRate    int      // Game loop tick rate in Hz (default: 20)
	MaxRooms    int      // Maximum number of game rooms (default: 5)
	Environment string   // "development" or "production"
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:        8000,
		CORSOrigins: []string{"http://localhost:3000", "http://localhost:9001"},
		TickRate:    20,
		MaxRooms:    50,
		Environment: "development",
	}

	if v := os.Getenv("PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid PORT: %w", err)
		}
		cfg.Port = port
	}

	if v := os.Getenv("CORS_ORIGIN"); v != "" {
		origins := strings.Split(v, ",")
		for i := range origins {
			origins[i] = strings.TrimSpace(origins[i])
		}
		cfg.CORSOrigins = origins
	}

	if v := os.Getenv("TICK_RATE"); v != "" {
		rate, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid TICK_RATE: %w", err)
		}
		cfg.TickRate = rate
	}

	if v := os.Getenv("MAX_ROOMS"); v != "" {
		rooms, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid MAX_ROOMS: %w", err)
		}
		cfg.MaxRooms = rooms
	}

	if v := os.Getenv("ENV"); v != "" {
		cfg.Environment = v
	}

	return cfg, nil
}

// Addr returns the listen address string (e.g. ":8000").
func (c *Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}
