# ─────────────────────────────────────────────────────────────────────────────
# Honeypot Integrated Platform — 초기 설치 헬퍼 (Windows PowerShell)
#   - .env 파일 생성 (템플릿 복사)
#   - 로그 디렉토리 생성
#   - SECRET_KEY 자동 생성
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "▸ Honeypot Integrated 초기 설정"
Write-Host "  PROJECT: $RootDir"
Write-Host ""

# ─── .env 생성 ───────────────────────────────────────────────────────────────
if (Test-Path .env) {
    Write-Host "  .env 가 이미 존재합니다. 건너뜀."
} else {
    Copy-Item .env.example .env
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
    (Get-Content .env) -replace '^SECRET_KEY=.*', "SECRET_KEY=$secret" | Set-Content .env -Encoding utf8
    Write-Host "  .env 생성 + SECRET_KEY 자동 발급"
    Write-Host "  ⚠  PROJECT_HOST / HONEYPOT_LOGS_HOST 경로가 본인 환경과 맞는지 확인"
}

# ─── 로그 디렉토리 ───────────────────────────────────────────────────────────
$logHostLine = Select-String -Path .env -Pattern '^HONEYPOT_LOGS_HOST=' | Select-Object -First 1
if ($logHostLine) {
    $logHost = ($logHostLine.Line -split '=', 2)[1].Trim()
    # /mnt/d/... → D:/... 변환 (Windows 호스트에서 직접 mkdir 할 때만)
    $localPath = $logHost -replace '^/mnt/([a-z])/', '$1:/'
    Write-Host "  로그 디렉토리 생성: $localPath"
    foreach ($hp in @("cowrie", "heralding", "opencanary", "snare", "dionaea", "mailoney", "conpot")) {
        New-Item -ItemType Directory -Force -Path "$localPath/$hp" | Out-Null
    }
}

Write-Host ""
Write-Host "✓ 초기 설정 완료"
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  1) .env 의 PROJECT_HOST / HONEYPOT_LOGS_HOST / POSTGRES_PASSWORD 검토"
Write-Host "  2) ../profiling-service 가 클론되어 있는지 확인 (Spring Boot 서비스)"
Write-Host "  3) docker compose up -d --build"
Write-Host "  4) 첫 실행 시 Ollama 모델 다운로드 대기:"
Write-Host "       docker compose logs -f model-pull"
Write-Host ""
Write-Host "접속:"
Write-Host "  Frontend       http://localhost:8001"
Write-Host "  FastAPI docs   http://localhost:8000/docs"
Write-Host "  Profiling      http://localhost:8090/api/health"
