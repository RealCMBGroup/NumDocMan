Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'scripts\numdocman-common.ps1')

function Get-FallbackTrackedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Role,
        [Parameter(Mandatory = $true)][int]$Port
    )

    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $listener) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $null
    }

    $requiredTokens = if ($Role -eq 'frontend') {
        @('vite.js', '--mode runtime', '--port 9500', 'NumDocMan\frontend')
    }
    else {
        @('-m uvicorn', 'server:app', '--port 9501')
    }

    foreach ($token in $requiredTokens) {
        if ($process.CommandLine -notlike "*$token*") {
            return $null
        }
    }

    return [pscustomobject]@{
        role = $Role
        pid = [int]$process.ProcessId
        parentPid = [int]$process.ParentProcessId
        executablePath = $process.ExecutablePath
        commandLine = $process.CommandLine
        creationDate = $process.CreationDate
        commandLineMustContain = $requiredTokens
    }
}

$context = Get-NumDocManContext
$state = Read-NumDocManState -Context $context

$trackedProcesses = @()
if ($null -ne $state) {
    $trackedProcesses = @($state.frontend, $state.backend) | Where-Object { $null -ne $_ }
}
else {
    $trackedProcesses = @(
        Get-FallbackTrackedProcess -Role 'frontend' -Port $context.FrontendPort
        Get-FallbackTrackedProcess -Role 'backend' -Port $context.BackendPort
    ) | Where-Object { $null -ne $_ }
}

if ($trackedProcesses.Count -eq 0) {
    Write-Host 'No tracked application state found and no matching NumDocMan listener processes were discovered. Nothing to stop.'
    exit 0
}

$stoppedAny = $false
foreach ($tracked in $trackedProcesses) {
    if (Stop-TrackedProcessTree -TrackedProcess $tracked) {
        Write-Host "Stopped $($tracked.role) process tree rooted at PID $($tracked.pid)."
        $stoppedAny = $true
    }
    else {
        Write-Host "Skipped $($tracked.role): process is no longer running or no longer matches the tracked command."
    }
}

Remove-NumDocManState -Context $context

if (Test-Path -LiteralPath $context.FrontendRuntimeEnvPath) {
    Remove-Item -LiteralPath $context.FrontendRuntimeEnvPath -Force
}

if (-not $stoppedAny) {
    Write-Host 'No tracked processes were running.'
}