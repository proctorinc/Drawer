package email

import (
	"drawer-service-backend/internal/config"
	"fmt"

	"gopkg.in/gomail.v2"
)

func SendVerificationEmail(cfg *config.Config, toEmail string, token string) error {
	// Create verification URL
	verifyURL := fmt.Sprintf("%s/api/v1/verify?token=%s", cfg.BaseURL, token)

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

	// Create new message
	m := gomail.NewMessage()
	m.SetHeader("From", cfg.FromEmail)
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Verify your Drawer account")
	m.SetBody("text/html", html)

	// Create dialer
	d := gomail.NewDialer("smtp.gmail.com", 587, cfg.FromEmail, cfg.GmailAppPassword)

	// Send email
	if err := d.DialAndSend(m); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}
