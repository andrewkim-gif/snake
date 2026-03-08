package db

import (
	"context"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/meta"
)

// ────────────────────────────────────────────────────────────
// FactionStoreAdapter adapts db.Store → meta.FactionStore
// ────────────────────────────────────────────────────────────

type FactionStoreAdapter struct{ s *Store }

func NewFactionStoreAdapter(s *Store) *FactionStoreAdapter {
	return &FactionStoreAdapter{s: s}
}

func (a *FactionStoreAdapter) UpsertFaction(id, name, tag, color, bannerURL, leaderID string, treasury []byte, prestige, memberCount int, createdAt time.Time) error {
	return a.s.Factions().UpsertFaction(context.Background(), FactionRow{
		ID: id, Name: name, Tag: tag, Color: color,
		BannerURL: bannerURL, LeaderID: leaderID,
		Treasury: treasury, Prestige: prestige,
		MemberCount: memberCount, CreatedAt: createdAt,
	})
}

func (a *FactionStoreAdapter) UpsertFactionMembers(factionID string, members []meta.FactionMemberRow) error {
	dbMembers := make([]FactionMemberRow, len(members))
	for i, m := range members {
		dbMembers[i] = FactionMemberRow{
			FactionID: m.FactionID, UserID: m.UserID,
			Role: m.Role, JoinedAt: m.JoinedAt,
		}
	}
	return a.s.Factions().UpsertFactionMembers(context.Background(), factionID, dbMembers)
}

func (a *FactionStoreAdapter) DeleteFaction(factionID string) error {
	return a.s.Factions().DeleteFaction(context.Background(), factionID)
}

func (a *FactionStoreAdapter) LoadFactions() ([]meta.FactionDBRow, []meta.FactionMemberRow, error) {
	frows, err := a.s.Factions().ListFactions(context.Background())
	if err != nil {
		return nil, nil, err
	}
	factions := make([]meta.FactionDBRow, len(frows))
	for i, f := range frows {
		factions[i] = meta.FactionDBRow{
			ID: f.ID, Name: f.Name, Tag: f.Tag, Color: f.Color,
			BannerURL: f.BannerURL, LeaderID: f.LeaderID,
			Treasury: f.Treasury, Prestige: f.Prestige,
			MemberCount: f.MemberCount, CreatedAt: f.CreatedAt,
		}
	}

	// Single query for all members (no N+1)
	mrows, err := a.s.Factions().ListAllFactionMembers(context.Background())
	if err != nil {
		return nil, nil, err
	}
	allMembers := make([]meta.FactionMemberRow, len(mrows))
	for i, m := range mrows {
		allMembers[i] = meta.FactionMemberRow{
			FactionID: m.FactionID, UserID: m.UserID,
			Role: m.Role, JoinedAt: m.JoinedAt,
		}
	}
	return factions, allMembers, nil
}

// ────────────────────────────────────────────────────────────
// SeasonStoreAdapter adapts db.Store → meta.SeasonStore
// ────────────────────────────────────────────────────────────

type SeasonStoreAdapter struct{ s *Store }

func NewSeasonStoreAdapter(s *Store) *SeasonStoreAdapter {
	return &SeasonStoreAdapter{s: s}
}

func (a *SeasonStoreAdapter) UpsertSeason(id, name string, number int, phase, status string, startAt, endAt time.Time, configJSON []byte, createdAt time.Time) error {
	return a.s.Seasons().UpsertSeason(context.Background(), SeasonRow{
		ID: id, Name: name, Number: number,
		Phase: phase, Status: status,
		StartAt: startAt, EndAt: endAt,
		ConfigJSON: configJSON, CreatedAt: createdAt,
	})
}

func (a *SeasonStoreAdapter) LoadActiveSeason() (*meta.SeasonDBRow, error) {
	row, err := a.s.Seasons().GetActiveSeason(context.Background())
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	return &meta.SeasonDBRow{
		ID: row.ID, Name: row.Name, Number: row.Number,
		Phase: row.Phase, Status: row.Status,
		StartAt: row.StartAt, EndAt: row.EndAt,
		ConfigJSON: row.ConfigJSON, CreatedAt: row.CreatedAt,
	}, nil
}

func (a *SeasonStoreAdapter) LoadAllSeasons() ([]meta.SeasonDBRow, error) {
	rows, err := a.s.Seasons().ListSeasons(context.Background())
	if err != nil {
		return nil, err
	}
	result := make([]meta.SeasonDBRow, len(rows))
	for i, r := range rows {
		result[i] = meta.SeasonDBRow{
			ID: r.ID, Name: r.Name, Number: r.Number,
			Phase: r.Phase, Status: r.Status,
			StartAt: r.StartAt, EndAt: r.EndAt,
			ConfigJSON: r.ConfigJSON, CreatedAt: r.CreatedAt,
		}
	}
	return result, nil
}

// ────────────────────────────────────────────────────────────
// DiplomacyStoreAdapter adapts db.Store → meta.DiplomacyStore
// ────────────────────────────────────────────────────────────

type DiplomacyStoreAdapter struct{ s *Store }

func NewDiplomacyStoreAdapter(s *Store) *DiplomacyStoreAdapter {
	return &DiplomacyStoreAdapter{s: s}
}

func (a *DiplomacyStoreAdapter) UpsertTreaty(d meta.DiplomacyDBRow) error {
	return a.s.Diplomacy().UpsertTreaty(context.Background(), DiplomacyRow{
		ID: d.ID, Type: d.Type,
		FactionA: d.FactionA, FactionB: d.FactionB,
		Status: d.Status, ProposedBy: d.ProposedBy,
		TermsJSON: d.TermsJSON,
		StartedAt: d.StartedAt, ExpiresAt: d.ExpiresAt,
		BrokenAt: d.BrokenAt, BrokenBy: d.BrokenBy,
		CreatedAt: d.CreatedAt,
	})
}

func (a *DiplomacyStoreAdapter) UpsertWar(w meta.WarDBRow) error {
	return a.s.Diplomacy().UpsertWar(context.Background(), WarRow{
		ID: w.ID, AttackerID: w.AttackerID,
		DefenderID: w.DefenderID, SeasonID: w.SeasonID,
		Status: w.Status, DeclaredAt: w.DeclaredAt,
		PrepEndsAt: w.PrepEndsAt, EndedAt: w.EndedAt,
		TermsJSON: w.TermsJSON, CreatedAt: w.CreatedAt,
	})
}

func (a *DiplomacyStoreAdapter) LoadActiveTreaties() ([]meta.DiplomacyDBRow, error) {
	rows, err := a.s.Diplomacy().ListActiveTreaties(context.Background())
	if err != nil {
		return nil, err
	}
	result := make([]meta.DiplomacyDBRow, len(rows))
	for i, r := range rows {
		result[i] = meta.DiplomacyDBRow{
			ID: r.ID, Type: r.Type,
			FactionA: r.FactionA, FactionB: r.FactionB,
			Status: r.Status, ProposedBy: r.ProposedBy,
			TermsJSON: r.TermsJSON,
			StartedAt: r.StartedAt, ExpiresAt: r.ExpiresAt,
			BrokenAt: r.BrokenAt, BrokenBy: r.BrokenBy,
			CreatedAt: r.CreatedAt,
		}
	}
	return result, nil
}

func (a *DiplomacyStoreAdapter) LoadActiveWars() ([]meta.WarDBRow, error) {
	rows, err := a.s.Diplomacy().ListActiveWars(context.Background())
	if err != nil {
		return nil, err
	}
	result := make([]meta.WarDBRow, len(rows))
	for i, r := range rows {
		result[i] = meta.WarDBRow{
			ID: r.ID, AttackerID: r.AttackerID,
			DefenderID: r.DefenderID, SeasonID: r.SeasonID,
			Status: r.Status, DeclaredAt: r.DeclaredAt,
			PrepEndsAt: r.PrepEndsAt, EndedAt: r.EndedAt,
			TermsJSON: r.TermsJSON, CreatedAt: r.CreatedAt,
		}
	}
	return result, nil
}

// ────────────────────────────────────────────────────────────
// CountryStoreAdapter adapts db.Store → meta.EconomyStore
// ────────────────────────────────────────────────────────────

type CountryStoreAdapter struct{ s *Store }

func NewCountryStoreAdapter(s *Store) *CountryStoreAdapter {
	return &CountryStoreAdapter{s: s}
}

func (a *CountryStoreAdapter) UpdateGDP(iso3 string, gdp int64) error {
	return a.s.Countries().UpdateGDP(context.Background(), iso3, gdp)
}

func (a *CountryStoreAdapter) UpdateSovereignty(iso3 string, factionID *string, level, streak int) error {
	return a.s.Countries().UpdateSovereignty(context.Background(), iso3, factionID, level, streak)
}
