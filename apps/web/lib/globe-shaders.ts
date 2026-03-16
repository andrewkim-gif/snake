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
