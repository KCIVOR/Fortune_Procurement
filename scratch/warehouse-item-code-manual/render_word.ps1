$ErrorActionPreference = 'Stop'
$manualPath = 'C:\Users\Rovick\Desktop\project\docs\Fortune-Warehouse-Item-Code-User-Guide.docx'
$pdfPath = 'C:\Users\Rovick\Desktop\project\scratch\warehouse-item-code-manual\preview.pdf'
$wordPreview = $null
$manualPreview = $null
try {
  $wordPreview = New-Object -ComObject Word.Application
  $wordPreview.Visible = $false
  $wordPreview.DisplayAlerts = 0
  $manualPreview = $wordPreview.Documents.Open($manualPath, $false, $true)
  $manualPreview.Repaginate()
  $manualPreview.ExportAsFixedFormat($pdfPath, 17)
  Write-Output ('Rendered pages: ' + $manualPreview.ComputeStatistics(2))
} finally {
  if ($manualPreview) { $manualPreview.Close(0) }
  if ($wordPreview) { $wordPreview.Quit() }
}
