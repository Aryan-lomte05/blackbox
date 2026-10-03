# Guardian setup: alerts by Telegram, Slack, email, WhatsApp and phone call

Every channel is optional. Each one is used only once its settings are in `.env`. The outbox
(`data/outbox/<incident>/`) always keeps a copy of every message, even with nothing configured.

Total time: about 15 minutes for Telegram, Slack, email and WhatsApp. All free (Twilio on its trial credit). Phone calls are optional and off by default.

**Before you start:** if you have no `.env` yet, run `copy .env.example .env` in the repo root.
Never commit or share `.env`.
After each channel, check it:
```bash
blackbox guardian channels        # ✅ = ready
blackbox guardian test            # sends a clearly-marked TEST incident through every ready channel
```

---

## 1. Telegram (2 minutes, easiest)
1. In Telegram, search for **@BotFather** (blue tick) and open it. Press **Start**.
2. Send `/newbot`.
3. When it asks for a name, send `Black Box Alerts`.
4. When it asks for a username, send something ending in `bot`, for example `halfabyte_blackbox_bot`.
5. BotFather replies with a **token** like `7123456789:AAH...`. Put it in `.env`:
   `TELEGRAM_BOT_TOKEN=7123456789:AAH...`
6. Tap the link to your new bot (`t.me/halfabyte_blackbox_bot`) and press **Start**. The bot can only
   message people who started it.
7. Run `blackbox guardian telegram-chat-id`. It prints a line like `TELEGRAM_CHAT_ID=123456789`; copy it into `.env`.
   - For a team group instead: add the bot to the group, send any message in the group, and run the command again
     (group ids start with `-`).

## 2. Slack (3 minutes)
1. If you have no Slack workspace, create one at **slack.com/get-started** (free). Create a channel, e.g. `#agent-alerts`.
2. Go to **api.slack.com/apps** → **Create New App** → **From scratch**.
   App name `Black Box`; choose your workspace → **Create App**.
3. Open **Incoming Webhooks** in the left menu and switch **Activate Incoming Webhooks** on.
4. Click **Add New Webhook to Workspace**, pick `#agent-alerts`, and click **Allow**.
5. Copy the **Webhook URL** (`https://hooks.slack.com/services/T.../B.../...`) into `.env`:
   `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...`

## 3. Email via EmailJS (5 minutes, the default)
1. Sign up at **emailjs.com** (free: 200 emails a month).
2. **Email Services → Add New Service → Gmail** → Connect Account (allow sending) → **Create Service**.
   Copy the **Service ID** (`service_xxxxxxx`).
3. **Email Templates → Create New Template**:
   - **Subject:** `{{subject}}`
   - **To Email** (right-hand panel): `{{to_email}}`
   - **Content:** click **Edit Content → Code Editor**, delete everything, and type exactly `{{{html_message}}}`
     (three braces, so the styled HTML email is not escaped).
   - **Save**, then copy the **Template ID** (`template_xxxxxxx`).
4. **Account → General**: copy the **Public Key**. **Account → Security**: copy the **Private Key**, and tick
   **"Allow EmailJS API for non-browser applications"** (Black Box sends from Python, not a browser), then save.
5. In `.env`:
   ```
   EMAILJS_SERVICE_ID=service_xxxxxxx
   EMAILJS_TEMPLATE_ID=template_xxxxxxx
   EMAILJS_PUBLIC_KEY=...
   EMAILJS_PRIVATE_KEY=...
   ALERT_EMAIL_TO=whoever-should-receive@gmail.com
   ```
   EmailJS errors: `403 API calls are disabled for non-browser applications` → step 4's tick box;
   `422 The recipients address is empty` → the template's To Email must be `{{to_email}}`.

### Alternative: email via Gmail SMTP (4 minutes)
Gmail needs an **App Password**; your normal password will not work.
1. Open **myaccount.google.com/security** and turn on **2-Step Verification** if it is off.
2. Open **myaccount.google.com/apppasswords**. Type the app name `Black Box` and click **Create**.
3. Google shows a 16-letter password (`abcd efgh ijkl mnop`). Copy it **without the spaces**.
4. In `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourname@gmail.com
   SMTP_PASSWORD=abcdefghijklmnop
   ALERT_EMAIL_FROM=yourname@gmail.com
   ALERT_EMAIL_TO=whoever-should-receive@gmail.com
   ```
   The first test email may land in Spam; mark it "Not spam" once.
(Mailgun is an alternative to SMTP. Skip it: SMTP is enough.)

## 4. WhatsApp via Twilio (6 minutes)
1. Sign up at **twilio.com/try-twilio**. Verify your email and **your own phone number**: the number you verify is
   the one Twilio's trial can message and call.
2. In the Twilio Console home page, under **Account Info**, copy the **Account SID** and **Auth Token** into `.env`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   ```
3. Open **Messaging → Try it out → Send a WhatsApp message** (the WhatsApp Sandbox). It shows a code like
   `join silver-tiger`.
4. On your phone, send that exact text in WhatsApp to **+1 415 523 8886**. Twilio replies that you joined.
5. In `.env` (your number with country code, no spaces):
   ```
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ALERT_WHATSAPP_TO=whatsapp:+91XXXXXXXXXX
   ```
- **Before the demo:** the sandbox only delivers within 24 hours of your last message to it. Send any message
  (e.g. `hi`) to +1 415 523 8886 shortly before the pitch. If it has been 3 days, send the `join` code again.

## 5. Phone call via Twilio (optional, off by default)
Calls are opt-in: set `BLACKBOX_VOICE_CALLS=1` to enable them, and then they are placed only for **critical** incidents.
1. In the Twilio Console, open **Phone Numbers → Manage → Buy a number** (the trial gives you one free US number)
   and take any number with **Voice**. Put it in `.env`: `TWILIO_VOICE_FROM=+1XXXXXXXXXX`.
2. Allow calls to India: open **Voice → Settings → Geo permissions**, tick **India**, and save.
3. In `.env`: `ALERT_PHONE_TO=+91XXXXXXXXXX` (the number you verified at sign-up; trial accounts can only call
   verified numbers).
- A trial call first plays a short Twilio trial message and asks you to **press any key**; then Black Box reads
  the incident aloud.

---

## Check everything
```bash
blackbox guardian channels
blackbox guardian test                  # Telegram, Slack, email, WhatsApp (a call only with BLACKBOX_VOICE_CALLS=1)
blackbox guardian test --severity high  # everything except the phone call
py -3 examples/trader_bot.py --glitch   # the real demo: a trading agent glitches, Guardian alerts you
```
If a channel says `failed`, the line says why (wrong token, unverified number, Geo permission off, ...).
Settings are read from `.env`; restart `blackbox ui` after changing them.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Telegram `chat not found` | press **Start** in your bot first, then re-run `telegram-chat-id` |
| Slack `404 no_service` | the webhook was removed; add a new one (step 2.4) |
| Gmail `535 Username and Password not accepted` | use the App Password, without spaces; 2-Step Verification must be on |
| WhatsApp sent, nothing arrives | send `hi` (or the join code) to +1 415 523 8886 again: the 24-hour window closed |
| Twilio `21219 unverified` | trial accounts only reach verified numbers: Console → Phone Numbers → Verified Caller IDs |
| Call fails to India | Voice → Settings → Geo permissions → India |
