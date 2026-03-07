package game

// ============================================================
// Arena Character & Weapon Unlock System — Phase 6 (v18)
// ============================================================
//
// Default unlocked: Striker + Guardian (2 characters)
// Remaining 6 characters: unlockable via quests/tokens/achievements
//
// Unlock methods:
//   1. Quest completion (specific quest chain)
//   2. Token purchase ($AWW or country tokens)
//   3. Achievement unlock (profile milestones)
//   4. Season pass reward (premium track)

// ── Unlock Constants ────────────────────────────────────────

const (
	ARUnlockCostAWW      = 1000.0 // $AWW cost to bypass unlock conditions
	ARWeaponUnlockCost   = 800.0  // country tokens to unlock a weapon
)

// ── Unlock Types ────────────────────────────────────────────

// ARUnlockMethod is how something can be unlocked.
type ARUnlockMethod string

const (
	ARUnlockByDefault     ARUnlockMethod = "default"     // starts unlocked
	ARUnlockByQuest       ARUnlockMethod = "quest"       // complete specific quest
	ARUnlockByAchievement ARUnlockMethod = "achievement" // earn achievement
	ARUnlockByToken       ARUnlockMethod = "token"       // purchase with tokens
	ARUnlockByProfile     ARUnlockMethod = "profile"     // reach profile level
	ARUnlockBySeason      ARUnlockMethod = "season"      // season pass reward
)

// ARCharUnlockDef defines unlock requirements for a character.
type ARCharUnlockDef struct {
	Character     ARCharacterType `json:"character"`
	DefaultUnlock bool            `json:"defaultUnlock"`
	Methods       []ARUnlockReq   `json:"methods"`     // any one of these can unlock
	Description   string          `json:"description"` // how to unlock (display text)
}

// ARUnlockReq is a single unlock requirement.
type ARUnlockReq struct {
	Method       ARUnlockMethod `json:"method"`
	QuestID      string         `json:"questId,omitempty"`      // for quest unlock
	AchievementID string        `json:"achievementId,omitempty"` // for achievement unlock
	ProfileLevel int            `json:"profileLevel,omitempty"` // for profile level unlock
	TokenCost    float64        `json:"tokenCost,omitempty"`    // for token purchase
	TokenType    ARTokenType    `json:"tokenType,omitempty"`    // AWW or country
	SeasonLevel  int            `json:"seasonLevel,omitempty"`  // for season pass unlock
}

// ARWeaponUnlockDef defines unlock requirements for a weapon.
type ARWeaponUnlockDef struct {
	Weapon      ARWeaponID    `json:"weapon"`
	StartChar   ARCharacterType `json:"startChar,omitempty"` // character that starts with this weapon
	Methods     []ARUnlockReq `json:"methods"`
	Description string        `json:"description"`
}

// ── Character Unlock Definitions ────────────────────────────

// AllCharUnlockDefs returns unlock requirements for all 8 characters.
func AllCharUnlockDefs() []ARCharUnlockDef {
	return charUnlockDefs
}

var charUnlockDefs = []ARCharUnlockDef{
	// Default unlocked (2)
	{
		Character: ARCharStriker, DefaultUnlock: true,
		Description: "Unlocked by default",
	},
	{
		Character: ARCharGuardian, DefaultUnlock: true,
		Description: "Unlocked by default",
	},

	// Unlockable characters (6)
	{
		Character: ARCharPyro, DefaultUnlock: false,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 5},
			{Method: ARUnlockByToken, TokenCost: ARUnlockCostAWW, TokenType: ARTokenAWW},
		},
		Description: "Reach Profile Level 5 or purchase with 1000 $AWW",
	},
	{
		Character: ARCharFrostMage, DefaultUnlock: false,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 10},
			{Method: ARUnlockByToken, TokenCost: ARUnlockCostAWW, TokenType: ARTokenAWW},
		},
		Description: "Reach Profile Level 10 or purchase with 1000 $AWW",
	},
	{
		Character: ARCharSniper, DefaultUnlock: false,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByAchievement, AchievementID: "centurion"},
			{Method: ARUnlockByToken, TokenCost: ARUnlockCostAWW, TokenType: ARTokenAWW},
		},
		Description: "Unlock 'Centurion' achievement (100 kills) or purchase with 1000 $AWW",
	},
	{
		Character: ARCharGambler, DefaultUnlock: false,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 20},
			{Method: ARUnlockByAchievement, AchievementID: "tome_collector"},
			{Method: ARUnlockByToken, TokenCost: ARUnlockCostAWW, TokenType: ARTokenAWW},
		},
		Description: "Profile Level 20, 'Tome Collector' achievement, or 1000 $AWW",
	},
	{
		Character: ARCharBerserker, DefaultUnlock: false,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByAchievement, AchievementID: "pvp_ace"},
			{Method: ARUnlockByProfile, ProfileLevel: 15},
			{Method: ARUnlockByToken, TokenCost: ARUnlockCostAWW, TokenType: ARTokenAWW},
		},
		Description: "Unlock 'PvP Ace' achievement (5 PvP kills), Profile Level 15, or 1000 $AWW",
	},
	{
		Character: ARCharShadow, DefaultUnlock: false,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByAchievement, AchievementID: "undying"},
			{Method: ARUnlockByProfile, ProfileLevel: 30},
			{Method: ARUnlockByToken, TokenCost: ARUnlockCostAWW, TokenType: ARTokenAWW},
			{Method: ARUnlockBySeason, SeasonLevel: 50},
		},
		Description: "Win 50 battles, Profile Level 30, Season Pass Level 50, or 1000 $AWW",
	},
}

// ── Unlock Check Logic ──────────────────────────────────────

// CanUnlockCharacter checks if a player meets any unlock requirement for a character.
func CanUnlockCharacter(profile *ARPlayerProfile, charType ARCharacterType) (bool, string) {
	// Already unlocked
	if profile.HasCharacter(charType) {
		return true, "already_unlocked"
	}

	// Find the unlock def
	var def *ARCharUnlockDef
	for i := range charUnlockDefs {
		if charUnlockDefs[i].Character == charType {
			def = &charUnlockDefs[i]
			break
		}
	}
	if def == nil {
		return false, "unknown_character"
	}

	if def.DefaultUnlock {
		return true, "default"
	}

	// Check each method
	achievementSet := profile.achievementSet()
	for _, req := range def.Methods {
		switch req.Method {
		case ARUnlockByProfile:
			if profile.ProfileLevel >= req.ProfileLevel {
				return true, "profile_level"
			}
		case ARUnlockByAchievement:
			if achievementSet[req.AchievementID] {
				return true, "achievement"
			}
		case ARUnlockByToken:
			if req.TokenType == ARTokenAWW && profile.AWWBalance >= req.TokenCost {
				return true, "token_purchase"
			}
		case ARUnlockBySeason:
			if profile.SeasonPassLevel >= req.SeasonLevel {
				return true, "season_pass"
			}
		}
	}

	return false, "locked"
}

// UnlockCharacter attempts to unlock a character for a player.
// Returns success status and the method used.
func UnlockCharacter(profile *ARPlayerProfile, charType ARCharacterType) (bool, string) {
	canUnlock, method := CanUnlockCharacter(profile, charType)
	if !canUnlock {
		return false, "requirements_not_met"
	}
	if method == "already_unlocked" {
		return true, "already_unlocked"
	}

	// If unlocking via token purchase, deduct tokens
	if method == "token_purchase" {
		profile.AWWBalance -= ARUnlockCostAWW
	}

	profile.UnlockedChars = append(profile.UnlockedChars, charType)

	// Also unlock the starting weapon for this character
	charDef := GetCharacterDef(charType)
	if charDef != nil {
		hasWeapon := false
		for _, w := range profile.UnlockedWeapons {
			if w == charDef.StartWeapon {
				hasWeapon = true
				break
			}
		}
		if !hasWeapon {
			profile.UnlockedWeapons = append(profile.UnlockedWeapons, charDef.StartWeapon)
		}
	}

	return true, method
}

// ── Weapon Unlock ───────────────────────────────────────────

// AllWeaponUnlockDefs returns unlock requirements for non-starter weapons.
func AllWeaponUnlockDefs() []ARWeaponUnlockDef {
	return weaponUnlockDefs
}

var weaponUnlockDefs = []ARWeaponUnlockDef{
	// Weapons not tied to any starting character
	{
		Weapon: ARWeaponSniperRifle, StartChar: ARCharSniper,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 8},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Profile Level 8 or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponLightningStaff,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 12},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Profile Level 12 or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponBow,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 6},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Profile Level 6 or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponRevolver,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByAchievement, AchievementID: "pvp_first"},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Get a PvP kill or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponBlackHole,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 25},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Profile Level 25 or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponShotgun,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 3},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Profile Level 3 or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponLandmine,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByAchievement, AchievementID: "elite_hunter"},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "'Elite Hunter' achievement or 800 Country Tokens",
	},
	{
		Weapon: ARWeaponPoisonFlask,
		Methods: []ARUnlockReq{
			{Method: ARUnlockByProfile, ProfileLevel: 15},
			{Method: ARUnlockByToken, TokenCost: ARWeaponUnlockCost, TokenType: ARTokenCountry},
		},
		Description: "Profile Level 15 or 800 Country Tokens",
	},
}

// CanUnlockWeapon checks if a player can unlock a specific weapon.
func CanUnlockWeapon(profile *ARPlayerProfile, weapon ARWeaponID) (bool, string) {
	// Already unlocked
	for _, w := range profile.UnlockedWeapons {
		if w == weapon {
			return true, "already_unlocked"
		}
	}

	// Find unlock def
	var def *ARWeaponUnlockDef
	for i := range weaponUnlockDefs {
		if weaponUnlockDefs[i].Weapon == weapon {
			def = &weaponUnlockDefs[i]
			break
		}
	}
	if def == nil {
		// No unlock def = freely available
		return true, "free"
	}

	achievementSet := profile.achievementSet()
	for _, req := range def.Methods {
		switch req.Method {
		case ARUnlockByProfile:
			if profile.ProfileLevel >= req.ProfileLevel {
				return true, "profile_level"
			}
		case ARUnlockByAchievement:
			if achievementSet[req.AchievementID] {
				return true, "achievement"
			}
		case ARUnlockByToken:
			if req.TokenType == ARTokenCountry {
				// Check any country balance
				for _, bal := range profile.CountryBalances {
					if bal >= req.TokenCost {
						return true, "token_purchase"
					}
				}
			}
		}
	}

	return false, "locked"
}
