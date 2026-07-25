# 💬 PM Skills — WhatsApp bot (via Twilio)

The [Telegram bot](../telegram/)'s twin for the world's biggest messenger:

```
find churn analysis
skill executive-update
run executive-update  churn up 2pts, shipped referral, hiring paused
```

Plain text auto-routes to the best skill. Search and fetch need no key; `run`
drafts with the deployer's Anthropic key if configured.

## Set up

1. **Deploy the worker:**
   ```bash
   cd integrations/whatsapp
   npx wrangler deploy
   npx wrangler secret put ANTHROPIC_API_KEY   # optional — enables "run"
   ```
2. **Twilio side** (needs a Twilio account): Messaging → Try WhatsApp (sandbox, free,
   good for personal use) or a registered WhatsApp sender for production. Set the
   inbound webhook to your worker URL, method POST. That's the whole wiring — replies
   ride back as TwiML, so no Twilio token is ever stored in the worker.
3. Sandbox note: users must first send the join code Twilio shows (e.g.
   `join amber-lion`) to the sandbox number; production senders don't have that step.

## Privacy

Stateless — the worker stores nothing and sees only what Twilio forwards. `run`
sends message text to the Anthropic API on the deployer's key; deploy your own
rather than sharing one with people you wouldn't share a key with.
