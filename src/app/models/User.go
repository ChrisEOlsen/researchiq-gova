package models

import (
	"database/sql"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gova/app/cache"
)

type User struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	PasswordHash   string    `json:"-"`
	Credits        int64     `json:"credits"`
	LifetimeAccess bool      `json:"lifetime_access"`
	CreatedAt      time.Time `json:"created_at"`
}

type UserModel struct {
	readDB  *sql.DB
	writeDB *sql.DB
	cache   *cache.Cache
}

func NewUserModel(readDB, writeDB *sql.DB, c *cache.Cache) *UserModel {
	return &UserModel{readDB: readDB, writeDB: writeDB, cache: c}
}

func (m *UserModel) Create(name, email, password string) (int64, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return 0, err
	}
	res, err := m.writeDB.Exec(
		"INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
		name, email, string(hashed),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (m *UserModel) FindByEmail(email string) (*User, error) {
	row := m.readDB.QueryRow(
		"SELECT id, name, email, password_hash, credits, lifetime_access, created_at FROM users WHERE email = ? LIMIT 1",
		email,
	)
	var u User
	var liInt int
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Credits, &liInt, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	u.LifetimeAccess = liInt != 0
	return &u, nil
}

func (m *UserModel) FindByID(id int64) (*User, error) {
	row := m.readDB.QueryRow(
		"SELECT id, name, email, credits, lifetime_access, created_at FROM users WHERE id = ? LIMIT 1",
		id,
	)
	var u User
	var liInt int
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Credits, &liInt, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	u.LifetimeAccess = liInt != 0
	return &u, nil
}

func (m *UserModel) IsRateLimited(ip string) (bool, error) {
	var lockedUntil sql.NullTime
	row := m.readDB.QueryRow("SELECT locked_until FROM rate_limits WHERE ip = ?", ip)
	if err := row.Scan(&lockedUntil); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if lockedUntil.Valid && time.Now().Before(lockedUntil.Time) {
		return true, nil
	}
	return false, nil
}

func (m *UserModel) RecordFailedAttempt(ip string) {
	_, _ = m.writeDB.Exec(`
		INSERT INTO rate_limits (ip, attempts, locked_until, updated_at)
		VALUES (?, 1, NULL, CURRENT_TIMESTAMP)
		ON CONFLICT(ip) DO UPDATE SET
			attempts = attempts + 1,
			locked_until = CASE WHEN attempts + 1 >= 5
				THEN datetime('now', '+15 minutes') ELSE locked_until END,
			updated_at = CURRENT_TIMESTAMP
	`, ip)
}

func (m *UserModel) ClearAttempts(ip string) {
	_, _ = m.writeDB.Exec("DELETE FROM rate_limits WHERE ip = ?", ip)
}

// guestRateLimitKey namespaces guest-submission tracking within the shared
// rate_limits table (whose primary key is just "ip") so it can never
// collide with a login-lockout row for the same address — the two use
// cases have different reset semantics (15-minute lockout vs. a 30-day
// submission window) and would corrupt each other if they shared a row.
func guestRateLimitKey(ip string) string { return "guest:" + ip }

// IsGuestSubmitLimited reports whether ip has already used its 5 guest
// research submissions within the current 30-day window (SEED.md: "IP rate
// limit: max 5 guest submissions per IP per 30 days"). It is a read-only
// check — call RecordGuestSubmission separately once the submission is
// actually accepted.
//
// This reuses the rate_limits table's locked_until column with different
// semantics than the login-lockout use above: here it stores when the
// current 30-day window *expires* (not a lockout expiry), so attempts can
// be interpreted as "submissions so far in this window" rather than
// "consecutive failed attempts".
func (m *UserModel) IsGuestSubmitLimited(ip string) (bool, error) {
	var attempts int64
	var windowExpires sql.NullTime
	row := m.readDB.QueryRow("SELECT attempts, locked_until FROM rate_limits WHERE ip = ?", guestRateLimitKey(ip))
	if err := row.Scan(&attempts, &windowExpires); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	windowActive := windowExpires.Valid && time.Now().Before(windowExpires.Time)
	return windowActive && attempts >= 5, nil
}

// RecordGuestSubmission records one guest research submission from ip
// against its rolling 30-day window: starts a fresh window (attempts=1) if
// none is active, otherwise increments the counter within the existing
// window. Call only after IsGuestSubmitLimited has confirmed the
// submission is allowed.
func (m *UserModel) RecordGuestSubmission(ip string) {
	_, _ = m.writeDB.Exec(`
		INSERT INTO rate_limits (ip, attempts, locked_until, updated_at)
		VALUES (?, 1, datetime('now', '+30 days'), CURRENT_TIMESTAMP)
		ON CONFLICT(ip) DO UPDATE SET
			attempts = CASE
				WHEN locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP THEN 1
				ELSE attempts + 1 END,
			locked_until = CASE
				WHEN locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP THEN datetime('now', '+30 days')
				ELSE locked_until END,
			updated_at = CURRENT_TIMESTAMP
	`, guestRateLimitKey(ip))
}

func (m *UserModel) AddCredits(userID int64, amount int64) error {
	_, err := m.writeDB.Exec("UPDATE users SET credits = credits + ? WHERE id = ?", amount, userID)
	return err
}

func (m *UserModel) DecrementCredits(userID int64) error {
	_, err := m.writeDB.Exec("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0", userID)
	return err
}
