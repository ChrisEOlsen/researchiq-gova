package models

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"gova/app/cache"
)

type ResearchResult struct {
	ID                int64     `json:"id"`
	JobID             int64     `json:"job_id"`
	Summary           string    `json:"summary"`
	KeyTakeaways      string    `json:"key_takeaways"`
	FollowUpQuestions string    `json:"follow_up_questions"`
	VisualHTML        string    `json:"visual_html"`
	Studies           string    `json:"studies"`
	CreatedAt         time.Time `json:"created_at"`
}

type ResearchResultModel struct {
	readDB  *sql.DB
	writeDB *sql.DB
	cache   *cache.Cache
}

func NewResearchResultModel(readDB, writeDB *sql.DB, c *cache.Cache) *ResearchResultModel {
	return &ResearchResultModel{readDB: readDB, writeDB: writeDB, cache: c}
}

func (m *ResearchResultModel) GetAll() ([]ResearchResult, error) {
	const cacheKey = "research_results:all"
	if hit, ok := m.cache.Get(cacheKey); ok {
		var items []ResearchResult
		if err := json.Unmarshal(hit, &items); err == nil {
			return items, nil
		}
	}
	rows, err := m.readDB.Query("SELECT id, job_id, summary, key_takeaways, follow_up_questions, visual_html, studies, created_at FROM research_results ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ResearchResult
	for rows.Next() {
		var item ResearchResult
		if err := rows.Scan(&item.ID, &item.JobID, &item.Summary, &item.KeyTakeaways, &item.FollowUpQuestions, &item.VisualHTML, &item.Studies, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if data, err := json.Marshal(items); err == nil {
		m.cache.Set(cacheKey, data, 5*time.Minute)
	}
	return items, nil
}

func (m *ResearchResultModel) Find(id int64) (*ResearchResult, error) {
	row := m.readDB.QueryRow("SELECT id, job_id, summary, key_takeaways, follow_up_questions, visual_html, studies, created_at FROM research_results WHERE id = ?", id)
	var item ResearchResult
	err := row.Scan(&item.ID, &item.JobID, &item.Summary, &item.KeyTakeaways, &item.FollowUpQuestions, &item.VisualHTML, &item.Studies, &item.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (m *ResearchResultModel) GetByJobID(jobID int64) (*ResearchResult, error) {
	row := m.readDB.QueryRow("SELECT id, job_id, summary, key_takeaways, follow_up_questions, visual_html, studies, created_at FROM research_results WHERE job_id = ?", jobID)
	var item ResearchResult
	if err := row.Scan(&item.ID, &item.JobID, &item.Summary, &item.KeyTakeaways, &item.FollowUpQuestions, &item.VisualHTML, &item.Studies, &item.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

func (m *ResearchResultModel) Create(job_id int64, summary string, key_takeaways string, follow_up_questions string, visual_html string, studies string) (int64, error) {
	res, err := m.writeDB.Exec(
		"INSERT INTO research_results (job_id, summary, key_takeaways, follow_up_questions, visual_html, studies) VALUES (?, ?, ?, ?, ?, ?)",
		job_id, summary, key_takeaways, follow_up_questions, visual_html, studies,
	)
	if err != nil {
		return 0, err
	}
	m.cache.Bust("research_results:")
	return res.LastInsertId()
}

func (m *ResearchResultModel) Delete(id int64) error {
	_, err := m.writeDB.Exec("DELETE FROM research_results WHERE id = ?", id)
	if err == nil {
		m.cache.Bust("research_results:")
	}
	return err
}
