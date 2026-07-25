# 📱 PM Skills — Apple Shortcuts

Put the library in every iPhone/iPad/Mac share sheet and in Siri. Shortcuts can't
be shipped as files in a repo (Apple requires signed/iCloud-shared shortcuts), so
this is a 3-minute build-it-yourself recipe against the public REST API — plus an
owner step to publish the iCloud link so everyone else gets one-tap install.

## Shortcut 1 — "Find a Skill" (no key needed)

1. New Shortcut → add **Ask for Input** (Text, prompt: "What do you need to do?")
2. **Get Contents of URL**:
   `https://pm-skills-mcp.pm-claude-skills.workers.dev/v1/search?q=[Provided Input]`
   (Insert the variable into the URL; method GET.)
3. **Get Dictionary from Input** → **Get Dictionary Value** `skills`
4. **Repeat with Each** → **Get Dictionary Value** `name` and `description` →
   **Add to Variable** `Results`
5. **Choose from List** (`Results`) → **Get Contents of URL**:
   `https://pm-skills-mcp.pm-claude-skills.workers.dev/v1/skills/[Chosen Item]?format=md`
6. **Quick Look** (read it) or **Copy to Clipboard** (paste into any AI app).

Say "Hey Siri, Find a Skill" and it runs hands-free.

## Shortcut 2 — "Run a Skill" (your Anthropic key)

Same start as above, then instead of Quick Look:

1. **Get Contents of URL** → `https://api.anthropic.com/v1/messages`, method POST,
   headers `x-api-key: <your key>`, `anthropic-version: 2023-06-01`,
   `content-type: application/json`; request body JSON:
   ```json
   { "model": "claude-sonnet-4-6", "max_tokens": 2000,
     "system": "[Skill markdown from step above]",
     "messages": [{ "role": "user", "content": "[Share-sheet input or Ask for Input]" }] }
   ```
2. **Get Dictionary Value** `content` → first item → `text` → **Quick Look**.
3. In the shortcut's settings enable **Show in Share Sheet** (accepts Text) — now any
   selected text, email, or note can be sent through a skill from the share button.

Your key lives inside your own shortcut on your own device — the worker never sees it.

## Owner step — publish one-tap installs

Build the two shortcuts once, then Share → **Copy iCloud Link** and add the links
here and to the README. That turns this recipe page into one-tap installs.
