package handlers

import (
	"gova/app/middleware"
	"net/http"
)

func LogoutPOST() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		middleware.ClearSession(w)
		jsonOK(w, nil)
	}
}
