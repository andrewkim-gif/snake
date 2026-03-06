package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// APIKey represents an API key with metadata.
type APIKey struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Prefix    string    `json:"prefix"`     // First 8 chars (visible to user for identification)
	KeyHash   string    `json:"-"`          // SHA-256 hash of the full key
	LastUsed  time.Time `json:"last_used"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// APIKeyConfig holds API key generation settings.
type APIKeyConfig struct {
	MaxKeysPerUser int
	DefaultExpiry  time.Duration
}

// DefaultAPIKeyConfig returns default API key configuration.
func DefaultAPIKeyConfig() APIKeyConfig {
	return APIKeyConfig{
		MaxKeysPerUser: 5,
		DefaultExpiry:  0, // No expiry by default
	}
}

// GenerateAPIKey creates a new API key string.
// Format: "aww_" + 32 random hex chars = 36 chars total
// Returns: (fullKey, prefix, keyHash)
func GenerateAPIKey() (string, string, string, error) {
	// Generate 32 bytes of random data
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", "", fmt.Errorf("generate random bytes: %w", err)
	}

	// Create the key: prefix + hex-encoded random
	hexStr := hex.EncodeToString(bytes)
	fullKey := "aww_" + hexStr

	// Prefix is the first 8 chars for identification
	prefix := fullKey[:8]

	// Hash for storage
	keyHash := HashAPIKey(fullKey)

	return fullKey, prefix, keyHash, nil
}

// HashAPIKey computes the SHA-256 hash of an API key for secure storage.
func HashAPIKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// ValidateAPIKeyFormat checks if a key has the correct format.
func ValidateAPIKeyFormat(key string) bool {
	// Must start with "aww_" and be 68 chars total (4 prefix + 64 hex)
	if !strings.HasPrefix(key, "aww_") {
		return false
	}
	if len(key) != 68 {
		return false
	}
	// Remaining chars must be valid hex
	_, err := hex.DecodeString(key[4:])
	return err == nil
}

// ExtractPrefix returns the visible prefix of an API key.
func ExtractPrefix(key string) string {
	if len(key) >= 8 {
		return key[:8]
	}
	return key
}
