package db

import (
	"context"
	"encoding/json"
	"fmt"
)

// RestSeasonRepo implements SeasonRepo via Supabase REST API.
type RestSeasonRepo struct {
	db *DB
}

func (r *RestSeasonRepo) UpsertSeason(ctx context.Context, s SeasonRow) error {
	type row struct {
		ID         string          `json:"id"`
		Name       string          `json:"name"`
		Number     int             `json:"number"`
		Phase      string          `json:"phase"`
		Status     string          `json:"status"`
		StartAt    string          `json:"start_at"`
		EndAt      string          `json:"end_at"`
		ConfigJSON json.RawMessage `json:"config_json"`
		CreatedAt  string          `json:"created_at"`
	}

	var configJSON json.RawMessage
	if len(s.ConfigJSON) > 0 {
		configJSON = s.ConfigJSON
	} else {
		configJSON = json.RawMessage(`{}`)
	}

	payload := row{
		ID:         s.ID,
		Name:       s.Name,
		Number:     s.Number,
		Phase:      s.Phase,
		Status:     s.Status,
		StartAt:    s.StartAt.UTC().Format("2006-01-02T15:04:05Z"),
		EndAt:      s.EndAt.UTC().Format("2006-01-02T15:04:05Z"),
		ConfigJSON: configJSON,
		CreatedAt:  s.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}

	err := r.db.post(ctx, "/seasons?on_conflict=id", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("upsert season %s: %w", s.ID, err)
	}
	return nil
}

func (r *RestSeasonRepo) GetActiveSeason(ctx context.Context) (*SeasonRow, error) {
	var rows []SeasonRow
	err := r.db.get(ctx, "/seasons?status=in.(active,final_rush)&order=number.desc&limit=1", &rows)
	if err != nil {
		return nil, fmt.Errorf("get active season: %w", err)
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

func (r *RestSeasonRepo) ListSeasons(ctx context.Context) ([]SeasonRow, error) {
	var rows []SeasonRow
	err := r.db.get(ctx, "/seasons?order=number.desc", &rows)
	if err != nil {
		return nil, fmt.Errorf("list seasons: %w", err)
	}
	return rows, nil
}
