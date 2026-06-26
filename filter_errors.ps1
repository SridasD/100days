$patterns = @(
    "app/(admin)/admin/layout.tsx",
    "app/(admin)/admin/projects/page.tsx",
    "app/(admin)/admin/osd/",
    "app/api/admin/osd/",
    "lib/auth/admin-session.ts",
    "app/api/admin/dashboard/route.ts",
    "app/api/admin/audit/route.ts",
    "app/api/admin/users/",
    "app/api/admin/projects/archive/"
)

$allErrors = Get-Content tsc_output.txt | Where-Object { $_ -match "error TS" }
$touchedErrors = @()
$unrelatedErrors = @()

foreach ($err in $allErrors) {
    $isTouched = $false
    foreach ($p in $patterns) {
        if ($err.Contains($p)) {
            $isTouched = $true
            break
        }
    }
    if ($isTouched) {
        $touchedErrors += $err
    } else {
        $unrelatedErrors += $err
    }
}

Write-Host "--- Touched Files Errors ---"
$touchedErrors | ForEach-Object { Write-Host $_ }
Write-Host "`n--- Total Unrelated Errors Count ---"
Write-Host $unrelatedErrors.Count
