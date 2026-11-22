param([Parameter(Mandatory=$true)][string]$SdkFolder)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
$stage = Join-Path $env:TEMP ('hamnafas-print-build-'+[Guid]::NewGuid())
New-Item -ItemType Directory $stage | Out-Null
$core = Join-Path $SdkFolder 'lib/net462/Microsoft.Web.WebView2.Core.dll'
$forms = Join-Path $SdkFolder 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'
Copy-Item -LiteralPath $core,$forms,(Join-Path $SdkFolder 'runtimes/win-x86/native/WebView2Loader.dll'),(Join-Path $SdkFolder 'LICENSE.txt'),(Join-Path $SdkFolder 'NOTICE.txt') -Destination $stage
& $compiler /nologo /platform:x86 /target:exe /codepage:65001 "/out:$stage/DocumentWorker.exe" "/r:$core" "/r:$forms" /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll (Join-Path $PSScriptRoot 'DocumentWorker.cs')
if ($LASTEXITCODE) { throw 'Document renderer build failed' }
& $compiler /nologo /target:winexe /codepage:65001 "/out:$stage/HamnafasPrintSetup.exe" /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /r:System.Management.dll (Join-Path $PSScriptRoot 'LabelPrinter.cs')
if ($LASTEXITCODE) { throw 'Bridge build failed' }
Compress-Archive -Path "$stage/*" -DestinationPath (Join-Path $PSScriptRoot '../../public/label-printer/HamnafasPrint-1.1.0.zip') -Force
Write-Output $stage
