package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Provider is a model that can judge a doodle. OpenAI is the only one today; another
// (Anthropic, a local model) only has to turn a Request into the verdict JSON.
type Provider interface {
	// Judge returns the model's raw JSON answer, shaped by ResponseSchema.
	Judge(ctx context.Context, req Request) (string, error)
	// Model names the model doing the judging, for the admin log.
	Model() string
}

// Talker is a model that can also just talk, without a doodle to look at: a judge
// introducing the day's prompt, say. Providers that can't are given a stock line.
type Talker interface {
	// Talk returns the model's raw JSON answer, shaped by schema.
	Talk(ctx context.Context, system, user, schemaName string, schema map[string]any) (string, error)
}

// DefaultOpenAIModel is used when no model is set. It needs image input and structured outputs.
const DefaultOpenAIModel = "gpt-4.1-mini"

const openAIBaseURL = "https://api.openai.com/v1"

// OpenAI judges with OpenAI's Chat Completions API.
type OpenAI struct {
	APIKey  string
	model   string
	BaseURL string // Overridable for tests
	HTTP    *http.Client
}

func NewOpenAI(apiKey, model string) *OpenAI {
	if model == "" {
		model = DefaultOpenAIModel
	}
	return &OpenAI{
		APIKey:  apiKey,
		model:   model,
		BaseURL: openAIBaseURL,
		HTTP:    &http.Client{Timeout: 60 * time.Second},
	}
}

func (o *OpenAI) Model() string { return o.model }

type openAIContentPart struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	ImageURL *openAIImageURL `json:"image_url,omitempty"`
}

type openAIImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
			Refusal string `json:"refusal"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (o *OpenAI) Judge(ctx context.Context, req Request) (string, error) {
	return o.complete(ctx, []openAIMessage{
		{Role: "system", Content: SystemPrompt(req.Personality)},
		{Role: "user", Content: []openAIContentPart{
			{Type: "text", Text: UserPrompt(req.Prompt)},
			// Low detail is plenty for a phone doodle, and the cheapest
			{Type: "image_url", ImageURL: &openAIImageURL{
				URL:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(req.Image),
				Detail: "low",
			}},
		}},
	}, "doodle_review", ResponseSchema(req.Personality))
}

func (o *OpenAI) Talk(ctx context.Context, system, user, schemaName string, schema map[string]any) (string, error) {
	return o.complete(ctx, []openAIMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: user},
	}, schemaName, schema)
}

// complete asks for an answer shaped by the schema and returns its raw JSON.
func (o *OpenAI) complete(ctx context.Context, messages []openAIMessage, schemaName string, schema map[string]any) (string, error) {
	if o.APIKey == "" {
		return "", errors.New("no OpenAI API key is set")
	}

	body := map[string]any{
		"model":    o.model,
		"messages": messages,
		"response_format": map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   schemaName,
				"strict": true,
				"schema": schema,
			},
		},
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.BaseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+o.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := o.HTTP.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("calling OpenAI: %w", err)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("reading OpenAI's answer: %w", err)
	}

	var parsed openAIResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("OpenAI answered %d with something unreadable", res.StatusCode)
	}
	if res.StatusCode != http.StatusOK {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return "", fmt.Errorf("OpenAI error (%d): %s", res.StatusCode, parsed.Error.Message)
		}
		return "", fmt.Errorf("OpenAI error (%d)", res.StatusCode)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("OpenAI gave no answer")
	}

	choice := parsed.Choices[0]
	if choice.Message.Refusal != "" {
		return "", fmt.Errorf("OpenAI refused: %s", choice.Message.Refusal)
	}
	if choice.Message.Content == "" {
		return "", fmt.Errorf("OpenAI gave an empty answer (finish reason %q)", choice.FinishReason)
	}
	return choice.Message.Content, nil
}
