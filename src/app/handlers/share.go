package handlers

import (
	"net/http"
)

func ShareGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/share.html")
	}
}
