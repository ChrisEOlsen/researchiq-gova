package handlers

import (
	"encoding/json"
	"net/http"
)

type envelope struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

func jsonOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	// Every JSON response here is session/privilege-dependent (credits,
	// lifetime_access, ownership-gated data) -- letting the browser cache
	// it means a stale privilege state can keep rendering after the
	// underlying data changes, with no explicit reload to fix it.
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(envelope{OK: true, Data: data})
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(envelope{OK: false, Error: msg})
}

// maxJSONBodyBytes caps request bodies decoded via decodeJSON, matching the
// limit payments_webhook.go already applies via io.LimitReader. Without
// this, json.Decoder will buffer/parse as much as an (often unauthenticated)
// client sends before any field-length validation runs — a memory-
// exhaustion DoS vector with no reverse proxy in front of this app.
const maxJSONBodyBytes = 65536

// decodeJSON wraps r.Body in a size-limited reader before decoding into v,
// so a caller can't force an unbounded read/allocation just by sending an
// oversized body. Use this instead of json.NewDecoder(r.Body).Decode
// directly in every POST handler that accepts a JSON body.
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	return json.NewDecoder(r.Body).Decode(v)
}
