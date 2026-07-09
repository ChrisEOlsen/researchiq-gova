package handlers

import (
	"net/http"
)

func ResultGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/result.html")
	}
}
