package handlers

import (
	"database/sql"
	"net/http"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func ResearchDeletePOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if middleware.UserID(r) == 0 {
			jsonError(w, "unauthorized", 401)
			return
		}
		var body struct {
			JobID int64 `json:"job_id"`
		}
		if err := decodeJSON(w, r, &body); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}
		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		if err := jobModel.Delete(body.JobID, middleware.UserID(r)); err != nil {
			jsonError(w, "not found or unauthorized", 404)
			return
		}
		jsonOK(w, nil)
	}
}
