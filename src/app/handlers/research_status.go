package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func ResearchStatusGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		jobID, _ := strconv.ParseInt(r.URL.Query().Get("job_id"), 10, 64)
		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		job, err := jobModel.GetByID(jobID)
		if err != nil || job == nil {
			jsonError(w, "not found", 404)
			return
		}
		if !jobModel.Owns(job, middleware.UserID(r), getGuestJobIDs(r)) {
			jsonError(w, "not found", 404)
			return
		}
		jsonOK(w, map[string]any{
			"status": job.Status, "pipeline_stage": job.PipelineStage,
			"studies_found": job.StudiesFound, "error_message": job.ErrorMessage,
		})
	}
}
