param(
  [Parameter(Mandatory=$true)][string]$KeyPath,
  [string]$BundlePath = (Join-Path $PSScriptRoot '..\nafasyar.bundle')
)
$ErrorActionPreference = 'Stop'
$repoUrl = 'git@github.com:alimahmoodyar/nafasyartebcrm.git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows first.' }
$keyFile = (Resolve-Path -LiteralPath $KeyPath).Path.Replace('\','/')
if ($keyFile.Contains('"')) { throw 'Key path cannot contain a double quote.' }
$bundleFile = (Resolve-Path -LiteralPath $BundlePath).Path
$destination = Join-Path $env:TEMP ('nafasyar-push-' + [guid]::NewGuid().ToString('N'))
$previousSsh = $env:GIT_SSH_COMMAND
try {
  git clone --branch main $bundleFile $destination
  if ($LASTEXITCODE -ne 0) { throw 'Bundle clone failed.' }
  # Keep the private key outside the repository. Let SSH verify GitHub host normally.
  $env:GIT_SSH_COMMAND = 'ssh -i "' + $keyFile + '" -o IdentitiesOnly=yes'
  git -C $destination remote add github $repoUrl
  git -C $destination push github main:main
  if ($LASTEXITCODE -ne 0) { throw 'Push failed; no force push was attempted. Check SSH access or existing GitHub history.' }
  Write-Host 'Pushed successfully: https://github.com/alimahmoodyar/nafasyartebcrm'
  Write-Host "Working copy: $destination"
} finally { $env:GIT_SSH_COMMAND = $previousSsh }
