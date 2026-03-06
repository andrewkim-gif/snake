// Package observability provides Prometheus metrics, structured logging,
// and health monitoring for AI World War v11.
//
// S44: Monitoring + Logging
//
// Metrics tracked:
//   - Server uptime and start time
//   - Active connections (WebSocket clients)
//   - Active arenas (concurrent battles)
//   - Country population (agents per country)
//   - Battle count (total completed)
//   - Tick latency (game loop performance)
//   - HTTP request count and latency
//   - Meta module health status
//   - Economy ticks processed
//   - Season status
//
// Endpoints:
//   - GET /health — JSON health status
//   - GET /metrics — Prometheus-compatible text metrics
package observability

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Metrics collects and exposes server metrics in Prometheus exposition format.
// Uses simple atomic counters instead of a full Prometheus client library
// to avoid adding heavy dependencies. Railway can scrape /metrics directly.
type Metrics struct {
	mu sync.RWMutex

	// Server lifecycle
	startTime time.Time
	started   bool

	// Counters (atomic for lock-free increment)
	httpRequests     atomic.Int64
	wsConnections    atomic.Int64
	wsDisconnections atomic.Int64
	battleStarted    atomic.Int64
	battleCompleted  atomic.Int64
	economyTicks     atomic.Int64
	seasonTransitions atomic.Int64
	agentDeployments atomic.Int64
	agentRecalls     atomic.Int64
	errorsTotal      atomic.Int64

	// Gauges (need mutex for read/write)
	activePlayers      atomic.Int64
	activeArenas       atomic.Int64
	activeSpectators   atomic.Int64
	goroutineCount     atomic.Int64

	// Histogram-like: track last N tick latencies
	tickLatencies    []time.Duration
	tickLatencyIdx   int
	tickLatencyMu    sync.Mutex

	// Webhook config (for error alerts)
	alertWebhookURL string
	alertCooldown   time.Duration
	lastAlertTime   time.Time
}

// NewMetrics creates a new Metrics instance.
func NewMetrics() *Metrics {
	return &Metrics{
		tickLatencies: make([]time.Duration, 100), // ring buffer of last 100 ticks
		alertCooldown: 5 * time.Minute,
	}
}

// RecordServerStart marks the server start time.
func (m *Metrics) RecordServerStart() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.startTime = time.Now()
	m.started = true
}

// --- Counter increments ---

// IncHTTPRequests increments the HTTP request counter.
func (m *Metrics) IncHTTPRequests() { m.httpRequests.Add(1) }

// IncWSConnections increments the WebSocket connection counter.
func (m *Metrics) IncWSConnections() { m.wsConnections.Add(1) }

// IncWSDisconnections increments the WebSocket disconnection counter.
func (m *Metrics) IncWSDisconnections() { m.wsDisconnections.Add(1) }

// IncBattleStarted increments the battle started counter.
func (m *Metrics) IncBattleStarted() { m.battleStarted.Add(1) }

// IncBattleCompleted increments the battle completed counter.
func (m *Metrics) IncBattleCompleted() { m.battleCompleted.Add(1) }

// IncEconomyTicks increments the economy tick counter.
func (m *Metrics) IncEconomyTicks() { m.economyTicks.Add(1) }

// IncSeasonTransitions increments the season transition counter.
func (m *Metrics) IncSeasonTransitions() { m.seasonTransitions.Add(1) }

// IncAgentDeployments increments the agent deployment counter.
func (m *Metrics) IncAgentDeployments() { m.agentDeployments.Add(1) }

// IncAgentRecalls increments the agent recall counter.
func (m *Metrics) IncAgentRecalls() { m.agentRecalls.Add(1) }

// IncErrors increments the error counter and optionally sends an alert.
func (m *Metrics) IncErrors(component, message string) {
	m.errorsTotal.Add(1)
	slog.Error("metric error recorded",
		"component", component,
		"message", message,
		"total_errors", m.errorsTotal.Load(),
	)
	m.maybeAlert(component, message)
}

// --- Gauge setters ---

// SetActivePlayers sets the current active player gauge.
func (m *Metrics) SetActivePlayers(n int64) { m.activePlayers.Store(n) }

// SetActiveArenas sets the current active arena gauge.
func (m *Metrics) SetActiveArenas(n int64) { m.activeArenas.Store(n) }

// SetActiveSpectators sets the current spectator count gauge.
func (m *Metrics) SetActiveSpectators(n int64) { m.activeSpectators.Store(n) }

// --- Tick latency tracking ---

// RecordTickLatency records a game loop tick duration.
func (m *Metrics) RecordTickLatency(d time.Duration) {
	m.tickLatencyMu.Lock()
	defer m.tickLatencyMu.Unlock()
	m.tickLatencies[m.tickLatencyIdx%len(m.tickLatencies)] = d
	m.tickLatencyIdx++
}

// AvgTickLatency returns the average tick latency over the ring buffer.
func (m *Metrics) AvgTickLatency() time.Duration {
	m.tickLatencyMu.Lock()
	defer m.tickLatencyMu.Unlock()

	count := m.tickLatencyIdx
	if count > len(m.tickLatencies) {
		count = len(m.tickLatencies)
	}
	if count == 0 {
		return 0
	}

	var total time.Duration
	for i := 0; i < count; i++ {
		total += m.tickLatencies[i]
	}
	return total / time.Duration(count)
}

// MaxTickLatency returns the max tick latency in the ring buffer.
func (m *Metrics) MaxTickLatency() time.Duration {
	m.tickLatencyMu.Lock()
	defer m.tickLatencyMu.Unlock()

	var maxLatency time.Duration
	count := m.tickLatencyIdx
	if count > len(m.tickLatencies) {
		count = len(m.tickLatencies)
	}
	for i := 0; i < count; i++ {
		if m.tickLatencies[i] > maxLatency {
			maxLatency = m.tickLatencies[i]
		}
	}
	return maxLatency
}

// --- Prometheus exposition format ---

// Handler returns an HTTP handler that serves Prometheus-compatible metrics.
func (m *Metrics) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		var sb strings.Builder

		// Server info
		sb.WriteString("# HELP aww_server_info Server version info\n")
		sb.WriteString("# TYPE aww_server_info gauge\n")
		sb.WriteString("aww_server_info{version=\"11.0.0\"} 1\n\n")

		// Uptime
		m.mu.RLock()
		uptime := time.Since(m.startTime).Seconds()
		m.mu.RUnlock()
		sb.WriteString("# HELP aww_server_uptime_seconds Server uptime in seconds\n")
		sb.WriteString("# TYPE aww_server_uptime_seconds gauge\n")
		sb.WriteString(fmt.Sprintf("aww_server_uptime_seconds %.1f\n\n", uptime))

		// Goroutines
		sb.WriteString("# HELP aww_goroutines Current number of goroutines\n")
		sb.WriteString("# TYPE aww_goroutines gauge\n")
		sb.WriteString(fmt.Sprintf("aww_goroutines %d\n\n", runtime.NumGoroutine()))

		// Memory
		var memStats runtime.MemStats
		runtime.ReadMemStats(&memStats)
		sb.WriteString("# HELP aww_memory_alloc_bytes Current memory allocation in bytes\n")
		sb.WriteString("# TYPE aww_memory_alloc_bytes gauge\n")
		sb.WriteString(fmt.Sprintf("aww_memory_alloc_bytes %d\n\n", memStats.Alloc))

		sb.WriteString("# HELP aww_memory_sys_bytes Total memory obtained from OS in bytes\n")
		sb.WriteString("# TYPE aww_memory_sys_bytes gauge\n")
		sb.WriteString(fmt.Sprintf("aww_memory_sys_bytes %d\n\n", memStats.Sys))

		// Counters
		writeCounter(&sb, "aww_http_requests_total", "Total HTTP requests", m.httpRequests.Load())
		writeCounter(&sb, "aww_ws_connections_total", "Total WebSocket connections", m.wsConnections.Load())
		writeCounter(&sb, "aww_ws_disconnections_total", "Total WebSocket disconnections", m.wsDisconnections.Load())
		writeCounter(&sb, "aww_battles_started_total", "Total battles started", m.battleStarted.Load())
		writeCounter(&sb, "aww_battles_completed_total", "Total battles completed", m.battleCompleted.Load())
		writeCounter(&sb, "aww_economy_ticks_total", "Total economy ticks processed", m.economyTicks.Load())
		writeCounter(&sb, "aww_season_transitions_total", "Total season transitions", m.seasonTransitions.Load())
		writeCounter(&sb, "aww_agent_deployments_total", "Total agent deployments", m.agentDeployments.Load())
		writeCounter(&sb, "aww_agent_recalls_total", "Total agent recalls", m.agentRecalls.Load())
		writeCounter(&sb, "aww_errors_total", "Total errors", m.errorsTotal.Load())

		// Gauges
		writeGauge(&sb, "aww_active_players", "Current active players", m.activePlayers.Load())
		writeGauge(&sb, "aww_active_arenas", "Current active arenas", m.activeArenas.Load())
		writeGauge(&sb, "aww_active_spectators", "Current spectators", m.activeSpectators.Load())

		// Tick latency
		avgTick := m.AvgTickLatency()
		maxTick := m.MaxTickLatency()
		sb.WriteString("# HELP aww_tick_latency_avg_ms Average game tick latency in milliseconds\n")
		sb.WriteString("# TYPE aww_tick_latency_avg_ms gauge\n")
		sb.WriteString(fmt.Sprintf("aww_tick_latency_avg_ms %.3f\n\n", float64(avgTick.Microseconds())/1000.0))

		sb.WriteString("# HELP aww_tick_latency_max_ms Maximum game tick latency in milliseconds\n")
		sb.WriteString("# TYPE aww_tick_latency_max_ms gauge\n")
		sb.WriteString(fmt.Sprintf("aww_tick_latency_max_ms %.3f\n\n", float64(maxTick.Microseconds())/1000.0))

		w.Write([]byte(sb.String()))
	}
}

func writeCounter(sb *strings.Builder, name, help string, value int64) {
	sb.WriteString(fmt.Sprintf("# HELP %s %s\n", name, help))
	sb.WriteString(fmt.Sprintf("# TYPE %s counter\n", name))
	sb.WriteString(fmt.Sprintf("%s %d\n\n", name, value))
}

func writeGauge(sb *strings.Builder, name, help string, value int64) {
	sb.WriteString(fmt.Sprintf("# HELP %s %s\n", name, help))
	sb.WriteString(fmt.Sprintf("# TYPE %s gauge\n", name))
	sb.WriteString(fmt.Sprintf("%s %d\n\n", name, value))
}

// --- Periodic Reporter (logs summary every 60s) ---

// StartReporter starts a background goroutine that logs metrics summary periodically.
func (m *Metrics) StartReporter(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.logSummary()
		}
	}
}

func (m *Metrics) logSummary() {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	slog.Info("metrics summary",
		"active_players", m.activePlayers.Load(),
		"active_arenas", m.activeArenas.Load(),
		"battles_total", m.battleCompleted.Load(),
		"economy_ticks", m.economyTicks.Load(),
		"errors_total", m.errorsTotal.Load(),
		"goroutines", runtime.NumGoroutine(),
		"memory_mb", memStats.Alloc/1024/1024,
		"tick_avg_ms", fmt.Sprintf("%.2f", float64(m.AvgTickLatency().Microseconds())/1000.0),
	)
}

// --- Error Alerting (simple webhook) ---

// SetAlertWebhook configures a webhook URL for error alerts.
func (m *Metrics) SetAlertWebhook(url string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.alertWebhookURL = url
}

func (m *Metrics) maybeAlert(component, message string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.alertWebhookURL == "" {
		return
	}

	if time.Since(m.lastAlertTime) < m.alertCooldown {
		return
	}

	m.lastAlertTime = time.Now()

	// Fire and forget — don't block metrics recording
	go func() {
		payload := fmt.Sprintf(`{"text":"[AWW Alert] %s: %s (errors: %d)"}`,
			component, message, m.errorsTotal.Load())
		resp, err := http.Post(m.alertWebhookURL, "application/json", strings.NewReader(payload))
		if err != nil {
			slog.Warn("alert webhook failed", "error", err)
			return
		}
		resp.Body.Close()
	}()
}
