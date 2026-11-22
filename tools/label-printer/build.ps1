$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
$target = Join-Path $PSScriptRoot '..\..\public\label-printer\HamnafasLabelSetup-1.0.0.exe'
& $compiler /nologo /target:winexe /codepage:65001 "/out:$target" /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /r:System.Management.dll (Join-Path $PSScriptRoot 'LabelPrinter.cs')
if ($LASTEXITCODE) { throw 'Build failed' }
if ((Start-Process $target '--self-test' -Wait -PassThru -WindowStyle Hidden).ExitCode) { throw 'Encoder self-test failed' }
