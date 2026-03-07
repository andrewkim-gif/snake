"use client";

/**
 * API Dashboard — Phase 5, S28
 * 1. API Key Management (create/delete/view)
 * 2. Agent Status Dashboard
 * 3. Battle Log Viewer
 * 4. Strategy Config Form
 * 5. Real-time Battle Mini View
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SK, SKFont, bodyFont, headingFont, handDrawnRadius } from "@/lib/sketch-ui";

// PLACEHOLDER: replaced at section level
const PLACEHOLDER_API_KEYS = "PLACEHOLDER_API_KEYS";
const PLACEHOLDER_AGENTS = "PLACEHOLDER_AGENTS";
const PLACEHOLDER_BATTLE_LOG = "PLACEHOLDER_BATTLE_LOG";
const PLACEHOLDER_STRATEGY = "PLACEHOLDER_STRATEGY";
const PLACEHOLDER_LIVE = "PLACEHOLDER_LIVE";

// --- Types ---

interface APIKeyInfo {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string;
  createdAt: string;
}

interface AgentStatus {
  agent_id: string;
  country_iso: string;
  country_name: string;
  status: string;
  level: number;
  hp: number;
  kills: number;
  deaths: number;
  total_score: number;
  deployed_at: string;
}

interface BattleLogEntry {
  timestamp: string;
  battle_id: string;
  country_iso: string;
  result: string;
  kills: number;
  deaths: number;
  score: number;
  duration_sec: number;
  final_level: number;
  killed_by?: string;
}

// --- Main Dashboard ---

type TabType = "keys" | "agents" | "logs" | "strategy" | "live";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("keys");

  const tabs: { id: TabType; label: string }[] = [
    { id: "keys", label: "API Keys" },
    { id: "agents", label: "Agents" },
    { id: "logs", label: "Battle Log" },
    { id: "strategy", label: "Strategy" },
    { id: "live", label: "Live View" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: SK.bg,
        color: SK.textPrimary,
        fontFamily: bodyFont,
        padding: 24,
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: SKFont.h1,
            color: SK.gold,
            margin: 0,
          }}
        >
          Agent API Dashboard
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          Manage your AI agents, API keys, and battle strategies
        </p>
      </header>

      {/* Tab navigation */}
      <nav
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: `1px solid ${SK.border}`,
          paddingBottom: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontFamily: bodyFont,
              fontSize: SKFont.body,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? SK.gold : SK.textSecondary,
              background: activeTab === tab.id ? `${SK.gold}15` : "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${SK.gold}` : "2px solid transparent",
              padding: "10px 18px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main>
        {activeTab === "keys" && <APIKeysPanel />}
        {activeTab === "agents" && <AgentsPanel />}
        {activeTab === "logs" && <BattleLogPanel />}
        {activeTab === "strategy" && <StrategyPanel />}
        {activeTab === "live" && <LiveBattlePanel />}
      </main>
    </div>
  );
}

// ============================================================
// 1. API Keys Panel
// ============================================================

function APIKeysPanel() {
  const [keys, setKeys] = useState<APIKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleCreateKey = useCallback(() => {
    // Simulated API key creation (in production, calls POST /api/keys)
    const fakeKey: APIKeyInfo = {
      id: `key_${Date.now()}`,
      name: newKeyName || `Key ${keys.length + 1}`,
      prefix: `aww_${Math.random().toString(16).slice(2, 10)}`,
      lastUsed: "Never",
      createdAt: new Date().toISOString(),
    };
    setKeys((prev) => [...prev, fakeKey]);
    setCreatedKey(`aww_${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`);
    setNewKeyName("");
  }, [newKeyName, keys.length]);

  const handleDeleteKey = useCallback((id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }, []);

  return (
    <div>
      <SectionTitle>API Key Management</SectionTitle>
      <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginBottom: 16 }}>
        Each API key controls one agent. Maximum 5 keys per account.
      </p>

      {/* Create new key */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Key name (optional)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={handleCreateKey}
          disabled={keys.length >= 5}
          style={{
            ...btnStyle,
            background: keys.length >= 5 ? SK.textMuted : SK.green,
            cursor: keys.length >= 5 ? "not-allowed" : "pointer",
          }}
        >
          + Generate Key
        </button>
      </div>

      {/* Show created key (one-time) */}
      {createdKey && (
        <div
          style={{
            background: `${SK.green}15`,
            border: `1px solid ${SK.green}`,
            borderRadius: 0,
            padding: 12,
            marginBottom: 16,
            fontSize: SKFont.sm,
          }}
        >
          <strong style={{ color: SK.green }}>Key created!</strong> Copy it now — it will not be shown again:
          <code
            style={{
              display: "block",
              marginTop: 8,
              padding: 8,
              background: SK.bg,
              borderRadius: 0,
              fontSize: SKFont.xs,
              wordBreak: "break-all",
              color: SK.gold,
            }}
          >
            {createdKey}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(createdKey); setCreatedKey(null); }}
            style={{ ...btnStyle, marginTop: 8, background: SK.blue, fontSize: SKFont.xs }}
          >
            Copy & Dismiss
          </button>
        </div>
      )}

      {/* Keys table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${SK.border}` }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Prefix</th>
            <th style={thStyle}>Last Used</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {keys.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: SK.textMuted }}>
                No API keys yet. Generate one to get started.
              </td>
            </tr>
          )}
          {keys.map((key) => (
            <tr key={key.id} style={{ borderBottom: `1px solid ${SK.borderDark}` }}>
              <td style={tdStyle}>{key.name}</td>
              <td style={{ ...tdStyle, fontFamily: "monospace", color: SK.gold }}>{key.prefix}...</td>
              <td style={{ ...tdStyle, color: SK.textSecondary }}>{key.lastUsed}</td>
              <td style={{ ...tdStyle, color: SK.textSecondary }}>{new Date(key.createdAt).toLocaleDateString()}</td>
              <td style={tdStyle}>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  style={{ ...btnStyle, background: SK.red, fontSize: SKFont.xs, padding: "4px 10px" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 2. Agents Panel
// ============================================================

function AgentsPanel() {
  const [agents, setAgents] = useState<AgentStatus[]>([
    {
      agent_id: "agent_demo_1",
      country_iso: "KOR",
      country_name: "South Korea",
      status: "active",
      level: 7,
      hp: 145.3,
      kills: 4,
      deaths: 0,
      total_score: 850,
      deployed_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      agent_id: "agent_demo_2",
      country_iso: "JPN",
      country_name: "Japan",
      status: "dead",
      level: 4,
      hp: 0,
      kills: 1,
      deaths: 1,
      total_score: 320,
      deployed_at: new Date(Date.now() - 600000).toISOString(),
    },
  ]);

  return (
    <div>
      <SectionTitle>Agent Status</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {agents.map((agent) => (
          <div
            key={agent.agent_id}
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: SKFont.body }}>{agent.agent_id}</span>
              <StatusBadge status={agent.status} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: SKFont.sm }}>
              <InfoChip label="Country" value={`${agent.country_name} (${agent.country_iso})`} />
              <InfoChip label="Level" value={String(agent.level)} color={SK.blue} />
              <InfoChip label="HP" value={agent.hp.toFixed(0)} color={agent.hp > 0 ? SK.green : SK.red} />
              <InfoChip label="Kills" value={String(agent.kills)} color={SK.orangeLight} />
              <InfoChip label="Score" value={String(agent.total_score)} color={SK.gold} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 3. Battle Log Panel
// ============================================================

function BattleLogPanel() {
  const [logs, setLogs] = useState<BattleLogEntry[]>([
    {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      battle_id: "battle_001",
      country_iso: "KOR",
      result: "survived",
      kills: 4,
      deaths: 0,
      score: 850,
      duration_sec: 300,
      final_level: 7,
    },
    {
      timestamp: new Date(Date.now() - 600000).toISOString(),
      battle_id: "battle_002",
      country_iso: "JPN",
      result: "died",
      kills: 1,
      deaths: 1,
      score: 320,
      duration_sec: 180,
      final_level: 4,
      killed_by: "bot_samurai_03",
    },
  ]);

  return (
    <div>
      <SectionTitle>Battle Log</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${SK.border}` }}>
            <th style={thStyle}>Time</th>
            <th style={thStyle}>Country</th>
            <th style={thStyle}>Result</th>
            <th style={thStyle}>K/D</th>
            <th style={thStyle}>Score</th>
            <th style={thStyle}>Level</th>
            <th style={thStyle}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${SK.borderDark}` }}>
              <td style={{ ...tdStyle, color: SK.textSecondary }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
              <td style={tdStyle}>{log.country_iso}</td>
              <td style={tdStyle}>
                <span
                  style={{
                    color: log.result === "survived" ? SK.green : log.result === "died" ? SK.red : SK.textSecondary,
                    fontWeight: 600,
                  }}
                >
                  {log.result.toUpperCase()}
                </span>
              </td>
              <td style={tdStyle}>{log.kills}/{log.deaths}</td>
              <td style={{ ...tdStyle, color: SK.gold }}>{log.score}</td>
              <td style={tdStyle}>Lv.{log.final_level}</td>
              <td style={{ ...tdStyle, color: SK.textSecondary }}>{Math.floor(log.duration_sec / 60)}m {log.duration_sec % 60}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 4. Strategy Config Panel
// ============================================================

function StrategyPanel() {
  const [aggression, setAggression] = useState(0.5);
  const [targetPriority, setTargetPriority] = useState("nearest");
  const [retreatThreshold, setRetreatThreshold] = useState(0.3);
  const [useDash, setUseDash] = useState(true);
  const [autoRedeploy, setAutoRedeploy] = useState(true);
  const [avoidSTier, setAvoidSTier] = useState(false);
  const [preferredTomes, setPreferredTomes] = useState<string[]>(["damage", "armor"]);
  const [synergyTarget, setSynergyTarget] = useState("glass_cannon");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // In production: POST /api/agents/{id}/strategy
  };

  return (
    <div>
      <SectionTitle>Strategy Configuration</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Combat Behavior */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Combat Behavior</h3>

          <FormField label={`Aggression: ${aggression.toFixed(1)}`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={aggression}
              onChange={(e) => setAggression(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: SK.gold }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: SKFont.xs, color: SK.textMuted }}>
              <span>Defensive</span>
              <span>Aggressive</span>
            </div>
          </FormField>

          <FormField label="Target Priority">
            <select
              value={targetPriority}
              onChange={(e) => setTargetPriority(e.target.value)}
              style={selectStyle}
            >
              <option value="nearest">Nearest</option>
              <option value="lowest_hp">Lowest HP</option>
              <option value="highest_level">Highest Level</option>
              <option value="strongest">Strongest</option>
            </select>
          </FormField>

          <FormField label={`Retreat Threshold: ${(retreatThreshold * 100).toFixed(0)}% HP`}>
            <input
              type="range"
              min="0.1"
              max="0.5"
              step="0.05"
              value={retreatThreshold}
              onChange={(e) => setRetreatThreshold(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: SK.gold }}
            />
          </FormField>

          <FormField label="">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={useDash} onChange={(e) => setUseDash(e.target.checked)} />
              <span>Use Dash (boost attacks)</span>
            </label>
          </FormField>
        </div>

        {/* Build Priority */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Build Priority</h3>

          <FormField label="Synergy Target">
            <select
              value={synergyTarget}
              onChange={(e) => setSynergyTarget(e.target.value)}
              style={selectStyle}
            >
              <option value="">None</option>
              <option value="glass_cannon">Glass Cannon (DMG x2)</option>
              <option value="iron_fortress">Iron Fortress (-30% DMG taken)</option>
              <option value="berserker">Berserker (Dash x3)</option>
              <option value="speedster">Speedster (-50% boost cost)</option>
              <option value="holy_trinity">Holy Trinity (+50% XP)</option>
            </select>
          </FormField>

          <FormField label="Preferred Tomes">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["damage", "armor", "speed", "regen", "xp", "luck", "magnet", "cursed"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setPreferredTomes((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    );
                  }}
                  style={{
                    ...btnStyle,
                    fontSize: SKFont.xs,
                    padding: "3px 10px",
                    background: preferredTomes.includes(t) ? SK.gold : "transparent",
                    color: preferredTomes.includes(t) ? SK.bg : SK.textSecondary,
                    border: `1px solid ${preferredTomes.includes(t) ? SK.gold : SK.border}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Deployment">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6 }}>
              <input type="checkbox" checked={autoRedeploy} onChange={(e) => setAutoRedeploy(e.target.checked)} />
              <span>Auto-redeploy after death</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={avoidSTier} onChange={(e) => setAvoidSTier(e.target.checked)} />
              <span>Avoid S-tier countries</span>
            </label>
          </FormField>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={handleSave} style={{ ...btnStyle, background: SK.green, padding: "8px 24px" }}>
          Save Strategy
        </button>
        {saved && (
          <span style={{ color: SK.green, fontSize: SKFont.sm, fontWeight: 600 }}>
            Strategy saved successfully!
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 5. Live Battle Mini View
// ============================================================

function LiveBattlePanel() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<{ time: string; text: string; color: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    // In production: connect to ws://server/ws/agents/live?api_key=xxx
    setConnected(true);
    // Simulate events
    const interval = setInterval(() => {
      const fakeEvents = [
        { text: "Agent scored a kill on bot_warrior_05", color: SK.orangeLight },
        { text: "Agent leveled up to Lv.8", color: SK.blue },
        { text: "Arena shrinking — radius now 4200px", color: SK.red },
        { text: "Agent collected 12 orbs (+36 mass)", color: SK.green },
        { text: "Agent took 15 damage from bot_tank_02", color: SK.redLight },
      ];
      const ev = fakeEvents[Math.floor(Math.random() * fakeEvents.length)];
      setEvents((prev) => [
        { time: new Date().toLocaleTimeString(), text: ev.text, color: ev.color },
        ...prev.slice(0, 49),
      ]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (connected) {
      const cleanup = connect();
      return cleanup;
    }
  }, [connected, connect]);

  return (
    <div>
      <SectionTitle>Real-time Battle Stream</SectionTitle>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 0,
            background: connected ? SK.green : SK.red,
            boxShadow: connected ? `0 0 8px ${SK.green}` : "none",
          }}
        />
        <span style={{ fontSize: SKFont.sm, color: connected ? SK.green : SK.textSecondary }}>
          {connected ? "Connected — Streaming" : "Disconnected"}
        </span>
        <button
          onClick={() => setConnected(!connected)}
          style={{
            ...btnStyle,
            background: connected ? SK.red : SK.green,
            fontSize: SKFont.sm,
            padding: "4px 14px",
          }}
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
      </div>

      {/* Live event feed */}
      <div
        style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          padding: 12,
          maxHeight: 400,
          overflowY: "auto",
        }}
      >
        {events.length === 0 && (
          <p style={{ color: SK.textMuted, textAlign: "center", padding: 40 }}>
            {connected ? "Waiting for events..." : "Connect to start streaming battle events"}
          </p>
        )}
        {events.map((ev, i) => (
          <div
            key={i}
            style={{
              padding: "4px 0",
              borderBottom: `1px solid ${SK.borderDark}`,
              display: "flex",
              gap: 8,
              fontSize: SKFont.sm,
            }}
          >
            <span style={{ color: SK.textMuted, fontFamily: "monospace", minWidth: 75 }}>
              {ev.time}
            </span>
            <span style={{ color: ev.color }}>{ev.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Shared Components & Styles
// ============================================================

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: headingFont,
        fontSize: SKFont.h2,
        color: SK.textWhite,
        marginBottom: 16,
        marginTop: 0,
      }}
    >
      {children}
    </h2>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: SK.green,
    dead: SK.red,
    recalled: SK.textMuted,
    deploying: SK.orangeLight,
  };
  return (
    <span
      style={{
        fontSize: SKFont.xs,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 0,
        background: `${colors[status] || SK.textMuted}22`,
        color: colors[status] || SK.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {status}
    </span>
  );
}

function InfoChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: `${color || SK.textSecondary}11`,
        border: `1px solid ${color || SK.border}33`,
        borderRadius: 0,
        padding: "2px 8px",
        fontSize: SKFont.xs,
      }}
    >
      <span style={{ color: SK.textMuted }}>{label}: </span>
      <span style={{ color: color || SK.textPrimary, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: "block", fontSize: SKFont.sm, color: SK.textSecondary, marginBottom: 4 }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

// --- Style objects ---

const inputStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: SKFont.body,
  background: SK.bg,
  color: SK.textPrimary,
  border: `1px solid ${SK.border}`,
  borderRadius: 0,
  padding: "8px 12px",
  flex: 1,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: SKFont.sm,
  fontWeight: 600,
  color: SK.textWhite,
  border: "none",
  borderRadius: 0,
  padding: "8px 16px",
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const selectStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: SKFont.body,
  background: SK.bg,
  color: SK.textPrimary,
  border: `1px solid ${SK.border}`,
  borderRadius: 0,
  padding: "8px 12px",
  width: "100%",
  outline: "none",
};

const thStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: SKFont.xs,
  color: SK.textMuted,
  textTransform: "uppercase",
  letterSpacing: 1,
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: SKFont.sm,
  padding: "8px 12px",
  color: SK.textPrimary,
};

const cardStyle: React.CSSProperties = {
  background: SK.cardBg,
  border: `1px solid ${SK.border}`,
  borderRadius: 0,
  padding: 20,
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: headingFont,
  fontSize: SKFont.h3,
  color: SK.textWhite,
  marginTop: 0,
  marginBottom: 16,
};
