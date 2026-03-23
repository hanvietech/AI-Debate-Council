import { useState, useRef, useEffect } from 'react';

export default function ChatArea({ chatHistory, isDebating, currentSummaryStatus, onStart, onStop, onRestoreDetails }) {
  const [inputVal, setInputVal] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, currentSummaryStatus]);

  const handleStart = () => {
    if (inputVal.trim() && !isDebating) {
      onStart(inputVal);
      setInputVal('');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: '600' }}>AI Council</h2>
      
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
         {chatHistory.map((msg, i) => (
           <div key={i} 
             onClick={() => msg.raw_dict && onRestoreDetails(msg.raw_dict)}
             style={{ 
               alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', 
               background: msg.role === 'user' ? '#1f6feb' : 'var(--panel-bg)',
               color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
               padding: '12px 16px', 
               borderRadius: 'var(--border-radius-md)',
               maxWidth: '85%',
               whiteSpace: 'pre-wrap',
               lineHeight: '1.5',
               cursor: msg.raw_dict ? 'pointer' : 'default',
               boxShadow: msg.raw_dict ? '0 0 0 1px var(--border-color) inset' : 'none'
             }}>
             {msg.content}
             {msg.raw_dict && <div style={{marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>👆 클릭하여 에이전트 원문 복원</div>}
           </div>
         ))}
         {currentSummaryStatus && (
           <div style={{ alignSelf: 'flex-start', background: 'var(--panel-bg)', padding: '12px 16px', borderRadius: 'var(--border-radius-md)', color: 'var(--text-secondary)' }}>
             🔄 {currentSummaryStatus}
           </div>
         )}
         <div ref={chatEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', background: 'var(--panel-bg)', padding: '8px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
         <input 
           type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
           onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
           placeholder="토론 안건을 길게 작성하세요..." 
           disabled={isDebating}
           style={{ flex: 1, background: 'var(--bg-color)', border: 'none', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '4px', outline: 'none', fontFamily: 'inherit' }} 
         />
         <button onClick={handleStart} disabled={isDebating} style={{ background: isDebating ? 'transparent' : '#238636', color: isDebating ? 'var(--text-secondary)' : '#fff', border: isDebating ? '1px solid var(--border-color)' : 'none', padding: '8px 16px', borderRadius: '4px', cursor: isDebating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
           Start Debate
         </button>
         <button onClick={onStop} disabled={!isDebating} style={{ background: !isDebating ? 'transparent' : '#da3633', color: !isDebating ? 'var(--text-secondary)' : '#fff', border: !isDebating ? '1px solid var(--border-color)' : 'none', padding: '8px 16px', borderRadius: '4px', cursor: !isDebating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
           Stop
         </button>
      </div>
    </div>
  );
}
