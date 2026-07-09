package handlers

import (
	"database/sql"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/stripe/stripe-go/v82/webhook"

	"gova/app/cache"
	"gova/app/models"
)

// PaymentsWebhookPOST handles POST /api/payments_webhook.
// Must be registered WITHOUT CSRF middleware and WITHOUT session auth —
// Stripe calls this server-to-server and signs the payload with an HMAC
// secret instead.
func PaymentsWebhookPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	userModel := models.NewUserModel(readDB, writeDB, appCache)
	txModel := models.NewCreditTransactionModel(readDB, writeDB, appCache)

	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 65536))
		if err != nil {
			jsonError(w, "failed to read body", 400)
			return
		}

		whSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
		sigHeader := r.Header.Get("Stripe-Signature")

		event, err := webhook.ConstructEventWithOptions(body, sigHeader, whSecret,
			webhook.ConstructEventOptions{IgnoreAPIVersionMismatch: true})
		if err != nil {
			log.Printf("stripe webhook: signature verification failed: %v", err)
			jsonError(w, "webhook signature verification failed", 400)
			return
		}

		if event.Type != "checkout.session.completed" {
			jsonOK(w, nil)
			return
		}

		// Extract payment_intent early for the idempotency check.
		paymentIntentID := event.GetObjectValue("payment_intent")
		if paymentIntentID != "" {
			already, err := txModel.ExistsForPaymentIntent(paymentIntentID)
			if err != nil {
				log.Printf("stripe webhook: idempotency check: %v", err)
			} else if already {
				log.Printf("stripe webhook: payment_intent %s already processed — skipping", paymentIntentID)
				jsonOK(w, nil)
				return
			}
		}

		clientRefID := event.GetObjectValue("client_reference_id")
		if clientRefID == "" {
			log.Printf("stripe webhook: missing client_reference_id")
			jsonOK(w, nil)
			return
		}

		userID, err := strconv.ParseInt(clientRefID, 10, 64)
		if err != nil || userID <= 0 {
			log.Printf("stripe webhook: invalid client_reference_id %q", clientRefID)
			jsonOK(w, nil)
			return
		}

		// Prefer credits from session metadata; fall back to amount-based lookup.
		var credits int64
		if creditsStr := event.GetObjectValue("metadata[credits]"); creditsStr != "" {
			credits, _ = strconv.ParseInt(creditsStr, 10, 64)
		}
		if credits <= 0 {
			amountTotal, _ := strconv.ParseInt(event.GetObjectValue("amount_total"), 10, 64)
			credits = creditsForAmount(amountTotal)
		}
		if credits <= 0 {
			log.Printf("stripe webhook: could not determine credit count for user %d — defaulting to 10", userID)
			credits = 10
		}

		if err := userModel.AddCredits(userID, credits); err != nil {
			log.Printf("stripe webhook: add credits for user %d: %v", userID, err)
			jsonError(w, "internal error", 500)
			return
		}

		if _, err := txModel.Create(userID, "purchase", credits, "Credit purchase", paymentIntentID, 0); err != nil {
			log.Printf("stripe webhook: record transaction for user %d: %v", userID, err)
		}

		log.Printf("stripe webhook: added %d credits for user %d (payment_intent=%s)", credits, userID, paymentIntentID)
		jsonOK(w, nil)
	}
}

// creditsForAmount returns the credit count for an amount in cents (fallback only).
func creditsForAmount(cents int64) int64 {
	switch cents {
	case 499:
		return 10
	case 999:
		return 25
	case 1799:
		return 50
	default:
		return 0
	}
}
