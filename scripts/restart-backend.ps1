$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$apiRoot = Join-Path $root 'api'
$apiEntry = Join-Path $apiRoot 'dist/main.js'
$logRoot = Join-Path $root 'tmp/dev-backend'
$apiHealthUrl = 'http://127.0.0.1:3004/api/v1/health'
$agentHealthUrl = 'http://127.0.0.1:8000/agent/health'
$web = 'http://localhost:5175'
$commit = (& git -C $root rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not read the checkout commit.' }
$dirty = [bool](& git -C $root status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Could not read the checkout status.' }
$node = Get-Command node -CommandType Application | Select-Object -First 1 -ExpandProperty Source
$npm = Get-Command npm.cmd -CommandType Application | Select-Object -First 1 -ExpandProperty Source
$python = $env:PYTHON
if (-not $python) {
    $venvPython = Join-Path $root '.venv/Scripts/python.exe'
    $python = if (Test-Path -LiteralPath $venvPython) { $venvPython } else {
        Get-Command python -CommandType Application | Select-Object -First 1 -ExpandProperty Source
    }
}

function Read-Health($url) {
    Invoke-RestMethod -Uri $url -TimeoutSec 4
}

function Listener-Ids($port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
}

function Find-Backend($port, $name, $command, $url) {
    $ids = @(Listener-Ids $port)
    if ($ids.Count -eq 0) { return }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($ids[0])"
    if ($ids.Count -ne 1 -or $process.Name -notmatch $name -or $process.CommandLine -notmatch $command) {
        throw "Port $port is occupied by an unrecognized process (PID $($ids -join ', '))."
    }
    $health = Read-Health $url
    if ($health.status -ne 'ok' -or ($port -eq 3004 -and $health.database -ne 'connected') -or
        ($port -eq 8000 -and $health.agents -notcontains 'course_action')) {
        throw "Port $port did not identify itself as a Course Radar backend."
    }
    Get-Process -Id $process.ProcessId
}

function Stop-Backend($process, $port) {
    if ($process) {
        $process.Refresh()
        if (-not $process.HasExited) {
            Write-Host "Stopping port $port (PID $($process.Id))."
            Stop-Process -InputObject $process
            if (-not $process.WaitForExit(10000)) { throw "PID $($process.Id) did not stop." }
        }
    }
    if (@(Listener-Ids $port).Count -gt 0) { throw "Port $port is still occupied." }
}

function Wait-Backend($process, $label, $url) {
    $deadline = (Get-Date).AddSeconds(60)
    do {
        $process.Refresh()
        if ($process.HasExited) { throw "$label exited ($($process.ExitCode)). See $logRoot/$label.err.log." }
        try { $health = Read-Health $url } catch { $health = $null }
        if ($health.status -eq 'ok' -and $health.pid) {
            $worker = Get-CimInstance Win32_Process -Filter "ProcessId = $($health.pid)"
            if ($health.pid -ne $process.Id -and $worker.ParentProcessId -ne $process.Id) {
                throw "$label health came from a different process."
            }
            if ($health.git.commit -ne $commit -or $health.git.dirty -ne $dirty -or -not $health.processStartedAt) {
                throw "$label health did not identify this checkout."
            }
            $health | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $logRoot "$label.health.json") -Encoding utf8
            return $health
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    throw "$label did not become healthy. See $logRoot/$label.err.log."
}

$oldApi = Find-Backend 3004 '^node\.exe$' ('(?:^|\s)"?(?:dist[\\/]main\.js|' + [regex]::Escape($apiEntry) + ')"?(?:\s|$)') $apiHealthUrl
$oldAgent = Find-Backend 8000 '^python(?:[\d.]*)\.exe$' '(?:^|\s)-m\s+uvicorn\s+agent_service\.server:app(?:\s|$)' $agentHealthUrl
$frontendIds = @(Listener-Ids 5175)
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

# Windows locks the existing Prisma engine when the generated client needs replacing.
$checkClients = @'
const { clientCurrent } = require('./scripts/generate-clients.cjs');
process.exit(clientCurrent('prisma/schema.prisma', 'node_modules/.prisma/client') &&
             clientCurrent('users/schema.prisma', 'generated/users') ? 0 : 1);
'@
Push-Location $apiRoot
try {
    $checkClients | & $node -
    $clientsCurrent = $LASTEXITCODE -eq 0
} finally { Pop-Location }
if (-not $clientsCurrent) { Stop-Backend $oldApi 3004 }
& $npm --prefix $apiRoot run build
if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }

Stop-Backend $oldApi 3004
$env:PORT = '3004'
$env:WEB_ORIGIN = "$web,http://127.0.0.1:5175"
$env:AUTH_WEB_ORIGIN = $web
$apiProcess = Start-Process -FilePath $node -ArgumentList ('"' + $apiEntry + '"') -WorkingDirectory $apiRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logRoot 'api.out.log') -RedirectStandardError (Join-Path $logRoot 'api.err.log')
$apiHealth = Wait-Backend $apiProcess 'api' $apiHealthUrl

Stop-Backend $oldAgent 8000
$env:KIMI_AUTH_URL = 'http://127.0.0.1:3004/api/v1/auth/me'
$env:COURSE_RADAR_API_URL = 'http://127.0.0.1:3004/api/v1'
$agentProcess = Start-Process -FilePath $python -ArgumentList @('-m', 'uvicorn', 'agent_service.server:app', '--host', '127.0.0.1', '--port', '8000') `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'agent.out.log') `
    -RedirectStandardError (Join-Path $logRoot 'agent.err.log')
$agentHealth = Wait-Backend $agentProcess 'agent' $agentHealthUrl

foreach ($field in @('programDataVersion', 'scheduleTerms')) {
    if ((ConvertTo-Json -InputObject $apiHealth.$field -Compress) -ne (ConvertTo-Json -InputObject $agentHealth.$field -Compress)) {
        throw "API and agent disagree on $field. See health reports in $logRoot."
    }
}

if ($frontendIds.Count) {
    $proxiedApi = Read-Health 'http://127.0.0.1:5175/api/v1/health'
    $proxiedAgent = Read-Health 'http://127.0.0.1:5175/api/v1/agent/health'
    if ($proxiedApi.pid -ne $apiHealth.pid -or $proxiedAgent.pid -ne $agentHealth.pid -or
        ($frontendIds -join ',') -ne (@(Listener-Ids 5175) -join ',')) { throw 'The existing 5175 frontend did not proxy the restarted processes.' }
    Write-Host "Frontend 5175 (PID $($frontendIds -join ', ')) is serving the new backends."
} else { Write-Host 'Frontend port 5175 has no listener.' }

Write-Host "API 3004 (PID $($apiHealth.pid), started $($apiHealth.processStartedAt))."
Write-Host "Agent 8000 (PID $($agentHealth.pid), started $($agentHealth.processStartedAt))."
Write-Host "Checkout $commit (dirty: $dirty). Versions and term dates are in $logRoot/*.health.json."
