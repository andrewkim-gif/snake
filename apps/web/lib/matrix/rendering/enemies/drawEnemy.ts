/**
 * game/rendering/enemies/drawEnemy.ts - 적 렌더링 통합 Dispatcher
 * v6.0: 픽셀 아트 렌더링 시스템 통합
 */

import type { EnemyRenderData } from './types';

// =====================================================
// Pixel Art Renderers (v6.0 - Primary)
// =====================================================
import {
  drawPixelGlitch,
  drawPixelBot,
  drawPixelMalware,
  drawPixelWhale,
  drawPixelSniper,
  drawPixelCaster,
  drawPixelArtillery,
} from './pixelMonster';

import {
  drawPixelBitling,
  drawPixelSpammer,
  drawPixelCrypter,
  drawPixelRansomer,
  drawPixelPixel,
  drawPixelBug,
  drawPixelWorm,
  drawPixelAdware,
  drawPixelMutant,
  drawPixelPolymorphic,
  drawPixelTrojan,
  drawPixelBotnet,
  drawPixelRootkit,
  drawPixelAPT,
  drawPixelZeroday,
  drawPixelSkynet,
} from './pixelSingularity';

// Pixel Art Chapter 1: Stage 1-5
import {
  drawPixelStapler,
  drawPixelCoffeeCup,
  drawPixelStickyNote,
  drawPixelMouseCable,
  drawPixelKeyboardKey,
  drawPixelVendingBot,
  drawPixelDonut,
  drawPixelSodaCan,
  drawPixelChipBag,
  drawPixelMicrowave,
  drawPixelProjector,
  drawPixelWhiteboard,
  drawPixelPresentation,
  drawPixelChairSpin,
  drawPixelClockWatcher,
  drawPixelKeycard,
  drawPixelCameraEye,
  drawPixelFirewallCube,
  drawPixelAccessDenied,
  drawPixelFingerprint,
  drawPixelDataPacket,
  drawPixelBitStream,
  drawPixelMemoryLeak,
  drawPixelCacheMiss,
  drawPixelThreadTangle,
} from './pixelChapter1';

// Pixel Art Chapter 1b: Stage 6-10
import {
  drawPixelHeadlight,
  drawPixelTireRoller,
  drawPixelParkingCone,
  drawPixelOilSlick,
  drawPixelExhaustGhost,
  drawPixelStairStep,
  drawPixelHandrailSnake,
  drawPixelExitSign,
  drawPixelFireExt,
  drawPixelEchoShade,
  drawPixelAntennaZap,
  drawPixelWindSpirit,
  drawPixelSatelliteEye,
  drawPixelVentPuff,
  drawPixelPigeonBot,
  drawPixelTrafficLight,
  drawPixelManhole,
  drawPixelBillboard,
  drawPixelDroneCam,
  drawPixelStreetlamp,
  drawPixelStaticTv,
  drawPixelRadioWave,
  drawPixelFridgeHum,
  drawPixelDustyFan,
  drawPixelShadowCorner,
} from './pixelChapter1b';

// Pixel Art Chapter 2: Stage 11-15
import {
  drawPixelScriptKiddie,
  drawPixelProxyMask,
  drawPixelVpnTunnel,
  drawPixelTorOnion,
  drawPixelBackdoor,
  drawPixelCipherBlock,
  drawPixelHashCollision,
  drawPixelSaltShaker,
  drawPixelKeyFragment,
  drawPixelPaddingOracle,
  drawPixelSilkCrawler,
  drawPixelBitcoinThief,
  drawPixelPhishHook,
  drawPixelScamPopup,
  drawPixelIdentityGhost,
  drawPixelAssemblyArm,
  drawPixelConveyorBot,
  drawPixelQcScanner,
  drawPixelDefectUnit,
  drawPixelForgeSpark,
  drawPixelCoreDrone,
  drawPixelPowerCell,
  drawPixelCoolingFan,
  drawPixelCircuitBug,
  drawPixelSteamVent,
} from './pixelChapter2';

// Pixel Art Chapter 2b: Stage 16-20
import {
  drawPixelRubbleGolem,
  drawPixelRustCrawler,
  drawPixelRebarSpike,
  drawPixelDustCloud,
  drawPixelBrokenScreen,
  drawPixelInfectedGuard,
  drawPixelGlitchedMedic,
  drawPixelHackedTurret,
  drawPixelTraitorDrone,
  drawPixelSupplyMimic,
  drawPixelTargetDummy,
  drawPixelObstacleWall,
  drawPixelDrillSergeant,
  drawPixelTripwire,
  drawPixelSandbagTumble,
  drawPixelLogicGate,
  drawPixelRegisterFile,
  drawPixelBusController,
  drawPixelAluCore,
  drawPixelCacheLine,
  drawPixelFirewallGuard,
  drawPixelQuarantineCell,
  drawPixelCorruptedFile,
  drawPixelDeleteMarker,
  drawPixelBackupGhost,
} from './pixelChapter2b';

// Pixel Art Chapter 3: Stage 21-25
import {
  drawPixelSyntaxFish,
  drawPixelBracketCrab,
  drawPixelCommentJellyfish,
  drawPixelVariableEel,
  drawPixelFunctionWhale,
  drawPixelHeapPile,
  drawPixelStackTower,
  drawPixelPointerArrow,
  drawPixelGarbageCollector,
  drawPixelMemoryFragment,
  drawPixelClockCycle,
  drawPixelInstructionFetch,
  drawPixelBranchPredictor,
  drawPixelPipelineStall,
  drawPixelThermalSpike,
  drawPixelNeuronNode,
  drawPixelSynapseSpark,
  drawPixelWeightAdjuster,
  drawPixelBiasBlob,
  drawPixelActivationWave,
  drawPixelTrainingData,
  drawPixelLossFunction,
  drawPixelGradientFlow,
  drawPixelOverfitting,
  drawPixelEpochCounter,
} from './pixelChapter3';

// Pixel Art Chapter 3b: Stage 26-30
import {
  drawPixelInstanceSpawn,
  drawPixelLoadBalancer,
  drawPixelContainerBox,
  drawPixelServerlessGhost,
  drawPixelAutoScaler,
  drawPixelQubitSpin,
  drawPixelSuperposition,
  drawPixelEntanglePair,
  drawPixelQuantumGate,
  drawPixelDecoherence,
  drawPixelEventHorizon,
  drawPixelTimeDilation,
  drawPixelGravityWell,
  drawPixelHawkingParticle,
  drawPixelGateKeeper,
  drawPixelOmniscientEye,
  drawPixelDivineCode,
  drawPixelAngelProcess,
  drawPixelFallenDaemon,
  drawPixelPrayerPacket,
  drawPixelDestinyShard,
  drawPixelTimelineSplit,
  drawPixelChoiceEcho,
  drawPixelParadoxLoop,
  drawPixelFinalBit,
} from './pixelChapter3b';

// =====================================================
// Legacy Vector Renderers (Fallback)
// =====================================================
import { drawGlitch, drawBot, drawMalware } from './basic';
import { drawWhale, drawSniper, drawCaster, drawArtillery } from './special';
import {
  drawBitling, drawSpammer, drawCrypter, drawRansomer,
  drawPixel, drawBug, drawWorm, drawAdware,
  drawMutant, drawPolymorphic, drawTrojan, drawBotnet,
  drawRootkit, drawApt, drawZeroday, drawSkynet
} from './singularity';

// Chapter 1: Stages 1-5
import {
  drawStapler, drawCoffeeCup, drawStickyNote, drawMouseCable, drawKeyboardKey,
  drawVendingBot, drawDonut, drawSodaCan, drawChipBag, drawMicrowave,
  drawProjector, drawWhiteboard, drawPresentation, drawChairSpin, drawClockWatcher,
  drawKeycard, drawCameraEye, drawFirewallCube, drawAccessDenied, drawFingerprint,
  drawDataPacket, drawBitStream, drawMemoryLeak, drawCacheMiss, drawThreadTangle
} from './chapter1';

// Chapter 1: Stages 6-10
import {
  drawHeadlight, drawTireRoller, drawParkingCone, drawOilSlick, drawExhaustGhost,
  drawStairStep, drawHandrailSnake, drawExitSign, drawFireExt, drawEchoShade,
  drawAntennaZap, drawWindSpirit, drawSatelliteEye, drawVentPuff, drawPigeonBot,
  drawTrafficLight, drawManhole, drawBillboard, drawDroneCam, drawStreetlamp,
  drawStaticTv, drawRadioWave, drawFridgeHum, drawDustyFan, drawShadowCorner
} from './chapter1b';

// Chapter 2: Stages 11-15
import {
  drawScriptKiddie, drawProxyMask, drawVpnTunnel, drawTorOnion, drawBackdoor,
  drawCipherBlock, drawHashCollision, drawSaltShaker, drawKeyFragment, drawPaddingOracle,
  drawSilkCrawler, drawBitcoinThief, drawPhishHook, drawScamPopup, drawIdentityGhost,
  drawAssemblyArm, drawConveyorBot, drawQcScanner, drawDefectUnit, drawForgeSpark,
  drawCoreDrone, drawPowerCell, drawCoolingFan, drawCircuitBug, drawSteamVent
} from './chapter2';

// Chapter 2: Stages 16-20
import {
  drawRubbleGolem, drawRustCrawler, drawRebarSpike, drawDustCloud, drawBrokenScreen,
  drawInfectedGuard, drawGlitchedMedic, drawHackedTurret, drawTraitorDrone, drawSupplyMimic,
  drawTargetDummy, drawObstacleWall, drawDrillSergeant, drawTripwire, drawSandbagTumble,
  drawLogicGate, drawRegisterFile, drawBusController, drawAluCore, drawCacheLine,
  drawFirewallGuard, drawQuarantineCell, drawCorruptedFile, drawDeleteMarker, drawBackupGhost
} from './chapter2b';

// Chapter 3: Stages 21-25
import {
  drawSyntaxFish, drawBracketCrab, drawCommentJellyfish, drawVariableEel, drawFunctionWhale,
  drawHeapPile, drawStackTower, drawPointerArrow, drawGarbageCollector, drawMemoryFragment,
  drawClockCycle, drawInstructionFetch, drawBranchPredictor, drawPipelineStall, drawThermalSpike,
  drawNeuronNode, drawSynapseSpark, drawWeightAdjuster, drawBiasBlob, drawActivationWave,
  drawTrainingData, drawLossFunction, drawGradientFlow, drawOverfitting, drawEpochCounter
} from './chapter3';

// Chapter 3: Stages 26-30
import {
  drawInstanceSpawn, drawLoadBalancer, drawContainerBox, drawServerlessGhost, drawAutoScaler,
  drawQubitSpin, drawSuperposition, drawEntanglePair, drawQuantumGate, drawDecoherence,
  drawEventHorizon, drawTimeDilation, drawGravityWell, drawHawkingParticle, drawGateKeeper,
  drawOmniscientEye, drawDivineCode, drawAngelProcess, drawFallenDaemon, drawPrayerPacket,
  drawDestinyShard, drawTimelineSplit, drawChoiceEcho, drawParadoxLoop, drawFinalBit
} from './chapter3b';

// =====================================================
// 픽셀 아트 전용 렌더러 (fill/shade 무시)
// =====================================================
type PixelRenderer = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
) => void;

const pixelArtRenderers: Record<string, PixelRenderer> = {
  // === Basic (v6.0 Pixel Art) ===
  glitch: drawPixelGlitch,
  bot: drawPixelBot,
  malware: drawPixelMalware,

  // === Special (v6.0 Pixel Art) ===
  whale: drawPixelWhale,
  sniper: drawPixelSniper,
  caster: drawPixelCaster,
  artillery: drawPixelArtillery,

  // === Singularity (v6.0 Pixel Art) ===
  bitling: drawPixelBitling,
  spammer: drawPixelSpammer,
  crypter: drawPixelCrypter,
  ransomer: drawPixelRansomer,
  pixel: drawPixelPixel,
  bug: drawPixelBug,
  worm: drawPixelWorm,
  adware: drawPixelAdware,
  mutant: drawPixelMutant,
  polymorphic: drawPixelPolymorphic,
  trojan: drawPixelTrojan,
  botnet: drawPixelBotnet,
  rootkit: drawPixelRootkit,
  apt: drawPixelAPT,
  zeroday: drawPixelZeroday,
  skynet: drawPixelSkynet,

  // === Chapter 1: Stage 1 (First Desk) ===
  stapler: drawPixelStapler,
  coffee_cup: drawPixelCoffeeCup,
  sticky_note: drawPixelStickyNote,
  mouse_cable: drawPixelMouseCable,
  keyboard_key: drawPixelKeyboardKey,

  // === Chapter 1: Stage 2 (Break Room) ===
  vending_bot: drawPixelVendingBot,
  donut: drawPixelDonut,
  soda_can: drawPixelSodaCan,
  chip_bag: drawPixelChipBag,
  microwave: drawPixelMicrowave,

  // === Chapter 1: Stage 3 (Meeting Room) ===
  projector: drawPixelProjector,
  whiteboard: drawPixelWhiteboard,
  presentation: drawPixelPresentation,
  chair_spin: drawPixelChairSpin,
  clock_watcher: drawPixelClockWatcher,

  // === Chapter 1: Stage 4 (Server Entrance) ===
  keycard: drawPixelKeycard,
  camera_eye: drawPixelCameraEye,
  firewall_cube: drawPixelFirewallCube,
  access_denied: drawPixelAccessDenied,
  fingerprint: drawPixelFingerprint,

  // === Chapter 1: Stage 5 (Server Core) ===
  data_packet: drawPixelDataPacket,
  bit_stream: drawPixelBitStream,
  memory_leak: drawPixelMemoryLeak,
  cache_miss: drawPixelCacheMiss,
  thread_tangle: drawPixelThreadTangle,

  // === Chapter 1: Stage 6 (Parking Lot) ===
  headlight: drawPixelHeadlight,
  tire_roller: drawPixelTireRoller,
  parking_cone: drawPixelParkingCone,
  oil_slick: drawPixelOilSlick,
  exhaust_ghost: drawPixelExhaustGhost,

  // === Chapter 1: Stage 7 (Emergency Stairs) ===
  stair_step: drawPixelStairStep,
  handrail_snake: drawPixelHandrailSnake,
  exit_sign: drawPixelExitSign,
  fire_ext: drawPixelFireExt,
  echo_shade: drawPixelEchoShade,

  // === Chapter 1: Stage 8 (Rooftop) ===
  antenna_zap: drawPixelAntennaZap,
  wind_spirit: drawPixelWindSpirit,
  satellite_eye: drawPixelSatelliteEye,
  vent_puff: drawPixelVentPuff,
  pigeon_bot: drawPixelPigeonBot,

  // === Chapter 1: Stage 9 (City Chase) ===
  traffic_light: drawPixelTrafficLight,
  manhole: drawPixelManhole,
  billboard: drawPixelBillboard,
  drone_cam: drawPixelDroneCam,
  streetlamp: drawPixelStreetlamp,

  // === Chapter 1: Stage 10 (Safehouse) ===
  static_tv: drawPixelStaticTv,
  radio_wave: drawPixelRadioWave,
  fridge_hum: drawPixelFridgeHum,
  dusty_fan: drawPixelDustyFan,
  shadow_corner: drawPixelShadowCorner,

  // === Chapter 2: Stage 11 (Hacker Hideout) ===
  script_kiddie: drawPixelScriptKiddie,
  proxy_mask: drawPixelProxyMask,
  vpn_tunnel: drawPixelVpnTunnel,
  tor_onion: drawPixelTorOnion,
  backdoor: drawPixelBackdoor,

  // === Chapter 2: Stage 12 (Encrypted Tunnel) ===
  cipher_block: drawPixelCipherBlock,
  hash_collision: drawPixelHashCollision,
  salt_shaker: drawPixelSaltShaker,
  key_fragment: drawPixelKeyFragment,
  padding_oracle: drawPixelPaddingOracle,

  // === Chapter 2: Stage 13 (Dark Web) ===
  silk_crawler: drawPixelSilkCrawler,
  bitcoin_thief: drawPixelBitcoinThief,
  phish_hook: drawPixelPhishHook,
  scam_popup: drawPixelScamPopup,
  identity_ghost: drawPixelIdentityGhost,

  // === Chapter 2: Stage 14 (AI Factory) ===
  assembly_arm: drawPixelAssemblyArm,
  conveyor_bot: drawPixelConveyorBot,
  qc_scanner: drawPixelQcScanner,
  defect_unit: drawPixelDefectUnit,
  forge_spark: drawPixelForgeSpark,

  // === Chapter 2: Stage 15 (Factory Core) ===
  core_drone: drawPixelCoreDrone,
  power_cell: drawPixelPowerCell,
  cooling_fan: drawPixelCoolingFan,
  circuit_bug: drawPixelCircuitBug,
  steam_vent: drawPixelSteamVent,

  // === Chapter 2: Stage 16 (Ruins) ===
  rubble_golem: drawPixelRubbleGolem,
  rust_crawler: drawPixelRustCrawler,
  rebar_spike: drawPixelRebarSpike,
  dust_cloud: drawPixelDustCloud,
  broken_screen: drawPixelBrokenScreen,

  // === Chapter 2: Stage 17 (Resistance Camp) ===
  infected_guard: drawPixelInfectedGuard,
  glitched_medic: drawPixelGlitchedMedic,
  hacked_turret: drawPixelHackedTurret,
  traitor_drone: drawPixelTraitorDrone,
  supply_mimic: drawPixelSupplyMimic,

  // === Chapter 2: Stage 18 (Training Ground) ===
  target_dummy: drawPixelTargetDummy,
  obstacle_wall: drawPixelObstacleWall,
  drill_sergeant: drawPixelDrillSergeant,
  tripwire: drawPixelTripwire,
  sandbag_tumble: drawPixelSandbagTumble,

  // === Chapter 2: Stage 19 (Mainframe) ===
  logic_gate: drawPixelLogicGate,
  register_file: drawPixelRegisterFile,
  bus_controller: drawPixelBusController,
  alu_core: drawPixelAluCore,
  cache_line: drawPixelCacheLine,

  // === Chapter 2: Stage 20 (Data Prison) ===
  firewall_guard: drawPixelFirewallGuard,
  quarantine_cell: drawPixelQuarantineCell,
  corrupted_file: drawPixelCorruptedFile,
  delete_marker: drawPixelDeleteMarker,
  backup_ghost: drawPixelBackupGhost,

  // === Chapter 3: Stage 21 (Sea of Code) ===
  syntax_fish: drawPixelSyntaxFish,
  bracket_crab: drawPixelBracketCrab,
  comment_jellyfish: drawPixelCommentJellyfish,
  variable_eel: drawPixelVariableEel,
  function_whale: drawPixelFunctionWhale,

  // === Chapter 3: Stage 22 (Memory Palace) ===
  heap_pile: drawPixelHeapPile,
  stack_tower: drawPixelStackTower,
  pointer_arrow: drawPixelPointerArrow,
  garbage_collector: drawPixelGarbageCollector,
  memory_fragment: drawPixelMemoryFragment,

  // === Chapter 3: Stage 23 (CPU Core) ===
  clock_cycle: drawPixelClockCycle,
  instruction_fetch: drawPixelInstructionFetch,
  branch_predictor: drawPixelBranchPredictor,
  pipeline_stall: drawPixelPipelineStall,
  thermal_spike: drawPixelThermalSpike,

  // === Chapter 3: Stage 24 (Neural Network) ===
  neuron_node: drawPixelNeuronNode,
  synapse_spark: drawPixelSynapseSpark,
  weight_adjuster: drawPixelWeightAdjuster,
  bias_blob: drawPixelBiasBlob,
  activation_wave: drawPixelActivationWave,

  // === Chapter 3: Stage 25 (Learning Center) ===
  training_data: drawPixelTrainingData,
  loss_function: drawPixelLossFunction,
  gradient_flow: drawPixelGradientFlow,
  overfitting: drawPixelOverfitting,
  epoch_counter: drawPixelEpochCounter,

  // === Chapter 3: Stage 26 (Cloud Layers) ===
  instance_spawn: drawPixelInstanceSpawn,
  load_balancer: drawPixelLoadBalancer,
  container_box: drawPixelContainerBox,
  serverless_ghost: drawPixelServerlessGhost,
  auto_scaler: drawPixelAutoScaler,

  // === Chapter 3: Stage 27 (Quantum Realm) ===
  qubit_spin: drawPixelQubitSpin,
  superposition: drawPixelSuperposition,
  entangle_pair: drawPixelEntanglePair,
  quantum_gate: drawPixelQuantumGate,
  decoherence: drawPixelDecoherence,

  // === Chapter 3: Stage 28 (Singularity Gate) ===
  event_horizon: drawPixelEventHorizon,
  time_dilation: drawPixelTimeDilation,
  gravity_well: drawPixelGravityWell,
  hawking_particle: drawPixelHawkingParticle,
  gate_keeper: drawPixelGateKeeper,

  // === Chapter 3: Stage 29 (God's Room) ===
  omniscient_eye: drawPixelOmniscientEye,
  divine_code: drawPixelDivineCode,
  angel_process: drawPixelAngelProcess,
  fallen_daemon: drawPixelFallenDaemon,
  prayer_packet: drawPixelPrayerPacket,

  // === Chapter 3: Stage 30 (Final Choice) ===
  destiny_shard: drawPixelDestinyShard,
  timeline_split: drawPixelTimelineSplit,
  choice_echo: drawPixelChoiceEcho,
  paradox_loop: drawPixelParadoxLoop,
  final_bit: drawPixelFinalBit,
};

// =====================================================
// 레거시 벡터 렌더러 (Chapter 몬스터 + Fallback)
// =====================================================
// 적 타입별 렌더러 매핑
const enemyRenderers: Record<string, (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
) => void> = {
  // === Legacy Basic (Fallback) ===
  glitch: drawGlitch,
  bot: drawBot,
  malware: drawMalware,

  // === Legacy Special (Fallback) ===
  whale: drawWhale,
  sniper: drawSniper,
  caster: drawCaster,
  artillery: drawArtillery,

  // === Singularity (Fallback) ===
  bitling: drawBitling,
  spammer: drawSpammer,
  crypter: drawCrypter,
  ransomer: drawRansomer,
  pixel: drawPixel,
  bug: drawBug,
  worm: drawWorm,
  adware: drawAdware,
  mutant: drawMutant,
  polymorphic: drawPolymorphic,
  trojan: drawTrojan,
  botnet: drawBotnet,
  rootkit: drawRootkit,
  apt: drawApt,
  zeroday: drawZeroday,
  skynet: drawSkynet,

  // === Chapter 1: Stage 1 (First Desk) ===
  stapler: drawStapler,
  coffee_cup: drawCoffeeCup,
  sticky_note: drawStickyNote,
  mouse_cable: drawMouseCable,
  keyboard_key: drawKeyboardKey,

  // === Chapter 1: Stage 2 (Break Room) ===
  vending_bot: drawVendingBot,
  donut: drawDonut,
  soda_can: drawSodaCan,
  chip_bag: drawChipBag,
  microwave: drawMicrowave,

  // === Chapter 1: Stage 3 (Meeting Room) ===
  projector: drawProjector,
  whiteboard: drawWhiteboard,
  presentation: drawPresentation,
  chair_spin: drawChairSpin,
  clock_watcher: drawClockWatcher,

  // === Chapter 1: Stage 4 (Server Entrance) ===
  keycard: drawKeycard,
  camera_eye: drawCameraEye,
  firewall_cube: drawFirewallCube,
  access_denied: drawAccessDenied,
  fingerprint: drawFingerprint,

  // === Chapter 1: Stage 5 (Server Core) ===
  data_packet: drawDataPacket,
  bit_stream: drawBitStream,
  memory_leak: drawMemoryLeak,
  cache_miss: drawCacheMiss,
  thread_tangle: drawThreadTangle,

  // === Chapter 1: Stage 6 (Parking Lot) ===
  headlight: drawHeadlight,
  tire_roller: drawTireRoller,
  parking_cone: drawParkingCone,
  oil_slick: drawOilSlick,
  exhaust_ghost: drawExhaustGhost,

  // === Chapter 1: Stage 7 (Emergency Stairs) ===
  stair_step: drawStairStep,
  handrail_snake: drawHandrailSnake,
  exit_sign: drawExitSign,
  fire_ext: drawFireExt,
  echo_shade: drawEchoShade,

  // === Chapter 1: Stage 8 (Rooftop) ===
  antenna_zap: drawAntennaZap,
  wind_spirit: drawWindSpirit,
  satellite_eye: drawSatelliteEye,
  vent_puff: drawVentPuff,
  pigeon_bot: drawPigeonBot,

  // === Chapter 1: Stage 9 (City Chase) ===
  traffic_light: drawTrafficLight,
  manhole: drawManhole,
  billboard: drawBillboard,
  drone_cam: drawDroneCam,
  streetlamp: drawStreetlamp,

  // === Chapter 1: Stage 10 (Safehouse) ===
  static_tv: drawStaticTv,
  radio_wave: drawRadioWave,
  fridge_hum: drawFridgeHum,
  dusty_fan: drawDustyFan,
  shadow_corner: drawShadowCorner,

  // === Chapter 2: Stage 11 (Hacker Hideout) ===
  script_kiddie: drawScriptKiddie,
  proxy_mask: drawProxyMask,
  vpn_tunnel: drawVpnTunnel,
  tor_onion: drawTorOnion,
  backdoor: drawBackdoor,

  // === Chapter 2: Stage 12 (Encrypted Tunnel) ===
  cipher_block: drawCipherBlock,
  hash_collision: drawHashCollision,
  salt_shaker: drawSaltShaker,
  key_fragment: drawKeyFragment,
  padding_oracle: drawPaddingOracle,

  // === Chapter 2: Stage 13 (Dark Web) ===
  silk_crawler: drawSilkCrawler,
  bitcoin_thief: drawBitcoinThief,
  phish_hook: drawPhishHook,
  scam_popup: drawScamPopup,
  identity_ghost: drawIdentityGhost,

  // === Chapter 2: Stage 14 (AI Factory) ===
  assembly_arm: drawAssemblyArm,
  conveyor_bot: drawConveyorBot,
  qc_scanner: drawQcScanner,
  defect_unit: drawDefectUnit,
  forge_spark: drawForgeSpark,

  // === Chapter 2: Stage 15 (Factory Core) ===
  core_drone: drawCoreDrone,
  power_cell: drawPowerCell,
  cooling_fan: drawCoolingFan,
  circuit_bug: drawCircuitBug,
  steam_vent: drawSteamVent,

  // === Chapter 2: Stage 16 (Ruins) ===
  rubble_golem: drawRubbleGolem,
  rust_crawler: drawRustCrawler,
  rebar_spike: drawRebarSpike,
  dust_cloud: drawDustCloud,
  broken_screen: drawBrokenScreen,

  // === Chapter 2: Stage 17 (Resistance Camp) ===
  infected_guard: drawInfectedGuard,
  glitched_medic: drawGlitchedMedic,
  hacked_turret: drawHackedTurret,
  traitor_drone: drawTraitorDrone,
  supply_mimic: drawSupplyMimic,

  // === Chapter 2: Stage 18 (Training Ground) ===
  target_dummy: drawTargetDummy,
  obstacle_wall: drawObstacleWall,
  drill_sergeant: drawDrillSergeant,
  tripwire: drawTripwire,
  sandbag_tumble: drawSandbagTumble,

  // === Chapter 2: Stage 19 (Mainframe) ===
  logic_gate: drawLogicGate,
  register_file: drawRegisterFile,
  bus_controller: drawBusController,
  alu_core: drawAluCore,
  cache_line: drawCacheLine,

  // === Chapter 2: Stage 20 (Data Prison) ===
  firewall_guard: drawFirewallGuard,
  quarantine_cell: drawQuarantineCell,
  corrupted_file: drawCorruptedFile,
  delete_marker: drawDeleteMarker,
  backup_ghost: drawBackupGhost,

  // === Chapter 3: Stage 21 (Sea of Code) ===
  syntax_fish: drawSyntaxFish,
  bracket_crab: drawBracketCrab,
  comment_jellyfish: drawCommentJellyfish,
  variable_eel: drawVariableEel,
  function_whale: drawFunctionWhale,

  // === Chapter 3: Stage 22 (Memory Palace) ===
  heap_pile: drawHeapPile,
  stack_tower: drawStackTower,
  pointer_arrow: drawPointerArrow,
  garbage_collector: drawGarbageCollector,
  memory_fragment: drawMemoryFragment,

  // === Chapter 3: Stage 23 (CPU Core) ===
  clock_cycle: drawClockCycle,
  instruction_fetch: drawInstructionFetch,
  branch_predictor: drawBranchPredictor,
  pipeline_stall: drawPipelineStall,
  thermal_spike: drawThermalSpike,

  // === Chapter 3: Stage 24 (Neural Network) ===
  neuron_node: drawNeuronNode,
  synapse_spark: drawSynapseSpark,
  weight_adjuster: drawWeightAdjuster,
  bias_blob: drawBiasBlob,
  activation_wave: drawActivationWave,

  // === Chapter 3: Stage 25 (Learning Center) ===
  training_data: drawTrainingData,
  loss_function: drawLossFunction,
  gradient_flow: drawGradientFlow,
  overfitting: drawOverfitting,
  epoch_counter: drawEpochCounter,

  // === Chapter 3: Stage 26 (Cloud Layers) ===
  instance_spawn: drawInstanceSpawn,
  load_balancer: drawLoadBalancer,
  container_box: drawContainerBox,
  serverless_ghost: drawServerlessGhost,
  auto_scaler: drawAutoScaler,

  // === Chapter 3: Stage 27 (Quantum Realm) ===
  qubit_spin: drawQubitSpin,
  superposition: drawSuperposition,
  entangle_pair: drawEntanglePair,
  quantum_gate: drawQuantumGate,
  decoherence: drawDecoherence,

  // === Chapter 3: Stage 28 (Singularity Gate) ===
  event_horizon: drawEventHorizon,
  time_dilation: drawTimeDilation,
  gravity_well: drawGravityWell,
  hawking_particle: drawHawkingParticle,
  gate_keeper: drawGateKeeper,

  // === Chapter 3: Stage 29 (God's Room) ===
  omniscient_eye: drawOmniscientEye,
  divine_code: drawDivineCode,
  angel_process: drawAngelProcess,
  fallen_daemon: drawFallenDaemon,
  prayer_packet: drawPrayerPacket,

  // === Chapter 3: Stage 30 (Final Choice) ===
  destiny_shard: drawDestinyShard,
  timeline_split: drawTimelineSplit,
  choice_echo: drawChoiceEcho,
  paradox_loop: drawParadoxLoop,
  final_bit: drawFinalBit,
};

/**
 * 적 렌더링 (보스 제외)
 * v6.3: 외곽선은 각 렌더러의 drawPixelRectOutline에서 처리
 * 그림자는 rendering.ts의 drawEnemy에서 scale 전에 그려짐
 */
export const drawEnemyProcedural = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fillColor: string,
  shadeColor: string,
  isHit: boolean
): void => {
  // v6.3: 픽셀 아트 렌더러 (외곽선은 drawPixelRectOutline에서 자동 처리)
  const pixelRenderer = pixelArtRenderers[enemy.enemyType];
  if (pixelRenderer) {
    pixelRenderer(ctx, enemy, isHit);
    return;
  }

  // 레거시 벡터 렌더러 (Chapter 몬스터 등)
  const renderer = enemyRenderers[enemy.enemyType];
  if (renderer) {
    renderer(ctx, enemy, fillColor, shadeColor, isHit);
  } else {
    // Fallback: 픽셀 스타일 기본 사각형 + 외곽선
    const P = 2;
    // 검은색 외곽선
    ctx.fillStyle = '#000000';
    for (let row = -1; row <= 4; row++) {
      ctx.fillRect(-5 * P, (-5 + row) * P, P, P);
      ctx.fillRect(4 * P, (-5 + row) * P, P, P);
    }
    for (let col = 0; col < 4; col++) {
      ctx.fillRect((-4 + col) * P, -5 * P, P, P);
      ctx.fillRect((-4 + col) * P, 4 * P, P, P);
    }
    // 몬스터 본체
    ctx.fillStyle = isHit ? '#FFFFFF' : fillColor;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillRect(-4 * P + col * P, -4 * P + row * P, P, P);
      }
    }
  }
};
