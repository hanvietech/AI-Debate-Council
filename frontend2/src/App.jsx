import { useState } from 'react';
import './index.css';
import SessionSidebar from './components/SessionSidebar';
import ChatArea from './components/ChatArea';
import AgentGrid from './components/AgentGrid';
import Settings from './components/Settings';
import { useDebate } from './hooks/useDebate';

export default function App() {
  const [activeTab, setActiveTab] = useState('console');
  const [refreshSessions, setRefreshSessions] = useState(0);

  const debateState = useDebate();

  const handleStop = async () => {
    await debateState.stopDebate();
    setRefreshSessions(r => r + 1); // Refresh sidebar after stop
  };

  const handleStart = async (msg) => {
    await debateState.startDebate(msg);
    setRefreshSessions(r => r + 1); // Refresh sidebar after started & done
  };

  const containerStyle = { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', overflow: 'hidden' };
  const headerStyle = { height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', gap: '20px' };
  const contentStyle = { display: 'flex', flex: 1, height: 'calc(100vh - 50px)', overflow: 'hidden' };
  const tabBtnStyle = (active) => ({ padding: '8px 16px', background: active ? 'var(--panel-bg)' : 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '600' });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <button style={tabBtnStyle(activeTab === 'console')} onClick={() => setActiveTab('console')}>🧠 Console</button>
        <button style={tabBtnStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
      </div>
      <div style={contentStyle}>
        {activeTab === 'console' ? (
          <>
            <div style={{ width: '20%', borderRight: '1px solid var(--border-color)', height: '100%' }}>
              <SessionSidebar 
                onSelectSession={debateState.loadSession} 
                onNewSession={debateState.clearSession}
                refreshFlag={refreshSessions} 
              />
            </div>
            <div style={{ width: '50%', borderRight: '1px solid var(--border-color)', height: '100%' }}>
              <ChatArea 
                chatHistory={debateState.chatHistory}
                isDebating={debateState.isDebating}
                currentSummaryStatus={debateState.currentSummaryStatus}
                onStart={handleStart}
                onStop={handleStop}
                onRestoreDetails={raw_dict => debateState.setAgentTexts(raw_dict)}
              />
            </div>
            <div style={{ width: '30%', height: '100%' }}>
              <AgentGrid agentTexts={debateState.agentTexts} />
            </div>
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
             <Settings />
          </div>
        )}
      </div>
    </div>
  );
}
