package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func ResearchVisualGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		resultModel := models.NewResearchResultModel(readDB, writeDB, appCache)

		var job *models.ResearchJob
		var err error
		if t := r.URL.Query().Get("share_token"); t != "" {
			job, err = jobModel.FindByShareToken(t)
		} else {
			id, _ := strconv.ParseInt(r.URL.Query().Get("job_id"), 10, 64)
			job, err = jobModel.GetByID(id)
			if err == nil && job != nil && !jobModel.Owns(job, middleware.UserID(r), getGuestJobIDs(r)) {
				job = nil
			}
		}
		if err != nil || job == nil {
			http.NotFound(w, r)
			return
		}
		result, err := resultModel.GetByJobID(job.ID)
		if err != nil || result == nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(result.VisualHTML))
	}
}
