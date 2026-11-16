# Free GitHub Pages hosting

The static build needs no paid server or API key. GitHub Pages is available free for public repositories; check the account plan before enabling it on a private repository. Making a private repository public is a separate user decision.

1. Repository Settings → Pages → Build and deployment → Source: GitHub Actions.
2. Actions → Publish GitHub Pages → Run workflow on main.
3. Wait for successful build/deploy; use the URL reported by the deployment job.
4. Run acceptance checks on the deployed site: article/cards/slides, mobile editor, reload persistence, local-model download/cancel, HTML export offline, PDF fonts and text.

Expected default URL: https://ahmed-ba11.github.io/Takwin/ (not a claim of successful deployment).

Workflow is manual so unverified changes do not auto-publish. It installs locked dependencies with package lifecycle scripts disabled: the app uses browser WASM, not ONNX's native Node GPU installer. `npm run build` bundles the worker and WASM into dist; only dist is published. Source references, raw font files, tests and local artifacts are excluded.

## Local model status

An opt-in worker runs Qwen2.5-0.5B-Instruct through Transformers.js using WASM. Model assets download from Hugging Face; entered text is sent only to the local worker. The browser can cache assets for subsequent use. Initial download may use hundreds of megabytes, and low-memory phones may fail. Cancel terminates the worker. Failure leaves content intact. The source always remains available for review.

Model inference quality has NOT yet been validated in this environment: outbound Hugging Face access is blocked by its restricted network policy. Treat this path as experimental until a real Arabic inference and quality review pass. It never silently falls back to a remote AI API.

## Environment unblock

Saved network draft additions: huggingface.co, *.hf.co, api.github.com, ahmed-ba11.github.io. Save/review and publish the environment configuration to apply them; a draft alone does not change the runtime. Git push works already, but GitHub API and live-site verification were blocked by 403 responses.
