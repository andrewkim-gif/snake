package game

import (
	"math/rand"
	"time"
)

// CountryData holds metadata about a country for arena generation.
type CountryData struct {
	ISO3       string
	Name       string
	Tier       int   // 1=major power, 2=significant, 3=moderate, 4=small
	Population int64 // approximate
	MaxAgents  int   // max concurrent agents
}

// CalcMaxAgents computes the maximum number of agents for a country based on tier and population.
func CalcMaxAgents(tier int, pop int64) int {
	base := 20
	switch tier {
	case 1:
		base = 100
	case 2:
		base = 60
	case 3:
		base = 40
	}
	bonus := int(pop / 100_000_000 * 20)
	if bonus > 50 {
		bonus = 50
	}
	total := base + bonus
	if total < 15 {
		return 15
	}
	if total > 150 {
		return 150
	}
	return total
}

// SelectRandomCountries picks n random countries from the pool using Fisher-Yates shuffle.
func SelectRandomCountries(n int) []CountryData {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	pool := make([]CountryData, len(allCountries))
	copy(pool, allCountries)

	for i := len(pool) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		pool[i], pool[j] = pool[j], pool[i]
	}

	if n > len(pool) {
		n = len(pool)
	}
	return pool[:n]
}

func init() {
	for i := range allCountries {
		allCountries[i].MaxAgents = CalcMaxAgents(allCountries[i].Tier, allCountries[i].Population)
	}
}

// allCountries contains 195 UN-recognized countries.
var allCountries = []CountryData{
	// ── Tier 1: Major Powers (30) ──
	{ISO3: "USA", Name: "United States", Tier: 1, Population: 331_000_000},
	{ISO3: "CHN", Name: "China", Tier: 1, Population: 1_412_000_000},
	{ISO3: "IND", Name: "India", Tier: 1, Population: 1_408_000_000},
	{ISO3: "GBR", Name: "United Kingdom", Tier: 1, Population: 67_000_000},
	{ISO3: "FRA", Name: "France", Tier: 1, Population: 67_000_000},
	{ISO3: "DEU", Name: "Germany", Tier: 1, Population: 83_000_000},
	{ISO3: "JPN", Name: "Japan", Tier: 1, Population: 125_000_000},
	{ISO3: "KOR", Name: "South Korea", Tier: 1, Population: 51_000_000},
	{ISO3: "RUS", Name: "Russia", Tier: 1, Population: 144_000_000},
	{ISO3: "BRA", Name: "Brazil", Tier: 1, Population: 214_000_000},
	{ISO3: "CAN", Name: "Canada", Tier: 1, Population: 38_000_000},
	{ISO3: "AUS", Name: "Australia", Tier: 1, Population: 26_000_000},
	{ISO3: "ITA", Name: "Italy", Tier: 1, Population: 59_000_000},
	{ISO3: "ESP", Name: "Spain", Tier: 1, Population: 47_000_000},
	{ISO3: "MEX", Name: "Mexico", Tier: 1, Population: 128_000_000},
	{ISO3: "IDN", Name: "Indonesia", Tier: 1, Population: 273_000_000},
	{ISO3: "TUR", Name: "Turkey", Tier: 1, Population: 85_000_000},
	{ISO3: "SAU", Name: "Saudi Arabia", Tier: 1, Population: 35_000_000},
	{ISO3: "NLD", Name: "Netherlands", Tier: 1, Population: 17_000_000},
	{ISO3: "CHE", Name: "Switzerland", Tier: 1, Population: 9_000_000},
	{ISO3: "POL", Name: "Poland", Tier: 1, Population: 38_000_000},
	{ISO3: "SWE", Name: "Sweden", Tier: 1, Population: 10_000_000},
	{ISO3: "NOR", Name: "Norway", Tier: 1, Population: 5_000_000},
	{ISO3: "ARG", Name: "Argentina", Tier: 1, Population: 46_000_000},
	{ISO3: "NGA", Name: "Nigeria", Tier: 1, Population: 218_000_000},
	{ISO3: "EGY", Name: "Egypt", Tier: 1, Population: 104_000_000},
	{ISO3: "ISR", Name: "Israel", Tier: 1, Population: 9_000_000},
	{ISO3: "ZAF", Name: "South Africa", Tier: 1, Population: 60_000_000},
	{ISO3: "ARE", Name: "United Arab Emirates", Tier: 1, Population: 10_000_000},
	{ISO3: "THA", Name: "Thailand", Tier: 1, Population: 72_000_000},

	// ── Tier 2: Significant (50) ──
	{ISO3: "PAK", Name: "Pakistan", Tier: 2, Population: 231_000_000},
	{ISO3: "BGD", Name: "Bangladesh", Tier: 2, Population: 169_000_000},
	{ISO3: "VNM", Name: "Vietnam", Tier: 2, Population: 98_000_000},
	{ISO3: "PHL", Name: "Philippines", Tier: 2, Population: 113_000_000},
	{ISO3: "ETH", Name: "Ethiopia", Tier: 2, Population: 120_000_000},
	{ISO3: "COD", Name: "DR Congo", Tier: 2, Population: 99_000_000},
	{ISO3: "IRN", Name: "Iran", Tier: 2, Population: 87_000_000},
	{ISO3: "COL", Name: "Colombia", Tier: 2, Population: 52_000_000},
	{ISO3: "MYS", Name: "Malaysia", Tier: 2, Population: 33_000_000},
	{ISO3: "PER", Name: "Peru", Tier: 2, Population: 34_000_000},
	{ISO3: "UKR", Name: "Ukraine", Tier: 2, Population: 44_000_000},
	{ISO3: "IRQ", Name: "Iraq", Tier: 2, Population: 42_000_000},
	{ISO3: "TZA", Name: "Tanzania", Tier: 2, Population: 63_000_000},
	{ISO3: "KEN", Name: "Kenya", Tier: 2, Population: 54_000_000},
	{ISO3: "MMR", Name: "Myanmar", Tier: 2, Population: 54_000_000},
	{ISO3: "GHA", Name: "Ghana", Tier: 2, Population: 32_000_000},
	{ISO3: "MOZ", Name: "Mozambique", Tier: 2, Population: 32_000_000},
	{ISO3: "AGO", Name: "Angola", Tier: 2, Population: 34_000_000},
	{ISO3: "CHL", Name: "Chile", Tier: 2, Population: 19_000_000},
	{ISO3: "ROU", Name: "Romania", Tier: 2, Population: 19_000_000},
	{ISO3: "KAZ", Name: "Kazakhstan", Tier: 2, Population: 19_000_000},
	{ISO3: "CZE", Name: "Czechia", Tier: 2, Population: 11_000_000},
	{ISO3: "PRT", Name: "Portugal", Tier: 2, Population: 10_000_000},
	{ISO3: "HUN", Name: "Hungary", Tier: 2, Population: 10_000_000},
	{ISO3: "BEL", Name: "Belgium", Tier: 2, Population: 12_000_000},
	{ISO3: "GRC", Name: "Greece", Tier: 2, Population: 10_000_000},
	{ISO3: "AUT", Name: "Austria", Tier: 2, Population: 9_000_000},
	{ISO3: "DNK", Name: "Denmark", Tier: 2, Population: 6_000_000},
	{ISO3: "FIN", Name: "Finland", Tier: 2, Population: 6_000_000},
	{ISO3: "SGP", Name: "Singapore", Tier: 2, Population: 6_000_000},
	{ISO3: "IRL", Name: "Ireland", Tier: 2, Population: 5_000_000},
	{ISO3: "NZL", Name: "New Zealand", Tier: 2, Population: 5_000_000},
	{ISO3: "UZB", Name: "Uzbekistan", Tier: 2, Population: 35_000_000},
	{ISO3: "MAR", Name: "Morocco", Tier: 2, Population: 37_000_000},
	{ISO3: "SDN", Name: "Sudan", Tier: 2, Population: 45_000_000},
	{ISO3: "CMR", Name: "Cameroon", Tier: 2, Population: 28_000_000},
	{ISO3: "CIV", Name: "Ivory Coast", Tier: 2, Population: 28_000_000},
	{ISO3: "VEN", Name: "Venezuela", Tier: 2, Population: 28_000_000},
	{ISO3: "NPL", Name: "Nepal", Tier: 2, Population: 30_000_000},
	{ISO3: "ECU", Name: "Ecuador", Tier: 2, Population: 18_000_000},
	{ISO3: "GTM", Name: "Guatemala", Tier: 2, Population: 18_000_000},
	{ISO3: "SYR", Name: "Syria", Tier: 2, Population: 22_000_000},
	{ISO3: "SEN", Name: "Senegal", Tier: 2, Population: 17_000_000},
	{ISO3: "ZMB", Name: "Zambia", Tier: 2, Population: 20_000_000},
	{ISO3: "ZWE", Name: "Zimbabwe", Tier: 2, Population: 16_000_000},
	{ISO3: "TWN", Name: "Taiwan", Tier: 2, Population: 24_000_000},
	{ISO3: "CUB", Name: "Cuba", Tier: 2, Population: 11_000_000},
	{ISO3: "TUN", Name: "Tunisia", Tier: 2, Population: 12_000_000},
	{ISO3: "DOM", Name: "Dominican Republic", Tier: 2, Population: 11_000_000},
	{ISO3: "BOL", Name: "Bolivia", Tier: 2, Population: 12_000_000},

	// ── Tier 3: Moderate (65) ──
	{ISO3: "PRY", Name: "Paraguay", Tier: 3, Population: 7_000_000},
	{ISO3: "SOM", Name: "Somalia", Tier: 3, Population: 17_000_000},
	{ISO3: "TCD", Name: "Chad", Tier: 3, Population: 17_000_000},
	{ISO3: "GIN", Name: "Guinea", Tier: 3, Population: 13_000_000},
	{ISO3: "RWA", Name: "Rwanda", Tier: 3, Population: 13_000_000},
	{ISO3: "BEN", Name: "Benin", Tier: 3, Population: 13_000_000},
	{ISO3: "BDI", Name: "Burundi", Tier: 3, Population: 12_000_000},
	{ISO3: "HND", Name: "Honduras", Tier: 3, Population: 10_000_000},
	{ISO3: "SSD", Name: "South Sudan", Tier: 3, Population: 11_000_000},
	{ISO3: "TJK", Name: "Tajikistan", Tier: 3, Population: 10_000_000},
	{ISO3: "SRB", Name: "Serbia", Tier: 3, Population: 7_000_000},
	{ISO3: "BGR", Name: "Bulgaria", Tier: 3, Population: 7_000_000},
	{ISO3: "LAO", Name: "Laos", Tier: 3, Population: 7_000_000},
	{ISO3: "LBY", Name: "Libya", Tier: 3, Population: 7_000_000},
	{ISO3: "JOR", Name: "Jordan", Tier: 3, Population: 11_000_000},
	{ISO3: "PNG", Name: "Papua New Guinea", Tier: 3, Population: 10_000_000},
	{ISO3: "SLV", Name: "El Salvador", Tier: 3, Population: 6_000_000},
	{ISO3: "NIC", Name: "Nicaragua", Tier: 3, Population: 7_000_000},
	{ISO3: "KGZ", Name: "Kyrgyzstan", Tier: 3, Population: 7_000_000},
	{ISO3: "TKM", Name: "Turkmenistan", Tier: 3, Population: 6_000_000},
	{ISO3: "HRV", Name: "Croatia", Tier: 3, Population: 4_000_000},
	{ISO3: "LBN", Name: "Lebanon", Tier: 3, Population: 5_000_000},
	{ISO3: "CRI", Name: "Costa Rica", Tier: 3, Population: 5_000_000},
	{ISO3: "SVK", Name: "Slovakia", Tier: 3, Population: 5_000_000},
	{ISO3: "PAN", Name: "Panama", Tier: 3, Population: 4_000_000},
	{ISO3: "LTU", Name: "Lithuania", Tier: 3, Population: 3_000_000},
	{ISO3: "LVA", Name: "Latvia", Tier: 3, Population: 2_000_000},
	{ISO3: "URY", Name: "Uruguay", Tier: 3, Population: 4_000_000},
	{ISO3: "GEO", Name: "Georgia", Tier: 3, Population: 4_000_000},
	{ISO3: "BIH", Name: "Bosnia and Herzegovina", Tier: 3, Population: 3_000_000},
	{ISO3: "ALB", Name: "Albania", Tier: 3, Population: 3_000_000},
	{ISO3: "MNG", Name: "Mongolia", Tier: 3, Population: 3_000_000},
	{ISO3: "ARM", Name: "Armenia", Tier: 3, Population: 3_000_000},
	{ISO3: "JAM", Name: "Jamaica", Tier: 3, Population: 3_000_000},
	{ISO3: "QAT", Name: "Qatar", Tier: 3, Population: 3_000_000},
	{ISO3: "BHR", Name: "Bahrain", Tier: 3, Population: 2_000_000},
	{ISO3: "NAM", Name: "Namibia", Tier: 3, Population: 3_000_000},
	{ISO3: "BWA", Name: "Botswana", Tier: 3, Population: 2_000_000},
	{ISO3: "EST", Name: "Estonia", Tier: 3, Population: 1_000_000},
	{ISO3: "MKD", Name: "North Macedonia", Tier: 3, Population: 2_000_000},
	{ISO3: "SVN", Name: "Slovenia", Tier: 3, Population: 2_000_000},
	{ISO3: "MLI", Name: "Mali", Tier: 3, Population: 22_000_000},
	{ISO3: "BFA", Name: "Burkina Faso", Tier: 3, Population: 22_000_000},
	{ISO3: "NER", Name: "Niger", Tier: 3, Population: 26_000_000},
	{ISO3: "MWI", Name: "Malawi", Tier: 3, Population: 20_000_000},
	{ISO3: "MDG", Name: "Madagascar", Tier: 3, Population: 29_000_000},
	{ISO3: "AFG", Name: "Afghanistan", Tier: 3, Population: 40_000_000},
	{ISO3: "YEM", Name: "Yemen", Tier: 3, Population: 33_000_000},
	{ISO3: "KHM", Name: "Cambodia", Tier: 3, Population: 17_000_000},
	{ISO3: "OMN", Name: "Oman", Tier: 3, Population: 5_000_000},
	{ISO3: "KWT", Name: "Kuwait", Tier: 3, Population: 4_000_000},
	{ISO3: "HTI", Name: "Haiti", Tier: 3, Population: 12_000_000},
	{ISO3: "PRK", Name: "North Korea", Tier: 3, Population: 26_000_000},
	{ISO3: "LKA", Name: "Sri Lanka", Tier: 3, Population: 22_000_000},
	{ISO3: "TGO", Name: "Togo", Tier: 3, Population: 9_000_000},
	{ISO3: "SLE", Name: "Sierra Leone", Tier: 3, Population: 8_000_000},
	{ISO3: "LBR", Name: "Liberia", Tier: 3, Population: 5_000_000},
	{ISO3: "CAF", Name: "Central African Republic", Tier: 3, Population: 5_000_000},
	{ISO3: "COG", Name: "Republic of Congo", Tier: 3, Population: 6_000_000},
	{ISO3: "ERI", Name: "Eritrea", Tier: 3, Population: 4_000_000},
	{ISO3: "MDA", Name: "Moldova", Tier: 3, Population: 3_000_000},
	{ISO3: "GAB", Name: "Gabon", Tier: 3, Population: 2_000_000},
	{ISO3: "MRT", Name: "Mauritania", Tier: 3, Population: 5_000_000},
	{ISO3: "GNQ", Name: "Equatorial Guinea", Tier: 3, Population: 2_000_000},
	{ISO3: "CYP", Name: "Cyprus", Tier: 3, Population: 1_000_000},

	// ── Tier 4: Small (50) ──
	{ISO3: "TTO", Name: "Trinidad and Tobago", Tier: 4, Population: 1_000_000},
	{ISO3: "FJI", Name: "Fiji", Tier: 4, Population: 900_000},
	{ISO3: "GUY", Name: "Guyana", Tier: 4, Population: 800_000},
	{ISO3: "SUR", Name: "Suriname", Tier: 4, Population: 600_000},
	{ISO3: "MNE", Name: "Montenegro", Tier: 4, Population: 600_000},
	{ISO3: "LUX", Name: "Luxembourg", Tier: 4, Population: 600_000},
	{ISO3: "MLT", Name: "Malta", Tier: 4, Population: 500_000},
	{ISO3: "BRN", Name: "Brunei", Tier: 4, Population: 400_000},
	{ISO3: "BHS", Name: "Bahamas", Tier: 4, Population: 400_000},
	{ISO3: "ISL", Name: "Iceland", Tier: 4, Population: 370_000},
	{ISO3: "MUS", Name: "Mauritius", Tier: 4, Population: 1_300_000},
	{ISO3: "BTN", Name: "Bhutan", Tier: 4, Population: 800_000},
	{ISO3: "GNB", Name: "Guinea-Bissau", Tier: 4, Population: 2_000_000},
	{ISO3: "TLS", Name: "Timor-Leste", Tier: 4, Population: 1_300_000},
	{ISO3: "SWZ", Name: "Eswatini", Tier: 4, Population: 1_200_000},
	{ISO3: "DJI", Name: "Djibouti", Tier: 4, Population: 1_000_000},
	{ISO3: "COM", Name: "Comoros", Tier: 4, Population: 900_000},
	{ISO3: "LSO", Name: "Lesotho", Tier: 4, Population: 2_000_000},
	{ISO3: "GMB", Name: "Gambia", Tier: 4, Population: 2_500_000},
	{ISO3: "CPV", Name: "Cape Verde", Tier: 4, Population: 600_000},
	{ISO3: "BLZ", Name: "Belize", Tier: 4, Population: 400_000},
	{ISO3: "MDV", Name: "Maldives", Tier: 4, Population: 500_000},
	{ISO3: "BRB", Name: "Barbados", Tier: 4, Population: 300_000},
	{ISO3: "VUT", Name: "Vanuatu", Tier: 4, Population: 300_000},
	{ISO3: "WSM", Name: "Samoa", Tier: 4, Population: 200_000},
	{ISO3: "STP", Name: "Sao Tome and Principe", Tier: 4, Population: 200_000},
	{ISO3: "KIR", Name: "Kiribati", Tier: 4, Population: 120_000},
	{ISO3: "FSM", Name: "Micronesia", Tier: 4, Population: 100_000},
	{ISO3: "TON", Name: "Tonga", Tier: 4, Population: 100_000},
	{ISO3: "GRD", Name: "Grenada", Tier: 4, Population: 110_000},
	{ISO3: "KNA", Name: "Saint Kitts and Nevis", Tier: 4, Population: 50_000},
	{ISO3: "VCT", Name: "Saint Vincent", Tier: 4, Population: 110_000},
	{ISO3: "LCA", Name: "Saint Lucia", Tier: 4, Population: 180_000},
	{ISO3: "DMA", Name: "Dominica", Tier: 4, Population: 72_000},
	{ISO3: "ATG", Name: "Antigua and Barbuda", Tier: 4, Population: 100_000},
	{ISO3: "AND", Name: "Andorra", Tier: 4, Population: 80_000},
	{ISO3: "SMR", Name: "San Marino", Tier: 4, Population: 34_000},
	{ISO3: "LIE", Name: "Liechtenstein", Tier: 4, Population: 39_000},
	{ISO3: "MCO", Name: "Monaco", Tier: 4, Population: 39_000},
	{ISO3: "PLW", Name: "Palau", Tier: 4, Population: 18_000},
	{ISO3: "MHL", Name: "Marshall Islands", Tier: 4, Population: 42_000},
	{ISO3: "NRU", Name: "Nauru", Tier: 4, Population: 11_000},
	{ISO3: "TUV", Name: "Tuvalu", Tier: 4, Population: 11_000},
	{ISO3: "VAT", Name: "Vatican City", Tier: 4, Population: 800},
	{ISO3: "SLB", Name: "Solomon Islands", Tier: 4, Population: 700_000},
	{ISO3: "PSE", Name: "Palestine", Tier: 4, Population: 5_000_000},
	{ISO3: "XKX", Name: "Kosovo", Tier: 4, Population: 2_000_000},
	{ISO3: "SYC", Name: "Seychelles", Tier: 4, Population: 100_000},
	{ISO3: "MNP", Name: "Northern Mariana Islands", Tier: 4, Population: 50_000},
	{ISO3: "ASM", Name: "American Samoa", Tier: 4, Population: 55_000},
}
