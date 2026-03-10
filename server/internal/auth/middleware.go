package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Context keys for authenticated user data
type contextKey string

const (
	ContextKeyUserID   contextKey = "user_id"
	ContextKeyUsername contextKey = "username"
	ContextKeyAPIKey   contextKey = "api_key"
	ContextKeyAuthType contextKey = "auth_type"
)

// AuthType identifies how a request was authenticated.
type AuthType string

const (
	AuthTypeJWT    AuthType = "jwt"
	AuthTypeAPIKey AuthType = "api_key"
	AuthTypeWallet AuthType = "wallet"
)

// --- JWT Authentication Middleware ---

// JWTAuth is a chi middleware that validates JWT tokens from the Authorization header.
// Format: "Authorization: Bearer <token>"
func JWTAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		// Extract bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]

		// Validate token
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			slog.Warn("JWT validation failed", "error", err)
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		// Add claims to context
		ctx := r.Context()
		ctx = context.WithValue(ctx, ContextKeyUserID, claims.UserID)
		ctx = context.WithValue(ctx, ContextKeyUsername, claims.Username)
		ctx = context.WithValue(ctx, ContextKeyAuthType, AuthTypeJWT)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- API Key Authentication Middleware ---

// APIKeyValidator is a function that validates an API key hash and returns the user ID.
// This is injected to avoid coupling the middleware to the database layer.
type APIKeyValidator func(ctx context.Context, keyHash string) (userID string, err error)

// APIKeyAuth creates a chi middleware that validates API keys from the X-API-Key header.
// The validator function is called to verify the key hash against the database.
func APIKeyAuth(validator APIKeyValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				http.Error(w, `{"error":"missing X-API-Key header"}`, http.StatusUnauthorized)
				return
			}

			// Validate format
			if !ValidateAPIKeyFormat(apiKey) {
				http.Error(w, `{"error":"invalid API key format"}`, http.StatusUnauthorized)
				return
			}

			// Hash and validate against DB
			keyHash := HashAPIKey(apiKey)
			userID, err := validator(r.Context(), keyHash)
			if err != nil {
				slog.Warn("API key validation failed", "prefix", ExtractPrefix(apiKey), "error", err)
				http.Error(w, `{"error":"invalid API key"}`, http.StatusUnauthorized)
				return
			}

			// Add to context
			ctx := r.Context()
			ctx = context.WithValue(ctx, ContextKeyUserID, userID)
			ctx = context.WithValue(ctx, ContextKeyAPIKey, ExtractPrefix(apiKey))
			ctx = context.WithValue(ctx, ContextKeyAuthType, AuthTypeAPIKey)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// --- RequireAuth Middleware (checks parent-set context) ---

// RequireAuth checks if the request is already authenticated (by a parent middleware
// like DualAuth). If UserID is already in the context, passes through. Otherwise
// falls back to JWTAuth behavior. Use this instead of JWTAuth in sub-routers that
// are mounted under a DualAuth parent, to support both JWT and API Key auth.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Already authenticated by parent DualAuth?
		if GetUserID(r.Context()) != "" {
			next.ServeHTTP(w, r)
			return
		}

		// Try JWT first
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				token := parts[1]

				// Wallet address auth: 0x-prefixed hex string (40 hex chars)
				if len(token) == 42 && strings.HasPrefix(token, "0x") {
					ctx := r.Context()
					ctx = context.WithValue(ctx, ContextKeyUserID, strings.ToLower(token))
					ctx = context.WithValue(ctx, ContextKeyAuthType, AuthTypeWallet)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}

				// JWT token validation
				claims, err := ValidateToken(token)
				if err == nil {
					ctx := r.Context()
					ctx = context.WithValue(ctx, ContextKeyUserID, claims.UserID)
					ctx = context.WithValue(ctx, ContextKeyUsername, claims.Username)
					ctx = context.WithValue(ctx, ContextKeyAuthType, AuthTypeJWT)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}
		}

		http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
	})
}

// --- Dual Auth Middleware (JWT or API Key) ---

// DualAuth accepts either JWT or API Key authentication.
func DualAuth(apiKeyValidator APIKeyValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try JWT first
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					claims, err := ValidateToken(parts[1])
					if err == nil {
						ctx := r.Context()
						ctx = context.WithValue(ctx, ContextKeyUserID, claims.UserID)
						ctx = context.WithValue(ctx, ContextKeyUsername, claims.Username)
						ctx = context.WithValue(ctx, ContextKeyAuthType, AuthTypeJWT)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}

			// Try API Key
			apiKey := r.Header.Get("X-API-Key")
			if apiKey != "" && ValidateAPIKeyFormat(apiKey) {
				keyHash := HashAPIKey(apiKey)
				userID, err := apiKeyValidator(r.Context(), keyHash)
				if err == nil {
					ctx := r.Context()
					ctx = context.WithValue(ctx, ContextKeyUserID, userID)
					ctx = context.WithValue(ctx, ContextKeyAPIKey, ExtractPrefix(apiKey))
					ctx = context.WithValue(ctx, ContextKeyAuthType, AuthTypeAPIKey)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
		})
	}
}

// --- Context Helpers ---

// GetUserID extracts the user ID from the request context.
func GetUserID(ctx context.Context) string {
	if v, ok := ctx.Value(ContextKeyUserID).(string); ok {
		return v
	}
	return ""
}

// GetUsername extracts the username from the request context.
func GetUsername(ctx context.Context) string {
	if v, ok := ctx.Value(ContextKeyUsername).(string); ok {
		return v
	}
	return ""
}

// GetAuthType returns how the request was authenticated.
func GetAuthType(ctx context.Context) AuthType {
	if v, ok := ctx.Value(ContextKeyAuthType).(AuthType); ok {
		return v
	}
	return ""
}

// --- Rate Limiter ---

// RateLimiter implements a simple in-memory sliding window rate limiter.
// For production, use Redis-based rate limiting via the cache package.
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

// NewRateLimiter creates a new rate limiter.
// limit: max requests per window.
// window: time window duration.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}

	// Cleanup goroutine (every 5 minutes)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rl.cleanup()
		}
	}()

	return rl
}

// Allow checks if a request from the given key is within rate limits.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Get existing requests for this key
	times := rl.requests[key]

	// Filter to only requests within the window
	var valid []time.Time
	for _, t := range times {
		if t.After(windowStart) {
			valid = append(valid, t)
		}
	}

	// Check limit
	if len(valid) >= rl.limit {
		rl.requests[key] = valid
		return false
	}

	// Record this request
	valid = append(valid, now)
	rl.requests[key] = valid

	return true
}

// cleanup removes expired entries.
func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	for key, times := range rl.requests {
		var valid []time.Time
		for _, t := range times {
			if t.After(windowStart) {
				valid = append(valid, t)
			}
		}
		if len(valid) == 0 {
			delete(rl.requests, key)
		} else {
			rl.requests[key] = valid
		}
	}
}

// RateLimitMiddleware is a chi middleware that rate-limits requests.
// keyFunc extracts the rate limit key from the request (e.g., API key prefix, IP, user ID).
func RateLimitMiddleware(limiter *RateLimiter, keyFunc func(r *http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFunc(r)
			if key == "" {
				// No key = can't rate limit, let through
				next.ServeHTTP(w, r)
				return
			}

			if !limiter.Allow(key) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"rate limit exceeded","retry_after":60}`, http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// APIKeyRateLimitKey extracts the API key prefix for rate limiting.
func APIKeyRateLimitKey(r *http.Request) string {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey != "" && len(apiKey) >= 8 {
		return apiKey[:8]
	}
	return ""
}
