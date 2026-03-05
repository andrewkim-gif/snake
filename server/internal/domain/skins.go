package domain

// DefaultSkins defines 24 agent skins (12 solid + 12 patterned).
// Matches the TS DEFAULT_SKINS in packages/shared/src/constants/game.ts.
var DefaultSkins = []AgentSkin{
	// 0-11: Solid skins
	{ID: 0, Name: "Crimson", PrimaryColor: "#C75B5B", SecondaryColor: "#D48A8A", Pattern: "solid", EyeStyle: "dot"},
	{ID: 1, Name: "Amber", PrimaryColor: "#D4914A", SecondaryColor: "#DFB07A", Pattern: "solid", EyeStyle: "default"},
	{ID: 2, Name: "Cerulean", PrimaryColor: "#5B8DAD", SecondaryColor: "#8AB4CC", Pattern: "solid", EyeStyle: "cute"},
	{ID: 3, Name: "Sage", PrimaryColor: "#7BA868", SecondaryColor: "#9FC490", Pattern: "solid", EyeStyle: "dot"},
	{ID: 4, Name: "Amethyst", PrimaryColor: "#8B72A8", SecondaryColor: "#AE9AC4", Pattern: "solid", EyeStyle: "wink"},
	{ID: 5, Name: "Goldenrod", PrimaryColor: "#D4C36A", SecondaryColor: "#E0D494", Pattern: "solid", EyeStyle: "default"},
	{ID: 6, Name: "Rose", PrimaryColor: "#C47A8E", SecondaryColor: "#D4A0AE", Pattern: "solid", EyeStyle: "angry"},
	{ID: 7, Name: "Mint", PrimaryColor: "#7DB89A", SecondaryColor: "#A0D0B8", Pattern: "solid", EyeStyle: "cool"},
	{ID: 8, Name: "Sky", PrimaryColor: "#82ADC8", SecondaryColor: "#A8C8DA", Pattern: "solid", EyeStyle: "cute"},
	{ID: 9, Name: "Chestnut", PrimaryColor: "#B8926A", SecondaryColor: "#D0B090", Pattern: "solid", EyeStyle: "dot"},
	{ID: 10, Name: "Khaki", PrimaryColor: "#A89070", SecondaryColor: "#C0AC94", Pattern: "solid", EyeStyle: "wink"},
	{ID: 11, Name: "Forest", PrimaryColor: "#6A9B7E", SecondaryColor: "#90B8A0", Pattern: "solid", EyeStyle: "default"},

	// 12-23: Patterned skins
	{ID: 12, Name: "Firestripe", PrimaryColor: "#C75B5B", SecondaryColor: "#D4C36A", Pattern: "striped", EyeStyle: "cute", AccentColor: ""},
	{ID: 13, Name: "Sunset Arrow", PrimaryColor: "#D4914A", SecondaryColor: "#C47A8E", Pattern: "striped", EyeStyle: "angry", AccentColor: ""},
	{ID: 14, Name: "Ocean Mist", PrimaryColor: "#5B8DAD", SecondaryColor: "#8B72A8", Pattern: "gradient", EyeStyle: "dot", AccentColor: ""},
	{ID: 15, Name: "Meadow Glow", PrimaryColor: "#7BA868", SecondaryColor: "#D4C36A", Pattern: "gradient", EyeStyle: "wink", AccentColor: ""},
	{ID: 16, Name: "Cosmic Dot", PrimaryColor: "#8B72A8", SecondaryColor: "#C75B5B", Pattern: "dotted", EyeStyle: "cute", AccentColor: ""},
	{ID: 17, Name: "Sandy Cool", PrimaryColor: "#D4C36A", SecondaryColor: "#D4914A", Pattern: "dotted", EyeStyle: "cool", AccentColor: ""},
	{ID: 18, Name: "Teal Stripe", PrimaryColor: "#7DB89A", SecondaryColor: "#5B8DAD", Pattern: "striped", EyeStyle: "dot", AccentColor: ""},
	{ID: 19, Name: "Berry Fade", PrimaryColor: "#C47A8E", SecondaryColor: "#8B72A8", Pattern: "gradient", EyeStyle: "angry", AccentColor: ""},
	{ID: 20, Name: "Spring Dots", PrimaryColor: "#82ADC8", SecondaryColor: "#7BA868", Pattern: "dotted", EyeStyle: "wink", AccentColor: ""},
	{ID: 21, Name: "Earth Stripe", PrimaryColor: "#A89070", SecondaryColor: "#D4914A", Pattern: "striped", EyeStyle: "cute", AccentColor: ""},
	{ID: 22, Name: "Pine Gradient", PrimaryColor: "#6A9B7E", SecondaryColor: "#D4C36A", Pattern: "gradient", EyeStyle: "default", AccentColor: ""},
	{ID: 23, Name: "Dusk Dots", PrimaryColor: "#B8926A", SecondaryColor: "#5B8DAD", Pattern: "dotted", EyeStyle: "dot", AccentColor: ""},
}

// GetSkinByID returns the skin with the given ID, or the default skin (0) if not found.
func GetSkinByID(id int) AgentSkin {
	if id >= 0 && id < len(DefaultSkins) {
		return DefaultSkins[id]
	}
	return DefaultSkins[0]
}
