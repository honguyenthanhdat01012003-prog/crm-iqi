# Dựng file Word từ docs/huong-dan-cai-apk.txt bằng Word COM.
# Nội dung để riêng ở file UTF-8 để tiếng Việt không vỡ khi đi qua PowerShell.
param(
    [string]$Source = "C:\Users\PC\Downloads\Test Web\crm-iqi\docs\huong-dan-cai-apk.txt",
    [string]$Output = "C:\Users\PC\Downloads\Huong-dan-cai-app-LUX-IQI-CRM-tren-Android.docx"
)

$ErrorActionPreference = "Stop"
$lines = Get-Content -LiteralPath $Source -Encoding UTF8

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()

$doc.Content.Style = "Normal"
$doc.Content.ParagraphFormat.SpaceAfter = 6
$sel = $word.Selection

# wdListBullet = 2 ; wdListSimpleNumbering = 3
$listBullet = 2
$listNumber = 3

function Reset-List {
    param($selection)
    $selection.Range.ListFormat.RemoveNumbers()
}

$pendingNumberRestart = $true

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    # Tách nhãn ở đầu dòng. Không dùng Substring(0,2) vì nhãn dài ngắn khác nhau
    # (H1: ba ký tự, P: hai ký tự) nên tiêu đề sẽ dính thêm dấu hai chấm.
    if ($line -notmatch '^(H1|H2|H3|P|N|B|W):\s*(.*)$') { continue }
    $tag = $Matches[1]
    $text = $Matches[2].Trim()

    switch ($tag) {
        "H1" {
            $sel.Style = $doc.Styles.Item("Heading 1")
            $sel.ParagraphFormat.Alignment = 1
            $sel.TypeText($text)
            $sel.TypeParagraph()
            $pendingNumberRestart = $true
        }
        "H2" {
            $sel.Style = $doc.Styles.Item("Heading 2")
            $sel.ParagraphFormat.Alignment = 0
            $sel.TypeText($text)
            $sel.TypeParagraph()
            $pendingNumberRestart = $true
        }
        "H3" {
            $sel.Style = $doc.Styles.Item("Heading 3")
            $sel.ParagraphFormat.Alignment = 0
            $sel.TypeText($text)
            $sel.TypeParagraph()
            $pendingNumberRestart = $true
        }
        "P" {
            $sel.Style = $doc.Styles.Item("Normal")
            Reset-List $sel
            $sel.ParagraphFormat.LeftIndent = 0
            $sel.Font.Bold = $false
            $sel.Font.Color = 0
            $sel.TypeText($text)
            $sel.TypeParagraph()
            $pendingNumberRestart = $true
        }
        "N" {
            $sel.Style = $doc.Styles.Item("Normal")
            $sel.Font.Bold = $false
            $sel.Font.Color = 0
            $sel.TypeText($text)
            $sel.Range.ListFormat.ApplyListTemplateWithLevel(
                $word.ListGalleries.Item($listNumber).ListTemplates.Item(1),
                $pendingNumberRestart, 0, 0
            )
            $sel.TypeParagraph()
            $pendingNumberRestart = $false
        }
        "B" {
            $sel.Style = $doc.Styles.Item("Normal")
            $sel.Font.Bold = $false
            $sel.Font.Color = 0
            $sel.TypeText($text)
            $sel.Range.ListFormat.ApplyListTemplateWithLevel(
                $word.ListGalleries.Item($listBullet).ListTemplates.Item(1),
                $false, 0, 0
            )
            $sel.TypeParagraph()
            $pendingNumberRestart = $true
        }
        "W" {
            $sel.Style = $doc.Styles.Item("Normal")
            Reset-List $sel
            $sel.ParagraphFormat.LeftIndent = 14
            $sel.Font.Bold = $true
            $sel.Font.Color = 192   # đỏ sẫm, cho phần cần chú ý
            $sel.TypeText($text)
            $sel.TypeParagraph()
            $sel.Font.Bold = $false
            $sel.Font.Color = 0
            $sel.ParagraphFormat.LeftIndent = 0
            $pendingNumberRestart = $true
        }
        default {
            $sel.Style = $doc.Styles.Item("Normal")
            $sel.TypeText($line)
            $sel.TypeParagraph()
        }
    }
}

# Đánh số trang ở chân trang
$footer = $doc.Sections.Item(1).Footers.Item(1).Range
$footer.ParagraphFormat.Alignment = 1
$footer.Fields.Add($footer, 33) | Out-Null   # wdFieldPage

if (Test-Path -LiteralPath $Output) { Remove-Item -LiteralPath $Output -Force }
$doc.SaveAs([ref]$Output, [ref]16)   # wdFormatDocumentDefault = .docx
$doc.Close([ref]0)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

Write-Output "DA TAO: $Output"
