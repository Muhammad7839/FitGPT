import os
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _validate_header_safe_email(to_email: str) -> str:
    """Reject any email containing CR/LF/NUL to prevent SMTP header injection.

    Pydantic's EmailStr already blocks these at the API layer — this is
    defense-in-depth for any direct caller.
    """
    if any(ch in to_email for ch in ("\r", "\n", "\0")):
        raise ValueError("Email address contains illegal control characters")
    return to_email


def send_password_reset_email(to_email: str, token: str) -> None:
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        logger.warning(
            "GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set — skipping password reset email to %s",
            to_email,
        )
        return

    to_email = _validate_header_safe_email(to_email)
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    html_body = f"""\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6c5ce7,#a363d9);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">FitGPT</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Reset Your Password</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a68;">
                We received a request to reset the password for your FitGPT account.
                Click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="{reset_link}"
                       style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6c5ce7,#a363d9);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#8888a2;">
                This link will expire in <strong>1 hour</strong>. If you did not request a
                password reset, you can safely ignore this email.
              </p>
              <hr style="border:none;border-top:1px solid #ebebf0;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#b0b0c0;">
                If the button above doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#6c5ce7;word-break:break-all;">
                {reset_link}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafc;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#b0b0c0;">
                &copy; 2026 FitGPT &mdash; Your AI-powered style assistant
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your FitGPT password"
    msg["From"] = f"FitGPT <{GMAIL_ADDRESS}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, to_email, msg.as_string())

    logger.info("Password reset email sent to %s", to_email)


def send_verification_email(to_email: str, token: str) -> None:
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        logger.warning(
            "GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set — skipping verification email to %s",
            to_email,
        )
        return

    to_email = _validate_header_safe_email(to_email)
    verification_link = f"{FRONTEND_URL}/verify-email?token={token}"

    html_body = f"""\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#6c5ce7,#a363d9);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">FitGPT</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Verify Your Email</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a68;">
                Confirm this email address to finish setting up your FitGPT account.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="{verification_link}"
                       style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6c5ce7,#a363d9);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#8888a2;">
                This link will expire in 24 hours.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#6c5ce7;word-break:break-all;">
                {verification_link}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your FitGPT email"
    msg["From"] = f"FitGPT <{GMAIL_ADDRESS}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, to_email, msg.as_string())

    logger.info("Verification email sent to %s", to_email)
