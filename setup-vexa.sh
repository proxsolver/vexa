#!/bin/bash

echo "=========================================="
echo "  🚀 Vexa 자동 설치 & 실행 스크립트"
echo "=========================================="

# ── 1. Docker 설치 ──────────────────────────
echo ""
echo "📦 [1/4] Docker 설치 중..."

if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    echo "   ✅ Docker 이미 설치됨: $(docker --version)"
else
    # Docker 공식 편의 스크립트 사용 (apt 저장소 문제 우회)
    curl -fsSL https://get.docker.com | sudo sh
    echo "   ✅ Docker 설치 완료: $(docker --version)"
fi

# ── 2. docker 그룹 추가 ──────────────────────
echo ""
echo "👤 [2/4] Docker 그룹 권한 설정..."
if groups | grep -q docker; then
    echo "   ✅ 이미 docker 그룹에 속해 있음"
else
    sudo usermod -aG docker $USER
    echo "   ✅ docker 그룹에 추가됨"
    echo "   ⚠️  권한 적용을 위해 'newgrp docker' 실행 필요"
fi

# ── 3. Docker 데몬 시작 ──────────────────────
echo ""
echo "🔧 [3/4] Docker 데몬 시작..."
sudo systemctl start docker 2>/dev/null || true
sudo systemctl enable docker 2>/dev/null || true
echo "   ✅ Docker 데몬 실행 중"

# ── 4. Vexa 실행 ─────────────────────────────
echo ""
echo "🚀 [4/4] Vexa 실행 (Lite 모드)..."

cd "$(dirname "$0")"

# .env 파일이 없으면 예제에서 복사
if [ ! -f .env ]; then
    if [ -f deploy/env-example ]; then
        cp deploy/env-example .env
        echo "   📝 .env 파일 생성됨"
        echo "   ⚠️  나중에 TRANSCRIPTION_SERVICE_TOKEN 을 설정하세요"
    else
        echo "   ⚠️  deploy/env-example 없음 — 수동으로 .env 생성 필요"
    fi
else
    echo "   ✅ .env 파일 이미 존재"
fi

# Vexa Lite 실행
echo "   🏗️  Vexa Lite 빌드 & 시작..."
make lite

echo ""
echo "=========================================="
echo "  ✅ 설치 완료!"
echo "=========================================="
echo ""
echo "  🌐 대시보드:  http://localhost:3000"
echo "  🔌 API:       http://localhost:8056"
echo "  📖 API 문서:  http://localhost:8056/docs"
echo ""
echo "  🛑 중지:  make lite-down"
echo "  📋 로그:  docker logs vexa-lite"
echo "=========================================="
