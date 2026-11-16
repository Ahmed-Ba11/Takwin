# Free GitHub Pages hosting

The static build needs no paid server or API key. GitHub Pages is available free for public repositories; check the account plan before enabling it on a private repository. Making a private repository public is a separate user decision.

1. Repository Settings → Pages → Build and deployment → Source: GitHub Actions.
2. Actions → Publish GitHub Pages → Run workflow on main.
3. Wait for successful build/deploy; use the URL reported by the deployment job.
4. Run acceptance checks on the deployed site: article/cards/slides, mobile editor, reload persistence, HTML export offline, PDF fonts and text.

Expected default URL: https://ahmed-ba11.github.io/Takwin/ (not a claim of successful deployment).

Workflow is manual so changes do not auto-publish. `npm run build` copies the five static application files into dist; only dist is published. No npm dependencies, inference runtime, model downloads or Hugging Face access are required. Source references, raw font files, tests and local artifacts are excluded.

The user removed AI from the product scope. Network access to GitHub API/live hosting may still be needed to execute and verify deployment from the cloud environment. No deployment is implied by a code push.
