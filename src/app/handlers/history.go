package handlers

import (
	"net/http"
)

func HistoryGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/history.html")
	}
}
