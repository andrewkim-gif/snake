package db

import (
	"context"
	"fmt"
	"net/url"
	"time"
)

// RestAchievementRepo implements AchievementRepo via Supabase REST API.
type RestAchievementRepo struct {
	db *DB
}

func (r *RestAchievementRepo) UpsertAchievement(ctx context.Context, userID, key string, progress int, unlockedAt *time.Time) error {
	type row struct {
		UserID         string  `json:"user_id"`
		AchievementKey string  `json:"achievement_key"`
		Progress       int     `json:"progress"`
		UnlockedAt     *string `json:"unlocked_at"`
	}

	payload := row{
		UserID:         userID,
		AchievementKey: key,
		Progress:       progress,
	}

	if unlockedAt != nil {
		s := unlockedAt.UTC().Format("2006-01-02T15:04:05Z")
		payload.UnlockedAt = &s
	}

	// Upsert on (user_id, achievement_key) unique constraint
	err := r.db.post(ctx, "/achievements?on_conflict=user_id,achievement_key", payload, map[string]string{
		"Prefer": "resolution=merge-duplicates",
	})
	if err != nil {
		return fmt.Errorf("upsert achievement %s/%s: %w", userID, key, err)
	}
	return nil
}

func (r *RestAchievementRepo) GetUserAchievements(ctx context.Context, userID string) ([]AchievementRow, error) {
	var rows []AchievementRow
	err := r.db.get(ctx, "/achievements?user_id=eq."+url.QueryEscape(userID)+"&order=created_at", &rows)
	if err != nil {
		return nil, fmt.Errorf("get achievements for %s: %w", userID, err)
	}
	return rows, nil
}
