import React, { useState, useEffect } from 'react';
import './AuthPanel.css';

export default function AuthPanel() {
  const [providers, setProviders] = useState([]);
  const [authStatus, setAuthStatus] = useState([]);
  const [loadingFlag, setLoadingFlag] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAuthData = async () => {
    try {
      const [provRes, statRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/auth/providers'),
        fetch('http://127.0.0.1:8000/api/auth/status')
      ]);
      const provData = await provRes.json();
      const statData = await statRes.json();
      setProviders(provData);
      setAuthStatus(statData);
    } catch (e) {
      console.error(e);
      setErrorMsg('인증 상태를 불러오는데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchAuthData();
    const interval = setInterval(fetchAuthData, 15000);
    const handleRefresh = () => fetchAuthData();
    window.addEventListener('auth_refresh_needed', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('auth_refresh_needed', handleRefresh);
    };
  }, []);

  const handleLogin = async (flag) => {
    let extraInput = null;
    if (flag.includes('cookie')) {
      extraInput = window.prompt("인증에 필요한 브라우저 쿠키값 또는 코드를 입력해주세요:");
      if (!extraInput) return;
    }

    setLoadingFlag(flag);
    setErrorMsg('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_flag: flag, extra_input: extraInput })
      });

      if (!response.ok || !response.body) {
        setErrorMsg(`서버 응답 오류: ${response.status}`);
        setLoadingFlag(null);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';
      let oauthWindow = null;

      while (true) {
        let result;
        try {
          result = await reader.read();
        } catch (readErr) {
          console.error('SSE read error:', readErr);
          break;
        }
        const { value, done } = result;
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        
        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'oauth_url') {
                  oauthWindow = window.open(data.url, '_blank', 'width=600,height=800');
                } else if (data.type === 'complete') {
                  if (oauthWindow) oauthWindow.close();
                  setTimeout(async () => {
                    await fetchAuthData();
                    setLoadingFlag(null);
                  }, 2000);
                  return;
                } else if (data.type === 'error') {
                  setErrorMsg(`로그인 에러: ${data.message}`);
                  setLoadingFlag(null);
                  return;
                } else if (data.type === 'stream_end') {
                  setTimeout(async () => {
                    await fetchAuthData();
                    setLoadingFlag(null);
                  }, 2000);
                  return;
                }
              } catch(e) {}
            }
          }
        }
      }
      // Stream ended without explicit event — refresh anyway
      await fetchAuthData();
    } catch (e) {
      console.error('Login flow error:', e);
      setErrorMsg(`네트워크 에러: ${e.message}`);
    }
    setLoadingFlag(null);
  };

  return (
    <div className="auth-panel-container">
      <h3>🔐 전역 인공지능 로그인 (OAuth)</h3>
      <p className="auth-subtitle">프록시 서버가 여기에 등록된 인증 세션을 활용하여 모델을 우회 호출합니다.</p>
      
      {errorMsg && <div className="auth-error-banner">{errorMsg}</div>}
      
      <div className="auth-grid">
        {providers.map(p => {
          // 상태 찾기 로직: provider 플래그 이름이나 라벨과 일치하는 상태 찾기
          const status = authStatus.find(s => 
            p.label.toLowerCase().includes(s.provider.toLowerCase()) || 
            p.flag.toLowerCase().includes(s.provider.toLowerCase())
          );
          
          let stateClass = "unconnected";
          let dot = "🔴";
          if (status) {
            if (status.is_valid) { stateClass = "active"; dot = "🟢"; }
            else { stateClass = "expired"; dot = "🟡"; }
          }
          
          return (
            <div key={p.flag} className={`auth-card ${stateClass}`}>
               <div className="auth-card-header">
                 <span className="auth-dot">{dot}</span>
                 <strong>{p.label}</strong>
               </div>
               
               {status ? (
                 <div className="auth-info">
                   <div className="auth-email">{status.email}</div>
                   {status.expired ? <div className="auth-expires">만료: {new Date(status.expired).toLocaleString()}</div> : null}
                 </div>
               ) : (
                 <div className="auth-info unconnected-text">연결 안 됨</div>
               )}
               
               <div className="auth-actions">
                 {loadingFlag === p.flag ? (
                   <span className="auth-spinner-text">인증 대기 중...</span>
                 ) : (
                   <button onClick={() => handleLogin(p.flag)} className="auth-btn">
                     {status ? "재인증 (갱신)" : "로그인"}
                   </button>
                 )}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
