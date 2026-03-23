from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import uuid
import os
import signal
from typing import List, Dict, Optional

import aiosqlite
from coordinator import DB_PATH, get_active_agents, get_settings, build_messages, generate_summary, save_turn
from api_client import stream_chat_completion
from database import init_db
from cli_proxy_manager import ensure_cli_proxy_running
from auth_manager import get_available_providers, get_all_auth_status, start_oauth_login

app = FastAPI(title="AI Debate Council API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Only try to init_db if it doesn't strictly break parallel booting, database.py already handles IF NOT EXISTS.
    init_db()
    await ensure_cli_proxy_running(8081)

# --- Models ---
class AgentData(BaseModel):
    id: Optional[int]
    name: str
    api_url: str
    model_name: str
    api_key: str
    role_prompt: str
    is_active: bool

class AgentUpdate(BaseModel):
    name: str
    api_url: str
    model_name: str
    api_key: str
    role_prompt: str
    is_active: bool

class AuthLoginRequest(BaseModel):
    provider_flag: str
    extra_input: Optional[str] = None

class SettingsData(BaseModel):
    summarizer_api_url: str
    summarizer_model: str
    summarizer_api_key: str
    summarizer_prompt: str

class SessionUpdate(BaseModel):
    title: str

class DebateRequest(BaseModel):
    user_msg: str
    session_id: Optional[str] = None

# Global state to keep track of running tasks for cancellation
running_debate_tasks = []

# --- REST APIs ---
@app.get("/api/agents")
async def get_agents():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, name, api_url, model_name, api_key, role_prompt, is_active FROM agents") as cur:
            rows = await cur.fetchall()
            return {"agents": [dict(r) for r in rows]}

@app.post("/api/agents")
async def save_agents(agents: List[AgentData]):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM agents")
        for ag in agents:
            await db.execute(
                "INSERT INTO agents (id, name, api_url, model_name, api_key, role_prompt, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ag.id, ag.name, ag.api_url, ag.model_name, ag.api_key, ag.role_prompt, ag.is_active)
            )
        await db.commit()
    return {"status": "success"}

@app.get("/api/settings")
async def fetch_settings_api():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT summarizer_api_url, summarizer_model, summarizer_api_key, summarizer_prompt FROM settings WHERE id = 1") as cur:
            row = await cur.fetchone()
            if row:
                return dict(row)
            return {"summarizer_api_url": "", "summarizer_model": "", "summarizer_api_key": "", "summarizer_prompt": ""}

@app.post("/api/settings")
async def save_settings_api(data: SettingsData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE settings SET summarizer_api_url=?, summarizer_model=?, summarizer_api_key=?, summarizer_prompt=? WHERE id=1",
            (data.summarizer_api_url, data.summarizer_model, data.summarizer_api_key, data.summarizer_prompt)
        )
        await db.commit()
    return {"status": "success"}

@app.get("/api/sessions")
async def fetch_sessions_api():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, datetime(created_at, 'localtime') as dt, title FROM sessions ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
            return {"sessions": [{"id": r["id"], "title": r["title"], "date": r["dt"]} for r in rows]}

@app.get("/api/sessions/{session_id}")
async def load_session_history_api(session_id: str):
    history = []
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT user_q, summary, raw_dict FROM turns WHERE session_id = ? ORDER BY id ASC", (session_id,)) as cur:
            rows = await cur.fetchall()
            for r in rows:
                history.append({
                    "role": "user",
                    "content": r["user_q"]
                })
                history.append({
                    "role": "assistant",
                    "content": f"**[Committee Summary]**\n\n{r['summary']}",
                    "raw_dict": json.loads(r["raw_dict"]) if r["raw_dict"] else {}
                })
    return {"history": history}

@app.delete("/api/sessions/{session_id}")
async def delete_session_api(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM turns WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()
    return {"status": "success"}

@app.patch("/api/sessions/{session_id}")
async def update_session_api(session_id: str, data: SessionUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE sessions SET title = ? WHERE id = ?", (data.title, session_id))
        await db.commit()
    return {"status": "success"}

import httpx

# --- Auth API ---
@app.get("/api/auth/providers")
async def api_get_providers():
    return get_available_providers()

@app.get("/api/models")
async def api_get_models():
    """Fetches available models from CLIProxyAPI on port 8081"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("http://127.0.0.1:8081/v1/models", timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                return {"models": [m["id"] for m in data.get("data", [])] }
    except Exception as e:
        pass
    return {"models": []}

@app.get("/api/auth/status")
async def api_get_auth_status():
    return get_all_auth_status()

@app.post("/api/auth/login")
async def api_auth_login(req: Request, data: AuthLoginRequest):
    async def sse_generator():
        async for chunk in start_oauth_login(data.provider_flag, data.extra_input):
            if await req.is_disconnected():
                break
            yield f"data: {chunk}\n\n"
        # Final keepalive to ensure stream closes cleanly
        yield "data: {\"type\": \"stream_end\"}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

# --- SSE Stream API ---
@app.post("/api/debate/start")
async def start_debate(req: Request, data: DebateRequest):
    user_msg = data.user_msg
    if not user_msg.strip():
        raise HTTPException(status_code=400, detail="안건을 입력하세요.")

    agents_rows = await get_active_agents()
    agents = [dict(r) for r in agents_rows]
    if not agents:
        raise HTTPException(status_code=400, detail="활성화된 에이전트가 없습니다.")

    session_id = data.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("INSERT INTO sessions (id, title, running_summary) VALUES (?, ?, ?)", 
                             (session_id, user_msg[:20], ""))
            await db.commit()

    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT running_summary FROM sessions WHERE id=?", (session_id,)) as cur:
            r = await cur.fetchone()
            running_summary = r[0] if r else ""

    async def event_generator():
        current_task = asyncio.current_task()
        running_debate_tasks.append(current_task)

        try:
            yield f"data: {json.dumps({'type': 'session_started', 'session_id': session_id, 'agents': [a['name'] for a in agents]})}\n\n"

            queue = asyncio.Queue()

            async def consume_stream(name, stream_gen, q):
                try:
                    async for chunk in stream_gen:
                        await q.put((name, chunk))
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    await q.put((name, f"\n[Network Error]: {str(e)}"))
                finally:
                    await q.put((name, None))

            tasks = []
            raw_responses = {}
            for i, ag in enumerate(agents):
                if i >= 10: break
                messages = build_messages(ag['role_prompt'], running_summary, user_msg)
                stream = stream_chat_completion(ag['api_url'], ag['model_name'], messages, ag['api_key'])
                task = asyncio.create_task(consume_stream(ag['name'], stream, queue))
                tasks.append(task)
                raw_responses[ag['name']] = ""

            active_count = len(tasks)
            
            while active_count > 0:
                if await req.is_disconnected():
                    for t in tasks: t.cancel()
                    break

                try:
                    name, chunk = await asyncio.wait_for(queue.get(), timeout=1.0)
                    if chunk is None:
                        active_count -= 1
                    else:
                        raw_responses[name] += chunk
                        yield f"data: {json.dumps({'type': 'token', 'agent': name, 'text': chunk})}\n\n"
                except asyncio.TimeoutError:
                    pass

            if await req.is_disconnected():
                return

            yield f"data: {json.dumps({'type': 'summarizing', 'status': '진행 중'})}\n\n"

            settings_row = await get_settings()
            if settings_row:
                summary = await generate_summary(
                    raw_responses, 
                    settings_row['summarizer_api_url'], 
                    settings_row['summarizer_model'], 
                    settings_row['summarizer_api_key'], 
                    settings_row['summarizer_prompt']
                )
            else:
                summary = "Failed to load summary settings."
                
            await save_turn(session_id, user_msg, summary, raw_responses)

            yield f"data: {json.dumps({'type': 'done', 'summary': summary, 'raw_dict': raw_responses})}\n\n"

        except asyncio.CancelledError:
            for t in tasks: t.cancel()
            yield f"data: {json.dumps({'type': 'error', 'message': 'Debate is stopped globally.'})}\n\n"
            raise
        finally:
            if current_task in running_debate_tasks:
                running_debate_tasks.remove(current_task)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/debate/stop")
async def stop_debate():
    # Only cancel tasks purely in python thread, since api_client httpx streams will close when task is cancelled.
    for task in running_debate_tasks:
        task.cancel()
    running_debate_tasks.clear()
    return {"status": "stopped"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
