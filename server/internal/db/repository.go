package db

import (
	"context"
	"encoding/json"
	"time"
)

// FactionRow represents a faction record in PostgreSQL.
type FactionRow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Tag         string    `json:"tag"`
	Color       string    `json:"color"`
	BannerURL   string    `json:"banner_url"`
	LeaderID    string    `json:"leader_id"`
	Treasury    json.RawMessage `json:"treasury"`
	Prestige    int       `json:"prestige"`
	MemberCount int       `json:"member_count"`
	CreatedAt   time.Time `json:"created_at"`
}

// FactionMemberRow represents a faction member in PostgreSQL.
type FactionMemberRow struct {
	FactionID string    `json:"faction_id"`
	UserID    string    `json:"user_id"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
}

// CountryRow represents a country record in PostgreSQL.
type CountryRow struct {
	ISO3              string  `json:"iso3"`
	NameOriginal      string  `json:"name_original"`
	Continent         string  `json:"continent"`
	Tier              string  `json:"tier"`
	ResourcesJSON     json.RawMessage `json:"resources_json"`
	SovereignFaction  *string `json:"sovereign_faction_id"`
	SovereigntyLevel  int     `json:"sovereignty_level"`
	SovereigntyStreak int     `json:"sovereignty_streak"`
	GDP               int64   `json:"gdp"`
}

// SeasonRow represents a season record in PostgreSQL.
type SeasonRow struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Number    int       `json:"number"`
	Phase     string    `json:"phase"`
	Status    string    `json:"status"`
	StartAt   time.Time `json:"start_at"`
	EndAt     time.Time `json:"end_at"`
	ConfigJSON json.RawMessage `json:"config_json"`
	CreatedAt time.Time `json:"created_at"`
}

// DiplomacyRow represents a diplomacy record in PostgreSQL.
type DiplomacyRow struct {
	ID         string     `json:"id"`
	Type       string     `json:"type"`
	FactionA   string     `json:"faction_a"`
	FactionB   string     `json:"faction_b"`
	Status     string     `json:"status"`
	ProposedBy string          `json:"proposed_by"`
	TermsJSON  json.RawMessage `json:"terms_json"`
	StartedAt  *time.Time      `json:"started_at"`
	ExpiresAt  *time.Time `json:"expires_at"`
	BrokenAt   *time.Time `json:"broken_at"`
	BrokenBy   *string    `json:"broken_by"`
	CreatedAt  time.Time  `json:"created_at"`
}

// WarRow represents a war record in PostgreSQL.
type WarRow struct {
	ID         string     `json:"id"`
	AttackerID string     `json:"attacker_id"`
	DefenderID string     `json:"defender_id"`
	SeasonID   *string    `json:"season_id"`
	Status     string     `json:"status"`
	DeclaredAt time.Time  `json:"declared_at"`
	PrepEndsAt time.Time  `json:"prep_ends_at"`
	EndedAt    *time.Time      `json:"ended_at"`
	TermsJSON  json.RawMessage `json:"terms_json"`
	CreatedAt  time.Time       `json:"created_at"`
}

// FactionRepo defines CRUD operations for factions.
type FactionRepo interface {
	UpsertFaction(ctx context.Context, f FactionRow) error
	UpsertFactionMembers(ctx context.Context, factionID string, members []FactionMemberRow) error
	ListFactions(ctx context.Context) ([]FactionRow, error)
	ListFactionMembers(ctx context.Context, factionID string) ([]FactionMemberRow, error)
	ListAllFactionMembers(ctx context.Context) ([]FactionMemberRow, error)
	DeleteFaction(ctx context.Context, factionID string) error
}

// CountryRepo defines CRUD operations for countries.
type CountryRepo interface {
	BulkUpsertCountries(ctx context.Context, countries []CountryRow) error
	UpdateSovereignty(ctx context.Context, iso3 string, factionID *string, level, streak int) error
	UpdateGDP(ctx context.Context, iso3 string, gdp int64) error
	ListCountries(ctx context.Context) ([]CountryRow, error)
}

// SeasonRepo defines CRUD operations for seasons.
type SeasonRepo interface {
	UpsertSeason(ctx context.Context, s SeasonRow) error
	GetActiveSeason(ctx context.Context) (*SeasonRow, error)
	ListSeasons(ctx context.Context) ([]SeasonRow, error)
}

// DiplomacyRepo defines CRUD operations for diplomacy and wars.
type DiplomacyRepo interface {
	UpsertTreaty(ctx context.Context, d DiplomacyRow) error
	ListActiveTreaties(ctx context.Context) ([]DiplomacyRow, error)
	UpsertWar(ctx context.Context, w WarRow) error
	ListActiveWars(ctx context.Context) ([]WarRow, error)
}

// BattleRepo defines operations for battle records.
type BattleRepo interface {
	InsertBattle(ctx context.Context, countryISO, seasonID, battleType, status string,
		startedAt, endedAt *time.Time, durationSec, participants int, resultsJSON []byte, winnerFactionID *string) error
}

// AchievementRepo defines operations for player achievements.
type AchievementRepo interface {
	UpsertAchievement(ctx context.Context, userID, key string, progress int, unlockedAt *time.Time) error
	GetUserAchievements(ctx context.Context, userID string) ([]AchievementRow, error)
}

// AchievementRow represents an achievement record.
type AchievementRow struct {
	UserID         string     `json:"user_id"`
	AchievementKey string     `json:"achievement_key"`
	Progress       int        `json:"progress"`
	UnlockedAt     *time.Time `json:"unlocked_at"`
}
