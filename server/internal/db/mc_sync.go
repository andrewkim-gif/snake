package db

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// playerMC holds a player's ID and MC balance for sync operations.
type playerMC struct {
	ID      string
	Balance int64
}

// MCSyncManager syncs Market Cap between Railway PG (master) and Supabase.
// Railway PG is the source of truth. Supabase game_saves is updated periodically.
type MCSyncManager struct {
	pg          *pgxpool.Pool
	supabaseURL string // e.g. "https://xxx.supabase.co/rest/v1"
	supabaseKey string // service_role key
	httpClient  *http.Client
	interval    time.Duration
	mu          sync.Mutex
}

// NewMCSyncManager creates a new sync manager.
func NewMCSyncManager(pg *pgxpool.Pool, supabaseURL, supabaseKey string) *MCSyncManager {
	return &MCSyncManager{
		pg:          pg,
		supabaseURL: strings.TrimSuffix(supabaseURL, "/") + "/rest/v1",
		supabaseKey: supabaseKey,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
		interval:    5 * time.Minute,
	}
}

// Start begins the periodic sync loop. Call in a goroutine.
func (m *MCSyncManager) Start(ctx context.Context) {
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	slog.Info("MC sync started", "interval", m.interval)

	for {
		select {
		case <-ctx.Done():
			slog.Info("MC sync stopped")
			return
		case <-ticker.C:
			if err := m.SyncToSupabase(ctx); err != nil {
				slog.Error("MC sync failed", "error", err)
			}
		}
	}
}

// SyncToSupabase reads all player MC balances from Railway PG and
// upserts them into Supabase game_saves.total_market_cap.
func (m *MCSyncManager) SyncToSupabase(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Railway PG에서 MC > 0인 모든 플레이어 조회
	rows, err := m.pg.Query(ctx,
		"SELECT id, mc_balance FROM players WHERE mc_balance > 0")
	if err != nil {
		return fmt.Errorf("query players: %w", err)
	}
	defer rows.Close()

	var players []playerMC
	for rows.Next() {
		var p playerMC
		if err := rows.Scan(&p.ID, &p.Balance); err != nil {
			return fmt.Errorf("scan player: %w", err)
		}
		players = append(players, p)
	}

	if len(players) == 0 {
		return nil
	}

	// Supabase로 배치 upsert (요청당 최대 100건)
	batchSize := 100
	synced := 0
	for i := 0; i < len(players); i += batchSize {
		end := i + batchSize
		if end > len(players) {
			end = len(players)
		}
		batch := players[i:end]

		if err := m.upsertBatch(ctx, batch); err != nil {
			slog.Warn("MC sync batch failed", "batch", i/batchSize, "error", err)
			continue
		}
		synced += len(batch)
	}

	slog.Info("MC sync completed", "players_synced", synced)
	return nil
}

// upsertBatch sends a batch of MC updates to Supabase via PostgREST upsert.
func (m *MCSyncManager) upsertBatch(ctx context.Context, players []playerMC) error {
	type supabaseRow struct {
		UserID         string `json:"user_id"`
		TotalMarketCap int64  `json:"total_market_cap"`
	}

	rows := make([]supabaseRow, len(players))
	for i, p := range players {
		rows[i] = supabaseRow{
			UserID:         p.ID,
			TotalMarketCap: p.Balance,
		}
	}

	body, err := json.Marshal(rows)
	if err != nil {
		return err
	}

	// PostgREST upsert: POST with Prefer: resolution=merge-duplicates
	url := m.supabaseURL + "/game_saves"
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", m.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+m.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase upsert: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("supabase upsert status: %d", resp.StatusCode)
	}
	return nil
}

// SyncFromSupabase reads MC from Supabase for a specific user and updates Railway PG.
// Used during initial login to import existing MC.
func (m *MCSyncManager) SyncFromSupabase(ctx context.Context, userID string) (int64, error) {
	// Supabase에서 해당 유저의 MC 조회
	url := fmt.Sprintf("%s/game_saves?user_id=eq.%s&select=total_market_cap", m.supabaseURL, userID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("apikey", m.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+m.supabaseKey)

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var results []struct {
		TotalMarketCap int64 `json:"total_market_cap"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return 0, err
	}

	if len(results) == 0 {
		return 0, nil
	}

	supabaseMC := results[0].TotalMarketCap

	// Railway PG에 upsert (데이터 손실 방지를 위해 큰 값 사용)
	_, err = m.pg.Exec(ctx,
		`INSERT INTO players (id, name, mc_balance) VALUES ($1, '', $2)
		 ON CONFLICT (id) DO UPDATE SET mc_balance = GREATEST(players.mc_balance, $2), updated_at = NOW()`,
		userID, supabaseMC)
	if err != nil {
		return 0, fmt.Errorf("pg upsert: %w", err)
	}

	return supabaseMC, nil
}
