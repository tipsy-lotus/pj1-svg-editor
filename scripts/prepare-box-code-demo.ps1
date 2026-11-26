param([string]$BaseRef = 'f544a0c')
$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $demoRoot
try {
  $demoSourceLines = git show ($BaseRef + ':src/main.ts')
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read baseline assembly' }
  $demoSource = $demoSourceLines -join "`n"
  $demoImport = "import { PluginLoader } from './host/PluginLoader.js';"
  $demoAnchor = '  const args = process.argv.slice(2);'
  if (!$demoSource.Contains($demoImport) -or !$demoSource.Contains($demoAnchor)) { throw 'Unexpected baseline assembly' }
  $demoSource = $demoSource.Replace($demoImport, $demoImport + "`n" + "import { BoxPlugin } from '../plugins/box/src/BoxPlugin.js';")
  $demoActivation = @'
  const boxManifest = JSON.parse(readFileSync(new URL('../../plugins/box/package.json', import.meta.url), 'utf8')) as PluginManifest;
  for (const error of await host.activate(new BoxPlugin(), boxManifest)) process.stderr.write(error + '\n');
'@
  $demoSource = $demoSource.Replace($demoAnchor, $demoActivation + "`n" + $demoAnchor)
  $demoDirectory = Join-Path $demoRoot '.cache/box-code-demo'
  New-Item -ItemType Directory -Path $demoDirectory -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $demoDirectory 'main.ts'), $demoSource + "`n", [Text.UTF8Encoding]::new($false))
  Write-Output 'Prepared .cache/box-code-demo/main.ts; no tracked source or Git state was modified.'
} finally { Pop-Location }
