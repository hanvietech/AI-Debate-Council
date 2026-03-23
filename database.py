import sqlite3
import os

DB_NAME = "council.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_url TEXT NOT NULL DEFAULT 'http://localhost:8081/v1/chat/completions',
        model_name TEXT NOT NULL DEFAULT 'gpt-4o',
        api_key TEXT DEFAULT '',
        role_prompt TEXT,
        is_active BOOLEAN DEFAULT 1
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        summarizer_api_url TEXT DEFAULT 'http://localhost:8081/v1/chat/completions',
        summarizer_model TEXT DEFAULT 'gpt-4o',
        summarizer_api_key TEXT DEFAULT '',
        summarizer_prompt TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        running_summary TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        user_q TEXT,
        summary TEXT,
        raw_dict TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    )
    ''')

    # Seed initial data if settings is empty
    cursor.execute('SELECT count(*) FROM settings')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
        INSERT INTO settings (id, summarizer_api_url, summarizer_model, summarizer_api_key, summarizer_prompt)
        VALUES (1, 'http://localhost:8081/v1/chat/completions', 'gemini-1.5-pro', '', '다음 텍스트들을 읽고, 여러 모델들의 의견을 종합한 결론과 개별 요약을 3~4문장 내외로 압축해 줘. 반드시 결론부터 말할 것.')
        ''')
        
    cursor.execute('SELECT count(*) FROM agents')
    if cursor.fetchone()[0] == 0:
        cursor.executemany('''
        INSERT INTO agents (name, api_url, model_name, api_key, role_prompt, is_active) VALUES (?, ?, ?, ?, ?, ?)
        ''', [
            ('Mock Claude', 'http://localhost:8080/v1/chat/completions', 'claude-3-opus', '', '당신은 보수적이고 비판적인 분석가입니다.', 1),
            ('Mock Gemini', 'http://localhost:8080/v1/chat/completions', 'gemini-1.5-pro', '', '당신은 창의적이고 혁신적인 제안가입니다.', 1),
            ('Mock GPT', 'http://localhost:8080/v1/chat/completions', 'gpt-4o', '', '당신은 중립적이고 객관적인 조정자입니다.', 1)
        ])

    conn.commit()
    conn.close()
    
    db_path = os.path.abspath(DB_NAME)
    print(f"✅ Success! SQLite DB (API Hybrid Scheme) initialized at: {db_path}")

if __name__ == "__main__":
    init_db()
