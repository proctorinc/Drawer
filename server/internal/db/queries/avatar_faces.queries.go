package queries

import (
	"context"
	"database/sql"
)

// GetAvatarFaces maps each user an admin picked a sketch face for to that face
func GetAvatarFaces(repo *sql.DB, ctx context.Context) (map[string]string, error) {
	rows, err := repo.QueryContext(ctx, `SELECT user_id, face FROM avatar_faces`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	faces := map[string]string{}
	for rows.Next() {
		var userID, face string
		if err := rows.Scan(&userID, &face); err != nil {
			return nil, err
		}
		faces[userID] = face
	}
	return faces, rows.Err()
}

// WearAvatarFace switches the user to a sketch face: the one given, or with ""
// the one their id gives them
func WearAvatarFace(repo *sql.DB, ctx context.Context, userID, face string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if face == "" {
		_, err = tx.ExecContext(ctx, `DELETE FROM avatar_faces WHERE user_id = ?`, userID)
	} else {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO avatar_faces (user_id, face) VALUES (?, ?)
			ON CONFLICT (user_id) DO UPDATE SET face = excluded.face, updated_at = CURRENT_TIMESTAMP`,
			userID, face)
	}
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET avatar_type = 'basic' WHERE id = ?`, userID); err != nil {
		return err
	}
	return tx.Commit()
}
