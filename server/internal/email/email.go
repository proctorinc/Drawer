package email

import (
	"drawer-service-backend/internal/config"
	"fmt"
	"log"

	"github.com/resendlabs/resend-go"
)

func SendVerificationEmail(cfg *config.Config, toEmail string, token string) error {
	// Create verification URL
	verifyURL := fmt.Sprintf("%s/api/v1/auth/verify?token=%s", cfg.BaseURL, token)

	if cfg.Env != "production" {
		log.Printf("Skipping email sending in development mode. Verify URL: %s", verifyURL)
		return nil
	}

	// Create email HTML
	html := fmt.Sprintf(`
		<html>
			<head>
				<meta charset="UTF-8" />
				<title>Login to the Daily Doodle!</title>
				<style>
				@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;700&family=Jua&display=swap');
				</style>
			</head>
			<body
				style="
				background: #423d34;
				margin: 0;
				padding: 0;
				font-family: 'Quicksand', 'sans-serif';
				"
			>
				<table
				width="100%"
				cellpadding="0"
				cellspacing="0"
				style="background: #423d34; min-height: 100vh"
				>
				<tr>
					<td align="center">
					<table
						width="100%"
						cellpadding="0"
						cellspacing="0"
						style="
						max-width: 420px;
						margin: 40px auto;
						background: #f5f4f0;
						border-radius: 24px;
						border: 2px solid #d4cfc1;
						box-shadow: 4px 4px 0 0 #d4cfc1;
						font-family: 'Quicksand', 'sans-serif';
						"
					>
						<tr>
						<td style="padding: 32px 32px 16px 32px">
							<!-- Logo -->
							<div style="text-align: center; margin-bottom: 20px">
							<img
								src="https://daily-doodle.app/logo.png"
								alt="Daily Doodle Logo"
								width="64"
								height="64"
								style="
								display: block;
								margin: 0 auto;
								border-radius: 50%;
								background: #edeae1;
								border: 2px solid #d4cfc1;
								"
							/>
							</div>
							<!-- Banner -->
							<div
							style="
								color: #635d4d;
								font-weight: bold;
								border-radius: 16px;
								padding: 12px 0;
								text-align: center;
								margin-bottom: 24px;
								font-size: 16px;
								font-family: 'Quicksand', 'sans-serif';
							"
							>
							Log in to the Daily Doodle!
							</div>
							<!-- Button -->
							<div style="text-align: center; margin-bottom: 24px">
							<a
								href="%s"
								style="
								display: inline-block;
								background: #635d4d;
								color: #fff;
								font-weight: bold;
								font-size: 16px;
								padding: 12px 32px;
								border-radius: 16px;
								text-decoration: none;
								font-family: 'Quicksand', 'sans-serif';
								"
								>Log in</a
							>
							</div>
							<div
							style="
								background: #d4cfc1;
								color: #635d4d;
								font-weight: bold;
								border-radius: 12px;
								padding: 8px 0;
								text-align: center;
								font-size: 14px;
								margin-bottom: 24px;
								font-family: 'Quicksand', 'sans-serif';
							"
							>
							This link will expire in 1 hour.
							</div>
							<p
							style="
								font-size: 10px;
								color: #635d4d;
								text-align: center;
								margin: 0;
								font-family: 'Quicksand', 'sans-serif';
							"
							>
							If you didn't request this verification, you can safely ignore
							this email.
							</p>
						</td>
						</tr>
					</table>
					</td>
				</tr>
				</table>
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
