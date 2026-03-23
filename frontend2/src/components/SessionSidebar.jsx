import { useState, useEffect } from 'react';

export default function SessionSidebar({ onSelectSession, onNewSession, refreshFlag }) {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const loadSessions = () => {
    fetch('/api/sessions').then(r => r.json()).then(d => setSessions(d.sessions || []));
  };

  useEffect(() => {
    loadSessions();
  }, [refreshFlag]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("이 세션을 삭제하시겠습니까? 연관된 모든 토론 내역이 지워집니다.")) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    loadSessions();
  };

  const handleEditClick = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleEditSave = async (id) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle })
    });
    setEditingId(null);
    loadSessions();
  };

  return (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Sessions</h2>
        <button onClick={onNewSession} style={{ 
          background: 'var(--claude-color)', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
        }}>+ New</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sessions.map(s => (
          <div key={s.id} onClick={() => onSelectSession(s.id)} style={{ padding: '12px', background: 'var(--panel-bg)', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              {editingId === s.id ? (
                <input 
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => handleEditSave(s.id)}
                  onKeyDown={e => e.key === 'Enter' && handleEditSave(s.id)}
                  style={{ width: '100%', padding: '4px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{s.title}</div>
              )}
              <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                <button onClick={(e) => handleEditClick(e, s)} title="이름 변경" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '1rem', opacity: 0.7 }}>✏️</button>
                <button onClick={(e) => handleDelete(e, s.id)} title="삭제" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '1rem', opacity: 0.7 }}>🗑️</button>
              </div>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{s.date}</div>
          </div>
        ))}
        {sessions.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>저장된 세션이 없습니다.</div>}
      </div>
      
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
         <button style={{ width: '100%', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>⬇️ Export 세션</button>
      </div>
    </div>
  );
}
