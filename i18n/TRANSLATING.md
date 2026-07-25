# 🤝 Translating the library — contributor guide

The English `skills/` tree is canonical. Machine translation
([`scripts/translate-skills.mjs`](../scripts/translate-skills.mjs)) gets a language to
draft quality fast; what turns a draft into something trustworthy is a **native
speaker's review** — and that's the contribution this guide is about. You don't need
to run any code.

## Two ways to contribute

**1. Crowdin (no git required).** Once the maintainer's Crowdin project is live
(config: [`crowdin.yml`](../crowdin.yml)), pick your language, and translate or fix
strings in the editor — machine drafts pre-fill, so most work is review, not
translation. Approved strings sync back here as PRs automatically.

**2. Plain PRs (no Crowdin required).** Edit `i18n/<lang>/skills/<name>/SKILL.md`
directly. When you've reviewed a file as a native speaker, change its frontmatter:

```yaml
review: pending          →          review: "@yourhandle 2026-07-25"
```

That flag is the whole trust system — `review: pending` renders as
"machine-translated" everywhere the skill appears, a reviewed flag as
"reviewed by a native speaker".

## Rules that keep translations loadable

- **Never translate the `name:` key** — it's the routing id; CI rejects a changed one.
- Keep the section structure identical to the English source (same headings order,
  same code blocks) — `node scripts/translate-skills.mjs --check` validates this.
- Translate *meaning*, not words: rubric items and anti-patterns should sound like a
  professional wrote them in your language. Terms of art (OKR, churn, postmortem) stay
  in whatever form your industry actually uses.
- English source changed after your translation? The file is *stale* —
  `node scripts/i18n-status.mjs --lang <yours>` lists coverage, pending reviews, and
  stale files.

## Adding a whole language

One line in the `LANGS` map of `scripts/translate-skills.mjs`, then a machine pass
(`--lang xx`) to draft it — or start from zero via Crowdin. Open an issue first if
you're not sure your language code is unambiguous.

## Owner setup for Crowdin (once)

1. Create a free open-source Crowdin project; point it at this repo's `crowdin.yml`.
2. Add `CROWDIN_PROJECT_ID` and `CROWDIN_PERSONAL_TOKEN` repo secrets and enable the
   GitHub integration (sync branch → PRs).
3. Add the project link here and in `README.md` so contributors can find the editor.
