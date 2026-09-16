@echo off
setlocal

set "PROJECT_ROOT=%~dp0"

if not exist "%PROJECT_ROOT%backend\package.json" (
  echo Backend package.json bulunamadi.
  echo Bu dosyayi proje kok dizininden calistirin.
  pause
  exit /b 1
)

if not exist "%PROJECT_ROOT%frontend\package.json" (
  echo Frontend package.json bulunamadi.
  echo Bu dosyayi proje kok dizininden calistirin.
  pause
  exit /b 1
)

where.exe wt.exe >nul 2>&1
if errorlevel 1 goto separate_windows

start "" wt.exe -w new ^
  new-tab --title "Core Asistan - Backend" -d "%PROJECT_ROOT%backend" cmd.exe /d /k "npm.cmd run start:dev" ^; ^
  new-tab --title "Core Asistan - Frontend" -d "%PROJECT_ROOT%frontend" cmd.exe /d /k "npm.cmd run dev" ^; ^
  new-tab --title "Core Asistan - Prisma Studio" -d "%PROJECT_ROOT%backend" cmd.exe /d /k "npm.cmd run db:studio" ^; ^
  new-tab --title "Core Asistan - Hookdeck" -d "%PROJECT_ROOT%backend" cmd.exe /d /k "where hookdeck >nul 2>&1 && hookdeck listen 4001 paddle --path /billing/webhooks/paddle || (echo. && echo Hookdeck CLI bulunamadi veya baslatilamadi. && echo Komutu bu sekmede manuel kontrol edin: && echo hookdeck listen 4001 paddle --path /billing/webhooks/paddle)"

exit /b 0

:separate_windows
echo Windows Terminal bulunamadi. Servisler ayri pencerelerde aciliyor.
start "Core Asistan - Backend" cmd.exe /d /k "cd /d ""%PROJECT_ROOT%backend"" && npm.cmd run start:dev"
start "Core Asistan - Frontend" cmd.exe /d /k "cd /d ""%PROJECT_ROOT%frontend"" && npm.cmd run dev"
start "Core Asistan - Prisma Studio" cmd.exe /d /k "cd /d ""%PROJECT_ROOT%backend"" && npm.cmd run db:studio"
start "Core Asistan - Hookdeck" cmd.exe /d /k "cd /d ""%PROJECT_ROOT%backend"" && where hookdeck >nul 2>&1 && hookdeck listen 4001 paddle --path /billing/webhooks/paddle || (echo. && echo Hookdeck CLI bulunamadi veya baslatilamadi. && echo Komutu bu pencerede manuel kontrol edin: && echo hookdeck listen 4001 paddle --path /billing/webhooks/paddle)"

endlocal
