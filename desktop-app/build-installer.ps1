# Build automation script for PrashnaSārathi C# Setup Installer
Write-Host "Creating app_bundle.zip..." -ForegroundColor Cyan

# Remove existing zip if any
if (Test-Path "app_bundle.zip") {
    Remove-Item "app_bundle.zip"
}

# Compress the packed Electron app folder into a standard zip file (fully compatible with .NET ZipArchive)
& node_modules\7zip-bin\win\x64\7za.exe a -tzip -mx=9 "-xr!LICENSES.chromium.html" "-xr!locales" app_bundle.zip ./dist/PrashnaSarathi-win32-x64/*

# Verify zip creation
if (!(Test-Path "app_bundle.zip")) {
    Write-Error "Failed to create app_bundle.zip!"
    exit 1
}

$ZipSize = (Get-Item "app_bundle.zip").Length / 1MB
Write-Host "app_bundle.zip created successfully! (Size: $ZipSize MB)" -ForegroundColor Green

Write-Host "Compiling Installer.cs using CSC (C# Compiler)..." -ForegroundColor Cyan

# Output path
$OutPath = "..\frontend\public\downloads\prashnasarathi-win.exe"

# If old exe exists, delete it first
if (Test-Path $OutPath) {
    Remove-Item $OutPath
}

# Run csc compiler embedding app_bundle.zip and setting the file icon
& C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /win32icon:logo.ico /resource:app_bundle.zip,app_bundle.zip /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /out:$OutPath Installer.cs

if (!(Test-Path $OutPath)) {
    Write-Error "Compilation failed!"
    exit 1
}

$ExeSize = (Get-Item $OutPath).Length / 1MB
Write-Host "prashnasarathi-win.exe compiled successfully! (Size: $ExeSize MB)" -ForegroundColor Green

# Clean up temporary zip
Remove-Item "app_bundle.zip" -ErrorAction SilentlyContinue
Write-Host "Build complete!" -ForegroundColor Cyan
