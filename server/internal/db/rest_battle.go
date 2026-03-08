package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// RestBattleRepo implements BattleRepo via Supabase REST API.
type RestBattleRepo struct {
	db *DB
}

func (r *RestBattleRepo) InsertBattle(ctx context.Context, countryISO, seasonID, battleType, status string,
	startedAt, endedAt *time.Time, durationSec, participants int, resultsJSON []byte, winnerFactionID *string) error {

	type row struct {
		CountryISO      string          `json:"country_iso"`
		SeasonID        *string         `json:"season_id"`
		BattleType      string          `json:"battle_type"`
		Status          string          `json:"status"`
		StartedAt       *string         `json:"started_at"`
		EndedAt         *string         `json:"ended_at"`
		DurationSec     int             `json:"duration_sec"`
		Participants    int             `json:"participants"`
		ResultsJSON     json.RawMessage `json:"results_json"`
		WinnerFactionID *string         `json:"winner_faction_id"`
	}

	var seasonIDVal *string
	if seasonID != "" {
		seasonIDVal = &seasonID
	}

	var results json.RawMessage
	if len(resultsJSON) > 0 {
		results = resultsJSON
	} else {
		results = json.RawMessage(`{}`)
	}

	payload := row{
		CountryISO:      countryISO,
		SeasonID:        seasonIDVal,
		BattleType:      battleType,
		Status:          status,
		DurationSec:     durationSec,
		Participants:    participants,
		ResultsJSON:     results,
		WinnerFactionID: winnerFactionID,
	}

	if startedAt != nil {
		s := startedAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.StartedAt = &s
	}
	if endedAt != nil {
		s := endedAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.EndedAt = &s
	}

	err := r.db.post(ctx, "/battles", payload, nil)
	if err != nil {
		return fmt.Errorf("insert battle for %s: %w", countryISO, err)
	}
	return nil
}
