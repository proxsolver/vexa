#!/bin/bash

echo "=========================================="
echo "  🔄 Vexa 리빌드 (수정 후 실행)"
echo "=========================================="

cd ~/2026/vexa/deploy/compose

echo "🔨 기존 중지 + 로컬 빌드 + 실행..."
docker compose up -d --build

echo ""
echo "=== 서비스 상태 ==="
docker compose ps

echo ""
echo "=========================================="
echo "  ✅ 완료!"
echo "  🌐 대시보드:  http://localhost:3001"
echo "  📖 API 문서:  http://localhost:8056/docs"
echo "=========================================="
