package db

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
)

// RestFactionRepo implements FactionRepo via Supabase REST API.
type RestFactionRepo struct {
	db *DB
}

func (r *RestFactionRepo) UpsertFaction(ctx context.Context, f FactionRow) error {
	type row struct {
		ID          string          `json:"id"`
		Name        string          `json:"name"`
		Tag         string          `json:"tag"`
		Color       string          `json:"color"`
		BannerURL   string          `json:"banner_url"`
		LeaderID    string          `json:"leader_id"`
		Treasury    json.RawMessage `json:"treasury"`
		Prestige    int             `json:"prestige"`
		MemberCount int             `json:"member_count"`
		CreatedAt   string          `json:"created_at"`
	}

	var treasury json.RawMessage
	if len(f.Treasury) > 0 {
		treasury = f.Treasury
	} else {
		treasury = json.RawMessage(`{}`)
	}

	payload := row{
		ID:          f.ID,
		Name:        f.Name,
		Tag:         f.Tag,
		Color:       f.Color,
		BannerURL:   f.BannerURL,
		LeaderID:    f.LeaderID,
		Treasury:    treasury,
		Prestige:    f.Prestige,
		MemberCount: f.MemberCount,
		CreatedAt:   f.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}

	err := r.db.post(ctx, "/factions?on_conflict=id", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("upsert faction %s: %w", f.ID, err)
	}
	return nil
}

func (r *RestFactionRepo) UpsertFactionMembers(ctx context.Context, factionID string, members []FactionMemberRow) error {
	// Delete existing members first
	err := r.db.del(ctx, "/faction_members?faction_id=eq."+url.QueryEscape(factionID))
	if err != nil {
		return fmt.Errorf("delete members for %s: %w", factionID, err)
	}

	if len(members) == 0 {
		return nil
	}

	type row struct {
		FactionID string `json:"faction_id"`
		UserID    string `json:"user_id"`
		Role      string `json:"role"`
		JoinedAt  string `json:"joined_at"`
	}

	payload := make([]row, len(members))
	for i, m := range members {
		payload[i] = row{
			FactionID: m.FactionID,
			UserID:    m.UserID,
			Role:      m.Role,
			JoinedAt:  m.JoinedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
	}

	err = r.db.post(ctx, "/faction_members?on_conflict=faction_id,user_id", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("insert members for %s: %w", factionID, err)
	}
	return nil
}

func (r *RestFactionRepo) ListFactions(ctx context.Context) ([]FactionRow, error) {
	var rows []FactionRow
	err := r.db.get(ctx, "/factions?order=prestige.desc", &rows)
	if err != nil {
		return nil, fmt.Errorf("list factions: %w", err)
	}
	return rows, nil
}

func (r *RestFactionRepo) ListFactionMembers(ctx context.Context, factionID string) ([]FactionMemberRow, error) {
	var rows []FactionMemberRow
	err := r.db.get(ctx, "/faction_members?faction_id=eq."+url.QueryEscape(factionID)+"&order=joined_at", &rows)
	if err != nil {
		return nil, fmt.Errorf("list members for %s: %w", factionID, err)
	}
	return rows, nil
}

func (r *RestFactionRepo) ListAllFactionMembers(ctx context.Context) ([]FactionMemberRow, error) {
	var rows []FactionMemberRow
	err := r.db.get(ctx, "/faction_members?order=faction_id,joined_at", &rows)
	if err != nil {
		return nil, fmt.Errorf("list all members: %w", err)
	}
	return rows, nil
}

func (r *RestFactionRepo) DeleteFaction(ctx context.Context, factionID string) error {
	// Delete members first
	if err := r.db.del(ctx, "/faction_members?faction_id=eq."+url.QueryEscape(factionID)); err != nil {
		return fmt.Errorf("delete members: %w", err)
	}
	if err := r.db.del(ctx, "/factions?id=eq."+url.QueryEscape(factionID)); err != nil {
		return fmt.Errorf("delete faction: %w", err)
	}
	return nil
}
