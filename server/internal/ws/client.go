package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/to-nexus/snake-server/internal/domain"
)

const (
	// Send channel buffer size
	sendBufferSize = 64

	// Write deadline
	writeWait = 10 * time.Second

	// Pong read deadline
	pongWait = 30 * time.Second

	// Ping interval (must be < pongWait)
	pingPeriod = 25 * time.Second

	// Max message size from client
	maxMessageSize = 4096
)

// MessageHandler is called for each event received from a client.
type MessageHandler func(client *Client, event string, data json.RawMessage)

// DisconnectHandler is called when a client disconnects.
type DisconnectHandler func(clientID string)

// Client represents a single WebSocket connection.
type Client struct {
	ID     string
	conn   *websocket.Conn
	hub    *Hub
	send   chan []byte
	done   chan struct{}
	RoomID string

	// Message handler (set externally)
	OnMessage MessageHandler

	// Disconnect handler (set externally)
	OnDisconnect DisconnectHandler

	// Rate limiter (per-event token buckets)
	rateLimiters map[string]*tokenBucket
	rlMu         sync.Mutex
}

// newClient creates a new Client.
func newClient(conn *websocket.Conn, hub *Hub) *Client {
	return &Client{
		ID:           uuid.New().String(),
		conn:         conn,
		hub:          hub,
		send:         make(chan []byte, sendBufferSize),
		done:         make(chan struct{}),
		rateLimiters: makeDefaultRateLimiters(),
	}
}

// ReadPump reads messages from the WebSocket connection and dispatches events.
// Must be called in its own goroutine.
func (c *Client) ReadPump() {
	defer func() {
		// Notify disconnect handler before unregistering
		if c.OnDisconnect != nil {
			c.OnDisconnect(c.ID)
		}
		c.hub.Unregister <- c
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
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
			) {
				slog.Debug("ws read error", "clientID", c.ID, "error", err)
			}
			return
		}

		// Parse the {e, d} frame
		event, data, err := ParseFrame(message)
		if err != nil {
			slog.Debug("invalid frame", "clientID", c.ID, "error", err)
			c.SendError("INVALID_FRAME", "invalid message format")
			continue
		}

		// Rate limit check
		if !c.checkRateLimit(event) {
			c.SendError(domain.ErrRateLimited, "rate limited: "+event)
			continue
		}

		// Handle ping directly (no external handler needed)
		if event == EventPing {
			c.handlePing(data)
			continue
		}

		// Dispatch to external handler
		if c.OnMessage != nil {
			c.OnMessage(c, event, data)
		}
	}
}

// WritePump writes messages from the send channel to the WebSocket connection.
// Must be called in its own goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case <-c.done:
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return

		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Channel closed
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

			// Drain queued messages (each as a separate WS frame)
			n := len(c.send)
			for i := 0; i < n; i++ {
				if err := c.conn.WriteMessage(websocket.TextMessage, <-c.send); err != nil {
					return
				}
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendEvent sends a typed event to this client.
func (c *Client) SendEvent(event string, data interface{}) {
	frame, err := MakeFrame(event, data)
	if err != nil {
		slog.Error("failed to marshal event", "event", event, "error", err)
		return
	}
	select {
	case c.send <- frame:
	case <-c.done:
	default:
		// Buffer full — will be handled by hub
	}
}

// SendRaw sends pre-serialized data to this client.
func (c *Client) SendRaw(data []byte) {
	select {
	case c.send <- data:
	case <-c.done:
	default:
	}
}

// SendError sends an error event to the client.
func (c *Client) SendError(code, message string) {
	c.SendEvent(EventError, domain.ErrorPayload{
		Code:    code,
		Message: message,
	})
}

// handlePing responds to a ping with a pong.
func (c *Client) handlePing(data json.RawMessage) {
	var ping domain.PingPayload
	if err := json.Unmarshal(data, &ping); err != nil {
		return
	}
	c.SendEvent(EventPong, domain.PongPayload{
		T:  ping.T,
		ST: time.Now().UnixMilli(),
	})
}

// ─── Rate Limiter ───

// tokenBucket implements a simple token bucket rate limiter.
type tokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

func newTokenBucket(maxTokens, refillRate float64) *tokenBucket {
	return &tokenBucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

func (tb *tokenBucket) allow() bool {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens += elapsed * tb.refillRate
	if tb.tokens > tb.maxTokens {
		tb.tokens = tb.maxTokens
	}
	tb.lastRefill = now

	if tb.tokens >= 1.0 {
		tb.tokens--
		return true
	}
	return false
}

// makeDefaultRateLimiters creates per-event rate limiters.
func makeDefaultRateLimiters() map[string]*tokenBucket {
	return map[string]*tokenBucket{
		EventInput:         newTokenBucket(30, 30),  // 30/s
		EventJoinRoom:      newTokenBucket(2, 1),    // 1/s (burst 2)
		EventRespawn:       newTokenBucket(2, 1),    // 1/s (burst 2)
		EventPing:          newTokenBucket(5, 5),    // 5/s
		EventChooseUpgrade: newTokenBucket(3, 3),    // 3/s
	}
}

// checkRateLimit returns true if the event is allowed.
func (c *Client) checkRateLimit(event string) bool {
	c.rlMu.Lock()
	defer c.rlMu.Unlock()

	bucket, ok := c.rateLimiters[event]
	if !ok {
		// No rate limit for this event
		return true
	}
	return bucket.allow()
}

// ─── WebSocket Upgrader + ServeWS ───

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins (CORS is handled at the HTTP level)
		return true
	},
}

// WSHandlers holds the event handlers for WebSocket connections.
type WSHandlers struct {
	OnMessage    MessageHandler
	OnDisconnect DisconnectHandler
}

// ServeWS handles the WebSocket upgrade and starts client pumps.
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, onMessage MessageHandler) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err)
		return
	}

	client := newClient(conn, hub)
	client.OnMessage = onMessage

	// Register to the "lobby" room initially
	hub.Register <- &Registration{
		Client: client,
		RoomID: "lobby",
	}

	slog.Info("ws client connected", "clientID", client.ID)

	// Start pumps in separate goroutines
	go client.WritePump()
	go client.ReadPump()
}

// ServeWSWithHandlers handles the WebSocket upgrade with full handler configuration.
func ServeWSWithHandlers(hub *Hub, w http.ResponseWriter, r *http.Request, handlers WSHandlers) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err)
		return
	}

	client := newClient(conn, hub)
	client.OnMessage = handlers.OnMessage
	client.OnDisconnect = handlers.OnDisconnect

	// Register to the "lobby" room initially
	hub.Register <- &Registration{
		Client: client,
		RoomID: "lobby",
	}

	slog.Info("ws client connected", "clientID", client.ID)

	// Start pumps in separate goroutines
	go client.WritePump()
	go client.ReadPump()
}
