Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NumDocManContext {
    $workspaceRoot = Split-Path -Parent $PSScriptRoot
    $stateDir = Join-Path $workspaceRoot '.run'
    $logsDir = Join-Path $stateDir 'logs'

    return [pscustomobject]@{
        WorkspaceRoot = $workspaceRoot
        BackendDir = Join-Path $workspaceRoot 'backend'
        FrontendDir = Join-Path $workspaceRoot 'frontend'
        VenvDir = Join-Path $workspaceRoot 'backend\.venv'
        PythonExe = Join-Path $workspaceRoot 'backend\.venv\Scripts\python.exe'
        StateDir = $stateDir
        LogsDir = $logsDir
        StatePath = Join-Path $stateDir 'numdocman-state.json'
        FrontendRuntimeEnvPath = Join-Path $workspaceRoot 'frontend\.env.runtime'
        FrontendPort = 9500
        BackendPort = 9501
        FrontendUrl = 'http://127.0.0.1:9500'
        BackendUrl = 'http://127.0.0.1:9501'
        BackendHealthUrl = 'http://127.0.0.1:9501/api/health'
        BackendLog = Join-Path $logsDir 'backend.log'
        BackendErrorLog = Join-Path $logsDir 'backend.err.log'
        FrontendLog = Join-Path $logsDir 'frontend.log'
        FrontendErrorLog = Join-Path $logsDir 'frontend.err.log'
    }
}

function Ensure-NumDocManDirectories {
    param([Parameter(Mandatory = $true)]$Context)

    foreach ($path in @($Context.StateDir, $Context.LogsDir)) {
        if (-not (Test-Path -LiteralPath $path)) {
            New-Item -ItemType Directory -Path $path | Out-Null
        }
    }
}

function Get-CommandPathOrNull {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        return $null
    }

    return $command.Source
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter()][string[]]$Arguments = @(),
        [Parameter()][string]$WorkingDirectory
    )

    $previousLocation = Get-Location
    try {
        if ($WorkingDirectory) {
            Set-Location -LiteralPath $WorkingDirectory
        }

        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: ${FilePath} $($Arguments -join ' ')"
        }
    }
    finally {
        Set-Location -LiteralPath $previousLocation
    }
}

function Read-NumDocManState {
    param([Parameter(Mandatory = $true)]$Context)

    if (-not (Test-Path -LiteralPath $Context.StatePath)) {
        return $null
    }

    return Get-Content -LiteralPath $Context.StatePath -Raw | ConvertFrom-Json
}

function Write-NumDocManState {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$State
    )

    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Context.StatePath -Encoding UTF8
}

function Remove-NumDocManState {
    param([Parameter(Mandatory = $true)]$Context)

    if (Test-Path -LiteralPath $Context.StatePath) {
        Remove-Item -LiteralPath $Context.StatePath -Force
    }
}

function Get-TrackedProcessSnapshot {
    param(
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [Parameter(Mandatory = $true)][string]$Role,
        [Parameter(Mandatory = $true)][string[]]$CommandLineMustContain
    )

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
    if ($null -eq $process) {
        throw "Process $ProcessId was not found for role '$Role'."
    }

    return [pscustomobject]@{
        role = $Role
        pid = [int]$process.ProcessId
        parentPid = [int]$process.ParentProcessId
        executablePath = $process.ExecutablePath
        commandLine = $process.CommandLine
        creationDate = $process.CreationDate
        commandLineMustContain = $CommandLineMustContain
    }
}

function Test-TrackedProcess {
    param([Parameter(Mandatory = $true)]$TrackedProcess)

    $processId = [int]$TrackedProcess.pid
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $null
    }

    foreach ($token in $TrackedProcess.commandLineMustContain) {
        if ([string]::IsNullOrWhiteSpace($token)) {
            continue
        }

        if ($process.CommandLine -notlike "*$token*") {
            return $null
        }
    }

    return $process
}

function Test-PortAvailable {
    param([Parameter(Mandatory = $true)][int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -eq $listeners)
}

function Assert-PortAvailable {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$Purpose
    )

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $listener) {
        return
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $name = if ($process) { $process.Name } else { 'unknown' }
    throw "Port $Port is already in use by PID $($listener.OwningProcess) ($name). Refusing to stop or replace an unrelated process for $Purpose."
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter()][int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
            return
        }
        catch {
            Start-Sleep -Milliseconds 750
        }
    }

    throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Get-ProcessTreeIds {
    param([Parameter(Mandatory = $true)][int]$RootPid)

    $processes = Get-CimInstance Win32_Process
    $result = New-Object System.Collections.Generic.List[int]
    $queue = New-Object System.Collections.Generic.Queue[int]
    $queue.Enqueue($RootPid)

    while ($queue.Count -gt 0) {
        $currentPid = $queue.Dequeue()
        $children = $processes | Where-Object { $_.ParentProcessId -eq $currentPid }
        foreach ($child in $children) {
            $childPid = [int]$child.ProcessId
            $result.Add($childPid)
            $queue.Enqueue($childPid)
        }
    }

    return $result.ToArray()
}

function Stop-TrackedProcessTree {
    param([Parameter(Mandatory = $true)]$TrackedProcess)

    $process = Test-TrackedProcess -TrackedProcess $TrackedProcess
    if ($null -eq $process) {
        return $false
    }

    $childPids = Get-ProcessTreeIds -RootPid ([int]$TrackedProcess.pid)
    foreach ($childPid in ($childPids | Sort-Object -Descending)) {
        Stop-Process -Id $childPid -Force -ErrorAction SilentlyContinue
    }

    Stop-Process -Id ([int]$TrackedProcess.pid) -Force -ErrorAction SilentlyContinue
    return $true
}