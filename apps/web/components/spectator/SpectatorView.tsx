'use client';

/**
 * SpectatorView — 국가 전투 관전 모드
 *
 * Phase 2 (S15): 국가 클릭 → 전투 관전 진입
 *   1. 기존 GameCanvas3D 재활용 (spectate 모드)
 *   2. 카메라 자유 이동 (팬/줌/회전)
 *   3. 관전자 수 표시 HUD
 *   4. 에이전트 클릭 → 정보 팝업 (이름, 팩션, 킬/점수)
 *   5. 내 에이전트 추적 카메라 토글
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

interface AgentData {
  id: string;
  name: string;
  factionId: string;
  factionName: string;
  factionColor: string;
  x: number;
  y: number;
  mass: number;
  level: number;
  kills: number;
  score: number;
  alive: boolean;
  isMyAgent: boolean;
  skinId: number;
}

interface SpectatorViewProps {
  /** Country ISO code being spectated */
  countryISO: string;
  /** Country display name */
  countryName: string;
  /** Number of spectators watching */
  spectatorCount: number;
  /** Battle state: "idle" | "preparing" | "in_battle" | "cooldown" */
  battleStatus: string;
  /** Time remaining in current battle (seconds) */
  timeRemaining: number;
  /** List of agents in the arena */
  agents: AgentData[];
  /** Currently tracked agent ID (if any) */
  trackedAgentId?: string;
  /** IDs of the user's own agents in this arena */
  myAgentIds: string[];
  /** Callback to exit spectator mode */
  onExit: () => void;
  /** Callback when user clicks an agent */
  onAgentClick?: (agentId: string) => void;
  /** Callback to toggle agent tracking */
  onTrackAgent?: (agentId: string | null) => void;
}

// ──────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────

/** Free camera controls for spectator mode */
function SpectatorCamera({
  trackedAgent,
  isTracking,
}: {
  trackedAgent: AgentData | null;
  isTracking: boolean;
}) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (isTracking && trackedAgent && trackedAgent.alive) {
      // Smoothly follow tracked agent
      const target = new THREE.Vector3(trackedAgent.x, 0, trackedAgent.y);
      targetRef.current.lerp(target, 0.05);
      camera.lookAt(targetRef.current);
    }
  });

  return (
    <OrbitControls
      enablePan={!isTracking}
      enableZoom={true}
      enableRotate={true}
      minDistance={200}
      maxDistance={3000}
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={0.3}
      target={isTracking && trackedAgent ? [trackedAgent.x, 0, trackedAgent.y] : undefined}
    />
  );
}

/** HUD overlay showing spectator count and battle info */
function SpectatorHUD({
  countryName,
  countryISO,
  spectatorCount,
  battleStatus,
  timeRemaining,
  agentCount,
  onExit,
}: {
  countryName: string;
  countryISO: string;
  spectatorCount: number;
  battleStatus: string;
  timeRemaining: number;
  agentCount: number;
  onExit: () => void;
}) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const statusLabels: Record<string, string> = {
    idle: 'Waiting',
    preparing: 'Preparing',
    in_battle: 'Battle Active',
    cooldown: 'Cooldown',
  };

  const statusColors: Record<string, string> = {
    idle: '#888',
    preparing: '#f59e0b',
    in_battle: '#ef4444',
    cooldown: '#3b82f6',
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top bar: Country name + Battle status */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4">
        {/* Left: Country info */}
        <div className="pointer-events-auto bg-black/70 rounded-lg px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs font-mono">{countryISO}</span>
            <h2 className="text-white font-bold text-lg">{countryName}</h2>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: statusColors[battleStatus] || '#888',
                color: 'white',
              }}
            >
              {statusLabels[battleStatus] || battleStatus}
            </span>
            <span className="text-white/70 text-xs">
              {agentCount} agents
            </span>
          </div>
        </div>

        {/* Center: Timer */}
        {battleStatus === 'in_battle' && (
          <div className="bg-black/70 rounded-lg px-6 py-2 backdrop-blur-sm">
            <span className="text-white font-mono text-2xl font-bold">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Right: Spectator count + Exit */}
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="bg-black/70 rounded-lg px-3 py-2 backdrop-blur-sm flex items-center gap-2">
            <svg
              className="w-4 h-4 text-white/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span className="text-white/90 text-sm font-mono">
              {spectatorCount}
            </span>
          </div>
          <button
            onClick={onExit}
            className="bg-red-600/80 hover:bg-red-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Bottom: Camera controls hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="bg-black/50 rounded-lg px-4 py-1.5 text-white/50 text-xs">
          Drag to rotate | Scroll to zoom | Right-drag to pan | Click agent for info
        </div>
      </div>
    </div>
  );
}

/** Agent info popup when clicking an agent */
function AgentInfoPopup({
  agent,
  onClose,
  onTrack,
  isTracked,
}: {
  agent: AgentData;
  onClose: () => void;
  onTrack: () => void;
  isTracked: boolean;
}) {
  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto z-20">
      <div className="bg-black/85 backdrop-blur-md rounded-xl px-5 py-4 min-w-[280px] border border-white/10">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-white font-bold text-base">{agent.name}</h3>
            {agent.factionName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: agent.factionColor || '#888' }}
                />
                <span className="text-white/60 text-xs">{agent.factionName}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-white font-bold text-lg">{agent.kills}</div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">Kills</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-lg">{agent.level}</div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">Level</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-lg">{agent.score}</div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">Score</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs mb-3">
          <span className={agent.alive ? 'text-green-400' : 'text-red-400'}>
            {agent.alive ? 'Alive' : 'Dead'}
          </span>
          <span className="text-white/40">
            Mass: {Math.round(agent.mass)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onTrack}
            className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
              isTracked
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {isTracked ? 'Tracking' : 'Track Camera'}
          </button>
          {agent.isMyAgent && (
            <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-1.5 rounded-lg">
              My Agent
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** My agents sidebar (quick access to track own agents) */
function MyAgentsSidebar({
  agents,
  trackedAgentId,
  onTrackAgent,
}: {
  agents: AgentData[];
  trackedAgentId: string | null;
  onTrackAgent: (id: string | null) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto z-10">
      <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 space-y-2">
        <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">
          My Agents
        </div>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onTrackAgent(trackedAgentId === agent.id ? null : agent.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
              trackedAgentId === agent.id
                ? 'bg-blue-600/40 border border-blue-500/50'
                : 'bg-white/5 hover:bg-white/10 border border-transparent'
            }`}
          >
            <div className="text-white font-medium truncate">{agent.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={agent.alive ? 'text-green-400' : 'text-red-400'}>
                {agent.alive ? 'Alive' : 'Dead'}
              </span>
              <span className="text-white/40">K:{agent.kills}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Main SpectatorView
// ──────────────────────────────────────────

export function SpectatorView({
  countryISO,
  countryName,
  spectatorCount,
  battleStatus,
  timeRemaining,
  agents,
  trackedAgentId: externalTrackedId,
  myAgentIds,
  onExit,
  onAgentClick,
  onTrackAgent,
}: SpectatorViewProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [internalTrackedId, setInternalTrackedId] = useState<string | null>(
    externalTrackedId || null
  );

  // Sync external tracked ID
  useEffect(() => {
    if (externalTrackedId !== undefined) {
      setInternalTrackedId(externalTrackedId || null);
    }
  }, [externalTrackedId]);

  const trackedAgent = agents.find((a) => a.id === internalTrackedId) || null;
  const isTracking = !!trackedAgent;
  const myAgents = agents.filter((a) => myAgentIds.includes(a.id));
  const aliveAgents = agents.filter((a) => a.alive);

  const handleAgentClick = useCallback(
    (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        setSelectedAgent(agent);
        onAgentClick?.(agentId);
      }
    },
    [agents, onAgentClick]
  );

  const handleTrackAgent = useCallback(
    (agentId: string | null) => {
      setInternalTrackedId(agentId);
      onTrackAgent?.(agentId);
    },
    [onTrackAgent]
  );

  const handleTrackFromPopup = useCallback(() => {
    if (selectedAgent) {
      const newId = internalTrackedId === selectedAgent.id ? null : selectedAgent.id;
      handleTrackAgent(newId);
    }
  }, [selectedAgent, internalTrackedId, handleTrackAgent]);

  return (
    <div className="relative w-full h-full bg-gray-950">
      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: [0, 800, 800],
          fov: 60,
          near: 10,
          far: 10000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#0a0a0a']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 500, 200]} intensity={0.8} />
        <fog attach="fog" args={['#0a0a0a', 2000, 5000]} />

        {/* Free camera controls */}
        <SpectatorCamera
          trackedAgent={trackedAgent}
          isTracking={isTracking}
        />

        {/* Ground plane (arena representation) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[8000, 8000]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        {/* Grid for spatial reference */}
        <gridHelper args={[6000, 30, '#333', '#222']} position={[0, 0, 0]} />

        {/* Agent representations */}
        {aliveAgents.map((agent) => (
          <group
            key={agent.id}
            position={[agent.x, 10, agent.y]}
            onClick={() => handleAgentClick(agent.id)}
          >
            {/* Agent body */}
            <mesh>
              <boxGeometry args={[20, 20, 20]} />
              <meshStandardMaterial
                color={agent.factionColor || '#4ade80'}
                emissive={agent.isMyAgent ? '#fbbf24' : '#000'}
                emissiveIntensity={agent.isMyAgent ? 0.3 : 0}
              />
            </mesh>
            {/* Tracked indicator ring */}
            {agent.id === internalTrackedId && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -9, 0]}>
                <ringGeometry args={[25, 30, 32]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
              </mesh>
            )}
            {/* Agent name label (billboard) */}
            <sprite position={[0, 25, 0]} scale={[60, 15, 1]}>
              <spriteMaterial transparent opacity={0.8} />
            </sprite>
          </group>
        ))}
      </Canvas>

      {/* HTML Overlays */}
      <SpectatorHUD
        countryName={countryName}
        countryISO={countryISO}
        spectatorCount={spectatorCount}
        battleStatus={battleStatus}
        timeRemaining={timeRemaining}
        agentCount={aliveAgents.length}
        onExit={onExit}
      />

      {/* My agents sidebar */}
      <MyAgentsSidebar
        agents={myAgents}
        trackedAgentId={internalTrackedId}
        onTrackAgent={handleTrackAgent}
      />

      {/* Agent info popup */}
      {selectedAgent && (
        <AgentInfoPopup
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onTrack={handleTrackFromPopup}
          isTracked={internalTrackedId === selectedAgent.id}
        />
      )}

      {/* No battle indicator */}
      {battleStatus !== 'in_battle' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-black/80 backdrop-blur-md rounded-2xl px-8 py-6 text-center">
            <h3 className="text-white text-xl font-bold mb-2">
              {battleStatus === 'preparing'
                ? 'Battle Starting Soon...'
                : battleStatus === 'cooldown'
                  ? 'Battle Ended — Next Round Soon'
                  : 'No Active Battle'}
            </h3>
            <p className="text-white/50 text-sm">
              {battleStatus === 'preparing'
                ? 'Agents are being deployed. Battle begins shortly.'
                : battleStatus === 'cooldown'
                  ? 'Results are being processed. Next battle cycle will begin after cooldown.'
                  : 'Deploy agents to this country to start a battle.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
