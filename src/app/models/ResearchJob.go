package models

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gova/app/cache"
)

type ResearchJob struct {
	ID            int64     `json:"id"`
	Question      string    `json:"question"`
	Title         string    `json:"title"`
	Status        string    `json:"status"`
	PipelineStage string    `json:"pipeline_stage"`
	StudiesFound  int64     `json:"studies_found"`
	ErrorMessage  string    `json:"error_message"`
	UserID        int64     `json:"user_id"`
	ShareToken    string    `json:"share_token"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ResearchJobModel struct {
	readDB  *sql.DB
	writeDB *sql.DB
	cache   *cache.Cache
}

func NewResearchJobModel(readDB, writeDB *sql.DB, c *cache.Cache) *ResearchJobModel {
	return &ResearchJobModel{readDB: readDB, writeDB: writeDB, cache: c}
}

func (m *ResearchJobModel) GetAll() ([]ResearchJob, error) {
	const cacheKey = "research_jobs:all"
	if hit, ok := m.cache.Get(cacheKey); ok {
		var items []ResearchJob
		if err := json.Unmarshal(hit, &items); err == nil {
			return items, nil
		}
	}
	rows, err := m.readDB.Query("SELECT id, question, title, status, pipeline_stage, studies_found, error_message, user_id, share_token, created_at, updated_at FROM research_jobs ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ResearchJob
	for rows.Next() {
		var item ResearchJob
		if err := rows.Scan(&item.ID, &item.Question, &item.Title, &item.Status, &item.PipelineStage, &item.StudiesFound, &item.ErrorMessage, &item.UserID, &item.ShareToken, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if data, err := json.Marshal(items); err == nil {
		m.cache.Set(cacheKey, data, 5*time.Minute)
	}
	return items, nil
}

func (m *ResearchJobModel) GetByID(id int64) (*ResearchJob, error) {
	row := m.readDB.QueryRow("SELECT id, question, title, status, pipeline_stage, studies_found, error_message, user_id, share_token, created_at, updated_at FROM research_jobs WHERE id = ?", id)
	var item ResearchJob
	err := row.Scan(&item.ID, &item.Question, &item.Title, &item.Status, &item.PipelineStage, &item.StudiesFound, &item.ErrorMessage, &item.UserID, &item.ShareToken, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (m *ResearchJobModel) Create(question string, userID int64) (int64, error) {
	res, err := m.writeDB.Exec(
		"INSERT INTO research_jobs (question, status, pipeline_stage, user_id) VALUES (?, 'pending', 'searching', ?)",
		question, userID,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (m *ResearchJobModel) GetByUserID(userID int64) ([]ResearchJob, error) {
	return m.queryJobs("WHERE user_id = ? ORDER BY created_at DESC", userID)
}

func (m *ResearchJobModel) GetByIDs(ids []int64) ([]ResearchJob, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := "WHERE id IN (" + strings.Join(placeholders, ",") + ") ORDER BY created_at DESC"
	return m.queryJobs(query, args...)
}

func (m *ResearchJobModel) queryJobs(whereClause string, args ...any) ([]ResearchJob, error) {
	rows, err := m.readDB.Query(
		"SELECT id, question, title, status, pipeline_stage, studies_found, error_message, user_id, share_token, created_at, updated_at FROM research_jobs "+whereClause,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ResearchJob
	for rows.Next() {
		var item ResearchJob
		if err := rows.Scan(&item.ID, &item.Question, &item.Title, &item.Status, &item.PipelineStage, &item.StudiesFound, &item.ErrorMessage, &item.UserID, &item.ShareToken, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (m *ResearchJobModel) UpdateStatus(id int64, status, errMsg string) error {
	_, err := m.writeDB.Exec("UPDATE research_jobs SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, errMsg, id)
	return err
}

func (m *ResearchJobModel) UpdateStage(id int64, stage string) error {
	_, err := m.writeDB.Exec("UPDATE research_jobs SET pipeline_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", stage, id)
	return err
}

func (m *ResearchJobModel) UpdateStudiesFound(id int64, count int64) error {
	_, err := m.writeDB.Exec("UPDATE research_jobs SET studies_found = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", count, id)
	return err
}

func (m *ResearchJobModel) UpdateTitle(id int64, title string) error {
	_, err := m.writeDB.Exec("UPDATE research_jobs SET title = ? WHERE id = ?", title, id)
	return err
}

func (m *ResearchJobModel) SetShareToken(id int64, token string) error {
	_, err := m.writeDB.Exec("UPDATE research_jobs SET share_token = ? WHERE id = ?", token, id)
	return err
}

func (m *ResearchJobModel) FindByShareToken(token string) (*ResearchJob, error) {
	items, err := m.queryJobs("WHERE share_token = ? LIMIT 1", token)
	if err != nil || len(items) == 0 {
		return nil, err
	}
	return &items[0], nil
}

func (m *ResearchJobModel) CountActive(userID int64) (int64, error) {
	var count int64
	err := m.readDB.QueryRow("SELECT COUNT(*) FROM research_jobs WHERE user_id = ? AND status IN ('pending','processing')", userID).Scan(&count)
	return count, err
}

// Delete removes a job's results and the job itself, scoped to the owning
// user at the SQL level so ownership can't be bypassed by app-logic bugs.
// It nullifies (zeroes) any credit_transactions.job_id pointing at this job
// to preserve the audit trail rather than cascading the delete.
func (m *ResearchJobModel) Delete(id int64, userID int64) error {
	if _, err := m.writeDB.Exec("UPDATE credit_transactions SET job_id = 0 WHERE job_id = ?", id); err != nil {
		return err
	}
	if _, err := m.writeDB.Exec("DELETE FROM research_results WHERE job_id = ?", id); err != nil {
		return err
	}
	res, err := m.writeDB.Exec("DELETE FROM research_jobs WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return errors.New("not found or unauthorized")
	}
	return nil
}

// Owns is the single ownership check used by every handler that touches a
// job (status, result, visual, share, delete) — GOTHA had two diverging
// implementations of this; this is the one source of truth.
func (m *ResearchJobModel) Owns(job *ResearchJob, userID int64, guestJobIDs []int64) bool {
	if job.UserID != 0 {
		return job.UserID == userID
	}
	for _, id := range guestJobIDs {
		if id == job.ID {
			return true
		}
	}
	return false
}
