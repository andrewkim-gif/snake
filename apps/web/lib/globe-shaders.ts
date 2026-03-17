/**
 * Globe GLSL shaders — Earth PBR, Clouds, Atmosphere.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

// ─── Earth PBR Shaders ───

/** EarthSphere PBR vertex shader (TBN matrix for tangent-space normal mapping) */
export const earthVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying mat3 vTBN;

  void main() {
    vUv = uv;
    vec3 N = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldNormal = N;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

    // 구면 좌표계 탄젠트 계산 (구체 전용)
    // theta 방향 탄젠트 (경도 방향)
    vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
    // 극점 근처 보정
    if (length(cross(vec3(0.0, 1.0, 0.0), N)) < 0.001) {
      T = normalize(cross(vec3(1.0, 0.0, 0.0), N));
    }
    vec3 B = cross(N, T);
    vTBN = mat3(T, B, N);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** EarthSphere PBR fragment shader (TBN normal map + specular + atmosphere) */
export const earthFragmentShader = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecularMap;
  uniform vec3 uSunDir;
  uniform float uNormalScale;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying mat3 vTBN;

  void main() {
    vec3 N = normalize(vWorldNormal);

    // TBN 노멀맵 적용 (tangent-space -> world-space)
    vec3 mapN = texture2D(uNormalMap, vUv).rgb * 2.0 - 1.0;
    mapN.xy *= uNormalScale;
    vec3 perturbedN = normalize(vTBN * mapN);

    // 태양 방향
    float sunOrientation = dot(N, uSunDir);           // 밤낮/대기 전환 (smooth normal)
    float sunOrientBump = dot(perturbedN, uSunDir);    // 디퓨즈 라이팅 (perturbed normal)

    // 낮/밤 혼합 팩터
    float dayStrength = smoothstep(-0.25, 0.5, sunOrientation);

    // 낮: 디퓨즈 라이팅
    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    float diffuse = max(sunOrientBump, 0.0) * 0.75 + 0.12;
    dayColor *= diffuse;

    // 스페큘러: 바다 반사 (Blinn-Phong)
    float specMask = texture2D(uSpecularMap, vUv).r;
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(uSunDir + viewDir);
    float specAngle = max(dot(perturbedN, halfDir), 0.0);
    float specular = pow(specAngle, 64.0) * specMask * 0.5;
    dayColor += vec3(1.0, 0.98, 0.95) * specular * dayStrength;

    // 밤: 도시 불빛
    vec3 nightLights = texture2D(uNightMap, vUv).rgb;
    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    float nightAmbient = 0.015;
    vec3 nightColor = nightLights * 1.5 + dayTex * nightAmbient;

    // 대기 프레넬 (가장자리에서만 -- 표면 내부에선 없음)
    float fresnel = 1.0 - max(dot(viewDir, N), 0.0);
    float rim = pow(fresnel, 6.0); // 높은 지수 -> 극단적 가장자리만

    // 대기 색상: twilight(터미네이터) <-> day blue
    vec3 twilightColor = vec3(1.0, 0.45, 0.2);
    vec3 dayAtmoColor = vec3(0.3, 0.55, 0.9);
    float atmoColorMix = smoothstep(-0.25, 0.75, sunOrientation);
    vec3 atmosphereColor = mix(twilightColor, dayAtmoColor, atmoColorMix);

    // 최종 혼합
    vec3 color = mix(nightColor, dayColor, dayStrength);
    color += atmosphereColor * rim * smoothstep(-0.2, 0.5, sunOrientation) * 0.4;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Clouds Shaders ───

export const cloudsVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const cloudsFragmentShader = /* glsl */ `
  uniform sampler2D uCloudsMap;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    float NdotL = dot(N, uSunDir);

    // 구름 텍스처 (밝기 = 알파)
    float cloudAlpha = texture2D(uCloudsMap, vUv).r;

    // 낮/밤 팩터 -- 밤 면은 완전 투명
    float dayFactor = smoothstep(-0.1, 0.5, NdotL);

    // 최종 알파: 텍스처 * 낮/밤 * 전체 투명도
    float finalAlpha = cloudAlpha * dayFactor * 0.55;

    // 거의 보이지 않는 프래그먼트는 discard (검은 잔여물 원천 차단)
    if (finalAlpha < 0.005) discard;

    // 구름 라이팅: 밝은 디퓨즈 조명 (밤 면은 이미 discard)
    float diffuse = max(NdotL, 0.0) * 0.6 + 0.4;
    vec3 cloudColor = vec3(diffuse);

    gl_FragColor = vec4(cloudColor, finalAlpha);
  }
`;

// ─── Atmosphere Shaders ───

export const atmoVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmoFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // 프레넬 림
    float NdotV = dot(viewDir, N);
    float fresnel = 1.0 - abs(NdotV);
    float rim = pow(fresnel, 4.5);

    // 태양 방향
    float sunDot = dot(N, uSunDir);
    float sunFacing = max(sunDot, 0.0);

    // 밤 쪽 제거
    float dayCut = smoothstep(-0.1, 0.2, sunDot);

    // --- 태양->지구 대기 수렴 산란 (Forward Scattering) ---
    // 카메라가 태양 쪽을 볼 때, 대기 가장자리에서 빛이 수렴/집중
    // Mie scattering 근사: viewDir.sunDir 가 높을수록 (역광) 강한 산란
    float VdotS = max(dot(viewDir, uSunDir), 0.0);
    float forwardScatter = pow(VdotS, 6.0) * rim * dayCut;
    float scatterIntensity = forwardScatter * 8.0;  // HDR 강화

    // 기본 대기 림 (태양 방향 가중)
    float basicAtmo = pow(sunFacing, 2.0) * rim * 0.8;

    // 대기 색상
    vec3 blueAtmo = vec3(0.35, 0.55, 0.95);
    vec3 scatterColor = vec3(1.0, 0.92, 0.8); // 따뜻한 수렴 산란

    // 터미네이터 오렌지 림
    float termRegion = smoothstep(-0.1, 0.05, sunDot) * smoothstep(0.3, 0.05, sunDot);
    vec3 termColor = vec3(1.0, 0.5, 0.15) * termRegion * 0.6;

    // 합성: 기본 파란 대기 + 수렴 산란 HDR + 터미네이터
    vec3 color = blueAtmo * basicAtmo + scatterColor * scatterIntensity + termColor;

    // 알파: 기본 림 + 수렴 산란 보정
    float alpha = rim * dayCut * 0.45 + forwardScatter * 0.4;
    alpha = clamp(alpha, 0.0, 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── COBE-style Dotted Globe Shaders ───
// Spherical Fibonacci lattice dot sampling + world map texture land detection
// Inspired by github.com/shuding/cobe (MIT license)

/** Dotted globe vertex shader — sphere geometry에서 world position + UV 전달 */
export const dottedVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Dotted globe fragment shader — Spherical Fibonacci dot sampling
 *  Closely follows COBE's original shader logic (github.com/shuding/cobe)
 *  Adapted for R3F sphere geometry (normal = sphere direction, no raymarching needed)
 */
export const dottedFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uLandMap;
  uniform vec3 uSunDir;
  uniform float uDots;
  uniform float uDotSize;
  uniform float uDiffuse;
  uniform float uDotBrightness;
  uniform vec3 uBaseColor;
  uniform float uDark;
  uniform float uMapBaseBrightness;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  // Spherical Fibonacci constants (from COBE by Shu Ding)
  const float sqrt5 = 2.23606797749979;
  const float PI = 3.141592653589793;
  const float kTau = 6.283185307179586;
  const float kPhi = 1.618033988749895;
  const float byLogPhiPlusOne = 0.7202100452062783;
  const float twoPiOnPhi = 3.8832220774509327;
  const float phiMinusOne = 0.618033988749895;

  // Fibonacci lattice fractional value lookup (mantissa trick by @farteryhr)
  float fibFrac(float idx) {
    float tidx = idx;
    float fracV = 0.0;
    if (tidx >= 524288.0) { tidx -= 524288.0; fracV += 0.8038937048986554; }
    if (tidx >= 262144.0) { tidx -= 262144.0; fracV += 0.9019468524493277; }
    if (tidx >= 131072.0) { tidx -= 131072.0; fracV += 0.9509734262246639; }
    if (tidx >= 65536.0)  { tidx -= 65536.0;  fracV += 0.4754867131123319; }
    if (tidx >= 32768.0)  { tidx -= 32768.0;  fracV += 0.737743356556166;  }
    if (tidx >= 16384.0)  { tidx -= 16384.0;  fracV += 0.868871678278083;  }
    if (tidx >= 8192.0)   { tidx -= 8192.0;   fracV += 0.9344358391390415; }
    if (tidx >= 4096.0)   { tidx -= 4096.0;   fracV += 0.46721791956952075;}
    if (tidx >= 2048.0)   { tidx -= 2048.0;   fracV += 0.7336089597847604; }
    if (tidx >= 1024.0)   { tidx -= 1024.0;   fracV += 0.8668044798923802; }
    if (tidx >= 512.0)    { tidx -= 512.0;    fracV += 0.4334022399461901; }
    if (tidx >= 256.0)    { tidx -= 256.0;    fracV += 0.21670111997309505;}
    if (tidx >= 128.0)    { tidx -= 128.0;    fracV += 0.10835055998654752;}
    if (tidx >= 64.0)     { tidx -= 64.0;     fracV += 0.5541752799932738; }
    if (tidx >= 32.0)     { tidx -= 32.0;     fracV += 0.7770876399966369; }
    if (tidx >= 16.0)     { tidx -= 16.0;     fracV += 0.8885438199983184; }
    if (tidx >= 8.0)      { tidx -= 8.0;      fracV += 0.9442719099991592; }
    if (tidx >= 4.0)      { tidx -= 4.0;      fracV += 0.4721359549995796; }
    if (tidx >= 2.0)      { tidx -= 2.0;      fracV += 0.2360679774997898; }
    if (tidx >= 1.0)      { tidx -= 1.0;      fracV += 0.6180339887498949; }
    return fract(fracV);
  }

  // Inverse Spherical Fibonacci — find nearest lattice point
  // Based on shadertoy.com/view/lllXz4 by @iquilezles
  vec3 nearestFibLattice(vec3 p, out float dist) {
    float byDots = 1.0 / uDots;
    // COBE uses xzy swizzle for its coordinate system
    p = p.xzy;

    float k = max(2.0, floor(log2(sqrt5 * uDots * PI * (1.0 - p.z * p.z)) * byLogPhiPlusOne));
    vec2 f = floor(pow(kPhi, k) / sqrt5 * vec2(1.0, kPhi) + 0.5);
    vec2 br1 = fract((f + 1.0) * phiMinusOne) * kTau - twoPiOnPhi;
    vec2 br2 = -2.0 * f;
    vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);
    vec2 c = floor(vec2(
      br2.y * sp.x - br1.y * (sp.y * uDots + 1.0),
      -br2.x * sp.x + br1.x * (sp.y * uDots + 1.0)
    ) / (br1.x * br2.y - br2.x * br1.y));

    float mindist = PI;
    vec3 minip = vec3(0.0);

    for (float s = 0.0; s < 4.0; s += 1.0) {
      vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));
      float idx = dot(f, c + o);
      if (idx > uDots) continue;

      float theta = fibFrac(idx) * kTau;
      float cosphi = 1.0 - 2.0 * idx * byDots;
      float sinphi = sqrt(1.0 - cosphi * cosphi);
      vec3 sam = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);

      float d = length(p - sam);
      if (d < mindist) {
        mindist = d;
        minip = sam;
      }
    }

    dist = mindist;
    return minip.xzy; // swizzle back
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // sphere geometry의 normal이 곧 구면 좌표 방향
    vec3 p = N;

    // Spherical Fibonacci 최근접점 탐색
    float dis;
    vec3 gP = nearestFibLattice(p, dis);

    // 최근접점의 구면 좌표 → UV 변환 (세계 지도 텍스처 샘플링)
    float gPhi = asin(clamp(gP.y, -1.0, 1.0));
    float cosPhi = cos(gPhi);
    float gTheta = (abs(cosPhi) > 0.001)
      ? acos(clamp(-gP.x / cosPhi, -1.0, 1.0))
      : 0.0;
    if (gP.z < 0.0) gTheta = -gTheta;
    vec2 mapUV = vec2((gTheta * 0.5) / PI, -(gPhi / PI + 0.5));

    // 텍스처 샘플 — luminance 기반 (blue marble RGB → grayscale)
    vec3 texRGB = texture2D(uLandMap, mapUV).rgb;
    float mapColor = max(dot(texRGB, vec3(0.299, 0.587, 0.114)), uMapBaseBrightness);

    // 점 가시성: smoothstep — dis가 uDotSize보다 작으면 점이 보임
    float v = smoothstep(uDotSize, 0.0, dis);

    // 점이 없는 곳은 완전 투명 (sphere geometry 위이므로 배경 비움)
    if (v < 0.01) discard;

    // 라이팅 — view 방향 기반 (COBE는 정면 라이트)
    float dotNL = max(dot(p, viewDir), 0.0);
    float lighting = pow(dotNL, uDiffuse) * uDotBrightness;

    // 점 밝기 = 지도색 * 라이팅
    float brightness = mapColor * lighting;

    // 최종 색상: baseColor * 밝기, 최소 0.15 보장 (완전 검정 방지)
    vec3 color = uBaseColor * max(brightness, 0.15);

    gl_FragColor = vec4(color, v);
  }
`;
