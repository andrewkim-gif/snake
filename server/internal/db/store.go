package db

// Store wraps all repository implementations backed by a single *DB connection.
type Store struct {
	db           *DB
	factions     FactionRepo
	countries    CountryRepo
	seasons      SeasonRepo
	diplomacy    DiplomacyRepo
	battles      BattleRepo
	achievements AchievementRepo
}

// NewStore creates a Store with Supabase REST-backed repositories.
func NewStore(database *DB) *Store {
	return &Store{
		db:           database,
		factions:     &RestFactionRepo{db: database},
		countries:    &RestCountryRepo{db: database},
		seasons:      &RestSeasonRepo{db: database},
		diplomacy:    &RestDiplomacyRepo{db: database},
		battles:      &RestBattleRepo{db: database},
		achievements: &RestAchievementRepo{db: database},
	}
}

func (s *Store) Factions() FactionRepo       { return s.factions }
func (s *Store) Countries() CountryRepo      { return s.countries }
func (s *Store) Seasons() SeasonRepo         { return s.seasons }
func (s *Store) Diplomacy() DiplomacyRepo    { return s.diplomacy }
func (s *Store) Battles() BattleRepo         { return s.battles }
func (s *Store) Achievements() AchievementRepo { return s.achievements }
