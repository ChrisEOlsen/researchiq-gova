package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func ResearchResultGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		resultModel := models.NewResearchResultModel(readDB, writeDB, appCache)

		var job *models.ResearchJob
		var err error
		if t := r.URL.Query().Get("t"); t != "" {
			job, err = jobModel.FindByShareToken(t)
		} else {
			id, _ := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
			job, err = jobModel.GetByID(id)
			if err == nil && job != nil && !jobModel.Owns(job, middleware.UserID(r), getGuestJobIDs(r)) {
				job = nil
			}
		}
		if err != nil || job == nil || job.Status != "done" {
			jsonError(w, "not found", 404)
			return
		}
		result, err := resultModel.GetByJobID(job.ID)
		if err != nil || result == nil {
			jsonError(w, "not found", 404)
			return
		}
		var takeaways, followUps, studies any
		json.Unmarshal([]byte(result.KeyTakeaways), &takeaways)
		json.Unmarshal([]byte(result.FollowUpQuestions), &followUps)
		json.Unmarshal([]byte(result.Studies), &studies)
		jsonOK(w, map[string]any{
			"job": job, "summary": result.Summary,
			"key_takeaways": takeaways, "follow_up_questions": followUps, "studies": studies,
		})
	}
}
