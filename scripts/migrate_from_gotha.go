package main

import (
	"database/sql"
	"flag"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	srcPath := flag.String("src", "/Users/crispychris/Desktop/repos/researchiq-gotha/data/app.db", "path to source (gotha-schema) sqlite db")
	dstPath := flag.String("dst", "./data/app.db", "path to destination (gova-schema) sqlite db, tables must already exist")
	flag.Parse()

	src, err := sql.Open("sqlite3", "file:"+*srcPath+"?mode=ro")
	if err != nil {
		log.Fatal(err)
	}
	defer src.Close()

	dst, err := sql.Open("sqlite3", *dstPath)
	if err != nil {
		log.Fatal(err)
	}
	defer dst.Close()

	migrateUsers(src, dst)
	migrateResearchJobs(src, dst)
	migrateResearchResults(src, dst)
	migrateCreditTransactions(src, dst)
	migratePubmedCache(src, dst)
	log.Println("migration complete")
}

func migrateUsers(src, dst *sql.DB) {
	rows, err := src.Query("SELECT id, name, email, password_hash, credits, lifetime_access, created_at FROM users")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, credits, lifetime int64
		var name, email, hash string
		var createdAt string
		if err := rows.Scan(&id, &name, &email, &hash, &credits, &lifetime, &createdAt); err != nil {
			log.Fatal(err)
		}
		_, err := dst.Exec(
			"INSERT OR IGNORE INTO users (id, name, email, password_hash, credits, lifetime_access, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			id, name, email, hash, credits, lifetime, createdAt,
		)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func migrateResearchJobs(src, dst *sql.DB) {
	rows, err := src.Query(`SELECT id, question, COALESCE(title,''), status, COALESCE(pipeline_stage,''),
		studies_found, COALESCE(error_message,''), COALESCE(user_id,0), COALESCE(share_token,''),
		created_at, updated_at FROM research_jobs`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, studiesFound, userID int64
		var question, title, status, stage, errMsg, shareToken, createdAt, updatedAt string
		if err := rows.Scan(&id, &question, &title, &status, &stage, &studiesFound, &errMsg, &userID, &shareToken, &createdAt, &updatedAt); err != nil {
			log.Fatal(err)
		}
		_, err := dst.Exec(
			`INSERT OR IGNORE INTO research_jobs (id, question, title, status, pipeline_stage, studies_found, error_message, user_id, share_token, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, question, title, status, stage, studiesFound, errMsg, userID, shareToken, createdAt, updatedAt,
		)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func migrateResearchResults(src, dst *sql.DB) {
	rows, err := src.Query("SELECT id, job_id, summary, key_takeaways, follow_up_questions, visual_html, studies, created_at FROM research_results")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, jobID int64
		var summary, takeaways, followUps, visualHTML, studies, createdAt string
		if err := rows.Scan(&id, &jobID, &summary, &takeaways, &followUps, &visualHTML, &studies, &createdAt); err != nil {
			log.Fatal(err)
		}
		_, err := dst.Exec(
			`INSERT OR IGNORE INTO research_results (id, job_id, summary, key_takeaways, follow_up_questions, visual_html, studies, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, jobID, summary, takeaways, followUps, visualHTML, studies, createdAt,
		)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func migrateCreditTransactions(src, dst *sql.DB) {
	rows, err := src.Query(`SELECT id, user_id, type, amount, COALESCE(description,''),
		COALESCE(stripe_payment_intent_id,''), COALESCE(job_id,0), created_at FROM credit_transactions`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, userID, amount, jobID int64
		var txType, desc, piID, createdAt string
		if err := rows.Scan(&id, &userID, &txType, &amount, &desc, &piID, &jobID, &createdAt); err != nil {
			log.Fatal(err)
		}
		_, err := dst.Exec(
			`INSERT OR IGNORE INTO credit_transactions (id, user_id, type, amount, description, stripe_payment_intent_id, job_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, userID, txType, amount, desc, piID, jobID, createdAt,
		)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func migratePubmedCache(src, dst *sql.DB) {
	rows, err := src.Query("SELECT pmid, abstract_json, fetched_at FROM pubmed_cache")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var pmid, abstractJSON, fetchedAt string
		if err := rows.Scan(&pmid, &abstractJSON, &fetchedAt); err != nil {
			log.Fatal(err)
		}
		_, err := dst.Exec(
			"INSERT OR IGNORE INTO pubmed_cache (pmid, abstract_json, fetched_at) VALUES (?, ?, ?)",
			pmid, abstractJSON, fetchedAt,
		)
		if err != nil {
			log.Fatal(err)
		}
	}
}
