package ws

import (
	"testing"
	"time"
)

func TestTokenBucket_AllowBurst(t *testing.T) {
	// 2 tokens max, refill 1/s
	tb := newTokenBucket(2, 1)

	// Should allow 2 immediate requests
	if !tb.allow() {
		t.Fatal("first request should be allowed")
	}
	if !tb.allow() {
		t.Fatal("second request should be allowed (burst)")
	}

	// Third should be denied
	if tb.allow() {
		t.Fatal("third request should be denied")
	}
}

func TestTokenBucket_Refill(t *testing.T) {
	tb := newTokenBucket(2, 10) // 10 tokens/sec refill
	tb.tokens = 0
	tb.lastRefill = time.Now().Add(-200 * time.Millisecond) // 200ms ago

	// After 200ms at 10/s refill rate = 2 tokens
	if !tb.allow() {
		t.Fatal("should have refilled")
	}
}

func TestRateLimiter_InputRate(t *testing.T) {
	c := mockClient("test")

	// Input is 30/s burst
	allowed := 0
	for i := 0; i < 35; i++ {
		if c.checkRateLimit(EventInput) {
			allowed++
		}
	}

	// Should allow 30 (burst), deny the rest
	if allowed != 30 {
		t.Fatalf("expected 30 allowed, got %d", allowed)
	}
}

func TestRateLimiter_JoinRoomRate(t *testing.T) {
	c := mockClient("test")

	// join_room is 1/s with burst 2
	allowed := 0
	for i := 0; i < 5; i++ {
		if c.checkRateLimit(EventJoinRoom) {
			allowed++
		}
	}

	if allowed != 2 {
		t.Fatalf("expected 2 allowed (burst), got %d", allowed)
	}
}

func TestRateLimiter_UnlimitedEvent(t *testing.T) {
	c := mockClient("test")

	// leave_room has no rate limit
	for i := 0; i < 100; i++ {
		if !c.checkRateLimit(EventLeaveRoom) {
			t.Fatal("leave_room should not be rate limited")
		}
	}
}
