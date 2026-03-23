import asyncio
import aiosqlite
import json
from api_client import stream_chat_completion

DB_PATH = "council.db"

async def get_active_agents():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM agents WHERE is_active = 1") as cursor:
            return await cursor.fetchall()

async def get_settings():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM settings WHERE id = 1") as cursor:
            return await cursor.fetchone()

# build_prompt 텍스트 조립기 대신, Message Array(리스트 객체) 생성기로 역할 변경
def build_messages(role_prompt, running_summary, user_q):
    messages = []
    if role_prompt:
        messages.append({"role": "system", "content": role_prompt})
    if running_summary:
        messages.append({"role": "system", "content": f"이전 토론 요약 사항:\n{running_summary}"})
    messages.append({"role": "user", "content": user_q})
    return messages

async def generate_summary(raw_dict, api_url, model_name, api_key, summarizer_prompt):
    combined_texts = "\n\n".join([f"[{k}] 의 의견:\n{v}" for k, v in raw_dict.items()])
    
    messages = [
        {"role": "system", "content": summarizer_prompt},
        {"role": "user", "content": combined_texts}
    ]
    
    summary = ""
    stream = stream_chat_completion(api_url, model_name, messages, api_key)
    async for chunk in stream:
        summary += chunk
    
    return summary.strip()

async def save_turn(session_id, user_q, summary, raw_dict):
    async with aiosqlite.connect(DB_PATH) as db:
        raw_json = json.dumps(raw_dict, ensure_ascii=False)
        await db.execute(
            "INSERT INTO turns (session_id, user_q, summary, raw_dict) VALUES (?, ?, ?, ?)",
            (session_id, user_q, summary, raw_json)
        )
        
        async with db.execute("SELECT running_summary FROM sessions WHERE id = ?", (session_id,)) as cursor:
            row = await cursor.fetchone()
            old_summary = row[0] if row and row[0] else ""
        
        new_running_summary = f"{old_summary}\n\n[Q: {user_q}]\n{summary}".strip()
        
        await db.execute(
            "UPDATE sessions SET running_summary = ? WHERE id = ?",
            (new_running_summary, session_id)
        )
        await db.commit()
