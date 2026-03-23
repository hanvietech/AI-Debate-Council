import { useState, useRef, useCallback } from 'react';

export function useDebate() {
  const [isDebating, setIsDebating] = useState(false);
  const [agentTexts, setAgentTexts] = useState({});
  const [chatHistory, setChatHistory] = useState([]);
  const [currentSummaryStatus, setCurrentSummaryStatus] = useState('');
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  const abortControllerRef = useRef(null);

  const startDebate = useCallback(async (userMsg) => {
    if (!userMsg.trim()) return;
    
    setIsDebating(true);
    setAgentTexts({});
    setCurrentSummaryStatus('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('/api/debate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_msg: userMsg, session_id: activeSessionId }),
        signal: abortControllerRef.current.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop(); 
        
        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            try {
              const data = JSON.parse(chunk.slice(6));
              
              if (data.type === 'session_started') {
                setActiveSessionId(data.session_id);
                setAgentTexts(prev => {
                  const newTexts = { ...prev };
                  data.agents.forEach(a => newTexts[a] = '');
                  return newTexts;
                });
              } else if (data.type === 'token') {
                setAgentTexts(prev => ({ ...prev, [data.agent]: (prev[data.agent] || '') + data.text }));
                if (data.text.includes('[API Error]') || data.text.includes('auth_unavailable')) {
                  window.dispatchEvent(new Event('auth_refresh_needed'));
                }
              } else if (data.type === 'summarizing') {
                setCurrentSummaryStatus('전담 에이전트 요약 진행 중...');
              } else if (data.type === 'done') {
                setChatHistory(prev => [
                  ...prev, 
                  { role: 'assistant', content: `**[위원회 종합 요약]**\n\n${data.summary}`, raw_dict: data.raw_dict }
                ]);
                setCurrentSummaryStatus('');
              }
            } catch(e) {}
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setCurrentSummaryStatus('토론이 중지되었습니다.');
      } else {
        console.error(e);
      }
    } finally {
      setIsDebating(false);
    }
  }, [activeSessionId]);

  const stopDebate = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    try { await fetch('/api/debate/stop', { method: 'POST' }); } catch(e) {}
    setIsDebating(false);
  }, []);

  const loadSession = useCallback(async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      setChatHistory(data.history || []);
      setActiveSessionId(sessionId);
      setAgentTexts({});
    } catch(e) { console.error(e); }
  }, []);

  const clearSession = useCallback(() => {
    setActiveSessionId(null);
    setChatHistory([]);
    setAgentTexts({});
    setCurrentSummaryStatus('');
  }, []);

  return {
    isDebating, agentTexts, chatHistory, currentSummaryStatus, activeSessionId,
    startDebate, stopDebate, loadSession, clearSession, setAgentTexts
  };
}
