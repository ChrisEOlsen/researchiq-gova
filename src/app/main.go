package main

import (
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"gova/app/cache"
	"gova/app/db"
	"gova/app/handlers"
	"gova/app/middleware"
	"gova/app/models"
)

func main() {
	if logPath := os.Getenv("LOG_PATH"); logPath != "" {
		if f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644); err == nil {
			log.SetOutput(io.MultiWriter(os.Stdout, f))
		}
	}

	if secret := os.Getenv("SESSION_SECRET"); len(secret) < 32 {
		log.Fatal("SESSION_SECRET must be set and at least 32 characters")
	}

	database, err := db.Open(os.Getenv("DB_PATH"))
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer database.Close()

	appCache := cache.New()
	_ = appCache

	// PubMed abstract cache: prune entries older than 30 days at startup,
	// then keep pruning on a 24h ticker for the life of the process.
	// GOTHA only pruned once at startup (Known Bug #5) — this fixes that.
	pubmedCacheModel := models.NewPubmedCacheModel(database.Read, database.Write)
	if err := pubmedCacheModel.PruneOlderThan30Days(); err != nil {
		log.Printf("pubmed cache prune (startup): %v", err)
	}
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := pubmedCacheModel.PruneOlderThan30Days(); err != nil {
				log.Printf("pubmed cache prune (ticker): %v", err)
			}
		}
	}()

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.Security)
	r.Use(middleware.CSRF)
	r.Use(middleware.Auth)

	// Static files
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// Pages
	r.Get("/", handlers.HomeGET())
	r.Get("/login", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, "./static/pages/login.html") })
	r.Get("/register", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, "./static/pages/register.html") })

	// Generated API routes registered here by MCP tools
	// Use database.Read for GET handlers, database.Write for POST handlers
	r.Post("/api/auth/login", handlers.LoginPOST(database.Read, database.Write, appCache))
	r.Post("/api/auth/logout", handlers.LogoutPOST())
	r.Get("/api/auth/me", handlers.MeGET(database.Read, database.Write, appCache))
	r.Post("/api/auth/register", handlers.RegisterPOST(database.Read, database.Write, appCache))

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("GOVA app listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
