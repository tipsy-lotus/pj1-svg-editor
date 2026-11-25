$ErrorActionPreference = 'Stop'
$replayRoot = Split-Path -Parent $PSScriptRoot
$replayArchive = Join-Path $replayRoot '.cache/phase1-baseline.zip'
$replayBaseline = Join-Path $replayRoot '.cache/phase1-baseline'
$replayEvidence = Join-Path $replayRoot '.cache/shape-compatibility'
$replayUtf8 = [System.Text.UTF8Encoding]::new($false)

Push-Location $replayRoot
try {
  New-Item -ItemType Directory -Path $replayEvidence -Force | Out-Null
  git archive --format=zip --output=$replayArchive final
  if ($LASTEXITCODE -ne 0) { throw 'Cannot export final baseline' }
  Expand-Archive -LiteralPath $replayArchive -DestinationPath $replayBaseline -Force
  node ./node_modules/typescript/bin/tsc -p (Join-Path $replayBaseline 'tsconfig.json')
  if ($LASTEXITCODE -ne 0) { throw 'Baseline build failed' }
  npm.cmd run build --silent
  if ($LASTEXITCODE -ne 0) { throw 'Current build failed' }
  $replayEntries = @{
    baseline = Join-Path $replayBaseline 'dist/src/main.js'
    current = Join-Path $replayRoot 'dist/src/main.js'
  }

  foreach ($replayMode in @('baseline', 'current')) {
    $replayWork = Join-Path $replayEvidence $replayMode
    New-Item -ItemType Directory -Path (Join-Path $replayWork 'examples') -Force | Out-Null
    Copy-Item -LiteralPath 'examples/import-example.svg' -Destination (Join-Path $replayWork 'examples/import-example.svg')
    foreach ($replaySession in @('basic-session', 'flowchart')) {
      $replayStart = [System.Diagnostics.ProcessStartInfo]::new()
      $replayStart.FileName = (Get-Command node).Source
      $replayStart.Arguments = '"' + $replayEntries[$replayMode] + '"'
      $replayStart.WorkingDirectory = $replayWork
      $replayStart.UseShellExecute = $false
      $replayStart.CreateNoWindow = $true
      $replayStart.RedirectStandardInput = $true
      $replayStart.RedirectStandardOutput = $true
      $replayStart.RedirectStandardError = $true
      $replayStart.StandardOutputEncoding = $replayUtf8
      $replayStart.StandardErrorEncoding = $replayUtf8
      $replayProcess = [System.Diagnostics.Process]::Start($replayStart)
      try {
        $replayInput = 'help' + "`n" + [System.IO.File]::ReadAllText((Join-Path $replayRoot ('examples/' + $replaySession + '.cli')))
        $replayBytes = $replayUtf8.GetBytes($replayInput)
        $replayProcess.StandardInput.BaseStream.Write($replayBytes, 0, $replayBytes.Length)
        $replayProcess.StandardInput.Close()
        $replayOutput = $replayProcess.StandardOutput.ReadToEnd()
        $replayErrors = $replayProcess.StandardError.ReadToEnd()
        $replayProcess.WaitForExit()
        if ($replayProcess.ExitCode -ne 0 -or $replayErrors) {
          throw ('Replay failed: ' + $replayMode + '/' + $replaySession + ' ' + $replayErrors)
        }
        [System.IO.File]::WriteAllText((Join-Path $replayEvidence ($replayMode + '-' + $replaySession + '.txt')), $replayOutput, $replayUtf8)
      } finally { $replayProcess.Dispose() }
    }
  }
  foreach ($replaySession in @('basic-session', 'flowchart')) {
    $replayOld = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $replayEvidence ('baseline-' + $replaySession + '.txt'))))
    $replayNew = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $replayEvidence ('current-' + $replaySession + '.txt'))))
    if ($replayOld -ne $replayNew) { throw ('Output mismatch: ' + $replaySession) }
    Write-Output ($replaySession + ': identical output bytes')
  }
  foreach ($replaySvg in @('demo.svg', 'flowchart.svg')) {
    $replayOld = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $replayEvidence ('baseline/' + $replaySvg))))
    $replayNew = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $replayEvidence ('current/' + $replaySvg))))
    if ($replayOld -ne $replayNew) { throw ('SVG mismatch: ' + $replaySvg) }
    Write-Output ($replaySvg + ': identical SVG bytes')
  }
} finally { Pop-Location }
