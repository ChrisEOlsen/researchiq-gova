package pipeline

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const openRouterURL = "https://openrouter.ai/api/v1/chat/completions"

// Model slugs verified live against OpenRouter's model catalog
// (openrouter.ai/anthropic) on 2026-07-09 via WebFetch, since GOTHA was
// built against an earlier Sonnet generation (claude-sonnet-4.6). Haiku
// tier is unchanged; Sonnet tier moved to the current-generation slug.
const (
	ModelHaiku  = "anthropic/claude-haiku-4.5"
	ModelSonnet = "anthropic/claude-sonnet-5"
)

// defaultToolMaxTokens bounds the tool-calling agent loop's per-turn
// response size. ChatWithTools has no maxTokens parameter in its public
// signature (each research-agent turn only ever needs a short tool call
// or a brief wrap-up message), so this is fixed rather than threaded
// through every call site.
const defaultToolMaxTokens = 4096

type Message struct {
	Role       string      `json:"role"`
	Content    interface{} `json:"content"`
	ToolCallID string      `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function FunctionCall `json:"function"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type Tool struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

type ToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type chatRequest struct {
	Model     string    `json:"model"`
	Messages  []Message `json:"messages"`
	Tools     []Tool    `json:"tools,omitempty"`
	MaxTokens int       `json:"max_tokens"`
}

// ChatResponse is the parsed OpenRouter chat-completion response.
type ChatResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func appURL() string {
	if u := os.Getenv("APP_URL"); u != "" {
		return u
	}
	return "https://researchiq.ai"
}

func chat(model string, messages []Message, tools []Tool, maxTokens int, timeout time.Duration) (*ChatResponse, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY not set")
	}
	body, err := json.Marshal(chatRequest{
		Model:     model,
		Messages:  messages,
		Tools:     tools,
		MaxTokens: maxTokens,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", openRouterURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", appURL())
	req.Header.Set("X-Title", "ResearchIQ")

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openrouter request: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		preview := raw
		if len(preview) > 300 {
			preview = preview[:300]
		}
		return nil, fmt.Errorf("openrouter HTTP %d: %s", resp.StatusCode, string(preview))
	}
	var cr ChatResponse
	if err := json.Unmarshal(raw, &cr); err != nil {
		return nil, fmt.Errorf("openrouter parse: %w", err)
	}
	if cr.Error != nil {
		return nil, fmt.Errorf("openrouter error: %s", cr.Error.Message)
	}
	return &cr, nil
}

// callWithRetry performs a chat completion, retrying once after a 3s sleep
// on transport error or an empty response (no content and no tool calls).
func callWithRetry(model string, messages []Message, tools []Tool, maxTokens int, timeout time.Duration) (*ChatResponse, error) {
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(3 * time.Second)
		}
		cr, err := chat(model, messages, tools, maxTokens, timeout)
		if err != nil {
			lastErr = err
			continue
		}
		if len(cr.Choices) == 0 {
			lastErr = fmt.Errorf("openrouter returned no choices")
			continue
		}
		content, _ := cr.Choices[0].Message.Content.(string)
		if content == "" && len(cr.Choices[0].Message.ToolCalls) == 0 {
			lastErr = fmt.Errorf("openrouter returned empty content and no tool calls")
			continue
		}
		return cr, nil
	}
	return nil, lastErr
}

// ChatWithRetry sends a single system+user turn (no tools) and returns the
// assistant's text content. Retries once after a 3s sleep on transport
// error or empty response.
func ChatWithRetry(model, systemPrompt, userPrompt string, maxTokens int, timeout time.Duration) (string, error) {
	messages := []Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
	cr, err := callWithRetry(model, messages, nil, maxTokens, timeout)
	if err != nil {
		return "", err
	}
	content, _ := cr.Choices[0].Message.Content.(string)
	return content, nil
}

// ChatWithTools sends a running conversation plus a tool-call system prompt
// and returns the full response (so callers can inspect tool_calls). Used
// by the multi-turn research agent loop, which manages its own message
// history across calls. Retries once after a 3s sleep on transport error
// or empty response, same as ChatWithRetry.
func ChatWithTools(model, systemPrompt string, messages []Message, tools []Tool, timeout time.Duration) (*ChatResponse, error) {
	full := make([]Message, 0, len(messages)+1)
	full = append(full, Message{Role: "system", Content: systemPrompt})
	full = append(full, messages...)
	return callWithRetry(model, full, tools, defaultToolMaxTokens, timeout)
}
