import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { getStorageData, updateStorageData, StorageData } from './storage'
import './index.css'

const Popup = () => {
  const [data, setData] = useState<StorageData | null>(null)
  const [activeTab, setActiveTab] = useState<'status' | 'saved'>('status')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    getStorageData().then(setData)
  }, [])

  // Sync data dynamically if storage changes under separate context
  useEffect(() => {
    const handleStorageChange = () => {
      getStorageData().then(setData)
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const hasApiKey = !!(data?.apiKey || data?.openaiApiKey || data?.anthropicApiKey)

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage()
    } else {
      window.open(chrome.runtime.getURL('options.html'))
    }
  }

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleDelete = async (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!data) return
    const currentSaved = data.savedPrompts || []
    const updated = currentSaved.filter((_, i) => i !== indexToDelete)
    await updateStorageData({ savedPrompts: updated })
    setData({ ...data, savedPrompts: updated })
  }

  if (!data) return null

  return (
    <div style={{
      width: '380px',
      padding: '20px',
      fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif",
      background: 'radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.15) 0%, rgba(8, 9, 13, 1) 100%)',
      color: '#e2e8f0',
      minHeight: '260px',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <h2 style={{
        margin: '0 0 16px 0',
        fontSize: '20px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        justifyContent: 'center'
      }}>
        <span className="text-gradient">AI Prompt Refiner</span>
        <span style={{ fontSize: '16px' }}>✨</span>
      </h2>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '16px',
        width: '100%'
      }}>
        <button
          onClick={() => setActiveTab('status')}
          className={`tab-button ${activeTab === 'status' ? 'active' : ''}`}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '13px',
            paddingBottom: '10px',
            outline: 'none',
            borderBottom: activeTab === 'status' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: activeTab === 'status' ? '#c084fc' : '#94a3b8',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
        >
          ⚡ Status
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`tab-button ${activeTab === 'saved' ? 'active' : ''}`}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '13px',
            paddingBottom: '10px',
            outline: 'none',
            borderBottom: activeTab === 'saved' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: activeTab === 'saved' ? '#c084fc' : '#94a3b8',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px'
          }}
        >
          📂 Saved ({data.savedPrompts?.length || 0})
        </button>
      </div>

      {/* Content Panels */}
      <div style={{ flex: '1 1 auto', overflowY: 'auto', maxHeight: '320px' }}>
        {activeTab === 'status' ? (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '10px 0' }}>
            {!hasApiKey ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '0 0 4px 0', lineHeight: 1.5 }}>
                  Welcome! To activate prompt engineering enhancements, please configure an API Key.
                </p>
                <button
                  onClick={openOptions}
                  className="btn-primary"
                  style={{
                    padding: '8px 20px',
                    fontSize: '13px',
                    width: 'auto'
                  }}
                >
                  Configure API Key
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '30px',
                  padding: '6px 14px',
                  color: '#34d399',
                  fontSize: '13px',
                  fontWeight: 600
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                    display: 'inline-block'
                  }}></span>
                  Extension active & ready!
                </div>
                
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0', padding: '0 10px', lineHeight: 1.5 }}>
                  Look for the ✨ button next to your chat inputs on ChatGPT, Claude, Gemini, or LMSYS.
                </p>

                <button
                  onClick={openOptions}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginTop: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  Manage Settings
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!data.savedPrompts || data.savedPrompts.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '30px 10px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                color: '#64748b',
                textAlign: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '24px' }}>📂</span>
                <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '13px' }}>No saved prompts</div>
                <div style={{ fontSize: '11px', color: '#475569', maxWidth: '240px', lineHeight: 1.4 }}>
                  Saved optimized prompts will appear here for fast copy-pasting.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
                {data.savedPrompts.map((promptText, idx) => {
                  const isCopied = copiedIndex === idx
                  return (
                    <div
                      key={idx}
                      onClick={() => handleCopy(promptText, idx)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: isCopied ? '1px solid rgba(139, 92, 246, 0.45)' : '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        boxShadow: isCopied ? '0 0 10px rgba(139, 92, 246, 0.1)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.03)'
                        e.currentTarget.style.borderColor = isCopied ? 'rgba(139, 92, 246, 0.45)' : 'rgba(139, 92, 246, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                        e.currentTarget.style.borderColor = isCopied ? 'rgba(139, 92, 246, 0.45)' : 'rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#f1f5f9',
                          lineHeight: '1.4',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrientation: 'vertical',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap'
                        } as any}>
                          {promptText}
                        </div>
                        {isCopied && (
                          <span style={{
                            fontSize: '10px',
                            color: '#c084fc',
                            fontWeight: 600,
                            marginTop: '2px',
                            display: 'block'
                          }}>
                            ✓ Copied to clipboard!
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleDelete(idx, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.stopPropagation()
                          e.currentTarget.style.color = '#ef4444'
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation()
                          e.currentTarget.style.color = '#475569'
                          e.currentTarget.style.background = 'none'
                        }}
                        title="Delete saved prompt"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const rootEl = document.getElementById('root')!
const root = ReactDOM.createRoot(rootEl)
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
)