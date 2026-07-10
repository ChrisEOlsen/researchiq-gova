package middleware

import "net/http"

// StaticCache sets the cache policy for static assets. Browsers must
// revalidate on every use (no-cache → conditional request → 304 when
// unchanged) so deploys reach returning visitors immediately, while
// Cloudflare's edge may hold a copy for a day (s-maxage) and answer
// those 304s itself instead of hitting the origin. sync.sh purges the
// edge on every deploy, so the s-maxage copy never outlives a release.
func StaticCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, s-maxage=86400")
		next.ServeHTTP(w, r)
	})
}
