# KliekNet Skill Storage Convention

Where every KliekNet skill must live, and how to register it. Follow this whenever
you create or update a skill for Gustav — don't invent a different location.

## Canonical location

- **Repo:** `https://github.com/gustavzietsman-hash/klieknet-dashboard`
- **Skills root:** `skills/`
- **One folder per skill:** `skills/<skill-name>/SKILL.md` (+ `references/`,
  `assets/`, `scripts/` as needed).
  - This skill → `skills/klieknet-brand/`
  - Existing example → `skills/claude-code-launch/`

## Registering a skill in the local launcher

The repo serves a skills launcher at `http://localhost:3000/skills.html`. After
adding a skill folder, register it there so it shows in the list. Add an entry
matching the page's existing card pattern, e.g.:

```html
<a class="skill-card" href="skills/klieknet-brand/SKILL.md">
  <span class="skill-name">klieknet-brand</span>
  <span class="skill-desc">Full KliekNet brand system — colours, logo, type, components, proposals.</span>
</a>
```

(Match whatever markup `skills.html` already uses; mirror an existing card.)

## Committing

From the repo root:

```bash
# place the folder at skills/<skill-name>/ first, then:
git add skills/<skill-name> skills.html
git commit -m "feat(skills): add <skill-name> skill"
git push origin main
```

For this brand skill specifically:

```bash
git add skills/klieknet-brand skills.html
git commit -m "feat(skills): add klieknet-brand brand system skill"
git push origin main
```

## Note for Claude

You cannot push to Gustav's private repo or reach `localhost:3000` from a sandbox —
those actions happen on his machine (best via Claude Code in the repo). When you
finish authoring a skill, hand him the ready folder plus these exact commands and
the `skills.html` snippet, rather than claiming it was pushed.
