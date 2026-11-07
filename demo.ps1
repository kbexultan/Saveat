<#
SAVEAT demo environment (see DEMO_ENVIRONMENT.md).

  .\demo.ps1            # = start: database, migrations, seed, backend on :8001
  .\demo.ps1 seed       # create missing demo rows (safe to repeat)
  .\demo.ps1 check      # verify links, stock and images
  .\demo.ps1 reset      # restore the initial demo state (manual only)
  .\demo.ps1 stop       # stop the demo database, data is kept

The backend runs against the local demo database only for this process;
backend/.env and the production database are not changed.
#>
param(
    [ValidateSet("start", "seed", "check", "reset", "stop")]
    [string]$Command = "start"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$compose = Join-Path $root "docker-compose.demo.yml"

$env:DATABASE_URL = "postgresql+psycopg://saveat_demo:saveat_demo@127.0.0.1:54330/saveat_demo"
$env:DEMO_OFFERS_AUTO_RENEW = "true"

function Invoke-Checked([scriptblock]$Block) {
    & $Block
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Command -eq "stop") {
    Invoke-Checked { docker compose -f $compose stop }
    exit 0
}

Invoke-Checked { docker compose -f $compose up -d --wait }

Push-Location (Join-Path $root "backend")
try {
    Invoke-Checked { uv run alembic upgrade head }

    switch ($Command) {
        "start" {
            Invoke-Checked { uv run python -m scripts.demo_env seed }
            uv run uvicorn app.main:app --reload --port 8001
        }
        "seed"  { Invoke-Checked { uv run python -m scripts.demo_env seed } }
        "check" { Invoke-Checked { uv run python -m scripts.demo_env check --images } }
        "reset" { Invoke-Checked { uv run python -m scripts.demo_env reset } }
    }
}
finally {
    Pop-Location
}
