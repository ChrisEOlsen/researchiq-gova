package handlers

import (
	"net/http"
)

func SettingsGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/settings.html")
	}
}
