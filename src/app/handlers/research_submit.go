package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
	"gova/app/pipeline"
)

func ResearchSubmitPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Question string `json:"question"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}
		question := strings.TrimSpace(body.Question)
		if len(question) < 10 {
			jsonError(w, "question must be at least 10 characters", 400)
			return
		}
		if ok, reason := pipeline.ValidateQuestion(question); !ok {
			jsonError(w, reason, 400)
			return
		}

		jobModel := models.NewResearchJobModel(readDB, writeDB, appCache)
		userModel := models.NewUserModel(readDB, writeDB, appCache)
		resultModel := models.NewResearchResultModel(readDB, writeDB, appCache)
		cacheModel := models.NewPubmedCacheModel(readDB, writeDB)
		txModel := models.NewCreditTransactionModel(readDB, writeDB, appCache)

		userID := middleware.UserID(r)
		if userID != 0 {
			user, err := userModel.FindByID(userID)
			if err != nil {
				jsonError(w, "user not found", 404)
				return
			}
			if !user.LifetimeAccess && user.Credits <= 0 {
				jsonError(w, "out of credits", 402)
				return
			}
			active, _ := jobModel.CountActive(userID)
			if active >= 3 {
				jsonError(w, "too many active research jobs", 429)
				return
			}
		} else {
			guestIDs := getGuestJobIDs(r)
			if len(guestIDs) >= 5 {
				jsonError(w, "guest query limit reached", 402)
				return
			}
		}

		jobID, err := jobModel.Create(question, userID)
		if err != nil {
			jsonError(w, "failed to create job", 500)
			return
		}
		if userID == 0 {
			addGuestJobID(w, r, jobID)
		}

		user, _ := userModel.FindByID(userID)
		isLifetime := user != nil && user.LifetimeAccess
		go pipeline.Run(jobID, question, userID, isLifetime, jobModel, resultModel, cacheModel, userModel, txModel)

		jsonOK(w, map[string]any{"job_id": jobID})
	}
}
