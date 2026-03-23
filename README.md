# 🏛️ AI Debate Council v1.0

> 다수의 AI 모델에게 동일한 안건을 동시에 던지고, 실시간으로 스트리밍 응답을 받은 뒤, 전담 요약 에이전트가 종합 결론을 도출하는 **다중 에이전트 토론 플랫폼**입니다.

---

## ✨ 핵심 기능

| 기능 | 설명 |
|------|------|
| **동시 멀티모델 토론** | 등록된 모든 AI 에이전트에게 안건을 병렬 전송, 실시간 SSE 스트리밍으로 응답 수신 |
| **자동 종합 요약** | 개별 응답 완료 후 전담 Summarizer가 종합 결론을 자동 생성 |
| **세션 컨텍스트 누적** | 같은 세션 내에서 이전 토론 요약이 프롬프트에 자동 포함되어 연속 대화 가능 |
| **웹 기반 OAuth 로그인** | Claude, Codex, Gemini 등 프로바이더별 원클릭 인증 (CLI 불필요) |
| **실시간 인증 상태 모니터링** | 🟢 Active / 🔴 Unconnected / 🟡 Expired 상태를 UI에서 실시간 확인 |
| **Model 드롭다운** | 프록시에서 지원하는 모델 목록을 자동으로 가져와 드롭다운으로 안전 선택 |
| **에이전트 CRUD** | 에이전트 추가/수정/삭제를 웹 UI에서 즉시 반영 |
| **토론 에러 ↔ 인증 연동** | 모델 응답 실패 시 Auth 상태를 즉시 갱신하여 만료 알림 |
| **CLIProxyAPI 사이드카** | 서버 시작 시 자동으로 프록시 프로세스를 띄워 모델 인증을 중계 |

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────┐
│         React Frontend          │  ← http://localhost:5173
│  (Vite + React 18)              │
│  ┌──────────┬───────┬─────────┐ │
│  │ Console  │Session│Settings │ │
│  │ (토론)   │(이력) │(설정)   │ │
│  └──────────┴───────┴─────────┘ │
└───────────────┬─────────────────┘
                │ SSE / REST
┌───────────────▼─────────────────┐
│      FastAPI Backend (8000)      │
│  ┌────────────┬────────────────┐ │
│  │ Coordinator│  Auth Manager  │ │
│  │ (토론 조율)│ (OAuth 관리)   │ │
│  └─────┬──────┴───────┬────────┘ │
│        │   SQLite DB   │         │
└────────┼───────────────┼─────────┘
         │               │
┌────────▼───────────────▼────────┐
│     CLIProxyAPI Sidecar (8081)   │
│  ┌────────┬────────┬──────────┐ │
│  │ Claude │ Codex  │  Gemini  │ │
│  │  Auth  │  Auth  │   Auth   │ │
│  └────────┴────────┴──────────┘ │
└─────────────────────────────────┘
```

---

## 📁 프로젝트 구조

```
MultiAgent/
├── server.py              # FastAPI 메인 서버 (API 엔드포인트)
├── coordinator.py         # 토론 조율 (프롬프트 조립, 요약 생성, 세션 저장)
├── api_client.py          # LLM API 스트리밍 클라이언트
├── auth_manager.py        # OAuth 프로바이더 탐지, 상태 확인, 로그인 플로우
├── cli_proxy_manager.py   # CLIProxyAPI 사이드카 프로세스 관리
├── database.py            # SQLite 스키마 초기화 및 시드 데이터
├── config.yaml            # CLIProxyAPI 설정
├── run.sh                 # 원클릭 기동 스크립트
├── requirements.txt       # Python 의존성
├── bin/
│   └── CLIProxyAPI        # 프록시 바이너리
├── frontend2/
│   ├── src/
│   │   ├── App.jsx        # 메인 앱 (3탭 레이아웃)
│   │   ├── hooks/
│   │   │   └── useDebate.js    # 토론 SSE 스트리밍 훅
│   │   └── components/
│   │       ├── ChatArea.jsx       # 토론 채팅 영역
│   │       ├── AgentGrid.jsx      # 에이전트별 실시간 응답 카드
│   │       ├── SessionSidebar.jsx # 세션 이력 사이드바
│   │       ├── Settings.jsx       # 설정 (Summarizer + Agents CRUD)
│   │       ├── AuthPanel.jsx      # OAuth 로그인 패널
│   │       └── AuthPanel.css      # AuthPanel 스타일
│   └── package.json
└── council.db             # SQLite 데이터베이스 (자동 생성)
```

---

## 🚀 빠른 시작

### 사전 준비
- **Python 3.10+**
- **Node.js 18+**
- `bin/CLIProxyAPI` 바이너리

### 설치

```bash
# 1. Python 가상환경 및 의존성
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. 프론트엔드 의존성
cd frontend2
npm install
cd ..
```

### 기동

```bash
# 원클릭 기동 (백엔드 + 프론트엔드 동시)
./run.sh
```

또는 개별 기동:

```bash
# 백엔드 (포트 8000, CLIProxyAPI 사이드카 자동 기동)
.venv/bin/python server.py &

# 프론트엔드 (포트 5173)
cd frontend2 && npm run dev
```

### 접속
- 🌐 **웹 UI**: http://localhost:5173
- 🔌 **API**: http://localhost:8000
- 🤖 **프록시**: http://localhost:8081

---

## 📡 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/debate/start` | 토론 시작 (SSE 스트리밍) |
| `POST` | `/api/debate/stop` | 토론 중지 |
| `GET` | `/api/sessions` | 세션 목록 조회 |
| `GET` | `/api/sessions/{id}` | 세션 이력 조회 |
| `DELETE` | `/api/sessions/{id}` | 세션 삭제 |
| `GET` | `/api/settings` | Summarizer 설정 조회 |
| `PUT` | `/api/settings` | Summarizer 설정 수정 |
| `GET` | `/api/agents` | 에이전트 목록 조회 |
| `PUT` | `/api/agents` | 에이전트 일괄 저장 |
| `GET` | `/api/models` | 프록시 모델 목록 조회 |
| `GET` | `/api/auth/providers` | OAuth 프로바이더 목록 |
| `GET` | `/api/auth/status` | 인증 상태 조회 |
| `POST` | `/api/auth/login` | OAuth 로그인 플로우 (SSE) |

---

## ⚙️ 기술 스택

| 영역 | 기술 |
|------|------|
| **Backend** | Python 3, FastAPI, aiosqlite, httpx, asyncio |
| **Frontend** | React 18, Vite 8, Vanilla CSS |
| **Database** | SQLite (council.db) |
| **Proxy** | CLIProxyAPI (Go 바이너리) |
| **통신** | SSE (Server-Sent Events), REST JSON |

---

## 📋 v1.0 변경 이력

### Phase 1 — Mock 기반 백엔드 구현
- Coordinator 패턴 기반 다중 에이전트 토론 엔진
- SSE 기반 실시간 토큰 스트리밍
- 전담 Summarizer 에이전트 자동 요약

### Phase 2 — React 프론트엔드
- 3탭 레이아웃 (Console / Sessions / Settings)
- 에이전트별 실시간 응답 카드 (`AgentGrid`)
- 세션 이력 사이드바 및 이어가기

### Phase 3 — 실제 LLM 연동 및 CRUD
- CLIProxyAPI 사이드카 자동 기동
- 에이전트 CRUD (추가/수정/삭제)
- Summarizer 설정 관리
- 세로형 세팅 UI 리디자인

### Phase 4 — OAuth 로그인 UI
- CLI `--help` 파싱을 통한 동적 프로바이더 탐지
- `~/.cli-proxy-api/*.json` 토큰 상태 실시간 모니터링
- 원클릭 OAuth 플로우 (SSE + 팝업 자동 오픈)
- 토론 실패 시 Auth 상태 자동 연동
- Model 드롭다운 (프록시 `/v1/models` 연동)
- 2-Phase 타임아웃 보호 (서버 블로킹 방지)

---

## 📄 라이선스

Private / Internal Use
