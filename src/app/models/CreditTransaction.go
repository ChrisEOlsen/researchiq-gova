package models

import (
	"database/sql"
	"encoding/json"
	"time"
	"gova/app/cache"
)

type CreditTransaction struct {
	ID                   int64     `json:"id"`
	UserID               int64     `json:"user_id"`
	Type                 string    `json:"type"`
	Amount               int64     `json:"amount"`
	Description          string    `json:"description"`
	StripePaymentIntentID string   `json:"stripe_payment_intent_id"`
	JobID                int64     `json:"job_id"`
	CreatedAt            time.Time `json:"created_at"`
}

type CreditTransactionModel struct {
	readDB  *sql.DB
	writeDB *sql.DB
	cache   *cache.Cache
}

func NewCreditTransactionModel(readDB, writeDB *sql.DB, c *cache.Cache) *CreditTransactionModel {
	return &CreditTransactionModel{readDB: readDB, writeDB: writeDB, cache: c}
}

func (m *CreditTransactionModel) GetAll() ([]CreditTransaction, error) {
	const cacheKey = "credit_transactions:all"
	if hit, ok := m.cache.Get(cacheKey); ok {
		var items []CreditTransaction
		if err := json.Unmarshal(hit, &items); err == nil {
			return items, nil
		}
	}
	rows, err := m.readDB.Query("SELECT id, user_id, type, amount, description, stripe_payment_intent_id, job_id, created_at FROM credit_transactions ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CreditTransaction
	for rows.Next() {
		var item CreditTransaction
		if err := rows.Scan(&item.ID, &item.UserID, &item.Type, &item.Amount, &item.Description, &item.StripePaymentIntentID, &item.JobID, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if data, err := json.Marshal(items); err == nil {
		m.cache.Set(cacheKey, data, 5*time.Minute)
	}
	return items, nil
}

func (m *CreditTransactionModel) Find(id int64) (*CreditTransaction, error) {
	row := m.readDB.QueryRow("SELECT id, user_id, type, amount, description, stripe_payment_intent_id, job_id, created_at FROM credit_transactions WHERE id = ?", id)
	var item CreditTransaction
	err := row.Scan(&item.ID, &item.UserID, &item.Type, &item.Amount, &item.Description, &item.StripePaymentIntentID, &item.JobID, &item.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (m *CreditTransactionModel) Create(userID int64, txType string, amount int64, description string, stripePaymentIntentID string, jobID int64) (int64, error) {
	res, err := m.writeDB.Exec(
		"INSERT INTO credit_transactions (user_id, type, amount, description, stripe_payment_intent_id, job_id) VALUES (?, ?, ?, ?, ?, ?)",
		userID, txType, amount, description, stripePaymentIntentID, jobID,
	)
	if err != nil {
		return 0, err
	}
	m.cache.Bust("credit_transactions:")
	return res.LastInsertId()
}

func (m *CreditTransactionModel) Delete(id int64) error {
	_, err := m.writeDB.Exec("DELETE FROM credit_transactions WHERE id = ?", id)
	if err == nil {
		m.cache.Bust("credit_transactions:")
	}
	return err
}

func (m *CreditTransactionModel) ExistsForPaymentIntent(piID string) (bool, error) {
	var count int
	err := m.readDB.QueryRow("SELECT COUNT(*) FROM credit_transactions WHERE stripe_payment_intent_id = ?", piID).Scan(&count)
	return count > 0, err
}

func (m *CreditTransactionModel) GetByUserID(userID int64) ([]CreditTransaction, error) {
	rows, err := m.readDB.Query("SELECT id, user_id, type, amount, description, stripe_payment_intent_id, job_id, created_at FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CreditTransaction
	for rows.Next() {
		var item CreditTransaction
		if err := rows.Scan(&item.ID, &item.UserID, &item.Type, &item.Amount, &item.Description, &item.StripePaymentIntentID, &item.JobID, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}
