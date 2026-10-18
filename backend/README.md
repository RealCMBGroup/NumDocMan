# Backend configuration

## Password reset emails

Set these environment variables on the backend to enable the password-reset flow:

- `SMTP_HOST`: SMTP server hostname.
- `SMTP_PORT`: SMTP server port; defaults to `587`. Port `465` uses implicit TLS.
- `SMTP_FROM`: sender address shown on reset emails.
- `FRONTEND_URL`: public base URL of the frontend, without a trailing slash.
- `SMTP_USERNAME` and `SMTP_PASSWORD`: optional SMTP credentials; set both or neither.

The backend sends a one-time reset link that expires after 30 minutes. Password reset requests fail with HTTP 503 until the required mail settings are configured.
