package game

import (
	"fmt"
	"math"
	"math/rand"
)

// ============================================================
// Arena Item System — Drops & Equipment (v18 Phase 2)
// ============================================================

// AllItemDefs returns the full item definition registry.
func AllItemDefs() map[ARItemID]*ARItemDef {
	return itemRegistry
}

// GetItemDef returns the definition for an item ID.
func GetItemDef(id ARItemID) *ARItemDef {
	return itemRegistry[id]
}

// itemRegistry defines all items.
var itemRegistry = map[ARItemID]*ARItemDef{
	// ── Instant-Use Items ─────────────────────────────────────
	ARItemHealthOrbSmall: {
		ID: ARItemHealthOrbSmall, Name: "Health Orb (Small)",
		Category: ARItemCatInstant, Rarity: ARRarityCommon,
		Desc: "Restores 10% max HP",
	},
	ARItemHealthOrbLarge: {
		ID: ARItemHealthOrbLarge, Name: "Health Orb (Large)",
		Category: ARItemCatInstant, Rarity: ARRarityUncommon,
		Desc: "Restores 30% max HP",
	},
	ARItemXPMagnet: {
		ID: ARItemXPMagnet, Name: "XP Magnet",
		Category: ARItemCatInstant, Rarity: ARRarityRare,
		Desc: "Instantly collects all XP on screen",
	},
	ARItemSpeedBoost: {
		ID: ARItemSpeedBoost, Name: "Speed Boost",
		Category: ARItemCatInstant, Rarity: ARRarityUncommon,
		Desc: "2x move speed for 15 seconds",
	},
	ARItemShieldBurst: {
		ID: ARItemShieldBurst, Name: "Shield Burst",
		Category: ARItemCatInstant, Rarity: ARRarityRare,
		Desc: "5 seconds of invincibility",
	},
	ARItemBomb: {
		ID: ARItemBomb, Name: "Bomb",
		Category: ARItemCatInstant, Rarity: ARRarityUncommon,
		Desc: "25% max HP damage to all enemies within 10m",
	},

	// ── Equipment Items ───────────────────────────────────────
	ARItemIronBoots: {
		ID: ARItemIronBoots, Name: "Iron Boots",
		Category: ARItemCatEquipment, Rarity: ARRarityCommon,
		Desc: "+30% knockback resistance",
	},
	ARItemFeatherCape: {
		ID: ARItemFeatherCape, Name: "Feather Cape",
		Category: ARItemCatEquipment, Rarity: ARRarityUncommon,
		Desc: "Enables double jump",
	},
	ARItemVampireRing: {
		ID: ARItemVampireRing, Name: "Vampire Ring",
		Category: ARItemCatEquipment, Rarity: ARRarityRare,
		Desc: "3% damage dealt as lifesteal",
	},
	ARItemBerserkerHelm: {
		ID: ARItemBerserkerHelm, Name: "Berserker Helm",
		Category: ARItemCatEquipment, Rarity: ARRarityRare,
		Desc: "+40% damage when below 50% HP",
	},
	ARItemCrownOfThorns: {
		ID: ARItemCrownOfThorns, Name: "Crown of Thorns",
		Category: ARItemCatEquipment, Rarity: ARRarityEpic,
		Desc: "25% damage reflection + 1s invincibility on hit",
	},
	ARItemMagnetAmulet: {
		ID: ARItemMagnetAmulet, Name: "Magnet Amulet",
		Category: ARItemCatEquipment, Rarity: ARRarityUncommon,
		Desc: "+5m XP collection range",
	},
	ARItemGlassCannon: {
		ID: ARItemGlassCannon, Name: "Glass Cannon",
		Category: ARItemCatEquipment, Rarity: ARRarityEpic,
		Desc: "+60% damage, +40% damage taken",
	},
	ARItemFrozenHeart: {
		ID: ARItemFrozenHeart, Name: "Frozen Heart",
		Category: ARItemCatEquipment, Rarity: ARRarityRare,
		Desc: "30% chance to freeze attackers on hit",
	},
	ARItemLuckyClover: {
		ID: ARItemLuckyClover, Name: "Lucky Clover",
		Category: ARItemCatEquipment, Rarity: ARRarityUncommon,
		Desc: "Luck +3 stacks equivalent",
	},
	ARItemTitanBelt: {
		ID: ARItemTitanBelt, Name: "Titan Belt",
		Category: ARItemCatEquipment, Rarity: ARRarityEpic,
		Desc: "+30% HP, +20% size, knockback immune",
	},
}

// ============================================================
// Drop Tables
// ============================================================

// ARDropResult represents a single drop.
type ARDropResult struct {
	ItemID ARItemID
	Pos    ARVec3
}

// MaxEquipmentSlots is the maximum number of equipment a player can wear.
const MaxEquipmentSlots = 3

// ItemPickupRange is the distance at which players collect items.
const ItemPickupRange = 2.0

// RollDropsOnDeath determines what drops when an enemy dies.
func RollDropsOnDeath(enemy *AREnemy, pos ARVec3, luckBonus float64) []ARDropResult {
	var drops []ARDropResult

	if enemy.IsElite {
		drops = rollEliteDrops(pos, luckBonus)
	} else {
		drops = rollNormalDrops(pos, luckBonus)
	}

	return drops
}

// RollMinibossDrops returns guaranteed drops from a miniboss.
func RollMinibossDrops(pos ARVec3, luckBonus float64) []ARDropResult {
	// Miniboss: 100% drop — 30% Uncommon, 50% Rare, 15% Epic, 5% Legendary
	roll := rand.Float64() * 100.0
	bonus := luckBonus * 2.0 // luck doubles for miniboss

	var pool []ARItemID

	switch {
	case roll < 5.0+bonus:
		// Legendary — just give best equipment
		pool = []ARItemID{ARItemTitanBelt, ARItemCrownOfThorns, ARItemGlassCannon}
	case roll < 20.0+bonus:
		pool = []ARItemID{ARItemCrownOfThorns, ARItemGlassCannon, ARItemVampireRing, ARItemBerserkerHelm, ARItemFrozenHeart}
	case roll < 70.0+bonus:
		pool = []ARItemID{ARItemVampireRing, ARItemBerserkerHelm, ARItemFrozenHeart, ARItemFeatherCape}
	default:
		pool = []ARItemID{ARItemFeatherCape, ARItemMagnetAmulet, ARItemLuckyClover, ARItemIronBoots}
	}

	if len(pool) == 0 {
		pool = []ARItemID{ARItemIronBoots}
	}

	return []ARDropResult{
		{ItemID: pool[rand.Intn(len(pool))], Pos: pos},
	}
}

func rollNormalDrops(pos ARVec3, luckBonus float64) []ARDropResult {
	// Normal enemy: 90% nothing, 8% Health Orb (small), 2% XP Crystal boost
	roll := rand.Float64() * 100.0
	_ = luckBonus // luck doesn't affect normal drops much

	switch {
	case roll < 2:
		// Drop nothing extra (XP crystal is handled separately)
		return nil
	case roll < 10:
		return []ARDropResult{{ItemID: ARItemHealthOrbSmall, Pos: pos}}
	default:
		return nil
	}
}

func rollEliteDrops(pos ARVec3, luckBonus float64) []ARDropResult {
	// Elite: 40% nothing, 25% Health Orb(large), 15% instant, 15% Common equip, 5% Uncommon equip
	roll := rand.Float64() * 100.0
	bonus := luckBonus

	switch {
	case roll < 5.0+bonus:
		pool := []ARItemID{ARItemFeatherCape, ARItemMagnetAmulet, ARItemLuckyClover}
		return []ARDropResult{{ItemID: pool[rand.Intn(len(pool))], Pos: pos}}
	case roll < 20.0+bonus:
		return []ARDropResult{{ItemID: ARItemIronBoots, Pos: pos}}
	case roll < 35.0+bonus:
		instants := []ARItemID{ARItemSpeedBoost, ARItemBomb, ARItemShieldBurst, ARItemXPMagnet}
		return []ARDropResult{{ItemID: instants[rand.Intn(len(instants))], Pos: pos}}
	case roll < 60.0+bonus:
		return []ARDropResult{{ItemID: ARItemHealthOrbLarge, Pos: pos}}
	default:
		return nil
	}
}

// ============================================================
// Item Application
// ============================================================

// ApplyInstantItem applies an instant-use item effect to a player.
// Returns a list of combat events generated.
func ApplyInstantItem(
	player *ARPlayer,
	itemID ARItemID,
	enemies []*AREnemy,
	crystals []*ARXPCrystal,
) []CombatEvent {
	var events []CombatEvent

	switch itemID {
	case ARItemHealthOrbSmall:
		heal := player.MaxHP * 0.10
		player.HP = math.Min(player.HP+heal, player.MaxHP)
		events = append(events, CombatEvent{
			Type:     "item_use",
			TargetID: player.ID,
			Data:     map[string]interface{}{"item": "health_orb_small", "heal": heal},
		})

	case ARItemHealthOrbLarge:
		heal := player.MaxHP * 0.30
		player.HP = math.Min(player.HP+heal, player.MaxHP)
		events = append(events, CombatEvent{
			Type:     "item_use",
			TargetID: player.ID,
			Data:     map[string]interface{}{"item": "health_orb_large", "heal": heal},
		})

	case ARItemXPMagnet:
		// Collect all crystals
		for _, c := range crystals {
			if c.Alive {
				c.Alive = false
				player.XP += c.Value * player.XPMult
			}
		}
		events = append(events, CombatEvent{
			Type:     "item_use",
			TargetID: player.ID,
			Data:     map[string]interface{}{"item": "xp_magnet"},
		})

	case ARItemSpeedBoost:
		player.SpeedBoostTimer = 15.0
		events = append(events, CombatEvent{
			Type:     "item_use",
			TargetID: player.ID,
			Data:     map[string]interface{}{"item": "speed_boost", "duration": 15.0},
		})

	case ARItemShieldBurst:
		player.ShieldBurstTimer = 5.0
		events = append(events, CombatEvent{
			Type:     "item_use",
			TargetID: player.ID,
			Data:     map[string]interface{}{"item": "shield_burst", "duration": 5.0},
		})

	case ARItemBomb:
		// 25% max HP damage to all enemies within 10m
		bombRadius := 10.0
		bombDmg := player.MaxHP * 0.25
		for _, e := range enemies {
			if !e.Alive {
				continue
			}
			dist := player.Pos.DistTo(e.Pos)
			if dist <= bombRadius {
				e.HP -= bombDmg
				if e.HP < 0 {
					e.HP = 0
				}
			}
		}
		events = append(events, CombatEvent{
			Type:     "item_use",
			TargetID: player.ID,
			Data:     map[string]interface{}{"item": "bomb", "radius": bombRadius},
		})
	}

	return events
}

// EquipItem adds an equipment item to a player's equipment slots.
// Returns false if equipment is full.
func EquipItem(player *ARPlayer, itemID ARItemID) bool {
	if len(player.Equipment) >= MaxEquipmentSlots {
		return false
	}

	// Check for duplicate
	for _, eq := range player.Equipment {
		if eq == itemID {
			return false
		}
	}

	player.Equipment = append(player.Equipment, itemID)
	RecomputeAllStats(player)

	// Special: Titan Belt applies +30% HP immediately
	if itemID == ARItemTitanBelt {
		bonus := player.MaxHP * 0.30
		player.MaxHP += bonus
		player.HP += bonus
	}

	return true
}

// ============================================================
// Field Item Management
// ============================================================

// ARItemSystem manages field items in the arena.
type ARItemSystem struct {
	nextItemID int
}

// NewARItemSystem creates a new item system.
func NewARItemSystem() *ARItemSystem {
	return &ARItemSystem{}
}

// SpawnFieldItem creates a field item at the given position.
func (is *ARItemSystem) SpawnFieldItem(itemID ARItemID, pos ARVec3) *ARFieldItem {
	is.nextItemID++
	return &ARFieldItem{
		ID:     fmt.Sprintf("item_%d", is.nextItemID),
		ItemID: itemID,
		Pos:    pos,
		Alive:  true,
	}
}

// TickItemPickup checks if any player is close enough to pick up items.
func TickItemPickup(
	player *ARPlayer,
	items []*ARFieldItem,
	enemies []*AREnemy,
	crystals []*ARXPCrystal,
) []CombatEvent {
	var events []CombatEvent

	for _, item := range items {
		if !item.Alive {
			continue
		}

		dist := player.Pos.DistTo(item.Pos)
		if dist > ItemPickupRange {
			continue
		}

		def := GetItemDef(item.ItemID)
		if def == nil {
			continue
		}

		switch def.Category {
		case ARItemCatInstant:
			evts := ApplyInstantItem(player, item.ItemID, enemies, crystals)
			events = append(events, evts...)
			item.Alive = false

		case ARItemCatEquipment:
			if EquipItem(player, item.ItemID) {
				events = append(events, CombatEvent{
					Type:     "item_equip",
					TargetID: player.ID,
					Data: map[string]interface{}{
						"item":   string(item.ItemID),
						"name":   def.Name,
						"rarity": string(def.Rarity),
					},
				})
				item.Alive = false
			}
			// If equipment full, item stays on ground
		}
	}

	return events
}
