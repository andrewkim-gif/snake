package db

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// DB wraps a Supabase REST API (PostgREST) client.
type DB struct {
	baseURL    string // SUPABASE_URL + "/rest/v1"
	apiKey     string // SUPABASE_ROLE_KEY (service_role JWT)
	httpClient *http.Client
}

// NewFromEnv creates a DB from SUPABASE_URL + SUPABASE_ROLE_KEY env vars.
// Returns (nil, nil) if neither is set (graceful skip).
func NewFromEnv() (*DB, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	roleKey := os.Getenv("SUPABASE_ROLE_KEY")

	if supabaseURL == "" && roleKey == "" {
		return nil, nil
	}
	if supabaseURL == "" {
		return nil, fmt.Errorf("SUPABASE_URL not set (SUPABASE_ROLE_KEY is set)")
	}
	if roleKey == "" {
		return nil, fmt.Errorf("SUPABASE_ROLE_KEY not set (SUPABASE_URL is set)")
	}

	// Trim trailing slash
	supabaseURL = strings.TrimRight(supabaseURL, "/")

	d := &DB{
		baseURL: supabaseURL + "/rest/v1",
		apiKey:  roleKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	slog.Info("Supabase REST client initialized", "baseURL", d.baseURL)
	return d, nil
}

// HealthCheck verifies the Supabase REST API is reachable.
func (d *DB) HealthCheck(ctx context.Context) error {
	// Simple GET on root — PostgREST returns OpenAPI spec
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.baseURL+"/", nil)
	if err != nil {
		return fmt.Errorf("health check request: %w", err)
	}
	d.setHeaders(req)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("health check status %d", resp.StatusCode)
	}
	return nil
}

// Ping is an alias for HealthCheck.
func (d *DB) Ping(ctx context.Context) error {
	return d.HealthCheck(ctx)
}

// Close is a no-op for the REST client (no persistent connections to clean up).
func (d *DB) Close() error {
	slog.Info("Supabase REST client closed")
	return nil
}

// ── Internal HTTP helpers ───────────────────────────────────────────

// setHeaders adds common Supabase headers.
func (d *DB) setHeaders(req *http.Request) {
	req.Header.Set("apikey", d.apiKey)
	req.Header.Set("Authorization", "Bearer "+d.apiKey)
	req.Header.Set("Content-Type", "application/json")
}

// get performs a GET request and decodes the JSON response into dest.
func (d *DB) get(ctx context.Context, path string, dest interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.baseURL+path, nil)
	if err != nil {
		return err
	}
	d.setHeaders(req)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("GET %s: status %d: %s", path, resp.StatusCode, truncate(body, 200))
	}

	if dest != nil {
		if err := json.Unmarshal(body, dest); err != nil {
			return fmt.Errorf("GET %s: decode: %w", path, err)
		}
	}
	return nil
}

// post performs a POST request with JSON body. extraHeaders are added on top of defaults.
func (d *DB) post(ctx context.Context, path string, payload interface{}, extraHeaders map[string]string) error {
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	d.setHeaders(req)
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("POST %s: status %d: %s", path, resp.StatusCode, truncate(body, 200))
	}
	return nil
}

// patch performs a PATCH request with JSON body.
func (d *DB) patch(ctx context.Context, path string, payload interface{}) error {
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, d.baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	d.setHeaders(req)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("PATCH %s: status %d: %s", path, resp.StatusCode, truncate(body, 200))
	}
	return nil
}

// del performs a DELETE request.
func (d *DB) del(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, d.baseURL+path, nil)
	if err != nil {
		return err
	}
	d.setHeaders(req)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("DELETE %s: status %d: %s", path, resp.StatusCode, truncate(body, 200))
	}
	return nil
}

// truncate returns at most n bytes of b as a string.
func truncate(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n]) + "..."
}
