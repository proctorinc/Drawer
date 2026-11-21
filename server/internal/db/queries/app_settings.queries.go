package queries

import (
	"context"
	"database/sql"
	"fmt"
)

// GetAppSettings returns every app-wide setting as key -> value.
func GetAppSettings(repo *sql.DB, ctx context.Context) (map[string]string, error) {
	rows, err := repo.QueryContext(ctx, `SELECT key, value FROM app_settings`)
	if err != nil {
		return nil, fmt.Errorf("error fetching app settings: %w", err)
	}
	defer rows.Close()

	settings := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("error scanning app setting: %w", err)
		}
		settings[key] = value
	}
	return settings, rows.Err()
}

// SetAppSettings saves the given settings, leaving the rest as they are.
func SetAppSettings(repo *sql.DB, ctx context.Context, values map[string]string) error {
	return withEventTx(repo, ctx, func(tx *sql.Tx) error {
		for key, value := range values {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
				key, value)
			if err != nil {
				return fmt.Errorf("error saving app setting %s: %w", key, err)
			}
		}
		return nil
	})
}
