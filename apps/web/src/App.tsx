import { useState, useEffect } from 'react'
import './App.css'

interface HealthStatus {
  status: string;
  app: string;
  version: string;
  groq_configured: boolean;
  spreadsheet_configured: boolean;
  meta: {
    row_count: number;
    last_sync_at: string | null;
    index_ready: boolean;
  };
}



interface StatItem {
  name: string;
  count: number;
}

interface ProblemItem {
  problem: string;
  count: number;
}

interface DatabaseStats {
  total_reviews: number;
  personas: StatItem[];
  barriers: StatItem[];
  product_areas: StatItem[];
  priorities: StatItem[];
  emotions: StatItem[];
  problems: ProblemItem[];
}

interface Citation {
  review_id: string;
  review: string;
  user_persona?: string;
  product_area?: string;
  barrier_to_new_category?: string;
  shopping_goal?: string;
  frequency?: string;
  priority?: string;
  emotion?: string;
}

interface Theme {
  name: string;
  support_count: number;
  description: string;
  citations: string[];
}

interface BarrierInsight {
  barrier: string;
  count: number;
  citations: string[];
}

interface PersonaInsight {
  persona: string;
  behavior_summary: string;
  citations: string[];
}

interface ValidationReport {
  citation_accuracy_score: number;
  average_retrieval_distance: number;
  total_citations_checked: number;
  total_citations_failed: number;
  warnings: string[];
}

interface InsightResponse {
  ok: boolean;
  answer_summary: string;
  key_themes: Theme[];
  barriers: BarrierInsight[];
  persona_insights: PersonaInsight[];
  evidence_quality: 'strong' | 'moderate' | 'weak' | 'insufficient';
  citations: Citation[];
  validation_report?: ValidationReport;
}


const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'ask' | 'explore' | 'methodology' | 'validation'>('ask');

  // Connection and Meta States
  const [apiHealth, setApiHealth] = useState<HealthStatus | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  
  // Interaction / Filter States
  const [question, setQuestion] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<string>('All Personas');
  const [selectedBarrier, setSelectedBarrier] = useState<string>('All Barriers');
  const [selectedProductArea, setSelectedProductArea] = useState<string>('All Product Areas');
  const [selectedPriority, setSelectedPriority] = useState<string>('All Priorities');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('All Emotions');
  
  // Loading States
  const [queryLoading, setQueryLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [rebuilding, setRebuilding] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result States
  const [ragResult, setRagResult] = useState<InsightResponse | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetchStatusFiltersAndStats();
  }, []);

  const fetchStatusFiltersAndStats = async () => {
    setCheckingHealth(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Health
      const healthRes = await fetch(`${API_BASE}/health`);
      if (!healthRes.ok) throw new Error("API server responded with error");
      const healthData = (await healthRes.json()) as HealthStatus;
      setApiHealth(healthData);



      // 3. Fetch database stats
      const statsRes = await fetch(`${API_BASE}/stats`);
      if (statsRes.ok) {
        const statsData = (await statsRes.json()) as DatabaseStats;
        setDbStats(statsData);
      }
    } catch (err) {
      console.error("Connection failed:", err);
      setApiHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Sync failed");
      
      alert(`Sync succeeded! Synced ${data.row_count} reviews. Vector index updated successfully.`);
      await fetchStatusFiltersAndStats();
    } catch (err: any) {
      console.error("Sync error:", err);
      setErrorMsg(err.message || "Failed to sync reviews dataset");
    } finally {
      setSyncing(false);
    }
  };

  const handleRebuild = async () => {
    if (rebuilding) return;
    const confirmRebuild = window.confirm(
      "WARNING: A full rebuild will completely drop the Chroma vector store index, clear all local SQLite content caches, and sync from scratch. This can take a couple of minutes. Do you want to proceed?"
    );
    if (!confirmRebuild) return;

    setRebuilding(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/sync/rebuild`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Rebuild failed");
      
      alert(`Wipe & rebuild completed successfully! Synced ${data.row_count} reviews, and fully populated the vector index.`);
      await fetchStatusFiltersAndStats();
    } catch (err: any) {
      console.error("Rebuild error:", err);
      setErrorMsg(err.message || "Failed to perform a full index rebuild.");
    } finally {
      setRebuilding(false);
    }
  };



  const handleQuery = async (e?: React.FormEvent, customQuestion?: string, customFilters?: any) => {
    if (e) e.preventDefault();
    
    const targetQuestion = customQuestion !== undefined ? customQuestion : question;
    if (!targetQuestion.trim()) return;

    setQueryLoading(true);
    setErrorMsg(null);
    setRagResult(null);
    setActiveCitation(null);
    setHighlightedCitationId(null);

    // Read active states or custom arguments
    const persona = customFilters ? customFilters.persona : selectedPersona;
    const barrier = customFilters ? customFilters.barrier : selectedBarrier;
    const area = customFilters ? customFilters.area : selectedProductArea;
    const priority = customFilters ? customFilters.priority : selectedPriority;
    const emotion = customFilters ? customFilters.emotion : selectedEmotion;

    const payload = {
      question: targetQuestion.trim(),
      filters: {
        user_persona: persona !== 'All Personas' ? persona : undefined,
        barrier_to_new_category: barrier !== 'All Barriers' ? barrier : undefined,
        product_area: area !== 'All Product Areas' ? area : undefined,
        priority: priority !== 'All Priorities' ? priority : undefined,
        emotion: emotion !== 'All Emotions' ? emotion : undefined
      }
    };

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Query execution failed");
      setRagResult(data as InsightResponse);
    } catch (err: any) {
      console.error("Query error:", err);
      setErrorMsg(err.message || "Failed to generate grounded RAG insights");
    } finally {
      setQueryLoading(false);
    }
  };

  // Click-through exploration triggers
  const triggerExploreFilter = (type: 'persona' | 'barrier' | 'area', value: string) => {
    // Reset all other dropdowns
    setSelectedPersona('All Personas');
    setSelectedBarrier('All Barriers');
    setSelectedProductArea('All Product Areas');
    setSelectedPriority('All Priorities');
    setSelectedEmotion('All Emotions');

    const filtersUpdate: any = {
      persona: 'All Personas',
      barrier: 'All Barriers',
      area: 'All Product Areas'
    };

    let qText = "";
    if (type === 'persona') {
      setSelectedPersona(value);
      filtersUpdate.persona = value;
      qText = `Summarize exploration barriers and shopping habits for ${value}`;
    } else if (type === 'barrier') {
      setSelectedBarrier(value);
      filtersUpdate.barrier = value;
      qText = `What product concerns trigger the barrier: "${value}"?`;
    } else if (type === 'area') {
      setSelectedProductArea(value);
      filtersUpdate.area = value;
      qText = `Analyze client issues and unmet needs in the ${value} area`;
    }

    setQuestion(qText);
    setActiveTab('ask');
    handleQuery(undefined, qText, filtersUpdate);
  };

  const highlightCitation = (cid: string) => {
    setHighlightedCitationId(cid);
    const element = document.getElementById(`cit-${cid}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const visibleBarriers = dbStats ? dbStats.barriers.slice(0, 6) : [];
  const barriersSum = visibleBarriers.reduce((acc, b) => acc + b.count, 0) || 1;
  const visiblePersonas = dbStats ? dbStats.personas.slice(0, 6) : [];
  const personasSum = visiblePersonas.reduce((acc, p) => acc + p.count, 0) || 1;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">Blinkit Discovery</span>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="nav-links">
          <a 
            href="#" 
            className={`nav-item ${activeTab === 'ask' ? 'active' : ''}`}
            onClick={() => setActiveTab('ask')}
          >
            <span className="icon">🔍</span> Ask Engine
          </a>
          <a 
            href="#" 
            className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
            onClick={() => setActiveTab('explore')}
          >
            <span className="icon">📊</span> Explore Dataset
          </a>
          <a 
            href="#" 
            className={`nav-item ${activeTab === 'methodology' ? 'active' : ''}`}
            onClick={() => setActiveTab('methodology')}
          >
            <span className="icon">💡</span> Theme Methodology
          </a>
          <a 
            href="#" 
            className={`nav-item ${activeTab === 'validation' ? 'active' : ''}`}
            onClick={() => setActiveTab('validation')}
          >
            <span className="icon">🛡️</span> Validation Methodology
          </a>
        </nav>
        
        {/* System Status Strip */}
        <div className="status-indicator-box">
          <div className="status-title">System Status</div>
          <div className="status-row">
            <span className="status-dot green"></span>
            <span className="status-label">Frontend UI: Running</span>
          </div>
          <div className="status-row">
            <span className={`status-dot ${apiHealth ? 'green' : checkingHealth ? 'orange' : 'red'}`}></span>
            <span className="status-label">
              Backend API: {checkingHealth ? 'Checking...' : apiHealth ? 'Connected' : 'Offline'}
            </span>
          </div>
          
          {apiHealth && (
            <div className="api-details">
              <div>Synced reviews: <strong>{apiHealth.meta.row_count}</strong></div>
              <div>Last sync: <span>{apiHealth.meta.last_sync_at ? new Date(apiHealth.meta.last_sync_at).toLocaleTimeString() : 'Never'}</span></div>
              <div>LLM Mode: <strong>Active</strong></div>
            </div>
          )}
          
          {!apiHealth && !checkingHealth && (
            <button className="reconnect-btn" onClick={fetchStatusFiltersAndStats}>
              🔌 Reconnect API
            </button>
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <header className="top-header">
          <div className="header-title-box">
            <h1>AI-Powered Category Discovery Engine</h1>
            <p className="subtitle">
              {activeTab === 'ask' && 'Interactive PM Question Panel'}
              {activeTab === 'explore' && 'Semantic Dataset Exploration Charts'}
              {activeTab === 'methodology' && 'How LLM & Vector Database Extract Customer Insights'}
              {activeTab === 'validation' && 'How LLM-as-a-Judge Audits & Grounding Rules Verify Insights'}
            </p>
          </div>
          <div className="header-actions">
            <button 
              className={`sync-button ${syncing ? 'loading' : ''}`} 
              onClick={handleSync}
              disabled={syncing || rebuilding || !apiHealth}
            >
              <span className="icon">{syncing ? '⏳' : '🔄'}</span> 
              {syncing ? 'Syncing...' : 'Sync Google Sheet'}
            </button>
            <button 
              className={`rebuild-button ${rebuilding ? 'loading' : ''}`} 
              onClick={handleRebuild}
              disabled={syncing || rebuilding || !apiHealth}
            >
              <span className="icon">{rebuilding ? '⏳' : '⚠️'}</span> 
              {rebuilding ? 'Rebuilding...' : 'Full Rebuild'}
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="error-alert">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <strong>Action Failed</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {activeTab === 'ask' && (
          <div className="dashboard-grid">
            {/* Ask Card */}
            <section className="dashboard-card query-card">
              <h2>Ask Research Question</h2>
              <p className="card-description">Ask natural-language questions or select a suggested topic to analyze category trial barriers.</p>
              
              <form onSubmit={handleQuery} className="ask-form">
                <div className="search-bar-container">
                  <input
                    type="text"
                    placeholder="e.g. Why are budget shoppers hesitant to explore organic groceries?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="search-input"
                    disabled={queryLoading || !apiHealth}
                  />
                  <button 
                    type="submit" 
                    className="search-button" 
                    disabled={queryLoading || !apiHealth || !question.trim()}
                  >
                    {queryLoading ? 'Thinking...' : 'Analyze'}
                  </button>
                </div>
              </form>

              {/* Suggestion Prompts Section */}
              <h3 className="suggestion-title">Suggested Research Questions</h3>
              <div className="suggestion-grid">
                {[
                  "Why do users repeatedly buy from the same categories?",
                  "What prevents users from exploring new categories?",
                  "How do users discover products today?",
                  "What role do habits play in shopping behavior?",
                  "What information do users need before trying a new category?",
                  "What frustrations emerge repeatedly?",
                  "Which user segments are more likely to experiment?",
                  "What unmet needs emerge consistently across discussions?"
                ].map((q) => (
                  <button
                    key={q}
                    className="suggestion-card"
                    disabled={queryLoading || !apiHealth}
                    onClick={() => {
                      setQuestion(q);
                      handleQuery(undefined, q);
                    }}
                  >
                    <span className="suggestion-icon">🔍</span>
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Insight Summary Block */}
            <section className="dashboard-card summary-card">
              <div className="card-header">
                <h2>Insight Summary</h2>
                {ragResult && (
                  <span className={`badge badge-${ragResult.evidence_quality}`}>
                    evidence: {ragResult.evidence_quality}
                  </span>
                )}
                {queryLoading && <span className="badge badge-loading">Analyzing...</span>}
              </div>

              {queryLoading && (
                <div className="skeleton-container">
                  <div className="skeleton-line full"></div>
                  <div className="skeleton-line full"></div>
                  <div className="skeleton-line half"></div>
                </div>
              )}

              {!queryLoading && !ragResult && (
                <div className="empty-state">
                  <p className="placeholder-text">
                    Submit a query, select a suggested question below, or click an item in the Explore Dataset view.
                  </p>
                </div>
              )}

              {ragResult && (
                <div className="rag-output-box">
                  <p className="summary-text">{ragResult.answer_summary}</p>

                  {ragResult.validation_report && (
                    <div className="validation-report-box">
                      <div className="validation-report-header">
                        <span className="validation-title">⚙️ Insight Quality Check</span>
                        <span className={`validation-score-badge val-score-${
                          ragResult.validation_report.citation_accuracy_score === 1.0 
                            ? 'perfect' 
                            : ragResult.validation_report.citation_accuracy_score >= 0.7 
                            ? 'good' 
                            : 'poor'
                        }`}>
                          Accuracy: {Math.round(ragResult.validation_report.citation_accuracy_score * 100)}%
                        </span>
                      </div>
                      
                      <div className="validation-metrics-grid">
                        <div className="validation-metric-card">
                          <span className="val-lbl">Citation Accuracy</span>
                          <span className="val-num">
                            {ragResult.validation_report.total_citations_checked - ragResult.validation_report.total_citations_failed} / {ragResult.validation_report.total_citations_checked}
                          </span>
                          <span className="val-sub">citations verified</span>
                        </div>
                        
                        <div className="validation-metric-card">
                          <span className="val-lbl">Retrieval Relevance</span>
                          <span className="val-num">
                            {(1.5 - ragResult.validation_report.average_retrieval_distance).toFixed(3)}
                          </span>
                          <span className="val-sub">
                            {ragResult.validation_report.average_retrieval_distance < 1.0 
                              ? '🎯 Excellent match' 
                              : ragResult.validation_report.average_retrieval_distance < 1.3 
                              ? '⚡ Moderate match' 
                              : '⚠️ Low match'}
                          </span>
                        </div>
                      </div>


                    </div>
                  )}
                  
                  {ragResult.key_themes.length > 0 && (
                    <div className="themes-section">
                      <h3>Identified Themes</h3>
                      <div className="themes-grid">
                        {ragResult.key_themes.map((t, idx) => (
                          <div key={idx} className="theme-pill">
                            <div className="theme-header">
                              <span className="theme-name">{t.name}</span>
                              <span className="theme-count">({t.support_count} reviews)</span>
                            </div>
                            <p className="theme-desc">{t.description}</p>
                            <div className="citation-pills-row">
                              {t.citations.map(cid => (
                                <span 
                                  key={cid} 
                                  className="cit-ref-bubble"
                                  onClick={() => highlightCitation(cid)}
                                >
                                  #{cid}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Extra aggregations */}
                  <div className="extra-insights-row">
                    {ragResult.barriers.length > 0 && (
                      <div className="extra-insights-col">
                        <h3>Barriers Breakdown</h3>
                        <ul className="extra-list">
                          {ragResult.barriers.map((b, idx) => (
                            <li key={idx}>
                              <span className="bold-bullet">{b.barrier}</span> 
                              <span className="count-tag">x{b.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ragResult.persona_insights.length > 0 && (
                      <div className="extra-insights-col">
                        <h3>Persona Comfort</h3>
                        <ul className="extra-list">
                          {ragResult.persona_insights.map((p, idx) => (
                            <li key={idx}>
                              <span className="bold-bullet">{p.persona}</span>: {p.behavior_summary}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Citations List Panel */}
            <section className="dashboard-card evidence-card">
              <h2>Evidence Citations List</h2>
              <p className="card-description">Specific feedback entries supporting the summary conclusions (Click to expand detail fields).</p>
              
              {queryLoading && (
                <div className="skeleton-container">
                  <div className="skeleton-item-box"></div>
                  <div className="skeleton-item-box"></div>
                </div>
              )}

              {!queryLoading && (!ragResult || ragResult.citations.length === 0) && (
                <div className="empty-state">
                  <p className="placeholder-text">Citations will list here when a query returns matching reviews.</p>
                </div>
              )}

              {ragResult && ragResult.citations.length > 0 && (
                <div className="evidence-list-container">
                  {ragResult.citations.map((c) => (
                    <div 
                      key={c.review_id} 
                      id={`cit-${c.review_id}`}
                      className={`evidence-item ${highlightedCitationId === c.review_id ? 'highlighted' : ''} ${activeCitation?.review_id === c.review_id ? 'active' : ''}`}
                      onClick={() => setActiveCitation(c)}
                    >
                      <div className="evidence-header">
                        <span className="ev-id">#REV-{c.review_id}</span>
                        <span className="ev-meta">
                          {c.user_persona || 'Unlabeled'} · {c.product_area || 'Other'}
                        </span>
                      </div>
                      <div className="ev-text">"{c.review}"</div>
                      {c.barrier_to_new_category && (
                        <div className="ev-barrier-tag">
                          Barrier: {c.barrier_to_new_category}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'explore' && (
          /* Explore Screen Tab */
          <div className="explore-container">
            {!dbStats && (
              <div className="empty-state">
                <p className="placeholder-text">Loading dataset statistics... Make sure API is online.</p>
              </div>
            )}
            
            {dbStats && (
              <div className="explore-grid">
                
                {/* Database Metrics Overview */}
                <div className="explore-summary-card">
                  <div className="stat-giant">{dbStats.total_reviews}</div>
                  <div className="stat-giant-lbl">Total Feedback reviews Synced</div>
                </div>

                 {/* Dominant Exploration Barriers */}
                <div className="explore-chart-card">
                  <h3>Dominant exploration Barriers</h3>
                  <p className="card-description">Click a barrier to filters details and ask specific questions.</p>
                  <div className="bar-chart-container">
                    {visibleBarriers.map((b) => (
                      <div 
                        key={b.name} 
                        className="bar-row"
                        onClick={() => triggerExploreFilter('barrier', b.name)}
                      >
                        <div className="bar-label-box">
                          <span className="bar-name">{b.name}</span>
                        </div>
                        <div className="bar-track">
                          <div 
                            className="bar-fill fill-orange" 
                            style={{ width: `${Math.max(4, (b.count / barriersSum) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Segment Distribution */}
                <div className="explore-chart-card">
                  <h3>Shopper Segment Breakdown</h3>
                  <p className="card-description">Click a persona to analyze segment Comfort and unmet needs.</p>
                  <div className="bar-chart-container">
                    {visiblePersonas.map((p) => (
                      <div 
                        key={p.name} 
                        className="bar-row"
                        onClick={() => triggerExploreFilter('persona', p.name)}
                      >
                        <div className="bar-label-box">
                          <span className="bar-name">{p.name}</span>
                        </div>
                        <div className="bar-track">
                          <div 
                            className="bar-fill fill-blue" 
                            style={{ width: `${Math.max(4, (p.count / personasSum) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>



              </div>
            )}
          </div>
        )}

        {activeTab === 'methodology' && (
          <div className="methodology-container">
            {/* Header section explaining Discovery Engine */}
            <div className="methodology-header-card">
              <h2>How does the Discovery Engine generate themes from user feedback?</h2>
              <p>
                Google Sheets acts as the central knowledge repository. Each review is enriched by the n8n workflow with AI-generated metadata such as intent, emotion, barrier, category, and theme. The dashboard queries this structured dataset to answer product research questions.
              </p>
            </div>

            {/* Horizontal Data Flow Pipeline Diagram */}
            <div className="architecture-card">
              <h3>System Data Flow Pipeline</h3>
              <div className="flow-steps-grid">
                <div className="flow-step">
                  <div className="flow-icon">🌐</div>
                  <h4>Sources</h4>
                  <span>Google Play Store + App Store + Kaggle + Reddit</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step highlight-blue">
                  <div className="flow-icon">🐍</div>
                  <h4>Python Scraper</h4>
                  <span>Generated with Claude</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step">
                  <div className="flow-icon">📄</div>
                  <h4>Raw Reviews</h4>
                  <span>Unfiltered Feedback Dataset</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step highlight-yellow">
                  <div className="flow-icon">📊</div>
                  <h4>Google Sheets</h4>
                  <span>Central Knowledge Repository</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step">
                  <div className="flow-icon">🤖</div>
                  <h4>Theme Generation</h4>
                  <span>AI Clustering & Tagging</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step highlight-green">
                  <div className="flow-icon">🎯</div>
                  <h4>Insight Dashboard</h4>
                  <span>PM Research Engine</span>
                </div>
              </div>
            </div>

            {/* SECTION 1: AI Pipeline */}
            <div className="methodology-section-title">
              <h3>AI Pipeline Steps & Methodology</h3>
            </div>
            
            <div className="pipeline-steps-grid">
              {/* Step 1 */}
              <div className="pipeline-step-card">
                <div className="step-badge">Step 1</div>
                <h4>Collect Feedback</h4>
                <div className="step-label">Sources:</div>
                <ul className="step-list">
                  <li>✓ Google Play Store</li>
                  <li>✓ App Store</li>
                  <li>✓ Kaggle</li>
                  <li>✓ Reddit</li>
                </ul>
                <div className="step-output">
                  <span>Output:</span> <strong>382 Reviews Collected</strong>
                </div>
              </div>

              {/* Step 2 */}
              <div className="pipeline-step-card">
                <div className="step-badge">Step 2</div>
                <h4>Clean & Prepare Data</h4>
                <div className="step-label">AI Removes:</div>
                <ul className="step-list">
                  <li>• Duplicate reviews</li>
                  <li>• Spam & Emojis</li>
                  <li>• Empty comments</li>
                  <li>• Normalizes text</li>
                </ul>
                <div className="step-output">
                  <span>Output:</span> <strong>Clean Dataset</strong>
                </div>
              </div>

              {/* Step 3 */}
              <div className="pipeline-step-card">
                <div className="step-badge">Step 3</div>
                <h4>Groq Analysis (via n8n)</h4>
                <p className="step-desc">Each review is sent to Groq to extract key product attributes:</p>
                <ul className="step-list highlight-list">
                  <li>• User Intent</li>
                  <li>• Pain Point</li>
                  <li>• Category</li>
                  <li>• Emotion</li>
                  <li>• Shopping Behaviour</li>
                </ul>
                <div className="step-example-box">
                  <strong>Example:</strong>
                  <div className="example-text">"I always reorder groceries."</div>
                  <div className="example-meta">
                    <span>Intent:</span> Repeat Purchase<br/>
                    <span>Emotion:</span> Convenience<br/>
                    <span>Barrier:</span> No exploration
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="pipeline-step-card">
                <div className="step-badge">Step 4</div>
                <h4>Theme Generation</h4>
                <p className="step-desc">Similar reviews are grouped together into clusters:</p>
                
                <div className="theme-cluster-box">
                  <div className="cluster-inputs">
                    <span>"I reorder every week."</span>
                    <span>"I never browse."</span>
                  </div>
                  <div className="cluster-arrow">↓</div>
                  <div className="cluster-theme">Habit-driven Shopping</div>
                </div>

                <div className="theme-cluster-box">
                  <div className="cluster-inputs">
                    <span>"So many options."</span>
                    <span>"Hard to decide."</span>
                  </div>
                  <div className="cluster-arrow">↓</div>
                  <div className="cluster-theme font-choice">Choice Overload</div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="pipeline-step-card">
                <div className="step-badge">Step 5</div>
                <h4>Insight Generation</h4>
                <p className="step-desc">AI summarizes every cluster to find PM opportunities:</p>
                
                <div className="insight-generation-box">
                  <div className="ins-item">
                    <strong>Theme:</strong>
                    <span>Habit-driven Shopping</span>
                  </div>
                  <div className="ins-item">
                    <strong>Insight:</strong>
                    <span>Users prioritize speed over exploration.</span>
                  </div>
                  <div className="ins-item opportunity">
                    <strong>PM Opportunity:</strong>
                    <span>Recommend adjacent categories during repeat orders.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Theme Identification Logic */}
            <div className="methodology-section-title">
              <h3>Theme Identification Logic</h3>
            </div>

            <div className="logic-card">
              <div className="logic-flow">
                <div className="logic-node">
                  <span className="node-icon">📝</span>
                  <strong>1 Review</strong>
                </div>
                <div className="logic-arrow">➔</div>
                <div className="logic-node highlight">
                  <span className="node-icon">🤖</span>
                  <strong>Groq Extracts</strong>
                  <span>Behavior, Emotion, Barrier, Intent</span>
                </div>
                <div className="logic-arrow">➔</div>
                <div className="logic-node">
                  <span className="node-icon">🔍</span>
                  <strong>Embeddings & Similarity</strong>
                  <span>Sentence Transformers</span>
                </div>
                <div className="logic-arrow">➔</div>
                <div className="logic-node">
                  <span className="node-icon">🗂️</span>
                  <strong>Reviews Grouped</strong>
                  <span>Clustered inside ChromaDB</span>
                </div>
                <div className="logic-arrow">➔</div>
                <div className="logic-node highlight-yellow">
                  <span className="node-icon">🏷️</span>
                  <strong>Cluster Label & Theme</strong>
                  <span>Grounded Category Theme</span>
                </div>
              </div>

              <div className="logic-example-container">
                <h4>Clustering Example:</h4>
                <div className="logic-example-grid">
                  <div className="logic-example-input">
                    <h5>Input Reviews:</h5>
                    <ul>
                      <li>"I always buy milk."</li>
                      <li>"I only reorder groceries."</li>
                      <li>"I never browse."</li>
                    </ul>
                  </div>
                  <div className="logic-example-arrow">➔</div>
                  <div className="logic-example-output">
                    <h5>Identified Cluster:</h5>
                    <div className="meta-pill">Repeat Ordering</div>
                    <h5>Resulting Theme:</h5>
                    <div className="meta-pill theme-pill-yellow">Habit-driven Purchasing</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Example Theme Generation */}
            <div className="methodology-section-title">
              <h3>Example Theme Generation</h3>
            </div>

            <div className="example-generation-card">
              <div className="ex-gen-section">
                <h4>Raw Customer Review:</h4>
                <p className="raw-review-text">
                  "I wanted to try the new gourmet cheese category but there was no explanation of what they taste like, so I just bought my usual block of Cheddar."
                </p>
              </div>
              <div className="ex-gen-arrow">➔</div>
              <div className="ex-gen-section">
                <h4>AI Extracted Tags:</h4>
                <div className="tags-grid">
                  <div className="tag-item"><span>Intent:</span> Trial of New Category</div>
                  <div className="tag-item"><span>Emotion:</span> Hesitant / Confused</div>
                  <div className="tag-item"><span>Barrier:</span> Lack of product information</div>
                  <div className="tag-item"><span>Product Area:</span> Gourmet / Dairy</div>
                </div>
              </div>
              <div className="ex-gen-arrow">➔</div>
              <div className="ex-gen-section highlight-theme">
                <h4>Resulting Assigned Theme:</h4>
                <div className="theme-box">Information Deficiency</div>
              </div>
            </div>


          </div>
        )}

        {activeTab === 'validation' && (
          <div className="methodology-container">
            {/* Header section explaining Validation System */}
            <div className="methodology-header-card">
              <h2>How do we validate the quality and correctness of generated insights?</h2>
              <p>
                To eliminate hallucinations and ensure absolute grounding, the Discovery Engine uses a <strong>programmatic citation auditing pipeline</strong> (LLM-as-a-Judge) coupled with vector similarity distance filtering. Every claim is cross-checked against source data, and invalid references are immediately pruned.
              </p>
            </div>

            {/* Horizontal Data Flow Pipeline Diagram for Validation */}
            <div className="architecture-card">
              <h3>Real-Time Insight Validation Pipeline</h3>
              <div className="flow-steps-grid">
                <div className="flow-step">
                  <div className="flow-icon">🔍</div>
                  <h4>1. Query & Search</h4>
                  <span>Match query to vector database chunks</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step highlight-blue">
                  <div className="flow-icon">🧠</div>
                  <h4>2. Generate Claims</h4>
                  <span>Groq synthesizes themes and cites review IDs</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step highlight-yellow">
                  <div className="flow-icon">⚖️</div>
                  <h4>3. LLM-as-a-Judge</h4>
                  <span>Auditor LLM validates each claim-to-review link</span>
                </div>
                <div className="flow-arrow">➔</div>
                <div className="flow-step highlight-green">
                  <div className="flow-icon">🛡️</div>
                  <h4>4. Prune & Score</h4>
                  <span>Discard bad citations, update counts, log metrics</span>
                </div>
              </div>
            </div>

            {/* Section 1: Validation Rules & Architecture */}
            <div className="methodology-section-title">
              <h3>Core Validation Mechanics & Rules</h3>
            </div>
            
            <div className="pipeline-steps-grid">
              <div className="pipeline-step-card">
                <div className="step-badge">Mechanic 1</div>
                <h4>Citation Verification</h4>
                <p className="step-desc">The auditor LLM evaluates if the text of a cited review semantically justifies the theme or barrier claim. If not, the citation is deleted from the payload.</p>
              </div>

              <div className="pipeline-step-card">
                <div className="step-badge">Mechanic 2</div>
                <h4>Vector Similarity Grading</h4>
                <p className="step-desc">Computes average Euclidean distance of retrieval. If distance exceeds a set threshold, the evidence grade drops to <code>weak</code> or <code>insufficient</code>.</p>
              </div>

              <div className="pipeline-step-card">
                <div className="step-badge">Mechanic 3</div>
                <h4>Honesty Safeguards</h4>
                <p className="step-desc">If zero or very weak reviews are retrieved, the engine is forced by system prompts to refuse general synthesis and instead output a standard thin-evidence message.</p>
              </div>
            </div>

            {/* Section 2: concrete example of validation */}
            <div className="methodology-section-title">
              <h3>Programmatic Validation Example</h3>
            </div>

            <div className="logic-card">
              <div className="logic-example-container" style={{ width: '100%', border: 'none', padding: 0 }}>
                <h4>Scenario: PM asks "Why do shoppers avoid premium fresh categories?"</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                  
                  {/* Case 1: Valid Citation */}
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ color: '#16A34A', fontSize: '14px' }}>Case A: Supported Citation (✅ VALID)</strong>
                      <span className="badge badge-strong" style={{ backgroundColor: '#16A34A', color: '#fff' }}>STATUS: RETAINED</span>
                    </div>
                    <p style={{ fontSize: '13px', margin: '4px 0', fontStyle: 'italic' }}>
                      <strong>Source Review (#REV-101):</strong> "I wanted to try the new organic cheese, but it is way too expensive compared to normal cheddar."
                    </p>
                    <p style={{ fontSize: '13px', margin: '4px 0' }}>
                      <strong>Claim Made by LLM:</strong> Premium Category Price Barrier (Organic goods cost too much).
                    </p>
                    <p style={{ fontSize: '12px', color: '#15803D', marginTop: '6px', fontWeight: 600 }}>
                      <strong>Auditor Reason:</strong> The review text directly mentions wanting to try a premium category (organic cheese) but being blocked by high cost, validating the claim.
                    </p>
                  </div>

                  {/* Case 2: Invalid/Hallucinated Citation */}
                  <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ color: '#DC2626', fontSize: '14px' }}>Case B: Unsupported Citation (❌ REJECTED)</strong>
                      <span className="badge badge-insufficient" style={{ backgroundColor: '#DC2626', color: '#fff' }}>STATUS: PURGED</span>
                    </div>
                    <p style={{ fontSize: '13px', margin: '4px 0', fontStyle: 'italic' }}>
                      <strong>Source Review (#REV-202):</strong> "The delivery boy was late by 30 minutes and the packet was torn."
                    </p>
                    <p style={{ fontSize: '13px', margin: '4px 0' }}>
                      <strong>Claim Made by LLM:</strong> Premium Category Price Barrier (Organic goods cost too much).
                    </p>
                    <p style={{ fontSize: '12px', color: '#B91C1C', marginTop: '6px', fontWeight: 600 }}>
                      <strong>Auditor Reason:</strong> The review text discusses operational delivery delays and package damage, which does not provide any logical evidence for category cost barriers.
                    </p>
                  </div>

                </div>
              </div>
            </div>

          </div>
        )}


      </main>

      {/* Slide-out Citation Details Panel Drawer */}
      {activeCitation && (
        <div className="overlay-drawer-backdrop" onClick={() => setActiveCitation(null)}>
          <div className="overlay-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Citation #REV-{activeCitation.review_id} Details</h2>
              <button className="close-drawer-btn" onClick={() => setActiveCitation(null)}>✕</button>
            </div>
            
            <div className="drawer-body">
              <div className="detail-section text-highlight">
                <label>Customer Feedback text</label>
                <p>"{activeCitation.review}"</p>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <label>Shopper Persona</label>
                  <span>{activeCitation.user_persona || 'None'}</span>
                </div>
                <div className="detail-item">
                  <label>Category exploration Barrier</label>
                  <span>{activeCitation.barrier_to_new_category || 'None'}</span>
                </div>
                <div className="detail-item">
                  <label>Product Area</label>
                  <span>{activeCitation.product_area || 'None'}</span>
                </div>
                <div className="detail-item">
                  <label>Shopping Goal</label>
                  <span>{activeCitation.shopping_goal || 'None'}</span>
                </div>
                <div className="detail-item">
                  <label>Mentioned Frequency</label>
                  <span>{activeCitation.frequency || 'None'}</span>
                </div>
                <div className="detail-item">
                  <label>Assigned Priority</label>
                  <span>{activeCitation.priority || 'None'}</span>
                </div>
                <div className="detail-item">
                  <label>Emotional Sentiment</label>
                  <span>{activeCitation.emotion || 'None'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
