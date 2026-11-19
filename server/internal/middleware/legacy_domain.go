package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

// The app moved from these hosts to the one in ALLOWED_ORIGINS. Sign-in only works on the
// new domain (Clerk is tied to it), so every request to an old host is sent there instead.
var legacyHosts = map[string]bool{
	"daily-doodle.app":     true,
	"www.daily-doodle.app": true,
}

// LegacyDomainRedirect permanently redirects requests for an old host to the same path on
// origin. GET and HEAD get a 301; anything else a 308, which keeps the method and body.
// It does nothing unless origin is an https URL on a new host, so a stale ALLOWED_ORIGINS
// can't cause a redirect loop or send people to localhost.
func LegacyDomainRedirect(origin string) gin.HandlerFunc {
	origin = strings.TrimSuffix(origin, "/")
	target, err := url.Parse(origin)
	if err != nil || target.Scheme != "https" || legacyHosts[strings.ToLower(target.Hostname())] {
		return func(c *gin.Context) { c.Next() }
	}

	return func(c *gin.Context) {
		host := strings.ToLower(strings.Split(c.Request.Host, ":")[0])
		if !legacyHosts[host] {
			c.Next()
			return
		}

		status := http.StatusPermanentRedirect
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead {
			status = http.StatusMovedPermanently
		}
		c.Redirect(status, origin+c.Request.URL.RequestURI())
		c.Abort()
	}
}
