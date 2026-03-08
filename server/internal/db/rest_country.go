package db

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
)

// RestCountryRepo implements CountryRepo via Supabase REST API.
type RestCountryRepo struct {
	db *DB
}

func (r *RestCountryRepo) BulkUpsertCountries(ctx context.Context, countries []CountryRow) error {
	if len(countries) == 0 {
		return nil
	}

	type row struct {
		ISO3              string          `json:"iso3"`
		NameOriginal      string          `json:"name_original"`
		Continent         string          `json:"continent"`
		Tier              string          `json:"tier"`
		ResourcesJSON     json.RawMessage `json:"resources_json"`
		SovereignFaction  *string         `json:"sovereign_faction_id"`
		SovereigntyLevel  int             `json:"sovereignty_level"`
		SovereigntyStreak int             `json:"sovereignty_streak"`
		GDP               int64           `json:"gdp"`
	}

	payload := make([]row, len(countries))
	for i, c := range countries {
		var resources json.RawMessage
		if len(c.ResourcesJSON) > 0 {
			resources = c.ResourcesJSON
		} else {
			resources = json.RawMessage(`{}`)
		}

		// Normalize empty faction ID to nil
		var sovFaction *string
		if c.SovereignFaction != nil && *c.SovereignFaction != "" {
			sovFaction = c.SovereignFaction
		}

		payload[i] = row{
			ISO3:              c.ISO3,
			NameOriginal:      c.NameOriginal,
			Continent:         c.Continent,
			Tier:              c.Tier,
			ResourcesJSON:     resources,
			SovereignFaction:  sovFaction,
			SovereigntyLevel:  c.SovereigntyLevel,
			SovereigntyStreak: c.SovereigntyStreak,
			GDP:               c.GDP,
		}
	}

	err := r.db.post(ctx, "/countries?on_conflict=iso3", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("bulk upsert countries: %w", err)
	}
	return nil
}

func (r *RestCountryRepo) UpdateSovereignty(ctx context.Context, iso3 string, factionID *string, level, streak int) error {
	// Normalize empty faction ID to nil
	var sovFaction *string
	if factionID != nil && *factionID != "" {
		sovFaction = factionID
	}

	payload := map[string]interface{}{
		"sovereign_faction_id": sovFaction,
		"sovereignty_level":    level,
		"sovereignty_streak":   streak,
	}

	err := r.db.patch(ctx, "/countries?iso3=eq."+url.QueryEscape(iso3), payload)
	if err != nil {
		return fmt.Errorf("update sovereignty %s: %w", iso3, err)
	}
	return nil
}

func (r *RestCountryRepo) UpdateGDP(ctx context.Context, iso3 string, gdp int64) error {
	payload := map[string]interface{}{
		"gdp": gdp,
	}

	err := r.db.patch(ctx, "/countries?iso3=eq."+url.QueryEscape(iso3), payload)
	if err != nil {
		return fmt.Errorf("update GDP %s: %w", iso3, err)
	}
	return nil
}

func (r *RestCountryRepo) ListCountries(ctx context.Context) ([]CountryRow, error) {
	var rows []CountryRow
	err := r.db.get(ctx, "/countries?select=iso3,name_original,continent,tier,resources_json,sovereign_faction_id,sovereignty_level,sovereignty_streak,gdp&order=iso3", &rows)
	if err != nil {
		return nil, fmt.Errorf("list countries: %w", err)
	}
	return rows, nil
}
