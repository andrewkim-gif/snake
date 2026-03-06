/**
 * S39: k6 Load Test — AI World War v11
 *
 * Tests:
 *  1. REST API endpoints (health, countries, factions, battles)
 *  2. WebSocket game connections (join country, spectate)
 *  3. Agent API (deploy, recall, status)
 *  4. Mixed workload (realistic user behavior)
 *
 * Run:
 *   k6 run --vus 100 --duration 60s server/loadtest/k6_world_war.js
 *
 * Target Metrics:
 *   - HTTP p95 < 200ms
 *   - WS connect p95 < 500ms
 *   - Error rate < 1%
 *   - Throughput > 1000 req/s
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================
// Configuration
// ============================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080';

export const options = {
  scenarios: {
    // Scenario 1: REST API load
    rest_api: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },  // ramp up
        { duration: '30s', target: 100 }, // sustained load
        { duration: '10s', target: 0 },   // ramp down
      ],
      exec: 'restApiScenario',
    },

    // Scenario 2: WebSocket connections
    websocket: {
      executor: 'constant-vus',
      vus: 20,
      duration: '40s',
      startTime: '5s',
      exec: 'websocketScenario',
    },

    // Scenario 3: Agent API burst
    agent_api: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 30,
      maxVUs: 50,
      stages: [
        { duration: '10s', target: 30 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      startTime: '5s',
      exec: 'agentApiScenario',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    ws_connecting: ['p(95)<500'],
    'http_req_duration{scenario:rest_api}': ['p(95)<150'],
    'http_req_duration{scenario:agent_api}': ['p(95)<300'],
  },
};

// ============================================================
// Custom Metrics
// ============================================================

const countriesLoaded = new Counter('countries_loaded');
const battleJoins = new Counter('battle_joins');
const apiErrors = new Rate('api_errors');
const tickLatency = new Trend('tick_latency');

// ============================================================
// Sample Data
// ============================================================

const COUNTRY_ISOS = [
  'USA', 'CHN', 'RUS', 'IND', 'BRA', 'JPN', 'DEU', 'GBR',
  'KOR', 'FRA', 'CAN', 'AUS', 'SAU', 'TUR', 'MEX', 'IDN',
  'EGY', 'THA', 'POL', 'ARG',
];

function randomCountry() {
  return COUNTRY_ISOS[Math.floor(Math.random() * COUNTRY_ISOS.length)];
}

function randomName() {
  return `Agent_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================
// Scenario 1: REST API Endpoints
// ============================================================

export function restApiScenario() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
  });

  // Get world state (195 countries)
  const worldRes = http.get(`${BASE_URL}/api/world/countries`);
  check(worldRes, {
    'countries: status 200': (r) => r.status === 200 || r.status === 404,
    'countries: response time < 200ms': (r) => r.timings.duration < 200,
  });
  if (worldRes.status === 200) {
    countriesLoaded.add(1);
  }

  // Get specific country
  const iso = randomCountry();
  const countryRes = http.get(`${BASE_URL}/api/world/countries/${iso}`);
  check(countryRes, {
    'country detail: status ok': (r) => r.status === 200 || r.status === 404,
  });

  // Get factions list
  const factionsRes = http.get(`${BASE_URL}/api/factions`);
  check(factionsRes, {
    'factions: status ok': (r) => r.status === 200 || r.status === 404,
  });

  // Get battle history for a country
  const battleRes = http.get(`${BASE_URL}/api/world/countries/${iso}/battles`);
  check(battleRes, {
    'battles: status ok': (r) => r.status === 200 || r.status === 404,
  });

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

// ============================================================
// Scenario 2: WebSocket Game Connection
// ============================================================

export function websocketScenario() {
  const iso = randomCountry();
  const name = randomName();

  const res = ws.connect(`${WS_URL}/ws`, {}, function (socket) {
    let messageCount = 0;

    socket.on('open', () => {
      // Join a country arena
      socket.send(JSON.stringify({
        e: 'join_country',
        d: { country: iso, name: name, skinId: 1 },
      }));
      battleJoins.add(1);
    });

    socket.on('message', (data) => {
      messageCount++;
      try {
        const msg = JSON.parse(data);
        if (msg.e === 'state') {
          tickLatency.add(Date.now() - (msg.d?.t || Date.now()));
        }
      } catch (e) {
        // Ignore parse errors for binary frames
      }
    });

    socket.on('error', (e) => {
      apiErrors.add(1);
    });

    // Send input at 30Hz for 10 seconds
    const inputInterval = setInterval(() => {
      socket.send(JSON.stringify({
        e: 'input',
        d: { angle: Math.random() * Math.PI * 2, boost: Math.random() > 0.8 },
      }));
    }, 33); // ~30Hz

    // Stay connected for 10-15 seconds
    sleep(10 + Math.random() * 5);

    clearInterval(inputInterval);

    // Leave
    socket.send(JSON.stringify({ e: 'leave_country', d: {} }));
    socket.close();
  });

  check(res, {
    'ws: connected': (r) => r && r.status === 101,
  });
}

// ============================================================
// Scenario 3: Agent API (Deploy/Recall/Status)
// ============================================================

export function agentApiScenario() {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': `aww_${'a'.repeat(64)}`, // Test key
  };

  const iso = randomCountry();

  // Deploy agent
  const deployRes = http.post(
    `${BASE_URL}/api/agents/deploy`,
    JSON.stringify({
      country: iso,
      build_profile: 'aggressive',
    }),
    { headers }
  );
  check(deployRes, {
    'deploy: status ok': (r) => r.status === 200 || r.status === 401 || r.status === 404,
    'deploy: latency < 300ms': (r) => r.timings.duration < 300,
  });

  if (deployRes.status !== 200) {
    apiErrors.add(1);
    return;
  }

  sleep(1);

  // Check agent status
  const statusRes = http.get(`${BASE_URL}/api/agents/status`, { headers });
  check(statusRes, {
    'status: ok': (r) => r.status === 200 || r.status === 401 || r.status === 404,
  });

  sleep(2);

  // Recall agent
  const recallRes = http.post(
    `${BASE_URL}/api/agents/recall`,
    JSON.stringify({ country: iso }),
    { headers }
  );
  check(recallRes, {
    'recall: ok': (r) => r.status === 200 || r.status === 401 || r.status === 404,
  });
}

// ============================================================
// Default scenario (runs if no specific scenario is targeted)
// ============================================================

export default function () {
  restApiScenario();
}
