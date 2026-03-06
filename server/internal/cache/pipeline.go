package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// ============================================================
// S39: Redis Pipeline + Batch Optimization
// ============================================================
//
// Problem: syncAllToRedis() issues 195 individual SET commands.
// Solution: Pipeline all writes into a single round-trip.
//
// Before: 195 × 1 RTT = ~195ms (at 1ms RTT)
// After:  1 × 1 RTT  = ~1ms   (pipelined)

// PipelineWriter batches multiple Redis writes into a single pipeline.
type PipelineWriter struct {
	client *RedisClient
}

// NewPipelineWriter creates a new pipeline writer.
func NewPipelineWriter(client *RedisClient) *PipelineWriter {
	return &PipelineWriter{client: client}
}

// BatchSetCountryStates writes all country states in a single pipeline.
// This replaces the per-country Set() calls in WorldManager.syncAllToRedis().
func (pw *PipelineWriter) BatchSetCountryStates(ctx context.Context, states map[string]interface{}, ttl time.Duration) error {
	if pw.client == nil || len(states) == 0 {
		return nil
	}

	pipe := pw.client.client.Pipeline()

	for iso, state := range states {
		payload, err := json.Marshal(state)
		if err != nil {
			slog.Warn("pipeline marshal error", "country", iso, "error", err)
			continue
		}
		key := CountryStateKey(iso)
		pipe.Set(ctx, key, payload, ttl)
	}

	cmds, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("pipeline exec: %w (commands: %d)", err, len(cmds))
	}

	// Count failures
	failures := 0
	for _, cmd := range cmds {
		if cmd.Err() != nil {
			failures++
		}
	}
	if failures > 0 {
		slog.Warn("pipeline partial failures", "total", len(cmds), "failed", failures)
	}

	return nil
}

// BatchPublish publishes multiple messages in a single pipeline.
// Useful for broadcasting sovereignty changes for multiple countries at once.
func (pw *PipelineWriter) BatchPublish(ctx context.Context, messages map[string]interface{}) error {
	if pw.client == nil || len(messages) == 0 {
		return nil
	}

	pipe := pw.client.client.Pipeline()

	for channel, data := range messages {
		payload, err := json.Marshal(data)
		if err != nil {
			slog.Warn("pipeline publish marshal error", "channel", channel, "error", err)
			continue
		}
		pipe.Publish(ctx, channel, payload)
	}

	cmds, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("pipeline publish exec: %w (commands: %d)", err, len(cmds))
	}

	return nil
}

// BatchGet retrieves multiple keys in a single pipeline.
// Returns a map of key→raw JSON bytes. Missing keys are omitted.
func (pw *PipelineWriter) BatchGet(ctx context.Context, keys []string) (map[string][]byte, error) {
	if pw.client == nil || len(keys) == 0 {
		return nil, nil
	}

	pipe := pw.client.client.Pipeline()

	cmds := make(map[string]*redis.StringCmd, len(keys))
	for _, key := range keys {
		cmds[key] = pipe.Get(ctx, key)
	}

	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		// Pipeline exec error is not fatal — individual commands may have redis.Nil
		// We check each command below
		_ = err
	}

	results := make(map[string][]byte, len(keys))
	for key, cmd := range cmds {
		val, err := cmd.Result()
		if err != nil {
			continue // key not found or error
		}
		results[key] = []byte(val)
	}

	return results, nil
}

// BatchDelete removes multiple keys in a single pipeline.
func (pw *PipelineWriter) BatchDelete(ctx context.Context, keys []string) error {
	if pw.client == nil || len(keys) == 0 {
		return nil
	}

	pipe := pw.client.client.Pipeline()
	for _, key := range keys {
		pipe.Del(ctx, key)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("pipeline delete exec: %w", err)
	}
	return nil
}

// BatchSetWithExpiry writes multiple key-value pairs with individual TTLs.
func (pw *PipelineWriter) BatchSetWithExpiry(ctx context.Context, entries []BatchEntry) error {
	if pw.client == nil || len(entries) == 0 {
		return nil
	}

	pipe := pw.client.client.Pipeline()
	for _, entry := range entries {
		payload, err := json.Marshal(entry.Value)
		if err != nil {
			continue
		}
		pipe.Set(ctx, entry.Key, payload, entry.TTL)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("pipeline batch set exec: %w", err)
	}
	return nil
}

// BatchEntry represents a single key-value pair with TTL for batch operations.
type BatchEntry struct {
	Key   string
	Value interface{}
	TTL   time.Duration
}

// IncrementBatch atomically increments multiple counters.
// Useful for tracking battle counts, agent deployments, etc.
func (pw *PipelineWriter) IncrementBatch(ctx context.Context, keys []string) (map[string]int64, error) {
	if pw.client == nil || len(keys) == 0 {
		return nil, nil
	}

	pipe := pw.client.client.Pipeline()
	cmds := make(map[string]*redis.IntCmd, len(keys))
	for _, key := range keys {
		cmds[key] = pipe.Incr(ctx, key)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("pipeline incr exec: %w", err)
	}

	results := make(map[string]int64, len(keys))
	for key, cmd := range cmds {
		if val, err := cmd.Result(); err == nil {
			results[key] = val
		}
	}
	return results, nil
}
