package handlers

import (
	"database/sql"
	"net/http"
	"os"

	"gova/app/cache"
	"gova/app/middleware"
	"gova/app/models"
)

func SettingsDataGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userModel := models.NewUserModel(readDB, writeDB, appCache)
		txModel := models.NewCreditTransactionModel(readDB, writeDB, appCache)
		userID := middleware.UserID(r)
		if userID == 0 {
			jsonError(w, "unauthorized", 401)
			return
		}
		user, err := userModel.FindByID(userID)
		if err != nil {
			jsonError(w, "user not found", 404)
			return
		}
		transactions, _ := txModel.GetByUserID(userID)
		packs := []map[string]any{
			{"id": "starter", "credits": 10, "price": "$4.99", "price_id": os.Getenv("STRIPE_PRICE_STARTER")},
			{"id": "standard", "credits": 25, "price": "$9.99", "price_id": os.Getenv("STRIPE_PRICE_STANDARD")},
			{"id": "pro", "credits": 50, "price": "$17.99", "price_id": os.Getenv("STRIPE_PRICE_PRO")},
		}
		jsonOK(w, map[string]any{"user": user, "credit_packs": packs, "transactions": transactions})
	}
}
