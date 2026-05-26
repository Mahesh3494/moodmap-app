import './index.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { InitResponse, DashboardResponse, HourlyBucket, Alert } from '../shared/api';

type DashboardData = {
  currentHealth: number;
  trend: HourlyBucket[];
  recentAlerts: Alert[];
  username: string;
  subreddit: string;
};

function getHealthColor(score: number): string {
  if (score >= 70) return '#FF4500';
  if (score >= 40) return '#ff8c00';
  return '#ff2200';
}

function getHealthLabel(score: number): string {
  if (score >= 70) return 'Healthy ✅';
  if (score >= 40) return 'Moderate ⚠️';
  return 'At Risk 🚨';
}

function getHealthDesc(score: number): string {
  if (score >= 70) return 'Community is in good shape. Toxicity within normal range.';
  if (score >= 40) return 'Some toxic activity detected. Keep an eye on recent alerts.';
  return 'High toxicity detected! Immediate moderation attention needed.';
}

function getToxPillStyle(pct: number): React.CSSProperties {
  if (pct >= 70) return { background: '#FF2200', color: '#ffffff' };
  if (pct >= 45) return { background: '#FF4500', color: '#ffffff' };
  return { background: '#ff8c00', color: '#ffffff' };
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData(endpoint: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as InitResponse | DashboardResponse;
      setData({
        currentHealth: json.currentHealth,
        trend: json.trend,
        recentAlerts: json.recentAlerts,
        username: 'username' in json ? json.username : data?.username ?? '',
        subreddit: 'subreddit' in json ? json.subreddit : data?.subreddit ?? '',
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadData('init'); }, []);

  const health = data?.currentHealth ?? 0;
  const color = getHealthColor(health);
  const totalComments = data?.trend.reduce((s, b) => s + b.commentCount, 0) ?? 0;
  const activeBuckets = data?.trend.filter(b => b.commentCount > 0) ?? [];
  const avgToxic = activeBuckets.length > 0
    ? Math.round(activeBuckets.reduce((s, b) => s + b.avgToxicity, 0) / activeBuckets.length * 100)
    : 0;
  const topOffenders = [...(data?.recentAlerts ?? [])]
    .sort((a, b) => b.toxicityScore - a.toxicityScore)
    .slice(0, 3);

  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (health / 100) * circ;

  const card: React.CSSProperties = {
    background: '#111111',
    border: '1px solid #222222',
    borderRadius: 14,
    padding: '16px',
    marginBottom: '12px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#666666',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const pill: React.CSSProperties = {
    fontSize: 10,
    background: '#FF4500',
    color: '#ffffff',
    padding: '3px 10px',
    borderRadius: 20,
    fontWeight: 700,
  };

  if (loading) return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, fontFamily: 'system-ui' }}>
      <div style={{ width: 52, height: 52, background: '#FF4500', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 0 30px #FF450077' }}>🗺️</div>
      <div style={{ color: '#666', fontSize: 14, letterSpacing: 1 }}>LOADING MOODMAP...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, fontFamily: 'system-ui' }}>
      <div style={{ color: '#ff2200', fontSize: 14 }}>Error: {error}</div>
      <button onClick={() => loadData('init')} style={{ padding: '10px 24px', background: '#FF4500', color: 'white', border: 'none', borderRadius: 50, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
    </div>
  );

  return (
    <div style={{ background: '#000000', minHeight: '100vh', padding: '16px', fontFamily: "'Inter', system-ui, sans-serif", color: '#ffffff' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: '#FF4500', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 0 20px #FF450066' }}>🗺️</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px' }}>MoodMap</div>
            <div style={{ fontSize: 11, color: '#aaaaaa', marginTop: 1 }}>r/{data?.subreddit} · Community Health</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <div style={{ fontSize: 12, color: '#aaaaaa' }}>u/{data?.username}</div>
          <div style={{ background: '#FF4500', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 10px', borderRadius: 20, letterSpacing: '2px' }}>MOD</div>
        </div>
      </div>

      {/* HEALTH RING CARD */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="9" />
            <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="9"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 50 50)"
              style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{health}</div>
            <div style={{ fontSize: 10, color: '#aaaaaa' }}>/ 100</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 6 }}>{getHealthLabel(health)}</div>
          <div style={{ fontSize: 13, color: '#aaaaaa', lineHeight: 1.6 }}>{getHealthDesc(health)}</div>
          <div style={{ fontSize: 10, color: '#888888', marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>🕐 Updated just now</div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
        {[
          { icon: '💬', val: totalComments, lbl: 'Comments', tag: `${totalComments} total`, tagOk: true },
          { icon: '🚨', val: data?.recentAlerts.length ?? 0, lbl: 'Alerts', tag: 'flagged', tagOk: (data?.recentAlerts.length ?? 0) === 0 },
          { icon: '📊', val: `${avgToxic}%`, lbl: 'Avg Toxic', tag: 'last 24h', tagOk: avgToxic < 30 },
        ].map((st, i) => (
          <div key={i} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 18 }}>{st.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: st.tagOk ? '#0a2a0a' : '#2a0a0a', color: st.tagOk ? '#46d160' : '#FF4500' }}>{st.tag}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>{st.val}</div>
            <div style={{ fontSize: 10, color: '#aaaaaa', marginTop: 3 }}>{st.lbl}</div>
          </div>
        ))}
      </div>

      {/* TREND CHART */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={sectionTitle}>Toxicity Trend — Last 24h</div>
          <div style={pill}>Hourly</div>
        </div>
        {!data?.trend.length || data.trend.every(b => b.commentCount === 0) ? (
          <div style={{ color: '#333', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No comments yet — post something to test!</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 70, padding: '0 2px' }}>
              {data.trend.map((b, i) => {
                const h = b.commentCount === 0 ? 4 : Math.max(8, Math.round(b.avgToxicity * 70));
                const c = b.avgToxicity > 0.6 ? '#FF2200'
                  : b.avgToxicity > 0.3 ? '#FF4500'
                  : b.commentCount > 0 ? '#ff8c00'
                  : '#1a1a1a';
                return (
                  <div key={i}
                    title={`${b.hour}: ${Math.round(b.avgToxicity * 100)}% toxic · ${b.commentCount} comments`}
                    style={{ flex: 1, height: h, background: c, borderRadius: '4px 4px 0 0', minWidth: 6, transition: 'height 0.3s ease', boxShadow: b.commentCount > 0 ? `0 0 6px ${c}88` : 'none' }} />
                );
              })}
            </div>
            <div style={{ height: 1, background: '#1a1a1a', margin: '0 2px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {['24h ago', '12h ago', 'now'].map(l => <span key={l} style={{ fontSize: 10, color: '#aaaaaa' }}>{l}</span>)}
            </div>
          </>
        )}
      </div>

      {/* RECENT ALERTS */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>Recent Alerts</div>
          <div style={pill}>{data?.recentAlerts.length ?? 0} flagged</div>
        </div>
        {!data?.recentAlerts.length ? (
          <div style={{ color: '#333', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No toxic comments detected 🎉</div>
        ) : data.recentAlerts.slice(0, 5).map((alert, i) => {
          const pct = Math.round(alert.toxicityScore * 100);
          const commentUrl = alert.postId && alert.subreddit
            ? `https://www.reddit.com/r/${alert.subreddit}/comments/${alert.postId}/?playtest=moodmap-app`
            : alert.subreddit ? `https://www.reddit.com/r/${alert.subreddit}/?playtest=moodmap-app` : null;
          return (
            <div key={i} style={{ padding: '12px 0', borderBottom: i < Math.min(data.recentAlerts.length, 5) - 1 ? '1px solid #1a1a1a' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a', border: '2px solid #FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#FF4500', flexShrink: 0 }}>
                    {alert.author.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>u/{alert.author}</div>
                    <div style={{ fontSize: 10, color: '#aaaaaa' }}>{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
                <div style={{ ...getToxPillStyle(pct), fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>{pct}% toxic</div>
              </div>
              <div style={{ fontSize: 12, color: '#777777', fontStyle: 'italic', lineHeight: 1.5, paddingLeft: 42, marginBottom: commentUrl ? 6 : 0 }}>"{alert.excerpt}"</div>
              {commentUrl && (
                <a href={commentUrl} style={{ fontSize: 11, color: '#FF4500', paddingLeft: 42, display: 'block', fontWeight: 700, textDecoration: 'none' }}>
                  🔗 View in subreddit →
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* TOP OFFENDERS */}
      {topOffenders.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={sectionTitle}>Top Offenders</div>
            <div style={pill}>This session</div>
          </div>
          {topOffenders.map((o, i) => {
            const pct = Math.round(o.toxicityScore * 100);
            const c = pct >= 70 ? '#FF2200' : pct >= 45 ? '#FF4500' : '#ff8c00';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < topOffenders.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                <div style={{ fontSize: 12, color: '#aaaaaa', fontWeight: 700, width: 20 }}>#{i + 1}</div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#aaaaaa' }}>
                  {o.author.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#cccccc', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>u/{o.author}</div>
                <div style={{ width: 80, height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 3, boxShadow: `0 0 6px ${c}` }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: c, width: 38, textAlign: 'right' }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      )}

      {/* REFRESH BUTTON */}
      <button
        onClick={() => loadData('dashboard', true)}
        disabled={refreshing}
        style={{ width: '100%', padding: '14px', background: refreshing ? '#cc3300' : '#FF4500', color: 'white', border: 'none', borderRadius: 50, fontSize: 15, fontWeight: 800, cursor: refreshing ? 'default' : 'pointer', boxShadow: refreshing ? 'none' : '0 0 30px #FF450055', transition: 'all 0.2s', letterSpacing: '0.5px' }}>
        {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Dashboard'}
      </button>

      <div style={{ textAlign: 'center', fontSize: 10, color: '#222222', marginTop: 16, letterSpacing: '2px' }}>
        MOODMAP · KEEPING COMMUNITIES HEALTHY
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);