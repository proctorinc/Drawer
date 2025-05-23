package email

import (
	"drawer-service-backend/internal/config"
	"fmt"

	"github.com/resend/resend-go/v2"
)

type EmailClient struct {
	ApiToken string
}

func NewClient(cfg *config.Config) EmailClient {
	return EmailClient{
		ApiToken: cfg.ResendAPIKey,
	}
}

func sendEmail(apiToken string, params *resend.SendEmailRequest) (*resend.SendEmailResponse, error) {
	client := resend.NewClient(apiToken)

	return client.Emails.Send(params)
}

func (e *EmailClient) SendAuthEmail() error {
	params := &resend.SendEmailRequest{
		From:    "MattyP <onboarding@resend.dev>",
		To:      []string{"delivered@resend.dev"},
		Html:    "<strong>hello world</strong>",
		Subject: "Login to Drawer!",
		ReplyTo: "replyto@example.com",
	}

	sent, err := sendEmail(e.ApiToken, params)

	if err != nil {
		return fmt.Errorf("Failed to send email (id: %d): %v", sent.Id, err)
	}

	return nil
}
