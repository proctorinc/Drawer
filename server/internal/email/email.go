package email

import (
	"drawer-service-backend/internal/config"
	"fmt"
	"log"

	"github.com/resendlabs/resend-go"
)

func SendVerificationEmail(cfg *config.Config, toEmail string, token string) error {
	// Create verification URL
	verifyURL := fmt.Sprintf("%s/api/v1/verify?token=%s", cfg.BaseURL, token)

	if cfg.Env != "production" {
		log.Printf("Skipping email sending in development mode. Verify URL: %s", verifyURL)
		return nil
	}

	// Create email HTML
	html := fmt.Sprintf(`
		<html>
			<body>
				<h2>Welcome to Daily Doodle!</h2>
				<p>Please click the link below to login to the Daily Doodle:</p>
				<p><a href="%s">Log in</a></p>
				<p>This link will expire in 1 hour.</p>
				<p>If you didn't request this verification, you can safely ignore this email.</p>
			</body>
		</html>
	`, verifyURL)

	// Create Resend client
	client := resend.NewClient(cfg.ResendAPIKey)

	// Create email params
	params := &resend.SendEmailRequest{
		From:    cfg.FromEmail,
		To:      []string{toEmail},
		Subject: "Log in to Daily Doodle!",
		Html:    html,
	}

	// Send email
	_, err := client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}
