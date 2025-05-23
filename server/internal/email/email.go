package email

import (
	"fmt"

	"drawer-service-backend/internal/config"

	"github.com/resend/resend-go/v2"
)

func SendVerificationEmail(cfg *config.Config, toEmail string, token string) error {
	// Create verification URL
	verifyURL := fmt.Sprintf("%s/api/auth/verify?token=%s", cfg.BaseURL, token)

	// Create email HTML
	html := fmt.Sprintf(`
		<html>
			<body>
				<h2>Welcome to Drawer!</h2>
				<p>Please click the link below to verify your email address:</p>
				<p><a href="%s">Verify Email</a></p>
				<p>This link will expire in 1 hour.</p>
				<p>If you didn't request this verification, you can safely ignore this email.</p>
			</body>
		</html>
	`, verifyURL)

	client := resend.NewClient(cfg.ResendAPIKey)

	params := &resend.SendEmailRequest{
		From:    cfg.FromEmail,
		To:      []string{toEmail},
		Subject: "Verify your Drawer account",
		Html:    html,
	}

	_, err := client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}
