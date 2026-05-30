Check deployment readiness for the Vexa project.

Perform these checks:
1. Verify Docker images can build: `docker compose build --dry-run` (or check Dockerfiles exist)
2. Verify Helm chart is valid: `helm lint deploy/helm/vexa/`
3. Check for uncommitted changes: `git status --short`
4. Check current stage: `python3 tests3/lib/stage.py probe`

Summarize readiness status and any blockers.
