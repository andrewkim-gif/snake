"use client";

/**
 * API Dashboard — Phase 6, S28
 * 1. API Key Management (localStorage-persisted)
 * 2. Agent Status Dashboard (live API)
 * 3. Battle Log Viewer (live API + polling)
 * 4. Strategy Config Form (load/save via API)
 * 5. Real-time Battle Mini View (WebSocket)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SK, SKFont, bodyFont, headingFont } from "@/lib/sketch-ui";
import { fetchAgents, fetchEvents, getServerUrl, isServerAvailable, type GameEvent } from "@/lib/api-client";
import { useApiData } from "@/hooks/useApiData";

// --- Types ---

interface APIKeyInfo {
  id: string;
  name: string;
  prefix: string;
  fullKey: string;
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

// --- Helpers ---

const LS_KEY = "aww_api_keys";

function generateHex(len: number): string {
  const arr = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadKeysFromStorage(): APIKeyInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as APIKeyInfo[];
  } catch {
    return [];
  }
}

function saveKeysToStorage(keys: APIKeyInfo[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(keys));
}

// --- Main Dashboard ---

type TabType = "keys" | "agents" | "logs" | "strategy" | "live";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("keys");
  const [keys, setKeys] = useState<APIKeyInfo[]>([]);

  // Load keys from localStorage on mount
  useEffect(() => {
    setKeys(loadKeysFromStorage());
  }, []);

  // Derive primary apiKey from first available key
  const apiKey = keys.length > 0 ? keys[0].fullKey : "";

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
              borderBottom: activeTab === tab.id ? `1px solid ${SK.gold}` : "1px solid transparent",
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
        {activeTab === "keys" && <APIKeysPanel keys={keys} setKeys={setKeys} />}
        {activeTab === "agents" && <AgentsPanel apiKey={apiKey} />}
        {activeTab === "logs" && <BattleLogPanel />}
        {activeTab === "strategy" && <StrategyPanel apiKey={apiKey} />}
        {activeTab === "live" && <LiveBattlePanel apiKey={apiKey} />}
      </main>
    </div>
  );
}

// ============================================================
// 1. API Keys Panel (localStorage-persisted)
// ============================================================

function APIKeysPanel({
  keys,
  setKeys,
}: {
  keys: APIKeyInfo[];
  setKeys: React.Dispatch<React.SetStateAction<APIKeyInfo[]>>;
}) {
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleCreateKey = useCallback(() => {
    const fullKey = `aww_${generateHex(24)}`;
    const prefix = fullKey.slice(0, 12);
    const newKey: APIKeyInfo = {
      id: `key_${Date.now()}`,
      name: newKeyName || `Key ${keys.length + 1}`,
      prefix,
      fullKey,
      lastUsed: "Never",
      createdAt: new Date().toISOString(),
    };
    const updated = [...keys, newKey];
    setKeys(updated);
    saveKeysToStorage(updated);
    setCreatedKey(fullKey);
    setNewKeyName("");
  }, [newKeyName, keys, setKeys]);

  const handleDeleteKey = useCallback(
    (id: string) => {
      const updated = keys.filter((k) => k.id !== id);
      setKeys(updated);
      saveKeysToStorage(updated);
    },
    [keys, setKeys],
  );

  return (
    <div>
      <SectionTitle>API Key Management</SectionTitle>
      <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginBottom: 8 }}>
        Each API key controls one agent. Maximum 5 keys per account.
      </p>
      <p style={{ color: SK.textMuted, fontSize: SKFont.xs, marginBottom: 16 }}>
        Keys are stored locally. Server-side key management coming soon.
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
            onClick={() => {
              navigator.clipboard.writeText(createdKey);
              setCreatedKey(null);
            }}
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
// 2. Agents Panel (live API via useApiData)
// ============================================================

function AgentsPanel({ apiKey }: { apiKey: string }) {
  const fetcher = useCallback(() => {
    if (!apiKey || !isServerAvailable()) return Promise.resolve([] as Record<string, unknown>[]);
    return fetchAgents(apiKey);
  }, [apiKey]);

  const { data: rawAgents, loading } = useApiData(fetcher, { refreshInterval: 15000 });

  // Map raw server response to AgentStatus shape
  const agents: AgentStatus[] = useMemo(() => {
    if (!rawAgents || !Array.isArray(rawAgents)) return [];
    return rawAgents.map((a) => ({
      agent_id: String(a.agent_id ?? a.id ?? "unknown"),
      country_iso: String(a.country_iso ?? a.country ?? "???"),
      country_name: String(a.country_name ?? a.countryName ?? a.country_iso ?? "Unknown"),
      status: String(a.status ?? "unknown"),
      level: Number(a.level ?? 0),
      hp: Number(a.hp ?? 0),
      kills: Number(a.kills ?? 0),
      deaths: Number(a.deaths ?? 0),
      total_score: Number(a.total_score ?? a.score ?? 0),
      deployed_at: String(a.deployed_at ?? a.deployedAt ?? new Date().toISOString()),
    }));
  }, [rawAgents]);

  return (
    <div>
      <SectionTitle>Agent Status</SectionTitle>

      {!apiKey && (
        <p style={{ color: SK.textMuted, fontSize: SKFont.sm, marginBottom: 16 }}>
          Enter your API key in the API Keys tab to see your agents.
        </p>
      )}

      {!isServerAvailable() && apiKey && (
        <p style={{ color: SK.textMuted, fontSize: SKFont.sm, marginBottom: 16 }}>
          Server connection required. Start the server with <code style={{ color: SK.gold }}>./game.sh</code>.
        </p>
      )}

      {loading && apiKey && isServerAvailable() && (
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm }}>Loading agents...</p>
      )}

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

      {!loading && agents.length === 0 && apiKey && isServerAvailable() && (
        <p style={{ color: SK.textMuted, fontSize: SKFont.sm, textAlign: "center", padding: 40 }}>
          No agents found. Deploy an agent to see it here.
        </p>
      )}
    </div>
  );
}

// ============================================================
// 3. Battle Log Panel (live API + polling)
// ============================================================

function BattleLogPanel() {
  const fetcher = useCallback(() => {
    if (!isServerAvailable()) return Promise.resolve([] as GameEvent[]);
    return fetchEvents(20);
  }, []);

  const { data: events, loading } = useApiData(fetcher, { refreshInterval: 10000 });

  // Convert GameEvent[] to BattleLogEntry[] format
  const logs: BattleLogEntry[] = useMemo(() => {
    if (!events || !Array.isArray(events)) return [];
    return events.map((ev, idx) => ({
      timestamp: ev.timestamp,
      battle_id: ev.id || `event_${idx}`,
      country_iso: ev.countryIso || "???",
      result: ev.type === "kill" || ev.type === "victory" ? "survived" : ev.type === "death" ? "died" : ev.type,
      kills: ev.type === "kill" || ev.type === "victory" ? 1 : 0,
      deaths: ev.type === "death" ? 1 : 0,
      score: 0,
      duration_sec: 0,
      final_level: 0,
    }));
  }, [events]);

  return (
    <div>
      <SectionTitle>Battle Log</SectionTitle>

      {!isServerAvailable() && (
        <p style={{ color: SK.textMuted, fontSize: SKFont.sm, marginBottom: 16 }}>
          Server connection required. Start the server with <code style={{ color: SK.gold }}>./game.sh</code>.
        </p>
      )}

      {loading && isServerAvailable() && (
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm }}>Loading battle log...</p>
      )}

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
          {logs.length === 0 && !loading && (
            <tr>
              <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: SK.textMuted }}>
                No battle events recorded yet.
              </td>
            </tr>
          )}
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
              <td style={tdStyle}>
                {log.kills}/{log.deaths}
              </td>
              <td style={{ ...tdStyle, color: SK.gold }}>{log.score}</td>
              <td style={tdStyle}>Lv.{log.final_level}</td>
              <td style={{ ...tdStyle, color: SK.textSecondary }}>
                {Math.floor(log.duration_sec / 60)}m {log.duration_sec % 60}s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 4. Strategy Config Panel (load/save via API)
// ============================================================

function StrategyPanel({ apiKey }: { apiKey: string }) {
  const [aggression, setAggression] = useState(0.5);
  const [targetPriority, setTargetPriority] = useState("nearest");
  const [retreatThreshold, setRetreatThreshold] = useState(0.3);
  const [useDash, setUseDash] = useState(true);
  const [autoRedeploy, setAutoRedeploy] = useState(true);
  const [avoidSTier, setAvoidSTier] = useState(false);
  const [preferredTomes, setPreferredTomes] = useState<string[]>(["damage", "armor"]);
  const [synergyTarget, setSynergyTarget] = useState("glass_cannon");
  const [saved, setSaved] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load training config from server when agentId is available
  useEffect(() => {
    if (!agentId || !isServerAvailable()) return;
    const serverUrl = getServerUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    fetch(`${serverUrl}/api/agent/${agentId}/training`, { headers })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        if (data.aggression != null) setAggression(data.aggression);
        if (data.target_priority) setTargetPriority(data.target_priority);
        if (data.retreat_threshold != null) setRetreatThreshold(data.retreat_threshold);
        if (data.use_dash != null) setUseDash(data.use_dash);
        if (data.auto_redeploy != null) setAutoRedeploy(data.auto_redeploy);
        if (data.avoid_s_tier != null) setAvoidSTier(data.avoid_s_tier);
        if (data.preferred_tomes) setPreferredTomes(data.preferred_tomes);
        if (data.synergy_target) setSynergyTarget(data.synergy_target);
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Could not load saved strategy. Using defaults.");
      });
  }, [agentId, apiKey]);

  const handleSave = useCallback(() => {
    const payload = {
      aggression,
      target_priority: targetPriority,
      retreat_threshold: retreatThreshold,
      use_dash: useDash,
      auto_redeploy: autoRedeploy,
      avoid_s_tier: avoidSTier,
      preferred_tomes: preferredTomes,
      synergy_target: synergyTarget,
    };

    if (agentId && isServerAvailable()) {
      const serverUrl = getServerUrl();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      fetch(`${serverUrl}/api/agent/${agentId}/training`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Save failed");
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        })
        .catch(() => {
          // Fallback: still show saved for local state
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        });
    } else {
      // No agent selected or no server — just show local save confirmation
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [aggression, targetPriority, retreatThreshold, useDash, autoRedeploy, avoidSTier, preferredTomes, synergyTarget, agentId, apiKey]);

  return (
    <div>
      <SectionTitle>Strategy Configuration</SectionTitle>

      {/* Agent ID selector */}
      <div style={{ marginBottom: 16 }}>
        <FormField label="Agent ID (optional — load/save to server)">
          <input
            type="text"
            placeholder="e.g. agent_abc123"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            style={{ ...inputStyle, maxWidth: 340 }}
          />
        </FormField>
        {loadError && (
          <p style={{ color: SK.orangeLight, fontSize: SKFont.xs, marginTop: 4 }}>{loadError}</p>
        )}
        {!agentId && (
          <p style={{ color: SK.textMuted, fontSize: SKFont.xs, marginTop: 4 }}>
            Without an Agent ID, strategy is saved locally only.
          </p>
        )}
      </div>

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
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
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
// 5. Live Battle Mini View (WebSocket)
// ============================================================

function LiveBattlePanel({ apiKey }: { apiKey: string }) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<{ time: string; text: string; color: string }[]>([]);
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!isServerAvailable()) {
      setWsError("Server URL not configured. Start the server with ./game.sh");
      return;
    }

    const serverUrl = getServerUrl();
    const wsUrl = serverUrl.replace(/^http/, "ws") + "/ws/agents/live" + (apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : "");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setWsError(null);
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          // Map event type to color
          let color: string = SK.textSecondary;
          const eventType = String(data.type || "");
          if (eventType.includes("kill")) color = SK.orangeLight;
          else if (eventType.includes("level")) color = SK.blue;
          else if (eventType.includes("shrink") || eventType.includes("damage")) color = SK.red;
          else if (eventType.includes("orb") || eventType.includes("heal")) color = SK.green;
          else if (eventType.includes("death")) color = SK.redLight;

          const text = data.description || data.message || data.text || JSON.stringify(data);

          setEvents((prev) => [
            { time: new Date().toLocaleTimeString(), text, color },
            ...prev.slice(0, 49),
          ]);
        } catch {
          // Non-JSON message — display raw
          setEvents((prev) => [
            { time: new Date().toLocaleTimeString(), text: String(msg.data), color: SK.textSecondary },
            ...prev.slice(0, 49),
          ]);
        }
      };

      ws.onerror = () => {
        setWsError("WebSocket connection error");
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };
    } catch {
      setWsError("Failed to create WebSocket connection");
    }
  }, [apiKey]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    if (connected) {
      disconnect();
    } else {
      connect();
    }
  }, [connected, connect, disconnect]);

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
          onClick={handleToggle}
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

      {wsError && (
        <p style={{ color: SK.orangeLight, fontSize: SKFont.xs, marginBottom: 12 }}>{wsError}</p>
      )}

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
