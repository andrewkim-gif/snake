package config

import (
	"fmt"

	"github.com/kelseyhightower/envconfig"
)

// Config holds all server configuration loaded from environment variables.
type Config struct {
	// Server
	Port       int    `envconfig:"PORT" default:"9001"`
	CORSOrigin string `envconfig:"CORS_ORIGIN" default:"http://localhost:3000"`
	LogLevel   string `envconfig:"LOG_LEVEL" default:"info"`

	// Game
	MaxRooms int `envconfig:"MAX_ROOMS" default:"5"`
	TickRate int `envconfig:"TICK_RATE" default:"20"`
}

// Load reads configuration from environment variables with the given prefix.
// An empty prefix means environment variables are used directly (PORT, CORS_ORIGIN, etc.).
func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, fmt.Errorf("loading config: %w", err)
	}
	return &cfg, nil
}
