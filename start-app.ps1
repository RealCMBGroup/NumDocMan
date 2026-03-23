Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'scripts\numdocman-common.ps1')

$context = Get-NumDocManContext
Ensure-NumDocManDirectories -Context $context

function New-NumDocManVenv {
    $candidates = @()

    $pyLauncher = Get-CommandPathOrNull -Name 'py'
    if ($pyLauncher) {
        foreach ($version in @('3.11', '3.12', '3.13', '3')) {
            $candidates += [pscustomobject]@{
                FilePath = $pyLauncher
                Arguments = @("-$version", '-m', 'venv', $context.VenvDir)
            }
        }
    }

    $python = Get-CommandPathOrNull -Name 'python'
    if ($python) {
        $candidates += [pscustomobject]@{
            FilePath = $python
            Arguments = @('-m', 'venv', $context.VenvDir)
        }
    }

    if ($candidates.Count -eq 0) {
        throw 'Neither py nor python is available. Install Python 3 before starting the application.'
    }

    $lastError = $null
    foreach ($candidate in $candidates) {
        try {
            Invoke-ExternalCommand -FilePath $candidate.FilePath -Arguments $candidate.Arguments -WorkingDirectory $context.WorkspaceRoot
            return
        }
        catch {
            $lastError = $_
            if (Test-Path -LiteralPath $context.VenvDir) {
                Remove-Item -LiteralPath $context.VenvDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }

    throw $lastError
}

function Get-VenvPythonVersion {
    if (-not (Test-Path -LiteralPath $context.PythonExe)) {
        return $null
    }

    $versionText = & $context.PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return $versionText.Trim()
}

function Test-BackendDependenciesInstalled {
    if (-not (Test-Path -LiteralPath $context.PythonExe)) {
        return $false
    }

    & $context.PythonExe -c "import aiosqlite, fastapi, uvicorn" | Out-Null
    return ($LASTEXITCODE -eq 0)
}

$state = Read-NumDocManState -Context $context
if ($null -ne $state) {
    $backendRunning = $null -ne (Test-TrackedProcess -TrackedProcess $state.backend)
    $frontendRunning = $null -ne (Test-TrackedProcess -TrackedProcess $state.frontend)
    if ($backendRunning -or $frontendRunning) {
        Write-Host "Application already running. Frontend: $($context.FrontendUrl) | Backend: $($context.BackendUrl)"
        exit 0
    }

    Remove-NumDocManState -Context $context
}

$backendDependenciesInstalled = Test-BackendDependenciesInstalled
$venvVersionText = Get-VenvPythonVersion
$needsVenvRebuild = $false
if ($venvVersionText) {
    try {
        $venvVersion = [version]$venvVersionText
        if (-not $backendDependenciesInstalled -and $venvVersion -ge [version]'3.14') {
            $needsVenvRebuild = $true
        }
    }
    catch {
        $needsVenvRebuild = $false
    }
}

$createdVenv = $false
if ($needsVenvRebuild -and (Test-Path -LiteralPath $context.VenvDir)) {
    Write-Host "Recreating backend/.venv with a Python version compatible with backend dependencies..."
    Remove-Item -LiteralPath $context.VenvDir -Recurse -Force
}

Assert-PortAvailable -Port $context.FrontendPort -Purpose 'frontend'
Assert-PortAvailable -Port $context.BackendPort -Purpose 'backend'

if (-not (Test-Path -LiteralPath $context.PythonExe)) {
    Write-Host 'Creating Python virtual environment in backend/.venv...'
    New-NumDocManVenv
    $createdVenv = $true
    $backendDependenciesInstalled = $false
}

if (-not (Test-Path -LiteralPath (Join-Path $context.FrontendDir 'node_modules'))) {
    if (-not (Get-CommandPathOrNull -Name 'corepack')) {
        throw 'corepack is not available. Install Node.js with Corepack support before starting the application.'
    }

    Write-Host 'Installing frontend dependencies with corepack yarn install...'
    Invoke-ExternalCommand -FilePath 'corepack' -Arguments @('yarn', 'install') -WorkingDirectory $context.FrontendDir
}

if ($createdVenv -or -not $backendDependenciesInstalled) {
    Write-Host 'Installing backend dependencies into backend/.venv...'
    Invoke-ExternalCommand -FilePath $context.PythonExe -Arguments @('-m', 'pip', 'install', '--upgrade', 'pip') -WorkingDirectory $context.BackendDir
    Invoke-ExternalCommand -FilePath $context.PythonExe -Arguments @('-m', 'pip', 'install', '-r', 'requirements.txt') -WorkingDirectory $context.BackendDir
}

@(
    'VITE_BACKEND_URL=' + $context.BackendUrl,
    'REACT_APP_BACKEND_URL=' + $context.BackendUrl
) | Set-Content -LiteralPath $context.FrontendRuntimeEnvPath -Encoding UTF8

$backendProcess = $null
$frontendProcess = $null

try {
    Write-Host "Starting backend on port $($context.BackendPort)..."
    $backendStartInfo = @{
        FilePath = $context.PythonExe
        ArgumentList = @('-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', "$($context.BackendPort)")
        WorkingDirectory = $context.BackendDir
        RedirectStandardOutput = $context.BackendLog
        RedirectStandardError = $context.BackendErrorLog
        PassThru = $true
    }
    $backendProcess = Start-Process @backendStartInfo

    Wait-HttpReady -Url $context.BackendHealthUrl -Name 'Backend API'

    Write-Host "Starting frontend on port $($context.FrontendPort)..."
    $frontendStartInfo = @{
        FilePath = 'cmd.exe'
        ArgumentList = @('/c', 'corepack yarn dev --mode runtime --host 127.0.0.1 --port 9500 --strictPort')
        WorkingDirectory = $context.FrontendDir
        RedirectStandardOutput = $context.FrontendLog
        RedirectStandardError = $context.FrontendErrorLog
        PassThru = $true
    }
    $frontendProcess = Start-Process @frontendStartInfo

    Wait-HttpReady -Url $context.FrontendUrl -Name 'Frontend app'

    $runtimeState = [pscustomobject]@{
        startedAt = (Get-Date).ToString('o')
        frontend = Get-TrackedProcessSnapshot -ProcessId $frontendProcess.Id -Role 'frontend' -CommandLineMustContain @('corepack', 'yarn dev', '--port 9500')
        backend = Get-TrackedProcessSnapshot -ProcessId $backendProcess.Id -Role 'backend' -CommandLineMustContain @('uvicorn', 'server:app', '--port 9501')
    }

    Write-NumDocManState -Context $context -State $runtimeState

    Write-Host "Application started successfully."
    Write-Host "Frontend: $($context.FrontendUrl)"
    Write-Host "Backend:  $($context.BackendUrl)"
    Write-Host "Logs:     $($context.LogsDir)"
}
catch {
    if ($frontendProcess) {
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }

    Remove-NumDocManState -Context $context
    throw
}