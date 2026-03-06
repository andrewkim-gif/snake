package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// Config holds Redis connection parameters.
type Config struct {
	Addr     string
	Password string
	DB       int
}

// DefaultConfig returns Redis config from environment variables with defaults.
func DefaultConfig() Config {
	return Config{
		Addr:     getEnvOrDefault("REDIS_ADDR", "localhost:6379"),
		Password: getEnvOrDefault("REDIS_PASSWORD", ""),
		DB:       0,
	}
}

// RedisClient wraps the go-redis client with application-specific helpers.
type RedisClient struct {
	client *redis.Client
	config Config
}

// New creates a new Redis client and verifies connectivity.
func New(cfg Config) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     20,
		MinIdleConns: 5,
	})

	// Verify connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	slog.Info("redis connected", "addr", cfg.Addr)

	return &RedisClient{
		client: client,
		config: cfg,
	}, nil
}

// Close closes the Redis connection.
func (r *RedisClient) Close() error {
	slog.Info("closing redis connection")
	return r.client.Close()
}

// Client returns the underlying go-redis client for advanced operations.
func (r *RedisClient) Client() *redis.Client {
	return r.client
}

// HealthCheck verifies Redis is reachable.
func (r *RedisClient) HealthCheck(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// --- Publish/Subscribe helpers ---

// Publish publishes a JSON-encoded message to a channel.
func (r *RedisClient) Publish(ctx context.Context, channel string, data interface{}) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal publish data: %w", err)
	}
	return r.client.Publish(ctx, channel, payload).Err()
}

// Subscribe creates a subscription to the given channels.
// Returns a PubSub that the caller should close when done.
func (r *RedisClient) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return r.client.Subscribe(ctx, channels...)
}

// SubscribePattern creates a pattern-based subscription.
// Useful for subscribing to all country events: "game:*", "battle:*"
func (r *RedisClient) SubscribePattern(ctx context.Context, patterns ...string) *redis.PubSub {
	return r.client.PSubscribe(ctx, patterns...)
}

// --- Session Management ---

// SetSession stores a user session with TTL.
func (r *RedisClient) SetSession(ctx context.Context, userID string, data interface{}, ttl time.Duration) error {
	key := SessionKey(userID)
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}
	return r.client.Set(ctx, key, payload, ttl).Err()
}

// GetSession retrieves a user session.
func (r *RedisClient) GetSession(ctx context.Context, userID string, dest interface{}) error {
	key := SessionKey(userID)
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// DeleteSession removes a user session.
func (r *RedisClient) DeleteSession(ctx context.Context, userID string) error {
	key := SessionKey(userID)
	return r.client.Del(ctx, key).Err()
}

// RefreshSession extends the TTL of an existing session.
func (r *RedisClient) RefreshSession(ctx context.Context, userID string, ttl time.Duration) error {
	key := SessionKey(userID)
	return r.client.Expire(ctx, key, ttl).Err()
}

// --- Cache helpers ---

// Set stores a key-value pair with optional TTL.
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal cache value: %w", err)
	}
	return r.client.Set(ctx, key, payload, ttl).Err()
}

// Get retrieves a cached value by key.
func (r *RedisClient) Get(ctx context.Context, key string, dest interface{}) error {
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// Delete removes a cached key.
func (r *RedisClient) Delete(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

// getEnvOrDefault returns the env value or a default.
func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
