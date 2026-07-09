package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

const guestCookieName = "riq_guest"

var guestCookieKey = []byte(os.Getenv("SESSION_SECRET"))

func getGuestJobIDs(r *http.Request) []int64 {
	cookie, err := r.Cookie(guestCookieName)
	if err != nil {
		return nil
	}
	parts := splitOnce(cookie.Value, "|")
	if len(parts) != 2 {
		return nil
	}
	encoded, sig := parts[0], parts[1]
	mac := hmac.New(sha256.New, guestCookieKey)
	mac.Write([]byte(encoded))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil
	}
	var ids []int64
	if err := json.Unmarshal(raw, &ids); err != nil {
		return nil
	}
	return ids
}

func addGuestJobID(w http.ResponseWriter, r *http.Request, jobID int64) {
	ids := getGuestJobIDs(r)
	for _, id := range ids {
		if id == jobID {
			return
		}
	}
	ids = append(ids, jobID)
	payload, _ := json.Marshal(ids)
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, guestCookieKey)
	mac.Write([]byte(encoded))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	http.SetCookie(w, &http.Cookie{
		Name:     guestCookieName,
		Value:    encoded + "|" + sig,
		Path:     "/",
		HttpOnly: true,
		Secure:   os.Getenv("APP_ENV") == "production",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
	})
}

func splitOnce(s, sep string) []string {
	for i := 0; i+len(sep) <= len(s); i++ {
		if s[i:i+len(sep)] == sep {
			return []string{s[:i], s[i+len(sep):]}
		}
	}
	return []string{s}
}
