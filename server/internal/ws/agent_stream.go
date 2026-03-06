// Package ws — Agent WebSocket live stream (Phase 5, S25).
// Provides WS /ws/agents/{id}/live endpoint for real-time battle state streaming.
// Supports API key authentication via query param, multi-subscription (multiple agents).
package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/gorilla/websocket"
)

// --- Agent Stream Types ---

// AgentStreamMsg is a message sent to agent stream subscribers.
type AgentStreamMsg struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// AgentBattleState is the real-time state of an agent in battle.
type AgentBattleState struct {
	AgentID    string  `json:"agent_id"`
	Alive      bool    `json:"alive"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Heading    float64 `json:"heading"`
	HP         float64 `json:"hp"` // mass as HP
	Level      int     `json:"level"`
	XP         int     `json:"xp"`
	Kills      int     `json:"kills"`
	Score      int     `json:"score"`
	Boosting   bool    `json:"boosting"`
	CountryISO string  `json:"country_iso"`
	Action     string  `json:"action"` // current behavior: "hunting", "farming", "fleeing", "idle"
	Tick       uint64  `json:"tick"`
	Timestamp  int64   `json:"timestamp"`
}

// AgentBattleEvent is a discrete event in an agent's battle.
type AgentBattleEvent struct {
	AgentID   string `json:"agent_id"`
	EventType string `json:"event_type"` // "kill", "death", "level_up", "synergy", "ability_used"
	Detail    string `json:"detail"`
	Timestamp int64  `json:"timestamp"`
}

// --- Stream Subscriber ---

// StreamSubscriber is a single WebSocket connection subscribing to agent streams.
type StreamSubscriber struct {
	conn       *websocket.Conn
	send       chan []byte
	agentIDs   map[string]bool // subscribed agent IDs
	userID     string
	mu         sync.Mutex
	closeOnce  sync.Once
	closed     bool
}

// newStreamSubscriber creates a new stream subscriber.
func newStreamSubscriber(conn *websocket.Conn, userID string) *StreamSubscriber {
	return &StreamSubscriber{
		conn:     conn,
		send:     make(chan []byte, 128),
		agentIDs: make(map[string]bool),
		userID:   userID,
	}
}

// Subscribe adds an agent ID to the subscription set.
func (s *StreamSubscriber) Subscribe(agentID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.agentIDs[agentID] = true
}

// Unsubscribe removes an agent ID from the subscription set.
func (s *StreamSubscriber) Unsubscribe(agentID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.agentIDs, agentID)
}

// IsSubscribed checks if the subscriber is watching a specific agent.
func (s *StreamSubscriber) IsSubscribed(agentID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.agentIDs[agentID]
}

// Close safely closes the subscriber's send channel and connection.
func (s *StreamSubscriber) Close() {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		s.mu.Unlock()
		close(s.send)
		s.conn.Close()
	})
}

// writePump sends queued messages to the WebSocket connection.
func (s *StreamSubscriber) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		s.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-s.send:
			s.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				s.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := s.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			s.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := s.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads incoming messages from the subscriber (subscribe/unsubscribe commands).
func (s *StreamSubscriber) readPump(hub *AgentStreamHub) {
	defer func() {
		hub.unregister <- s
		s.conn.Close()
	}()

	s.conn.SetReadLimit(4096)
	s.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	s.conn.SetPongHandler(func(string) error {
		s.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		return nil
	})

	for {
		_, message, err := s.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Warn("agent stream read error", "userId", s.userID, "error", err)
			}
			return
		}

		// Parse subscribe/unsubscribe commands
		var cmd struct {
			Action  string `json:"action"`  // "subscribe" or "unsubscribe"
			AgentID string `json:"agent_id"`
		}
		if err := json.Unmarshal(message, &cmd); err != nil {
			continue
		}

		switch cmd.Action {
		case "subscribe":
			s.Subscribe(cmd.AgentID)
			slog.Info("agent stream: subscribed", "userId", s.userID, "agentId", cmd.AgentID)
		case "unsubscribe":
			s.Unsubscribe(cmd.AgentID)
			slog.Info("agent stream: unsubscribed", "userId", s.userID, "agentId", cmd.AgentID)
		}
	}
}

// --- Agent Stream Hub ---

// AgentStreamHub manages all agent stream subscribers.
// It broadcasts agent state updates and battle events to interested subscribers.
type AgentStreamHub struct {
	subscribers map[*StreamSubscriber]bool
	register    chan *StreamSubscriber
	unregister  chan *StreamSubscriber
	broadcast   chan []byte // agent-targeted broadcast (contains agentID)
	done        chan struct{}
	mu          sync.RWMutex

	// APIKey validator for WebSocket auth
	ValidateAPIKey auth.APIKeyValidator
}

// NewAgentStreamHub creates a new agent stream hub.
func NewAgentStreamHub() *AgentStreamHub {
	return &AgentStreamHub{
		subscribers: make(map[*StreamSubscriber]bool),
		register:    make(chan *StreamSubscriber, 64),
		unregister:  make(chan *StreamSubscriber, 64),
		broadcast:   make(chan []byte, 256),
		done:        make(chan struct{}),
	}
}

// Run starts the hub event loop. Call this in a goroutine.
func (h *AgentStreamHub) Run() {
	for {
		select {
		case sub := <-h.register:
			h.subscribers[sub] = true
			slog.Info("agent stream subscriber registered", "userId", sub.userID, "total", len(h.subscribers))

		case sub := <-h.unregister:
			if _, ok := h.subscribers[sub]; ok {
				delete(h.subscribers, sub)
				sub.Close()
				slog.Info("agent stream subscriber unregistered", "userId", sub.userID, "total", len(h.subscribers))
			}

		case msg := <-h.broadcast:
			// Parse the agent ID from the message to target correct subscribers
			var envelope struct {
				Event string          `json:"event"`
				Data  json.RawMessage `json:"data"`
			}
			var agentID string
			if err := json.Unmarshal(msg, &envelope); err == nil {
				var idHolder struct {
					AgentID string `json:"agent_id"`
				}
				json.Unmarshal(envelope.Data, &idHolder)
				agentID = idHolder.AgentID
			}

			for sub := range h.subscribers {
				if agentID != "" && !sub.IsSubscribed(agentID) {
					continue
				}
				select {
				case sub.send <- msg:
				default:
					// Slow subscriber — disconnect
					delete(h.subscribers, sub)
					sub.Close()
				}
			}

		case <-h.done:
			for sub := range h.subscribers {
				sub.Close()
			}
			return
		}
	}
}

// Stop shuts down the agent stream hub.
func (h *AgentStreamHub) Stop() {
	close(h.done)
}

// BroadcastState sends an agent battle state update to all interested subscribers.
func (h *AgentStreamHub) BroadcastState(state *AgentBattleState) {
	msg := AgentStreamMsg{
		Event: "agent_state",
		Data:  state,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case h.broadcast <- data:
	default:
		// Channel full — drop message (stale data is acceptable for live streams)
	}
}

// BroadcastEvent sends a discrete battle event to interested subscribers.
func (h *AgentStreamHub) BroadcastEvent(event *AgentBattleEvent) {
	msg := AgentStreamMsg{
		Event: "agent_event",
		Data:  event,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case h.broadcast <- data:
	default:
	}
}

// SubscriberCount returns the number of active subscribers.
func (h *AgentStreamHub) SubscriberCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subscribers)
}

// --- HTTP Handler ---

// agentStreamUpgrader is the WebSocket upgrader for agent streams.
var agentStreamUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// HandleAgentStream is the HTTP handler for WS /ws/agents/{id}/live.
// Authentication is via API key query parameter: ?api_key=aww_xxx
func (h *AgentStreamHub) HandleAgentStream(w http.ResponseWriter, r *http.Request) {
	// Extract agent ID from URL
	agentID := "" // Will be extracted from path
	// chi.URLParam works if mounted via chi router
	// Fallback: parse from path manually
	if id := r.URL.Query().Get("agent_id"); id != "" {
		agentID = id
	}

	// Authenticate via API key query param
	apiKey := r.URL.Query().Get("api_key")
	if apiKey == "" {
		// Also check header as fallback
		apiKey = r.Header.Get("X-API-Key")
	}

	if apiKey == "" {
		http.Error(w, `{"error":"missing api_key parameter"}`, http.StatusUnauthorized)
		return
	}

	if !auth.ValidateAPIKeyFormat(apiKey) {
		http.Error(w, `{"error":"invalid API key format"}`, http.StatusUnauthorized)
		return
	}

	// Validate API key
	userID := ""
	if h.ValidateAPIKey != nil {
		keyHash := auth.HashAPIKey(apiKey)
		var err error
		userID, err = h.ValidateAPIKey(r.Context(), keyHash)
		if err != nil {
			http.Error(w, `{"error":"invalid API key"}`, http.StatusUnauthorized)
			return
		}
	} else {
		// Development fallback: derive userID from key prefix
		userID = "dev_user_" + auth.ExtractPrefix(apiKey)
	}

	// Upgrade to WebSocket
	conn, err := agentStreamUpgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("agent stream upgrade failed", "error", err)
		return
	}

	sub := newStreamSubscriber(conn, userID)

	// Auto-subscribe to the requested agent if provided
	if agentID != "" {
		sub.Subscribe(agentID)
	}

	h.register <- sub

	// Send connection acknowledgment
	ack := AgentStreamMsg{
		Event: "connected",
		Data: map[string]interface{}{
			"user_id":       userID,
			"subscribed_to": agentID,
			"message":       "Send {\"action\":\"subscribe\",\"agent_id\":\"xxx\"} to watch agents",
		},
	}
	ackData, _ := json.Marshal(ack)
	conn.WriteMessage(websocket.TextMessage, ackData)

	// Start read/write pumps
	go sub.writePump()
	go sub.readPump(h)

	slog.Info("agent stream connected",
		"userId", userID,
		"agentId", agentID,
		"remoteAddr", r.RemoteAddr,
	)
}
