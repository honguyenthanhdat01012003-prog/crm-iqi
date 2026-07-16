#!/bin/bash
# Chạy trên Mac (Xcode 14): ép Capacitor 5 rồi tạo lại ios
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pull"
git pull origin main

echo "==> Xóa Cap 8 cũ"
rm -rf ios android/.capacitor node_modules
rm -f package-lock.json

echo "==> Cài Capacitor 5 (theo package.json)"
npm install

echo "==> Kiểm tra version (PHẢI là 5.x)"
npm ls @capacitor/core @capacitor/cli @capacitor/ios @capacitor/local-notifications @capacitor/push-notifications

CORE_VER=$(node -p "require('./node_modules/@capacitor/core/package.json').version")
case "$CORE_VER" in
  5.*) echo "OK: @capacitor/core@$CORE_VER" ;;
  *) echo "ERROR: vẫn là @capacitor/core@$CORE_VER — dừng lại, đừng mở Xcode"; exit 1 ;;
esac

echo "==> Build web + add/sync ios"
npm run build:capacitor
npx cap add ios
npx cap sync ios

echo "==> Xong. Mở bằng:"
echo "   open ios/App/App.xcworkspace"
echo "(Nếu không có workspace: open ios/App/App.xcodeproj)"
