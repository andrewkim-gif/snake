package db

import (
	"context"
	"encoding/json"
	"fmt"
)

// RestDiplomacyRepo implements DiplomacyRepo via Supabase REST API.
type RestDiplomacyRepo struct {
	db *DB
}

func (r *RestDiplomacyRepo) UpsertTreaty(ctx context.Context, d DiplomacyRow) error {
	type row struct {
		ID         string          `json:"id"`
		Type       string          `json:"type"`
		FactionA   string          `json:"faction_a"`
		FactionB   string          `json:"faction_b"`
		Status     string          `json:"status"`
		ProposedBy string          `json:"proposed_by"`
		TermsJSON  json.RawMessage `json:"terms_json"`
		StartedAt  *string         `json:"started_at"`
		ExpiresAt  *string         `json:"expires_at"`
		BrokenAt   *string         `json:"broken_at"`
		BrokenBy   *string         `json:"broken_by"`
		CreatedAt  string          `json:"created_at"`
	}

	var terms json.RawMessage
	if len(d.TermsJSON) > 0 {
		terms = d.TermsJSON
	} else {
		terms = json.RawMessage(`{}`)
	}

	payload := row{
		ID:         d.ID,
		Type:       d.Type,
		FactionA:   d.FactionA,
		FactionB:   d.FactionB,
		Status:     d.Status,
		ProposedBy: d.ProposedBy,
		TermsJSON:  terms,
		BrokenBy:   d.BrokenBy,
		CreatedAt:  d.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}

	if d.StartedAt != nil {
		s := d.StartedAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.StartedAt = &s
	}
	if d.ExpiresAt != nil {
		s := d.ExpiresAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.ExpiresAt = &s
	}
	if d.BrokenAt != nil {
		s := d.BrokenAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.BrokenAt = &s
	}

	err := r.db.post(ctx, "/diplomacy?on_conflict=id", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("upsert treaty %s: %w", d.ID, err)
	}
	return nil
}

func (r *RestDiplomacyRepo) ListActiveTreaties(ctx context.Context) ([]DiplomacyRow, error) {
	var rows []DiplomacyRow
	err := r.db.get(ctx, "/diplomacy?status=in.(proposed,active)&order=created_at.desc", &rows)
	if err != nil {
		return nil, fmt.Errorf("list active treaties: %w", err)
	}
	return rows, nil
}

func (r *RestDiplomacyRepo) UpsertWar(ctx context.Context, w WarRow) error {
	type row struct {
		ID         string          `json:"id"`
		AttackerID string          `json:"attacker_id"`
		DefenderID string          `json:"defender_id"`
		SeasonID   *string         `json:"season_id"`
		Status     string          `json:"status"`
		DeclaredAt string          `json:"declared_at"`
		PrepEndsAt string          `json:"prep_ends_at"`
		EndedAt    *string         `json:"ended_at"`
		TermsJSON  json.RawMessage `json:"terms_json"`
		CreatedAt  string          `json:"created_at"`
	}

	var terms json.RawMessage
	if len(w.TermsJSON) > 0 {
		terms = w.TermsJSON
	} else {
		terms = json.RawMessage(`{}`)
	}

	payload := row{
		ID:         w.ID,
		AttackerID: w.AttackerID,
		DefenderID: w.DefenderID,
		SeasonID:   w.SeasonID,
		Status:     w.Status,
		DeclaredAt: w.DeclaredAt.UTC().Format("2006-01-02T15:04:05Z"),
		PrepEndsAt: w.PrepEndsAt.UTC().Format("2006-01-02T15:04:05Z"),
		TermsJSON:  terms,
		CreatedAt:  w.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}

	if w.EndedAt != nil {
		s := w.EndedAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.EndedAt = &s
	}

	err := r.db.post(ctx, "/wars?on_conflict=id", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("upsert war %s: %w", w.ID, err)
	}
	return nil
}

func (r *RestDiplomacyRepo) ListActiveWars(ctx context.Context) ([]WarRow, error) {
	var rows []WarRow
	err := r.db.get(ctx, "/wars?status=in.(preparing,active)&order=declared_at.desc", &rows)
	if err != nil {
		return nil, fmt.Errorf("list active wars: %w", err)
	}
	return rows, nil
}
