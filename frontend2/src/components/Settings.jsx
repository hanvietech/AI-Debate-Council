import { useState, useEffect } from 'react';
import AuthPanel from './AuthPanel';

export default function Settings() {
  const [sApiUrl, setSApiUrl] = useState('');
  const [sModel, setSModel] = useState('');
  const [sApiKey, setSApiKey] = useState('');
  const [promptStr, setPromptStr] = useState('');
  const [agents, setAgents] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);

  const loadData = async () => {
    const sRes = await fetch('/api/settings');
    const sData = await sRes.json();
    setSApiUrl(sData.summarizer_api_url || '');
    setSModel(sData.summarizer_model || '');
    setSApiKey(sData.summarizer_api_key || '');
    setPromptStr(sData.summarizer_prompt || '');

    const aRes = await fetch('/api/agents');
    const aData = await aRes.json();
    setAgents(aData.agents || []);
  };

  const loadModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      setAvailableModels(data.models || []);
    } catch(e) {}
  };

  useEffect(() => { loadData(); loadModels(); }, []);

  const saveSummarizer = async () => {
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        summarizer_api_url: sApiUrl,
        summarizer_model: sModel,
        summarizer_api_key: sApiKey,
        summarizer_prompt: promptStr
      })
    });
    alert('Summarizer 설정이 저장되었습니다.');
  };

  const saveAgents = async () => {
    await fetch('/api/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agents)
    });
    alert('Agents 설정이 갱신되었습니다.');
    loadData();
  };

  const updateAgent = (index, field, value) => {
    const newAgents = [...agents];
    newAgents[index] = { ...newAgents[index], [field]: value };
    setAgents(newAgents);
  };

  const addAgent = () => {
    setAgents([...agents, {
      id: null,
      name: 'New Agent',
      api_url: 'http://127.0.0.1:8081/v1/chat/completions',
      model_name: 'gpt-4o',
      api_key: '',
      role_prompt: '너는 훌륭한 토론자야.',
      is_active: 1
    }]);
  };

  const removeAgent = (index) => {
    if (!window.confirm("이 에이전트를 삭제하시겠습니까?")) return;
    const newAgents = [...agents];
    newAgents.splice(index, 1);
    setAgents(newAgents);
  };

  const inputStyle = { width: '100%', padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* 0단: Auth Panel */}
      <AuthPanel />

      {/* 1단: Summarizer Setting */}
      <div>
        <h3 style={{ marginTop: 0, fontSize: '1.2rem', fontWeight: '600' }}>📝 Summarizer Setting</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--panel-bg)', padding: '24px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Proxy / API URL</label>
            <input type="text" value={sApiUrl} onChange={e=>setSApiUrl(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Model Name</label>
              <input type="text" value={sModel} onChange={e=>setSModel(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>API Key (Optional)</label>
              <input type="password" value={sApiKey} onChange={e=>setSApiKey(e.target.value)} placeholder="If using direct API" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Prompt</label>
            <textarea rows="3" value={promptStr} onChange={e=>setPromptStr(e.target.value)} style={{ ...inputStyle, fontFamily: 'inherit' }} />
          </div>
          <button onClick={saveSummarizer} style={{ background: 'var(--gemini-color)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', alignSelf: 'flex-start' }}>Save Summarizer Config</button>
        </div>
      </div>

      {/* 2단: Agents Management */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>🤖 Agents Management</h3>
          <button onClick={addAgent} style={{ background: 'var(--claude-color)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Agent</button>
        </div>
        
        <div style={{ background: 'var(--panel-bg)', padding: '24px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 8px', width: '15%' }}>Name</th>
                <th style={{ padding: '12px 8px', width: '15%' }}>Model</th>
                <th style={{ padding: '12px 8px', width: '25%' }}>API URL</th>
                <th style={{ padding: '12px 8px', width: '15%' }}>API Key</th>
                <th style={{ padding: '12px 8px', width: '20%' }}>Role Prompt</th>
                <th style={{ padding: '12px 8px', width: '5%', textAlign: 'center' }}>Active</th>
                <th style={{ padding: '12px 8px', width: '5%', textAlign: 'center' }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((ag, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px' }}><input type="text" value={ag.name} onChange={e => updateAgent(i, 'name', e.target.value)} style={inputStyle} /></td>
                  <td style={{ padding: '8px' }}>
                    <select 
                      value={ag.model_name} 
                      onChange={e => updateAgent(i, 'model_name', e.target.value)} 
                      style={{ ...inputStyle, color: 'var(--gpt-color)', appearance: 'auto' }}
                    >
                      {availableModels.includes(ag.model_name) || !ag.model_name ? null : <option value={ag.model_name}>{ag.model_name} (미연결)</option>}
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      {availableModels.length === 0 && (!ag.model_name || availableModels.includes(ag.model_name)) && <option value={ag.model_name}>{ag.model_name || 'Loading...'}</option>}
                    </select>
                  </td>
                  <td style={{ padding: '8px' }}><input type="text" value={ag.api_url} onChange={e => updateAgent(i, 'api_url', e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85em' }} /></td>
                  <td style={{ padding: '8px' }}><input type="password" value={ag.api_key} onChange={e => updateAgent(i, 'api_key', e.target.value)} placeholder="Optional" style={inputStyle} /></td>
                  <td style={{ padding: '8px' }}><input type="text" value={ag.role_prompt} onChange={e => updateAgent(i, 'role_prompt', e.target.value)} style={inputStyle} /></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <input type="checkbox" checked={ag.is_active === 1} onChange={e => updateAgent(i, 'is_active', e.target.checked ? 1 : 0)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button onClick={() => removeAgent(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.8 }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agents.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>등록된 에이전트가 없습니다.</div>}
          
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={loadData} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>🔄 Revert</button>
            <button onClick={saveAgents} style={{ background: 'var(--gpt-color)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>💾 Save All Agents</button>
          </div>
        </div>
      </div>
    </div>
  );
}
