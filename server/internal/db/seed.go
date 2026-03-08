package db

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// SeedDefaults inserts initial data for development/testing.
// Safe to run multiple times (uses upsert via PostgREST merge-duplicates).
func (d *DB) SeedDefaults(ctx context.Context) error {
	slog.Info("seeding default data")

	factions := []FactionRow{
		{ID: "seed-faction-alpha", Name: "Alpha Legion", Tag: "ALP", Color: "#EF4444", LeaderID: "seed-leader-1", Prestige: 100, MemberCount: 5, CreatedAt: time.Now()},
		{ID: "seed-faction-bravo", Name: "Bravo Company", Tag: "BRV", Color: "#3B82F6", LeaderID: "seed-leader-2", Prestige: 80, MemberCount: 3, CreatedAt: time.Now()},
		{ID: "seed-faction-charlie", Name: "Charlie Division", Tag: "CHR", Color: "#10B981", LeaderID: "seed-leader-3", Prestige: 60, MemberCount: 4, CreatedAt: time.Now()},
	}

	repo := &RestFactionRepo{db: d}
	for _, f := range factions {
		if err := repo.UpsertFaction(ctx, f); err != nil {
			return fmt.Errorf("seed faction %s: %w", f.ID, err)
		}
	}

	seasonRepo := &RestSeasonRepo{db: d}
	now := time.Now()
	if err := seasonRepo.UpsertSeason(ctx, SeasonRow{
		ID:        "seed-season-1",
		Name:      "Genesis",
		Number:    1,
		Phase:     "discovery",
		Status:    "active",
		StartAt:   now,
		EndAt:     now.Add(28 * 24 * time.Hour),
		CreatedAt: now,
	}); err != nil {
		return fmt.Errorf("seed season: %w", err)
	}

	slog.Info("seed data inserted", "factions", len(factions), "seasons", 1)
	return nil
}
