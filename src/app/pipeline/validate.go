package pipeline

import (
	"encoding/json"
	"strings"
	"time"
)

type validationResult struct {
	Valid  bool   `json:"valid"`
	Reason string `json:"reason"`
}

// ValidateQuestion calls Haiku to check whether a question is on-topic for
// a health/fitness/nutrition/mental-health research tool. Fails open on
// any API or parse error — (true, "") — so users are never blocked by an
// AI-provider outage.
func ValidateQuestion(question string) (accepted bool, reason string) {
	content, err := ChatWithRetry(ModelHaiku, validationSystemPrompt, question, 120, 15*time.Second)
	if err != nil {
		return true, ""
	}
	content = StripMarkdownFences(content)
	var result validationResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(content)), &result); err != nil {
		return true, ""
	}
	return result.Valid, result.Reason
}
