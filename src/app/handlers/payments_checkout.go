package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/checkout/session"

	"gova/app/cache"
	"gova/app/middleware"
)

func PaymentsCheckoutPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserID(r)
		if userID == 0 {
			jsonError(w, "unauthorized", 401)
			return
		}

		var body struct {
			PriceID string `json:"price_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}

		creditsByPrice := map[string]int64{
			os.Getenv("STRIPE_PRICE_STARTER"):  10,
			os.Getenv("STRIPE_PRICE_STANDARD"): 25,
			os.Getenv("STRIPE_PRICE_PRO"):      50,
		}
		credits, ok := creditsByPrice[body.PriceID]
		if !ok || body.PriceID == "" {
			jsonError(w, "invalid price", 400)
			return
		}

		appURL := os.Getenv("APP_URL")
		if appURL == "" {
			appURL = "http://localhost:8080"
		}

		params := &stripe.CheckoutSessionParams{
			Mode: stripe.String("payment"),
			LineItems: []*stripe.CheckoutSessionLineItemParams{
				{Price: stripe.String(body.PriceID), Quantity: stripe.Int64(1)},
			},
			ClientReferenceID: stripe.String(strconv.FormatInt(userID, 10)),
			SuccessURL:        stripe.String(appURL + "/settings?payment=success"),
			CancelURL:         stripe.String(appURL + "/settings"),
			Metadata: map[string]string{
				"user_id": strconv.FormatInt(userID, 10),
				"credits": strconv.FormatInt(credits, 10),
			},
		}

		sess, err := session.New(params)
		if err != nil {
			jsonError(w, "checkout session failed", 500)
			return
		}

		jsonOK(w, map[string]any{"checkout_url": sess.URL})
	}
}
