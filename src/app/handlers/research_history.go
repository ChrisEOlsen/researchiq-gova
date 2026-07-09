package handlers

import (
	"database/sql"
	"net/http"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func ResearchHistoryGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		userID := middleware.UserID(r)
		var jobs []models.ResearchJob
		var err error
		if userID != 0 {
			jobs, err = jobModel.GetByUserID(userID)
		} else {
			jobs, err = jobModel.GetByIDs(getGuestJobIDs(r))
		}
		if err != nil {
			jsonError(w, "failed to load", 500)
			return
		}
		jsonOK(w, map[string]any{"jobs": jobs})
	}
}
