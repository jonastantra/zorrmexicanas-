$ErrorActionPreference = 'Stop'

$checks = @(
    @{ Url = 'http://localhost:3000/'; Expected = 200 },
    @{ Url = 'http://localhost:3000/young-small-mexican-big-dick'; Expected = 200 },
    @{ Url = 'http://localhost:3000/young-small-mexican-big-dick-2'; Expected = 301 },
    @{ Url = 'http://localhost:3000/categoria/amateur-mexicano'; Expected = 200 },
    @{ Url = 'http://localhost:3000/sitemap.xml'; Expected = 200 },
    @{ Url = 'http://localhost:3000/robots.txt'; Expected = 200 }
)

$failed = $false
foreach ($check in $checks) {
    $status = & curl.exe -sS -o NUL --max-redirs 0 -w '%{http_code}' $check.Url
    $ok = [int]$status -eq $check.Expected
    if (-not $ok) { $failed = $true }
    '{0} {1} (esperado {2}) {3}' -f $status, $check.Url, $check.Expected, $(if ($ok) { 'OK' } else { 'ERROR' })
}

if ($failed) { exit 1 }
