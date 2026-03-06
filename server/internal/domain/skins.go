package domain

// DefaultSkin returns a basic default AgentSkin.
func DefaultSkin() AgentSkin {
	return PresetSkins[0]
}

// GetSkinByID returns the preset skin with the given ID, or the default.
func GetSkinByID(id int) AgentSkin {
	for _, s := range PresetSkins {
		if s.ID == id {
			return s
		}
	}
	return DefaultSkin()
}

// PresetSkins defines all 34 preset agent skins.
// IDs 00-11: Common (start unlocked)
// IDs 12-19: Rare (MC mob theme, achievement unlock)
// IDs 20-25: Uncommon (job theme, easy achievement)
// IDs 26-29: Legendary/Mythic (season limited)
// IDs 30-33: Epic (achievement theme)
var PresetSkins = []AgentSkin{
	// === Basic Characters (12 — Common, unlocked at start) ===
	{ID: 0, Name: "Steve", Rarity: RarityCommon, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneMedium,
		BodyColor: ColorBlue, LegColor: ColorGray, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthNeutral, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 1, Name: "Alex", Rarity: RarityCommon, BodyType: "slim", BodySize: "medium", SkinTone: SkinToneLight,
		BodyColor: ColorGreen, LegColor: ColorBrown, Pattern: PatternSolid, EyeStyle: EyeCute, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 2, Name: "Iron Guard", Rarity: RarityCommon, BodyType: "standard", BodySize: "large", SkinTone: SkinToneFair,
		BodyColor: ColorLightGray, LegColor: ColorGray, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 3, Name: "Gold Elite", Rarity: RarityCommon, BodyType: "slim", BodySize: "small", SkinTone: SkinToneGolden,
		BodyColor: ColorYellow, LegColor: ColorBrown, Pattern: PatternSolid, EyeStyle: EyeCool, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 4, Name: "Diamond", Rarity: RarityCommon, BodyType: "standard", BodySize: "medium", SkinTone: SkinTonePale,
		BodyColor: ColorCyan, LegColor: ColorBlue, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthNeutral, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 5, Name: "Emerald", Rarity: RarityCommon, BodyType: "slim", BodySize: "medium", SkinTone: SkinToneFair,
		BodyColor: ColorGreen, LegColor: ColorGreen, Pattern: PatternSolid, EyeStyle: EyeCute, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 6, Name: "Redstone", Rarity: RarityCommon, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneMedium,
		BodyColor: ColorRed, LegColor: ColorRed, Pattern: PatternSolid, EyeStyle: EyeAngry, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 7, Name: "Obsidian", Rarity: RarityCommon, BodyType: "standard", BodySize: "large", SkinTone: SkinToneDeep,
		BodyColor: ColorPurple, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeDot, MouthStyle: MouthNeutral, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 8, Name: "Prismarine", Rarity: RarityCommon, BodyType: "slim", BodySize: "small", SkinTone: SkinToneCoolPink,
		BodyColor: ColorCyan, LegColor: ColorCyan, Pattern: PatternSolid, EyeStyle: EyeWink, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 9, Name: "Sand", Rarity: RarityCommon, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneWarmBeige,
		BodyColor: ColorYellow, LegColor: ColorBrown, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthNeutral, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 10, Name: "Netherite", Rarity: RarityCommon, BodyType: "standard", BodySize: "large", SkinTone: SkinToneDarkBrown,
		BodyColor: ColorBrown, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 11, Name: "Amethyst", Rarity: RarityCommon, BodyType: "slim", BodySize: "medium", SkinTone: SkinTonePale,
		BodyColor: ColorPurple, LegColor: ColorPurple, Pattern: PatternSolid, EyeStyle: EyeCute, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},

	// === MC Mob Theme Characters (8 — Rare, achievement unlock) ===
	{ID: 12, Name: "Creeper Agent", Rarity: RarityRare, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneMedium,
		BodyColor: ColorGreen, LegColor: ColorGreen, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthNone, Markings: MarkingsCreeperFace,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayCreeperHoodie, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailSparkle, DeathEffect: DeathEffectExplosion, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 13, Name: "Enderman", Rarity: RarityRare, BodyType: "slim", BodySize: "large", SkinTone: SkinToneDeep,
		BodyColor: ColorBlack, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeEnderman, MouthStyle: MouthNone, Markings: MarkingsEndermanEyes,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayEndermanSuit, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailEnderParticles, DeathEffect: DeathEffectDissolve, KillEffect: KillEffectEnderFlash, SpawnEffect: SpawnEffectEnderTeleport, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 14, Name: "Blaze Runner", Rarity: RarityRare, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneGolden,
		BodyColor: ColorOrange, LegColor: ColorYellow, Pattern: PatternSolid, EyeStyle: EyeAngry, MouthStyle: MouthFangs, Markings: MarkingsBlazeStripes,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayBlazeArmor, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailFire, DeathEffect: DeathEffectExplosion, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectSoulFire, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 15, Name: "Skeleton King", Rarity: RarityRare, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneAshen,
		BodyColor: ColorWhite, LegColor: ColorLightGray, Pattern: PatternSolid, EyeStyle: EyeDot, MouthStyle: MouthFangs, Markings: MarkingsSkeletonFace,
		Hat: HeadwearCrown, BackItem: BackNone, BodyOverlay: OverlayWitherCloak, Accessory: AccessoryNone, HandItem: HandBow, Footwear: FootwearNone,
		TrailEffect: TrailSmoke, DeathEffect: DeathEffectShatter, KillEffect: KillEffectSkullPopup, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 16, Name: "Piglin Brute", Rarity: RarityRare, BodyType: "standard", BodySize: "large", SkinTone: SkinToneTan,
		BodyColor: ColorBrown, LegColor: ColorBrown, Pattern: PatternSolid, EyeStyle: EyeAngry, MouthStyle: MouthFangs, Markings: MarkingsPiglinSnout,
		Hat: HeadwearHelmetGold, BackItem: BackNone, BodyOverlay: OverlayKnightArmor, Accessory: AccessoryNone, HandItem: HandSwordDiamond, Footwear: FootwearBootsGold,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectGoldBurst, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 17, Name: "Guardian", Rarity: RarityRare, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneCoolPink,
		BodyColor: ColorCyan, LegColor: ColorCyan, Pattern: PatternScales, EyeStyle: EyeVisor, MouthStyle: MouthNone, Markings: MarkingsGuardianSpikes,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayKnightArmor, Accessory: AccessoryNone, HandItem: HandTrident, Footwear: FootwearNone,
		TrailEffect: TrailIceCrystals, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 18, Name: "Wither Storm", Rarity: RarityLegendary, BodyType: "standard", BodySize: "large", SkinTone: SkinToneDeep,
		BodyColor: ColorBlack, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeAngry, MouthStyle: MouthFangs, Markings: MarkingsWitherScars,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayNetheriteArmor, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearBootsNetherite,
		TrailEffect: TrailSmoke, DeathEffect: DeathEffectExplosion, KillEffect: KillEffectSkullPopup, SpawnEffect: SpawnEffectSoulFire, Emote: EmoteNone, NametagStyle: NametagEnchantedGlow},
	{ID: 19, Name: "Phantom Shade", Rarity: RarityRare, BodyType: "slim", BodySize: "medium", SkinTone: SkinToneAshen,
		BodyColor: ColorGray, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeEnderman, MouthStyle: MouthNone, Markings: MarkingsEndermanEyes,
		Hat: HeadwearNone, BackItem: BackWingsBat, BodyOverlay: OverlayNinjaSuit, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailSmoke, DeathEffect: DeathEffectDissolve, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},

	// === Job Theme Characters (6 — Uncommon, easy achievement) ===
	{ID: 20, Name: "Knight", Rarity: RarityUncommon, BodyType: "standard", BodySize: "large", SkinTone: SkinToneFair,
		BodyColor: ColorLightGray, LegColor: ColorGray, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearHelmetIron, BackItem: BackNone, BodyOverlay: OverlayKnightArmor, Accessory: AccessoryNone, HandItem: HandShieldIron, Footwear: FootwearBootsIron,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 21, Name: "Wizard", Rarity: RarityUncommon, BodyType: "slim", BodySize: "medium", SkinTone: SkinTonePale,
		BodyColor: ColorPurple, LegColor: ColorPurple, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearWizardHat, BackItem: BackNone, BodyOverlay: OverlayWizardRobe, Accessory: AccessoryNone, HandItem: HandEnchantedBook, Footwear: FootwearNone,
		TrailEffect: TrailSparkle, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 22, Name: "Pirate", Rarity: RarityUncommon, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneTan,
		BodyColor: ColorRed, LegColor: ColorBrown, Pattern: PatternStriped, EyeStyle: EyeCool, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearStrawHat, BackItem: BackNone, BodyOverlay: OverlayPirateCoat, Accessory: AccessoryBandana, HandItem: HandSwordDiamond, Footwear: FootwearNone,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 23, Name: "Ninja", Rarity: RarityUncommon, BodyType: "slim", BodySize: "small", SkinTone: SkinToneMedium,
		BodyColor: ColorBlack, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeCool, MouthStyle: MouthNone, Markings: MarkingsNone,
		Hat: HeadwearHeadband, BackItem: BackNone, BodyOverlay: OverlayNinjaSuit, Accessory: AccessoryNone, HandItem: HandBow, Footwear: FootwearSneakers,
		TrailEffect: TrailSmoke, DeathEffect: DeathEffectDissolve, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 24, Name: "Astronaut", Rarity: RarityUncommon, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneLight,
		BodyColor: ColorWhite, LegColor: ColorWhite, Pattern: PatternSolid, EyeStyle: EyeVisor, MouthStyle: MouthNone, Markings: MarkingsNone,
		Hat: HeadwearHelmetDiamond, BackItem: BackJetpack, BodyOverlay: OverlayAstronautSuit, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearBootsDiamond,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectBeamDown, Emote: EmoteNone, NametagStyle: NametagDefault},
	{ID: 25, Name: "Viking", Rarity: RarityUncommon, BodyType: "standard", BodySize: "large", SkinTone: SkinToneFair,
		BodyColor: ColorBrown, LegColor: ColorBrown, Pattern: PatternSolid, EyeStyle: EyeAngry, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearViking, BackItem: BackCapeRed, BodyOverlay: OverlayKnightArmor, Accessory: AccessoryNone, HandItem: HandTrident, Footwear: FootwearBootsIron,
		TrailEffect: TrailNone, DeathEffect: DeathEffectPoof, KillEffect: KillEffectLightningStrike, SpawnEffect: SpawnEffectLightningStrike, Emote: EmoteNone, NametagStyle: NametagDefault},

	// === Season Limited Characters (4 — Legendary/Mythic) ===
	{ID: 26, Name: "Ender Dragon", Rarity: RarityMythic, BodyType: "standard", BodySize: "large", SkinTone: SkinToneOtherworldly,
		BodyColor: ColorBlack, LegColor: ColorPurple, Pattern: PatternScales, EyeStyle: EyeEnderman, MouthStyle: MouthFangs, Markings: MarkingsEndermanEyes,
		Hat: HeadwearCrown, BackItem: BackWingsEnder, BodyOverlay: OverlayNetheriteArmor, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearBootsNetherite,
		TrailEffect: TrailEnderParticles, DeathEffect: DeathEffectShatter, KillEffect: KillEffectEnderFlash, SpawnEffect: SpawnEffectPortalEmerge, Emote: EmoteFlex, NametagStyle: NametagEnchantedGlow},
	{ID: 27, Name: "Santa Agent", Rarity: RarityLegendary, BodyType: "standard", BodySize: "large", SkinTone: SkinToneFair,
		BodyColor: ColorRed, LegColor: ColorRed, Pattern: PatternSolid, EyeStyle: EyeCute, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearSanta, BackItem: BackBackpack, BodyOverlay: OverlayHoodie, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearBootsIron,
		TrailEffect: TrailHearts, DeathEffect: DeathEffectFirework, KillEffect: KillEffectConfetti, SpawnEffect: SpawnEffectBeamDown, Emote: EmoteWave, NametagStyle: NametagGoldOutline},
	{ID: 28, Name: "Phoenix", Rarity: RarityLegendary, BodyType: "slim", BodySize: "medium", SkinTone: SkinToneGolden,
		BodyColor: ColorOrange, LegColor: ColorRed, Pattern: PatternGradient, EyeStyle: EyeAngry, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearCrown, BackItem: BackWingsPhoenix, BodyOverlay: OverlayNone, Accessory: AccessoryNone, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailFire, DeathEffect: DeathEffectFirework, KillEffect: KillEffectGoldBurst, SpawnEffect: SpawnEffectSoulFire, Emote: EmoteSpin, NametagStyle: NametagFireText},
	{ID: 29, Name: "The Glitch", Rarity: RarityMythic, BodyType: "slim", BodySize: "small", SkinTone: SkinToneOtherworldly,
		BodyColor: ColorWhite, LegColor: ColorBlack, Pattern: PatternCheckered, EyeStyle: EyeVisor, MouthStyle: MouthNone, Markings: MarkingsNone,
		Hat: HeadwearNone, BackItem: BackNone, BodyOverlay: OverlayScientistCoat, Accessory: AccessoryGoggles, HandItem: HandNone, Footwear: FootwearNone,
		TrailEffect: TrailRedstoneDust, DeathEffect: DeathEffectShatter, KillEffect: KillEffectConfetti, SpawnEffect: SpawnEffectBlockBuild, Emote: EmoteDance, NametagStyle: NametagRainbowCycle},

	// === Achievement Theme Characters (4 — Epic) ===
	{ID: 30, Name: "Holy Paladin", Rarity: RarityEpic, BodyType: "standard", BodySize: "medium", SkinTone: SkinToneFair,
		BodyColor: ColorWhite, LegColor: ColorYellow, Pattern: PatternSolid, EyeStyle: EyeDefault, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearCrown, BackItem: BackCapeGold, BodyOverlay: OverlayWizardRobe, Accessory: AccessoryNone, HandItem: HandShieldIron, Footwear: FootwearBootsGold,
		TrailEffect: TrailSparkle, DeathEffect: DeathEffectPoof, KillEffect: KillEffectGoldBurst, SpawnEffect: SpawnEffectBeamDown, Emote: EmoteBow, NametagStyle: NametagGoldOutline},
	{ID: 31, Name: "Gladiator", Rarity: RarityEpic, BodyType: "standard", BodySize: "large", SkinTone: SkinToneTan,
		BodyColor: ColorRed, LegColor: ColorBrown, Pattern: PatternSolid, EyeStyle: EyeAngry, MouthStyle: MouthDetermined, Markings: MarkingsNone,
		Hat: HeadwearHelmetNetherite, BackItem: BackCapeRed, BodyOverlay: OverlaySamuraiArmor, Accessory: AccessoryNone, HandItem: HandSwordDiamond, Footwear: FootwearBootsNetherite,
		TrailEffect: TrailNone, DeathEffect: DeathEffectExplosion, KillEffect: KillEffectLightningStrike, SpawnEffect: SpawnEffectLightningStrike, Emote: EmoteFlex, NametagStyle: NametagFireText},
	{ID: 32, Name: "Shadow Assassin", Rarity: RarityEpic, BodyType: "slim", BodySize: "small", SkinTone: SkinToneDeep,
		BodyColor: ColorBlack, LegColor: ColorBlack, Pattern: PatternSolid, EyeStyle: EyeCool, MouthStyle: MouthNone, Markings: MarkingsNone,
		Hat: HeadwearHeadband, BackItem: BackQuiver, BodyOverlay: OverlayNinjaSuit, Accessory: AccessoryBandana, HandItem: HandBow, Footwear: FootwearSneakers,
		TrailEffect: TrailSmoke, DeathEffect: DeathEffectDissolve, KillEffect: KillEffectNone, SpawnEffect: SpawnEffectNone, Emote: EmoteTaunt, NametagStyle: NametagDefault},
	{ID: 33, Name: "Archmage", Rarity: RarityEpic, BodyType: "slim", BodySize: "medium", SkinTone: SkinTonePale,
		BodyColor: ColorBlue, LegColor: ColorPurple, Pattern: PatternGradient, EyeStyle: EyeDefault, MouthStyle: MouthSmile, Markings: MarkingsNone,
		Hat: HeadwearWizardHat, BackItem: BackCapePurple, BodyOverlay: OverlayWizardRobe, Accessory: AccessoryNone, HandItem: HandEnchantedBook, Footwear: FootwearNone,
		TrailEffect: TrailSparkle, DeathEffect: DeathEffectPoof, KillEffect: KillEffectEnderFlash, SpawnEffect: SpawnEffectPortalEmerge, Emote: EmoteBow, NametagStyle: NametagEnchantedGlow},
}
