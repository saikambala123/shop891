# Email setup — real password-reset emails (SMTP)

The "Forgot password?" flow emails a real 6-digit verification code to the
user's inbox. Codes are sent over SMTP and are **never** shown in the UI.

Until the SMTP account below is configured, requesting a code honestly
answers: *"We couldn't send a reset code right now — email delivery isn't
set up on the server."*

## 1. Create a Gmail App Password (one time, ~2 minutes)

Gmail no longer accepts your normal password from apps — you need a
16-character **App Password**:

1. Go to <https://myaccount.google.com/security> and make sure
   **2-Step Verification** is turned ON for `saikambala111@gmail.com`.
2. Open <https://myaccount.google.com/apppasswords>.
3. Name it (e.g. "shop-891") and click **Create**.
4. Copy the 16-character password it shows (`abcd efgh ijkl mnop`).

## 2. Configure the environment

### Local development (`/home/z/my-project/.env`)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=saikambala111@gmail.com
SMTP_PASS=abcd efgh ijkl mnop   # paste your App Password here (spaces are fine)
```

Restart the dev server after saving.

### Production (Vercel — shop891.vercel.app)

```bash
vercel env add SMTP_HOST production        # smtp.gmail.com
vercel env add SMTP_PORT production        # 465
vercel env add SMTP_USER production        # saikambala111@gmail.com
vercel env add SMTP_PASS production        # your App Password
vercel deploy                               # env changes need a redeploy
```

(Or paste the four values in the Vercel dashboard → your project →
Settings → Environment Variables, then **Redeploy**.)

## 3. Verify

1. Open the store → **Sign in → Forgot password?**
2. Enter a registered account email (e.g. `aarav@example.com`).
3. The 6-digit code arrives in that inbox within a few seconds, subject:
   `123456 is your shop-891 password reset code`.
4. Enter the code + a new password → sign in with it.

## Notes

- Codes expire after **10 minutes**; one code request per email per minute.
- The code is stored **bcrypt-hashed** — even a database leak reveals nothing.
- Any SMTP provider works (Brevo, SMTP2GO, SES…): just change `SMTP_HOST`
  / `SMTP_PORT` / credentials. `SMTP_PORT=465` uses implicit TLS;
  anything else falls back to STARTTLS.
- Gmail allows ~500 sent mails/day per account — far beyond what a reset
  flow needs.
