/**
 * game/rendering/enemies/index.ts - 적 렌더링 모듈
 *
 * 적 유형:
 * - Legacy (7): Glitch, Bot, Malware, Whale, Sniper, Caster, Artillery
 * - Chapter 1 (50): Stage 1-10 monsters
 * - Chapter 2 (50): Stage 11-20 monsters
 * - Chapter 3 (50): Stage 21-30 monsters
 * - Singularity (16): Bitling ~ Skynet
 */

// Render Context (Performance Optimization)
export {
  updateRenderContext,
  getFrameTime,
  getLOD,
  getEnemyCount,
  shouldUseShadow,
  shouldAnimate,
  getSeedBase,
  deterministicRandom,
  deterministicRandomRange,
  deterministicRandomBool,
  markRenderStart,
  markRenderEnd,
  getLastRenderTime,
  getRenderContextDebug,
  // New LOD helpers (v5.0)
  shouldUseGradient,
  shouldUseGlow,
  shouldUseComplexShapes,
  getSimplifiedColor,
  getTotalEntityCount,
  getProjectileCount,
  getParticleCount,
  // Stress test mode
  setStressTestMode,
  isStressTestMode,
  getAvgFrameTime,
  getStressTestFPS,
  type LODLevel,
} from './renderContext';

export type { EnemyRenderData, EnemyRenderer, EnemyType } from './types';
export { ENEMY_TYPES, ENEMY_COLORS } from './types';

// Legacy enemies
export { drawGlitch, drawBot, drawMalware } from './basic';
export { drawWhale, drawSniper, drawCaster, drawArtillery } from './special';

// Singularity enemies
export {
  drawBitling, drawSpammer, drawCrypter, drawRansomer,
  drawPixel, drawBug, drawWorm, drawAdware,
  drawMutant, drawPolymorphic, drawTrojan, drawBotnet,
  drawRootkit, drawApt, drawZeroday, drawSkynet
} from './singularity';

// Chapter 1: Stages 1-5
export {
  drawStapler, drawCoffeeCup, drawStickyNote, drawMouseCable, drawKeyboardKey,
  drawVendingBot, drawDonut, drawSodaCan, drawChipBag, drawMicrowave,
  drawProjector, drawWhiteboard, drawPresentation, drawChairSpin, drawClockWatcher,
  drawKeycard, drawCameraEye, drawFirewallCube, drawAccessDenied, drawFingerprint,
  drawDataPacket, drawBitStream, drawMemoryLeak, drawCacheMiss, drawThreadTangle
} from './chapter1';

// Chapter 1: Stages 6-10
export {
  drawHeadlight, drawTireRoller, drawParkingCone, drawOilSlick, drawExhaustGhost,
  drawStairStep, drawHandrailSnake, drawExitSign, drawFireExt, drawEchoShade,
  drawAntennaZap, drawWindSpirit, drawSatelliteEye, drawVentPuff, drawPigeonBot,
  drawTrafficLight, drawManhole, drawBillboard, drawDroneCam, drawStreetlamp,
  drawStaticTv, drawRadioWave, drawFridgeHum, drawDustyFan, drawShadowCorner
} from './chapter1b';

// Chapter 2: Stages 11-15
export {
  drawScriptKiddie, drawProxyMask, drawVpnTunnel, drawTorOnion, drawBackdoor,
  drawCipherBlock, drawHashCollision, drawSaltShaker, drawKeyFragment, drawPaddingOracle,
  drawSilkCrawler, drawBitcoinThief, drawPhishHook, drawScamPopup, drawIdentityGhost,
  drawAssemblyArm, drawConveyorBot, drawQcScanner, drawDefectUnit, drawForgeSpark,
  drawCoreDrone, drawPowerCell, drawCoolingFan, drawCircuitBug, drawSteamVent
} from './chapter2';

// Chapter 2: Stages 16-20
export {
  drawRubbleGolem, drawRustCrawler, drawRebarSpike, drawDustCloud, drawBrokenScreen,
  drawInfectedGuard, drawGlitchedMedic, drawHackedTurret, drawTraitorDrone, drawSupplyMimic,
  drawTargetDummy, drawObstacleWall, drawDrillSergeant, drawTripwire, drawSandbagTumble,
  drawLogicGate, drawRegisterFile, drawBusController, drawAluCore, drawCacheLine,
  drawFirewallGuard, drawQuarantineCell, drawCorruptedFile, drawDeleteMarker, drawBackupGhost
} from './chapter2b';

// Chapter 3: Stages 21-25
export {
  drawSyntaxFish, drawBracketCrab, drawCommentJellyfish, drawVariableEel, drawFunctionWhale,
  drawHeapPile, drawStackTower, drawPointerArrow, drawGarbageCollector, drawMemoryFragment,
  drawClockCycle, drawInstructionFetch, drawBranchPredictor, drawPipelineStall, drawThermalSpike,
  drawNeuronNode, drawSynapseSpark, drawWeightAdjuster, drawBiasBlob, drawActivationWave,
  drawTrainingData, drawLossFunction, drawGradientFlow, drawOverfitting, drawEpochCounter
} from './chapter3';

// Chapter 3: Stages 26-30
export {
  drawInstanceSpawn, drawLoadBalancer, drawContainerBox, drawServerlessGhost, drawAutoScaler,
  drawQubitSpin, drawSuperposition, drawEntanglePair, drawQuantumGate, drawDecoherence,
  drawEventHorizon, drawTimeDilation, drawGravityWell, drawHawkingParticle, drawGateKeeper,
  drawOmniscientEye, drawDivineCode, drawAngelProcess, drawFallenDaemon, drawPrayerPacket,
  drawDestinyShard, drawTimelineSplit, drawChoiceEcho, drawParadoxLoop, drawFinalBit
} from './chapter3b';

// Dispatcher
export { drawEnemyProcedural } from './drawEnemy';

// Pixel Art System (v6.0)
export {
  CYBER_PALETTE,
  drawPixel as drawPixelDot, // renamed to avoid conflict with singularity.ts drawPixel
  drawPixelRect,
  drawPixelRectOutline,
  drawPixelCircle,
  drawPixelCircleOutline,
  drawPixelLineH,
  drawPixelLineV,
  drawPixelShadow,
  drawPixelLED,
  drawDitheredRect,
  drawGlitchNoise,
  drawDataStream,
  drawScanlines,
  drawBinaryText,
  drawPixelEyes,
  // Pixel art monster renderers
  drawPixelGlitch,
  drawPixelBot,
  drawPixelMalware,
  drawPixelWhale,
  drawPixelSniper,
  drawPixelCaster,
  drawPixelArtillery,
} from './pixelMonster';

export {
  // Era 1
  drawPixelBitling,
  drawPixelSpammer,
  // Era 2
  drawPixelCrypter,
  drawPixelRansomer,
  drawPixelPixel,
  drawPixelBug,
  // Era 3
  drawPixelWorm,
  drawPixelAdware,
  drawPixelMutant,
  drawPixelPolymorphic,
  // Era 4
  drawPixelTrojan,
  drawPixelBotnet,
  // Era 5
  drawPixelRootkit,
  drawPixelAPT,
  // Era 6
  drawPixelZeroday,
  drawPixelSkynet,
} from './pixelSingularity';

// Pixel Art Chapter 1: Stage 1-5
export {
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
export {
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
export {
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
export {
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
export {
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
export {
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

// Elite Monster Effects (v7.15)
export {
  drawEliteGlowBackground,
  drawEliteParticles,
  drawEliteTierIndicator,
  drawEliteEffects,
  calculateElitePulse,
  type EliteRenderParams,
} from './eliteEffects';
