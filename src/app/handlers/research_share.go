package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func ResearchSharePOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			JobID int64 `json:"job_id"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		job, err := jobModel.GetByID(body.JobID)
		if err != nil || job == nil || !jobModel.Owns(job, middleware.UserID(r), getGuestJobIDs(r)) {
			jsonError(w, "not found", 404)
			return
		}
		if job.ShareToken == "" {
			b := make([]byte, 24)
			rand.Read(b)
			token := hex.EncodeToString(b)
			jobModel.SetShareToken(job.ID, token)
			job.ShareToken = token
		}
		jsonOK(w, map[string]any{"share_url": os.Getenv("APP_URL") + "/share?t=" + job.ShareToken})
	}
}
