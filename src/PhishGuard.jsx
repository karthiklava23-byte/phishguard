import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set as dbSet, get as dbGet, onValue } from 'firebase/database';

// COLORS & THEME
const colors = {
  bg: '#070b14', surface: '#0d1220', border: '#1e2640',
  accent: '#38bdf8', green: '#10b981', red: '#ef4444',
  yellow: '#f59e0b', purple: '#a78bfa', orange: '#fb923c',
  text: '#c8d3ea', dim: '#4a5478'
};

const attackTypes = {
  phishing: { id: "phishing", label: "Phishing Attack", icon: "🎣", color: "#ef4444", desc: "Email/link impersonating trusted entities" },
  financial: { id: "financial", label: "Financial Fraud", icon: "💳", color: "#f59e0b", desc: "Banking, crypto, investment scams" },
  social: { id: "social", label: "Social Media Attack", icon: "📱", color: "#a78bfa", desc: "Fake profiles, account hijacking" },
  scam: { id: "scam", label: "Online Scam", icon: "🛒", color: "#06b6d4", desc: "Fake shops, prize scams, delivery fraud" }
};

// UI COMPONENT STYLES
const STYLES = {
  card: { background: "#0d1220", border: "1px solid #1e2640", borderRadius: 12, padding: 24 },
  badge: (color) => ({ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: "bold", background: `${color}18`, color: color, border: `1px solid ${color}44`, alignItems: 'center', whiteSpace: 'nowrap' }),
  btnPrimary: { background: "linear-gradient(135deg,#38bdf8,#3b82f6)", color: "#070b14", border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Courier New, monospace' },
  btnDanger: { background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Courier New, monospace' },
  btnSuccess: { background: "linear-gradient(135deg,#10b981,#059669)", color: "#070b14", border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Courier New, monospace' },
  btnPurple: { background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "#fff", border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Courier New, monospace' },
  btnGhost: { background: "transparent", border: "1px solid #1e2640", color: "#4a5478", padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Courier New, monospace' },
  sectionLabel: { fontSize: 10, letterSpacing: 3, color: "#4a5478", marginBottom: 8, display: "block", fontWeight: "bold", textTransform: 'uppercase' },
  pulse: (color) => ({ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 8px ${color}` }),
  input: { width: '100%', background: '#070b14', border: '1px solid #1e2640', padding: '12px', color: '#c8d3ea', borderRadius: '6px', fontFamily: 'Courier New, monospace', boxSizing: 'border-box' },
  textarea: { width: '100%', background: '#070b14', border: '1px solid #1e2640', padding: '12px', color: '#c8d3ea', borderRadius: '6px', fontFamily: 'Courier New, monospace', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box' }
};

// HELPERS
const uid = () => Math.random().toString(36).slice(2, 9);
const timeAgo = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// FIREBASE INITIALIZATION
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// SHARED PERSISTENCE ENGINE (Firebase Realtime Database)
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (key) => {
      try {
        const snapshot = await dbGet(ref(db, `storage/${key}`));
        if (snapshot.exists()) {
          const val = JSON.stringify(snapshot.val());
          localStorage.setItem(`pg_cache:${key}`, val);
          return { value: val };
        }
        const local = localStorage.getItem(`pg_cache:${key}`);
        return local ? { value: local } : null;
      } catch (e) {
        const local = localStorage.getItem(`pg_cache:${key}`);
        return local ? { value: local } : null;
      }
    },
    set: async (key, val) => {
      try {
        localStorage.setItem(`pg_cache:${key}`, val);
        await dbSet(ref(db, `storage/${key}`), JSON.parse(val));
      } catch (e) {
        console.warn("Firebase sync delayed.", e);
      }
    },
    // Extension for true real-time listeners
    listen: (key, callback) => {
        return onValue(ref(db, `storage/${key}`), (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
    }
  };
}

async function loadShared(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    return res && res.value ? JSON.parse(res.value) : fallback;
  } catch { return fallback; }
}

async function saveShared(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), true); } catch { }
}

const SEED_BLACKLIST = [
  { id: "b1", url: "http://secure-paypal-update.xyz/login", reportedAt: "2026-01-10T09:23:00Z", score: 8, votes: 14, reason: "Credential harvesting – PayPal impersonation", attackType: "phishing" },
  { id: "b2", url: "http://amaz0n-verify.info", reportedAt: "2026-01-22T14:05:00Z", score: 5, votes: 22, reason: "Amazon brand spoofing with number substitution", attackType: "scam" },
  { id: "b3", url: "http://free-iphone-winner.top/claim", reportedAt: "2026-02-03T11:11:00Z", score: 3, votes: 31, reason: "Prize scam – social engineering lure", attackType: "scam" },
  { id: "b4", url: "http://microsoft-security-alert.net", reportedAt: "2026-02-18T16:44:00Z", score: 11, votes: 9, reason: "Tech support scam page", attackType: "phishing" }
];

const SEED_COMMENTS = [
  { id: "c1", attackType: "phishing", text: "Got an email from 'Apple Support' saying my account was locked. The link looked real but the domain was apple-id-support.xyz. Lost access to my email for 3 days.", at: "2026-02-01T10:00:00Z", helpful: 24 },
  { id: "c2", attackType: "financial", text: "Received a WhatsApp message about a 'crypto investment opportunity' promising 300% returns. Classic rug pull setup.", at: "2026-02-10T14:30:00Z", helpful: 18 },
  { id: "c3", attackType: "social", text: "A fake Instagram page copied my friend's profile and sent me a DM asking for money urgently. Always verify through a call before sending anything.", at: "2026-02-20T09:15:00Z", helpful: 31 },
  { id: "c4", attackType: "scam", text: "Ordered from what looked like a legit online store. Paid $80, never received anything. Always check Trustpilot reviews first!", at: "2026-03-01T17:45:00Z", helpful: 15 }
];

function analyzeURL(url, blacklist) {
  let score = 0;
  const details = [];
  const lo = url.toLowerCase();

  if (lo.startsWith("https://")) { score += 20; details.push({ text: "HTTPS connection", prefix: "✓", color: colors.green }); }
  else { score -= 20; details.push({ text: "No HTTPS (Insecure)", prefix: "✗", color: colors.red }); }

  const KEYWORDS = ["secure", "login", "update", "verify", "account", "banking", "paypal", "amazon", "apple", "microsoft", "signin", "password", "confirm", "validate", "urgent", "suspended", "limited", "free", "winner", "click", "prize", "alert", "warning"];
  let foundKW = 0;
  KEYWORDS.forEach(k => { if (lo.includes(k)) foundKW++; });
  if (foundKW === 0) { score += 20; details.push({ text: "No suspicious keywords", prefix: "✓", color: colors.green }); }
  else {
    score -= Math.min(30, foundKW * 6);
    details.push({ text: `Suspicious keywords found (${foundKW})`, prefix: "✗", color: colors.red });
  }

  const BAD_TLDS = [".xyz", ".info", ".top", ".click", ".link", ".pw", ".tk", ".ml", ".ga", ".cf", ".gq"];
  if (!BAD_TLDS.some(t => lo.includes(t))) { score += 25; details.push({ text: "Clean TLD", prefix: "✓", color: colors.green }); }
  else { score -= 30; details.push({ text: "High-risk TLD detected", prefix: "✗", color: colors.red }); }

  if (url.length < 40) { score += 15; details.push({ text: "Standard length", prefix: "✓", color: colors.green }); }
  else if (url.length > 100) { score -= 10; details.push({ text: "Suspiciously long URL", prefix: "✗", color: colors.red }); }
  else { score += 5; details.push({ text: "Normal length URL", prefix: "○", color: colors.dim }); }

  const special = url.match(/[-_@%=?&]/g);
  const specCount = special ? special.length : 0;
  if (specCount <= 3) { score += 20; details.push({ text: "Low special characters", prefix: "✓", color: colors.green }); }
  else { score -= Math.min(20, (specCount - 3) * 3); details.push({ text: "Excessive special characters", prefix: "✗", color: colors.red }); }

  if (/[0o1il]{2,}/.test(lo)) { score -= 15; details.push({ text: "Visual substitution (e.g., 0 for o)", prefix: "✗", color: colors.red }); }

  const flagged = blacklist.find(b => lo.includes(b.url.toLowerCase()));
  if (flagged) {
    score = Math.min(score, 8);
    details.push({ text: "FLAGGED IN PUBLIC BLACKLIST", prefix: "✗", color: colors.red });
  }

  score = Math.max(0, Math.min(100, score));
  const risk = score >= 70 ? "LOW" : score >= 40 ? "MEDIUM" : "HIGH";
  return { score, risk, details, isFlagged: !!flagged };
}

// -------------------------------------------------------------
// MODULE COMPONENT: DASHBOARD
// -------------------------------------------------------------
function Dashboard({ blacklist, comments, scanLog, newsLog }) {
  const highRiskHits = scanLog.filter(s => s.risk === 'HIGH').length;
  const fakeNews = newsLog.filter(n => n.verdict === 'FAKE').length;

  const countByType = Object.keys(attackTypes).map(tKey => {
    const blCount = blacklist.filter(b => b.attackType === tKey).length;
    const cmCount = comments.filter(c => c.attackType === tKey).length;
    return { ...attackTypes[tKey], total: blCount + cmCount };
  });

  return (
    <div>
      <h1 style={{ margin: '0 0 20px 0', fontSize: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        ◈ THREAT INTELLIGENCE DASHBOARD
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.green }}>
          <span style={STYLES.pulse(colors.green)} /> LIVE — Blacklist synced across all users in real time
        </div>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total URL Scans", value: scanLog.length, color: colors.accent },
          { label: "High Risk Detected", value: highRiskHits, color: colors.red },
          { label: "Blacklisted URLs", value: blacklist.length, color: colors.yellow },
          { label: "News Analyzed", value: newsLog.length, color: colors.purple },
          { label: "Fake News Caught", value: fakeNews, color: colors.red },
          { label: "Community Reports", value: comments.length, color: colors.green }
        ].map((s, i) => (
            <div key={i} style={{ ...STYLES.card, padding: 16 }}>
              <span style={STYLES.sectionLabel}>{s.label}</span>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: s.color }}>{s.value}</div>
            </div>
          ))}
      </div>

      <span style={STYLES.sectionLabel}>Attack Type Breakdown</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {countByType.map(t => (
          <div key={t.id} style={{ ...STYLES.card, padding: 16, display: 'flex', alignItems: 'center', gap: 16, borderLeft: `4px solid ${t.color}` }}>
            <div style={{ fontSize: 24 }}>{t.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: t.color }}>{t.total}</div>
              <div style={{ fontSize: 12, color: colors.dim }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <span style={STYLES.sectionLabel}>Recent URL Scans</span>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12 }}>
            {scanLog.slice(0, 6).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: i < Math.min(scanLog.length, 6) - 1 ? `1px solid ${colors.border}` : 'none' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{s.url}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={STYLES.badge(s.risk === 'LOW' ? colors.green : s.risk === 'MEDIUM' ? colors.yellow : colors.red)}>{s.risk}</span>
                  <span style={{ fontSize: 12, color: colors.dim }}>{timeAgo(s.time)}</span>
                </div>
              </div>
            ))}
            {scanLog.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: colors.dim }}>No scans yet</div>}
          </div>
        </div>
        <div>
          <span style={STYLES.sectionLabel}>Latest Community Experiences</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.slice(0, 4).map(c => {
              const t = attackTypes[c.attackType];
              return (
                <div key={c.id} style={{ ...STYLES.card, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={STYLES.badge(t.color)}>{t.icon} {t.label}</span>
                    <span style={{ fontSize: 12, color: colors.dim }}>{timeAgo(c.at)}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODULE COMPONENT: SCANNER
// -------------------------------------------------------------
function Scanner({ blacklist, setBlacklist, scanLog, setScanLog }) {
  const [url, setUrl] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [aiApiKey, setAiApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || "");
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reported, setReported] = useState(false);

  const handleScan = async () => {
    if (!url || !selectedType) return;
    setScanning(true);
    setResult(null);
    setAiExplanation(null);
    setReported(false);
    
    // Simulate scan delay
    setTimeout(async () => {
      const res = analyzeURL(url, blacklist);
      const scanData = { ...res, url, attackType: selectedType, time: new Date().toISOString() };
      setResult(scanData);
      
      // Persist to Shared Scan Log
      const latest = await loadShared("phishguard:scanlog:v1", []);
      latest.unshift(scanData);
      await saveShared("phishguard:scanlog:v1", latest.slice(0, 50));
      
      setScanning(false);
    }, 1200);
  };

  const handleExplain = async () => {
    if (!aiApiKey) { alert("Missing Gemini API Key. Please add VITE_GEMINI_API_KEY to your .env file and restart the server."); return; }
    setAiLoading(true);
    const systemPrompt = "You are a cybersecurity expert. Give a concise 3-4 sentence plain-English explanation of why this URL is or isn't suspicious. Be specific about red flags. No markdown.";
    const userPrompt = `Analyze this URL: "${result.url}"\nRisk Score: ${result.score}/100 (${result.risk} RISK)\nAttack Type: ${attackTypes[result.attackType].label}\nSignals: ${result.details.map(d => d.text).join(", ")}`;

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${aiApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }]
        })
      });
      const data = await resp.json();
      if (data.error) {
        setAiExplanation("API Error: " + (data.error.message || "Unknown error"));
      } else if (data.candidates && data.candidates[0].content.parts[0].text) {
        setAiExplanation(data.candidates[0].content.parts[0].text);
      } else {
        setAiExplanation("AI analysis failed: No content returned.");
      }
    } catch (e) {
      setAiExplanation("Error calling Gemini API: " + e.message);
    }
    setAiLoading(false);
  };

  const handleReport = async () => {
    if (!result) return;
    const latest = await loadShared("phishguard:blacklist:v1", blacklist);
    const exists = latest.find(b => b.url === result.url);
    if (exists) {
      exists.votes++;
    } else {
      latest.unshift({ id: uid(), url: result.url, reportedAt: new Date().toISOString(), score: result.score, votes: 1, reason: `Scan flagged as ${result.risk} risk`, attackType: result.attackType });
    }
    await saveShared("phishguard:blacklist:v1", latest);
    setBlacklist(latest);
    setReported(true);
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 24px 0', fontSize: 24 }}>◈ URL SCANNER</h1>
      {!result ? (
        <div style={STYLES.card}>
          <span style={STYLES.sectionLabel}>Step 1: Select Suspected Attack Type</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {Object.values(attackTypes).map(t => (
              <div key={t.id} onClick={() => setSelectedType(t.id)}
                style={{ ...STYLES.card, padding: 16, cursor: 'pointer', border: selectedType === t.id ? `1px solid ${t.color}` : `1px solid ${colors.border}`, background: selectedType === t.id ? `${t.color}11` : colors.surface }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontWeight: 'bold' }}>{t.label}</div>
              </div>
            ))}
          </div>
          <span style={STYLES.sectionLabel}>Step 2: Input URL</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <input style={STYLES.input} placeholder="http://suspicious-site.xyz/login" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleScan()} />
            <button style={STYLES.btnPrimary} onClick={handleScan} disabled={scanning || !selectedType || !url}>
              {scanning ? "▶ ANALYZING…" : "SCAN"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ ...STYLES.card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontFamily: 'monospace', color: result.risk === 'LOW' ? colors.green : colors.red, marginBottom: 12 }}>{result.url}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={STYLES.badge(result.risk === 'LOW' ? colors.green : result.risk === 'MEDIUM' ? colors.yellow : colors.red)}>{result.risk} RISK</span>
                <span style={STYLES.badge(attackTypes[result.attackType].color)}>{attackTypes[result.attackType].label}</span>
                {result.isFlagged && <span style={STYLES.badge(colors.red)}>FLAGGED</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: result.risk === 'LOW' ? colors.green : result.risk === 'MEDIUM' ? colors.yellow : colors.red }}>
                {result.score}<span style={{ fontSize: 24, color: colors.dim }}>/100</span>
              </div>
              <div style={{ width: 200, height: 8, background: colors.border, borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                <div style={{ width: `${result.score}%`, height: '100%', background: result.risk === 'LOW' ? colors.green : result.risk === 'MEDIUM' ? colors.yellow : colors.red, transition: 'width 1s' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={STYLES.card}>
              <span style={STYLES.sectionLabel}>Signal Breakdown</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {result.details.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: d.color, width: 20 }}>{d.prefix}</span>
                    <span style={{ color: colors.text }}>{d.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={STYLES.card}>
                <span style={STYLES.sectionLabel}>AI Explain</span>
                {aiExplanation ? (
                  <div style={{ lineHeight: '1.6', fontSize: 14 }}>{aiExplanation}</div>
                ) : (
                  <div>
                    <button style={{ ...STYLES.btnPurple, width: '100%' }} onClick={handleExplain} disabled={aiLoading}>
                      {aiLoading ? "◈ THINKING..." : "⚡ AI EXPLAIN"}
                    </button>
                  </div>
                )}
              </div>
              <button style={STYLES.btnDanger} onClick={handleReport} disabled={reported}>
                {reported ? <><span style={STYLES.pulse(colors.text)} /> ADDED TO PUBLIC BLACKLIST</> : "🚨 REPORT & ADD TO PUBLIC BLACKLIST"}
              </button>
              <button style={STYLES.btnGhost} onClick={() => { setResult(null); setUrl(''); setSelectedType(null); }}>CLEAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODULE COMPONENT: BLACKLIST
// -------------------------------------------------------------
function Blacklist({ blacklist, setBlacklist }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Newest");
  const [lastSync, setLastSync] = useState(Date.now());

  const handleUpvote = async (id) => {
    const latest = await loadShared("phishguard:blacklist:v1", blacklist);
    const item = latest.find(b => b.id === id);
    if (item) item.votes++;
    await saveShared("phishguard:blacklist:v1", latest);
    setBlacklist(latest);
  };

  let f = blacklist.filter(b => (filter === "ALL" || b.attackType === filter) && b.url.toLowerCase().includes(search.toLowerCase()));
  if (sort === "Newest") f.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  if (sort === "Most Voted") f.sort((a, b) => b.votes - a.votes);
  if (sort === "Highest Risk") f.sort((a, b) => a.score - b.score); // Lower score is higher risk

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          ◈ PUBLIC BLACKLIST
        </h1>
        <div style={{ fontSize: 12, color: colors.green, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={STYLES.pulse(colors.green)} /> LIVE — synced every 6s · shared across all users (Last sync {timeAgo(lastSync)})
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto' }}>
        <button style={{ ...STYLES.badge(filter === 'ALL' ? colors.accent : colors.dim), cursor: 'pointer', padding: '6px 16px', fontSize: 12 }} onClick={() => setFilter("ALL")}>ALL ({blacklist.length})</button>
        {Object.values(attackTypes).map(t => (
          <button key={t.id} style={{ ...STYLES.badge(filter === t.id ? t.color : colors.dim), cursor: 'pointer', padding: '6px 16px', fontSize: 12 }} onClick={() => setFilter(t.id)}>
            {t.icon} {t.label} ({blacklist.filter(b => b.attackType === t.id).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input style={{ ...STYLES.input, flex: 1 }} placeholder="Search URLs..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...STYLES.input, width: 200, WebkitAppearance: 'none' }} value={sort} onChange={e => setSort(e.target.value)}>
          <option>Newest</option>
          <option>Most Voted</option>
          <option>Highest Risk</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {f.map(b => {
          const t = attackTypes[b.attackType];
          const isNew = (Date.now() - new Date(b.reportedAt)) < 300000;
          return (
            <div key={b.id} style={{ ...STYLES.card, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {isNew && <span style={STYLES.badge(colors.green)}><span style={{ ...STYLES.pulse(colors.green), marginRight: 4 }} /> JUST REPORTED</span>}
                  <span style={STYLES.badge(t.color)}>{t.icon} {t.label}</span>
                  <span style={{ fontSize: 12, color: colors.dim }}>{timeAgo(b.reportedAt)} by anonymous</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={STYLES.badge(b.score >= 70 ? colors.green : b.score >= 40 ? colors.yellow : colors.red)}>SCORE: {b.score}/100</span>
                  <button style={{ ...STYLES.btnGhost, padding: '4px 12px', fontSize: 12 }} onClick={() => handleUpvote(b.id)}>▲ Upvote ({b.votes})</button>
                </div>
              </div>
              <div style={{ color: colors.red, fontWeight: 'bold', fontSize: 16, marginBottom: 8, wordBreak: 'break-all' }}>⚠ {b.url}</div>
              <div style={{ fontStyle: 'italic', color: colors.dim }}>"{b.reason}"</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODULE COMPONENT: COMMUNITY Experience
// -------------------------------------------------------------
function Community({ comments, setComments }) {
  const [filter, setFilter] = useState("ALL");
  const [text, setText] = useState("");
  const [type, setType] = useState(null);
  const [success, setSuccess] = useState(false);
  const [helpedIds, setHelpedIds] = useState({});

  const handleSubmit = async () => {
    if (!text || !type) return;
    const latest = await loadShared("phishguard:comments:v1", comments);
    latest.unshift({ id: uid(), attackType: type, text, at: new Date().toISOString(), helpful: 0 });
    await saveShared("phishguard:comments:v1", latest);
    setComments(latest);
    setText(""); setType(null); setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
  };

  const handleHelpful = async (id) => {
    if (helpedIds[id]) return;
    const latest = await loadShared("phishguard:comments:v1", comments);
    const item = latest.find(c => c.id === id);
    if (item) item.helpful++;
    await saveShared("phishguard:comments:v1", latest);
    setComments(latest);
    setHelpedIds(p => ({ ...p, [id]: true }));
  };

  const f = comments.filter(c => filter === "ALL" || c.attackType === filter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>◈ COMMUNITY EXPERIENCE BOARD</h1>
        <div style={{ fontSize: 12, color: colors.green, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={STYLES.pulse(colors.green)} /> LIVE & PUBLIC — experiences visible to all users
        </div>
      </div>

      <div style={{ ...STYLES.card, marginBottom: 32 }}>
        <span style={STYLES.sectionLabel}>Share Your Experience</span>
        {success && <div style={{ color: colors.green, marginBottom: 16, fontWeight: 'bold' }}><span style={STYLES.pulse(colors.green)} /> YOUR EXPERIENCE IS NOW LIVE AND VISIBLE TO ALL USERS</div>}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {Object.values(attackTypes).map(t => (
            <button key={t.id} style={{ ...(type === t.id ? STYLES.btnPrimary : STYLES.btnGhost), flex: 1 }} onClick={() => setType(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <textarea style={STYLES.textarea} placeholder="Describe the threat, how they approached you, and red flags to watch out for..." value={text} onChange={e => setText(e.target.value.slice(0, 500))} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ color: colors.dim, fontSize: 12 }}>{text.length}/500</span>
          <button style={STYLES.btnPrimary} disabled={!text || !type} onClick={handleSubmit}>SUBMIT REPORT</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto' }}>
        <button style={{ ...STYLES.badge(filter === 'ALL' ? colors.accent : colors.dim), cursor: 'pointer', padding: '6px 16px', fontSize: 12 }} onClick={() => setFilter("ALL")}>ALL ({comments.length})</button>
        {Object.values(attackTypes).map(t => (
          <button key={t.id} style={{ ...STYLES.badge(filter === t.id ? t.color : colors.dim), cursor: 'pointer', padding: '6px 16px', fontSize: 12 }} onClick={() => setFilter(t.id)}>
            {t.icon} {t.label} ({comments.filter(c => c.attackType === t.id).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {f.map((c, i) => {
          const t = attackTypes[c.attackType];
          return (
            <div key={c.id} style={{ ...STYLES.card, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: colors.dim, fontWeight: 'bold' }}>#{comments.length - i} in community</span>
                  <span style={STYLES.badge(t.color)}>{t.icon} {t.label}</span>
                  <span style={STYLES.badge(colors.dim)}>👤 Anonymous</span>
                  <span style={{ fontSize: 12, color: colors.dim }}>{timeAgo(c.at)}</span>
                </div>
              </div>
              <div style={{ fontSize: 15, lineHeight: '1.6', marginBottom: 16 }}>{c.text}</div>
              <button style={{ ...(helpedIds[c.id] ? STYLES.btnPrimary : STYLES.btnGhost), padding: '6px 16px', fontSize: 12 }} onClick={() => handleHelpful(c.id)} disabled={helpedIds[c.id]}>
                ▲ Helpful ({c.helpful})
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODULE COMPONENT: FAKE NEWS
// -------------------------------------------------------------
function FakeNews({ newsLog, setNewsLog }) {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    if (!headline) return;
    if (!apiKey) { alert("Missing Gemini API Key. Please add VITE_GEMINI_API_KEY to your .env file and restart the server."); return; }
    setLoading(true);
    setResult(null);

    const systemPrompt = `You are a fact-checking AI. Today's date is ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}. Respond ONLY with valid JSON (no markdown):\n{"verdict":"FAKE|REAL|UNCERTAIN","confidence":0-100,"reasons":["r1","r2","r3"],"redFlags":["f1","f2"],"summary":"2-3 sentence plain English analysis"}`;
    const userPrompt = `Headline: ${headline}\nBody: ${body || "None provided"}`;

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      let text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setResult(parsed);
      
      // Persist to Shared News Log
      const newsData = { ...parsed, headline, time: new Date().toISOString() };
      const latest = await loadShared("phishguard:newslog:v1", []);
      latest.unshift(newsData);
      await saveShared("phishguard:newslog:v1", latest.slice(0, 50));
    } catch (e) {
      setResult({ verdict: "ERROR", summary: e.message, confidence: 0, reasons: [], redFlags: [] });
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 24px 0', fontSize: 24 }}>◈ FAKE NEWS DETECTOR</h1>
      {!result ? (
        <div style={STYLES.card}>

          <span style={STYLES.sectionLabel}>Article Headline (Required)</span>
          <input style={{ ...STYLES.input, marginBottom: 16 }} placeholder="e.g. Breaking: Government to ban all crypto tomorrow..." value={headline} onChange={e => setHeadline(e.target.value)} />
          <span style={STYLES.sectionLabel}>Article Body (Optional)</span>
          <textarea style={{ ...STYLES.textarea, marginBottom: 24 }} placeholder="Paste article content here for deeper analysis..." value={body} onChange={e => setBody(e.target.value)} />
          <button style={{ ...STYLES.btnPurple, width: '100%' }} onClick={handleCheck} disabled={loading || !headline}>
            {loading ? <><span style={STYLES.pulse('#fff')} /> ◈ AI FACT-CHECKING…</> : "◈ CHECK FOR FAKE NEWS"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ ...STYLES.card, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 64, fontWeight: 'bold', color: result.verdict === 'FAKE' ? colors.red : result.verdict === 'REAL' ? colors.green : result.verdict === 'UNCERTAIN' ? colors.yellow : colors.dim }}>
              {result.verdict}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
              <span>Confidence: {result.confidence}%</span>
              <div style={{ width: 200, height: 8, background: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${result.confidence}%`, height: '100%', background: colors.purple }} />
              </div>
            </div>
          </div>

          <div style={{ ...STYLES.card, marginBottom: 24 }}>
            <span style={STYLES.sectionLabel}>AI Summary</span>
            <div style={{ fontSize: 16, lineHeight: '1.6' }}>{result.summary}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {result.redFlags && result.redFlags.length > 0 && (
              <div style={STYLES.card}>
                <span style={STYLES.sectionLabel}>Logical Fallacies & Red Flags</span>
                <ul style={{ paddingLeft: 20, color: colors.red }}>
                  {result.redFlags.map((r, i) => <li key={i} style={{ marginBottom: 8 }}>✗ {r}</li>)}
                </ul>
              </div>
            )}
            {result.reasons && result.reasons.length > 0 && (
              <div style={STYLES.card}>
                <span style={STYLES.sectionLabel}>Analysis Points</span>
                <ul style={{ paddingLeft: 20 }}>
                  {result.reasons.map((r, i) => <li key={i} style={{ marginBottom: 8 }}>○ {r}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <button style={{ ...STYLES.btnGhost, flex: 1 }} onClick={() => setResult(null)}>RE-ANALYZE</button>
            <button style={{ ...STYLES.btnGhost, flex: 1 }} onClick={() => { setResult(null); setHeadline(''); setBody(''); }}>CLEAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODULE COMPONENT: QUIZ
// -------------------------------------------------------------
function Quiz() {
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const q = [
    { url: "http://secure-paypal-update.xyz/login", label: 1, reason: "No HTTPS · Suspicious TLD (.xyz) · Keywords: secure, paypal, update, login" },
    { url: "https://google.com", label: 0, reason: "HTTPS · Well-known trusted domain · Short clean URL" },
    { url: "http://amaz0n-account-verify.com/signin", label: 1, reason: "No HTTPS · Number substitution (0→o) · Keywords: account, verify, signin" },
    { url: "https://github.com/user/repo", label: 0, reason: "HTTPS · Reputable developer platform · Clean structure" },
    { url: "http://apple-id-suspended.info/confirm", label: 1, reason: "No HTTPS · Brand impersonation · Alarm keywords · .info TLD" },
    { url: "https://stackoverflow.com/questions/123", label: 0, reason: "HTTPS · Trusted dev community · Standard URL format" },
    { url: "http://login-bankofamerica-verify.xyz", label: 1, reason: "No HTTPS · Brand impersonation · 3 suspicious keywords · .xyz TLD" },
    { url: "https://wikipedia.org/wiki/Phishing", label: 0, reason: "HTTPS · Well-known educational resource · Clean URL" }
  ];

  const current = q[qi % q.length];

  const handleAnswer = (ans) => {
    const isCorrect = ans === current.label;
    setFeedback({ correct: isCorrect, reason: current.reason });
    setTotal(p => p + 1);
    if (isCorrect) {
      setScore(p => p + 1);
      setStreak(p => p + 1);
    } else {
      setStreak(0);
    }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 24px 0', fontSize: 24 }}>◈ PHISHING QUIZ</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <span style={STYLES.sectionLabel}>Score</span>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: colors.accent }}>{score}/{total}</div>
        </div>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <span style={STYLES.sectionLabel}>Accuracy</span>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: colors.purple }}>{total === 0 ? 0 : Math.round((score / total) * 100)}%</div>
        </div>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <span style={STYLES.sectionLabel}>Streak</span>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: colors.orange }}>🔥 {streak}</div>
        </div>
      </div>

      <div style={{ ...STYLES.card, padding: 40, textAlign: 'center', marginBottom: 24 }}>
        <span style={STYLES.sectionLabel}>Is this URL safe or phishing?</span>
        <div style={{ background: '#0a0f18', padding: 24, borderRadius: 8, fontSize: 24, color: colors.green, fontFamily: 'monospace', wordBreak: 'break-all', border: `1px dashed ${colors.dim}`, marginBottom: 32 }}>
          {current.url}
        </div>

        {!feedback ? (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button style={{ ...STYLES.btnSuccess, width: 200, fontSize: 18, padding: 16 }} onClick={() => handleAnswer(0)}>✓ SAFE</button>
            <button style={{ ...STYLES.btnDanger, width: 200, fontSize: 18, padding: 16 }} onClick={() => handleAnswer(1)}>⚠ PHISHING</button>
          </div>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: feedback.correct ? colors.green : colors.red, marginBottom: 12 }}>
              {feedback.correct ? '✓ CORRECT!' : '✗ INCORRECT'}
            </div>
            <div style={{ fontSize: 16, color: colors.text, marginBottom: 24 }}>{feedback.reason}</div>
            <button style={STYLES.btnPrimary} onClick={() => { setFeedback(null); setQi(p => p + 1); }}>NEXT →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MAIN APP COMPONENT
// -------------------------------------------------------------
export default function PhishGuard() {
  const [tab, setTab] = useState("dashboard");
  const [blacklist, setBlacklist] = useState([]);
  const [comments, setComments] = useState([]);
  const [scanLog, setScanLog] = useState([]);
  const [newsLog, setNewsLog] = useState([]);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      body { margin: 0; background: ${colors.bg}; color: ${colors.text}; font-family: 'Courier New', monospace; overflow-x: hidden; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: #1e2640; border-radius: 2px; }
      @keyframes pulseSync { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
    `;
    document.head.appendChild(style);

    // Listen for Shared Blacklist
    const unsubBlacklist = window.storage.listen("phishguard:blacklist:v1", (data) => {
      if (data && data.length > 0) setBlacklist(data);
      else saveShared("phishguard:blacklist:v1", SEED_BLACKLIST);
    });

    // Listen for Shared Comments
    const unsubComments = window.storage.listen("phishguard:comments:v1", (data) => {
      if (data && data.length > 0) setComments(data);
      else saveShared("phishguard:comments:v1", SEED_COMMENTS);
    });

    // Listen for Shared Scan Log
    const unsubScans = window.storage.listen("phishguard:scanlog:v1", (data) => {
      if (data) setScanLog(data);
    });

    // Listen for Shared News Log
    const unsubNews = window.storage.listen("phishguard:newslog:v1", (data) => {
      if (data) setNewsLog(data);
    });

    // Booting timer
    const timer = setTimeout(() => setBooting(false), 2000);

    return () => {
      unsubBlacklist();
      unsubComments();
      unsubScans();
      unsubNews();
      clearTimeout(timer);
    };
  }, []);

  if (booting) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <h1 style={{ fontSize: 48, background: 'linear-gradient(90deg, #38bdf8, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 24, letterSpacing: 4 }}>
          ⚡ PHISHGUARD
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: colors.green, fontFamily: 'monospace', letterSpacing: 2 }}>
          <span style={{ ...STYLES.pulse(colors.green), animation: 'pulseSync 1s infinite' }} /> LOADING SHARED BLACKLIST…
        </div>
      </div>
    );
  }

  const menu = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "scanner", label: "URL Scanner", icon: "◉" },
    { id: "blacklist", label: "Public Blacklist", icon: "⚠", badge: blacklist.length, badgeColor: colors.red },
    { id: "community", label: "Community", icon: "👥", badge: comments.length, badgeColor: colors.green },
    { id: "news", label: "Fake News", icon: "📰" },
    { id: "quiz", label: "Phishing Quiz", icon: "🎯" }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: 230, background: colors.surface, borderRight: `1px solid ${colors.border}`, padding: '24px 0', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ padding: '0 24px', marginBottom: 40 }}>
          <div style={{ fontWeight: 'bold', fontSize: 18, color: colors.accent, letterSpacing: 1, marginBottom: 4 }}>⚡ PHISHGUARD</div>
          <div style={{ fontSize: 10, color: colors.dim, letterSpacing: 1, marginBottom: 16 }}>CYBER THREAT INTEL v5.0</div>
          <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 6, color: colors.green, padding: '4px 8px', background: `${colors.green}11`, borderRadius: 12, width: 'fit-content' }}>
            <span style={{ ...STYLES.pulse(colors.green), animation: 'pulseSync 2s infinite' }} />
            LIVE · OPEN · PERSISTENT
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {menu.map(m => (
            <div key={m.id} onClick={() => setTab(m.id)} style={{ padding: '12px 24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: tab === m.id ? `3px solid ${colors.accent}` : '3px solid transparent', background: tab === m.id ? `${colors.accent}11` : 'transparent', color: tab === m.id ? colors.accent : colors.text }}>
              <div style={{ display: 'flex', gap: 12 }}><span style={{ width: 20 }}>{m.icon}</span>{m.label}</div>
              {m.badge && <span style={{ background: m.badgeColor, color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>{m.badge}</span>}
            </div>
          ))}
        </div>

        <div style={{ padding: '24px 24px 0 24px', borderTop: `1px solid ${colors.border}` }}>
          <span style={STYLES.sectionLabel}>ATTACK TYPES</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(attackTypes).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span>{t.icon}</span>
                <span style={{ color: t.color }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginLeft: 230, padding: '36px 40px', flex: 1, maxWidth: 1200 }}>
        {tab === "dashboard" && <Dashboard blacklist={blacklist} comments={comments} scanLog={scanLog} newsLog={newsLog} />}
        {tab === "scanner" && <Scanner blacklist={blacklist} setBlacklist={setBlacklist} scanLog={scanLog} setScanLog={setScanLog} />}
        {tab === "blacklist" && <Blacklist blacklist={blacklist} setBlacklist={setBlacklist} />}
        {tab === "community" && <Community comments={comments} setComments={setComments} />}
        {tab === "news" && <FakeNews newsLog={newsLog} setNewsLog={setNewsLog} />}
        {tab === "quiz" && <Quiz />}
      </div>
    </div>
  );
}
