"use client";

import { useState } from "react";

// ============================================================
// Analyst Panel (S58)
// Post-round AI analysis displayed inside RoundResult.
// Collapsible panel, default closed, click to expand.
// ============================================================

export interface RoundAnalysisData {
  playerId: string;
  buildAnalysis: {
    buildPath: string;
    efficiency: number;
    synergyStatus: string;
    activeSynergies: string[];
    tomeDistribution: Record<string, number>;
    assessment: string;
  };
  combatAnalysis: {
    killDeathRatio: number;
    survivalTime: number;
    positionScore: number;
    assessment: string;
  };
  suggestions: Array<{
    priority: number;
    icon: string;
    text: string;
  }>;
  overallGrade: string;
}

const GRADE_COLORS: Record<string, string> = {
  S: "text-yellow-400",
  A: "text-green-400",
  B: "text-blue-400",
  C: "text-gray-300",
  D: "text-red-400",
};

const SUGGESTION_ICONS: Record<string, string> = {
  build: "\uD83D\uDCE6",
  survival: "\uD83D\uDEE1\uFE0F",
  combat: "\u2694\uFE0F",
};

export function AnalystPanel({
  analysis,
}: {
  analysis: RoundAnalysisData | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  return (
    <div className="mt-4 w-full max-w-md">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="
          w-full flex items-center justify-between
          px-4 py-2 rounded-t-lg
          bg-indigo-900/60 border border-indigo-500/40
          text-indigo-200 text-sm font-medium
          hover:bg-indigo-800/60 transition-colors
        "
        aria-expanded={expanded}
        aria-controls="analyst-content"
      >
        <span className="flex items-center gap-2">
          <span>\uD83E\uDD16</span>
          <span>AI Analysis</span>
          <span className={`text-lg font-bold ${GRADE_COLORS[analysis.overallGrade] || "text-white"}`}>
            {analysis.overallGrade}
          </span>
        </span>
        <span className="text-xs opacity-70">
          {expanded ? "Click to collapse" : "Click to expand"}
        </span>
      </button>

      {/* Collapsible content */}
      <div
        id="analyst-content"
        className={`
          overflow-hidden transition-all duration-300
          ${expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="bg-gray-900/80 border border-t-0 border-indigo-500/30 rounded-b-lg p-4 space-y-4">
          {/* Build Analysis */}
          <Section title="Build Analysis">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">Path:</span>
              <span className="text-sm text-white capitalize">
                {analysis.buildAnalysis.buildPath}
              </span>
              <span className="text-xs text-gray-400 ml-2">Efficiency:</span>
              <EfficiencyBar value={analysis.buildAnalysis.efficiency} />
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              {analysis.buildAnalysis.assessment}
            </p>
            {analysis.buildAnalysis.activeSynergies.length > 0 && (
              <div className="mt-1 flex gap-1 flex-wrap">
                {analysis.buildAnalysis.activeSynergies.map((syn) => (
                  <span
                    key={syn}
                    className="px-2 py-0.5 bg-purple-800/50 rounded text-xs text-purple-200"
                  >
                    {syn}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* Combat Analysis */}
          <Section title="Combat Analysis">
            <div className="grid grid-cols-3 gap-2 mb-1">
              <StatBox label="K/D" value={analysis.combatAnalysis.killDeathRatio.toFixed(1)} />
              <StatBox label="Survival" value={`${analysis.combatAnalysis.survivalTime}s`} />
              <StatBox label="Position" value={`${analysis.combatAnalysis.positionScore.toFixed(0)}%`} />
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              {analysis.combatAnalysis.assessment}
            </p>
          </Section>

          {/* Suggestions */}
          <Section title="Improvement Suggestions">
            <div className="space-y-2">
              {analysis.suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="flex-shrink-0 mt-0.5">
                    {SUGGESTION_ICONS[suggestion.icon] || "\uD83D\uDCA1"}
                  </span>
                  <span className="text-gray-200 leading-relaxed">
                    {suggestion.text}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wide mb-1">
        {title}
      </h4>
      {children}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded px-2 py-1 text-center">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function EfficiencyBar({ value }: { value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  let color = "bg-red-500";
  if (clampedValue >= 80) color = "bg-green-500";
  else if (clampedValue >= 50) color = "bg-yellow-500";
  else if (clampedValue >= 30) color = "bg-orange-500";

  return (
    <div className="flex items-center gap-1">
      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-xs text-gray-300">{clampedValue.toFixed(0)}%</span>
    </div>
  );
}

export default AnalystPanel;
