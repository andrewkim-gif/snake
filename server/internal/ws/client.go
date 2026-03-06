package ws

import (
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 30 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer (64KB).
	maxMessageSize = 64 * 1024

	// Send channel buffer size.
	sendBufferSize = 64
)

// MessageHandler is called for each incoming message from a client.
type MessageHandler func(client *Client, message []byte)

// RateLimiter tracks per-event rate limits for a client.
type RateLimiter struct {
	mu       sync.Mutex
	lastSent map[string]time.Time
	limits   map[string]time.Duration
}

// NewRateLimiter creates a rate limiter with predefined event limits.
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		lastSent: make(map[string]time.Time),
		limits: map[string]time.Duration{
			"input":   33 * time.Millisecond,  // 30Hz max
			"respawn": 2 * time.Second,        // 0.5Hz max
			"ping":    200 * time.Millisecond,  // 5Hz max
		},
	}
}

// Allow checks if an event should be allowed through the rate limiter.
// Returns true if allowed, false if rate limited (should be silently dropped).
func (rl *RateLimiter) Allow(event string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limit, hasLimit := rl.limits[event]
	if !hasLimit {
		// No rate limit for this event
		return true
	}

	now := time.Now()
	last, exists := rl.lastSent[event]
	if exists && now.Sub(last) < limit {
		// Rate limited — silently drop
		return false
	}

	rl.lastSent[event] = now
	return true
}

// Client represents a single WebSocket connection.
type Client struct {
	ID     string
	RoomID string
	Hub    *Hub
	conn   *websocket.Conn
	send   chan []byte

	// Rate limiter for incoming events.
	rateLimiter *RateLimiter

	// onMessage is called for each incoming message.
	onMessage MessageHandler

	// onDisconnect is called when the client disconnects.
	onDisconnect func(client *Client)

	// sendOnce ensures the send channel is closed exactly once.
	sendOnce sync.Once

	// Agent-specific fields (S46)
	IsAgent      bool   // true if this client is an authenticated AI agent
	AgentID      string // agent identifier (e.g., "my-claude-agent-01")
	AgentAPIKey  string // API key for verification (stored hashed in production)
}

// CloseSend safely closes the send channel exactly once (prevents double-close panic).
func (c *Client) CloseSend() {
	c.sendOnce.Do(func() {
		close(c.send)
	})
}

// NewClient creates a new Client with the given WebSocket connection.
func NewClient(id string, hub *Hub, conn *websocket.Conn, handler MessageHandler, onDisconnect func(client *Client)) *Client {
	return &Client{
		ID:           id,
		Hub:          hub,
		conn:         conn,
		send:         make(chan []byte, sendBufferSize),
		rateLimiter:  NewRateLimiter(),
		onMessage:    handler,
		onDisconnect: onDisconnect,
	}
}

// Send queues a message for delivery to the client.
func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	default:
		slog.Warn("send buffer full, dropping message", "clientId", c.ID)
	}
}

// CheckRateLimit checks if an event is allowed by the rate limiter.
func (c *Client) CheckRateLimit(event string) bool {
	return c.rateLimiter.Allow(event)
}

// ReadPump reads messages from the WebSocket connection.
// Must be run in a goroutine. One per client.
func (c *Client) ReadPump() {
	defer func() {
		if c.onDisconnect != nil {
			c.onDisconnect(c)
		}
		c.Hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Warn("ws read error", "clientId", c.ID, "error", err)
			}
			return
		}

		if c.onMessage != nil {
			func() {
				defer func() {
					if r := recover(); r != nil {
						slog.Error("message handler panic", "clientId", c.ID, "error", r)
					}
				}()
				c.onMessage(c, message)
			}()
		}
	}
}

// WritePump writes messages from the send channel to the WebSocket connection.
// Must be run in a goroutine. One per client.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Batch flush: drain queued messages into the same write.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
