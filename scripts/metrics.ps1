param([string]$BaseRef = 'final', [string]$TargetRef = 'HEAD', [string]$Output = 'docs/metrics')
$ErrorActionPreference = 'Stop'
$metricsRoot = Split-Path -Parent $PSScriptRoot
Push-Location $metricsRoot
try {
  $metricsBase = git rev-parse --verify ($BaseRef + '^{commit}')
  if ($LASTEXITCODE -ne 0) { throw 'Invalid baseline commit' }
  $metricsTarget = git rev-parse --verify ($TargetRef + '^{commit}')
  if ($LASTEXITCODE -ne 0) { throw 'Invalid target commit' }
  $metricsDirectory = Join-Path $metricsRoot ('.cache/metrics-' + $metricsBase + '-' + $metricsTarget)
  New-Item -ItemType Directory -Path $metricsDirectory -Force | Out-Null
  foreach ($metricsVersion in @('base', 'target')) {
    $metricsCommit = if ($metricsVersion -eq 'base') { $metricsBase } else { $metricsTarget }
    $metricsArchive = Join-Path $metricsDirectory ($metricsVersion + '.zip')
    git archive --format=zip --output=$metricsArchive $metricsCommit
    if ($LASTEXITCODE -ne 0) { throw 'Cannot export history snapshot' }
    Expand-Archive -LiteralPath $metricsArchive -DestinationPath (Join-Path $metricsDirectory $metricsVersion) -Force
  }
  node scripts/metrics.mjs $metricsDirectory $metricsBase $metricsTarget $BaseRef $TargetRef $Output
  if ($LASTEXITCODE -ne 0) { throw 'Metrics generation failed' }
} finally { Pop-Location }
