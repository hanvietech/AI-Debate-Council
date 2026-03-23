import { useState, useEffect } from 'react';

export default function AgentGrid({ agentTexts = {} }) {
  const [agents, setAgents] = useState([]);
  const defaultColors = ['var(--claude-color)', 'var(--gemini-color)', 'var(--gpt-color)', 'var(--local-color)'];

  useEffect(() => {
    fetch('/api/agents').then(r=>r.json()).then(d=> {
       const active = (d.agents || []).filter(a => a.is_active);
       setAgents(active.map((a, i) => ({ ...a, color: defaultColors[i % defaultColors.length] })));
    });
  }, []);

  return (
    <div style={{ height: '100%', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '600' }}>Active Agents</h2>
      {agents.map((ag) => (
        <div key={ag.id} style={{ flex: 1, minHeight: '150px', border: `1.5px solid ${ag.color}`, borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', color: ag.color, fontWeight: 'bold', borderBottom: `1px solid var(--border-color)`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🤖</span> {ag.name}
          </div>
          <div style={{ padding: '12px', flex: 1, overflowY: 'auto', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
            {agentTexts[ag.name] || '대기 중...'}
          </div>
        </div>
      ))}
      {agents.length === 0 && <div style={{color:'var(--text-secondary)'}}>활성 에이전트가 없습니다.</div>}
    </div>
  );
}
