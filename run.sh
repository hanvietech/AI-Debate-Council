#!/bin/bash

# 종료 시 자식 프로세스까지 모두 Kill 하기 위한 트랩 설정
trap 'kill 0' EXIT

echo "========================================="
echo "🚀 AI 다수결 토론 플랫폼 기동 (Phase 3)"
echo "========================================="

echo "[1/2] 🐍 FastAPI 백엔드 서버 시작 (포트 8000)"
echo "      ↳ CLIProxyAPI 사이드카가 자동으로 8081 포트에 연결됩니다."
.venv/bin/python server.py &

# 잠시 대기
sleep 2

echo "[2/2] ⚛️ React 프론트엔드 서버 시작 (포트 5173)"
cd frontend2
npm run dev -- --host &

echo ""
echo "========================================="
echo "✅ 구동 완료! 브라우저를 열어주세요."
echo "👉 접속 주소: http://localhost:5173"
echo "========================================="
echo "(서버를 종료하시려면 여기서 Ctrl-C 를 누르세요.)"

# 무한 대기 (터미널이 꺼지거나 Ctrl+C를 누르기 전까지 유지)
wait
