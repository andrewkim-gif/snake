package game

// ============================================================
// v39 Phase 5 — Resource Distribution: 지역별 자원 분배 로직
//
// 국가 특산 자원 우선 배치 (70% 특산, 30% 공통) 규칙과
// 지역 유형에 따른 자원 밀도 차등을 구현한다.
//
// COUNTRY_SPECIALTY 매핑 활용 (region-data.ts 서버 미러).
// ============================================================

// ── 국가별 특산 자원 매핑 (region-data.ts 동기화) ──

// CountrySpecialty maps ISO3 country codes to their specialty resource name.
var CountrySpecialty = map[string]string{
	// S 티어
	"USA": "oil", "CHN": "rare_earth", "RUS": "natural_gas", "IND": "spices",
	"JPN": "automobile", "DEU": "precision_machinery", "GBR": "finance", "FRA": "luxury_goods",
	// A 티어
	"KOR": "semiconductor", "BRA": "biofuel", "CAN": "timber", "AUS": "iron_ore",
	"ITA": "fashion", "TUR": "textiles", "SAU": "crude_oil", "MEX": "silver",
	"IDN": "palm_oil", "ESP": "olive_oil", "NLD": "tulips", "POL": "copper",
	"ARG": "beef", "ZAF": "diamond", "EGY": "cotton", "PAK": "rice",
	"NGA": "crude_oil", "IRN": "saffron", "ISR": "tech_startup", "UKR": "wheat",
	// B 티어 (일부)
	"THA": "rubber", "VNM": "coffee", "MYS": "tin", "PHL": "coconut",
	"SGP": "electronics", "TWN": "semiconductor", "SWE": "iron_ore", "NOR": "salmon",
	"CHE": "watches", "AUT": "crystal", "BEL": "chocolate", "CZE": "beer",
	"ROU": "wood", "PRT": "cork", "GRC": "marble", "HUN": "paprika",
	"DNK": "wind_energy", "FIN": "paper", "IRL": "whiskey", "NZL": "wool",
	"CHL": "copper", "COL": "emerald", "PER": "gold", "VEN": "oil",
	"BGD": "jute", "LKA": "tea", "MMR": "jade", "KAZ": "uranium",
	"UZB": "cotton", "ETH": "coffee", "KEN": "tea", "TZA": "tanzanite",
	"MAR": "phosphate", "DZA": "natural_gas", "IRQ": "oil", "CUB": "sugar",
	"PRK": "coal", "SRB": "raspberry", "BGR": "rose_oil", "SVK": "cars",
}

// GetCountrySpecialty returns the specialty resource for a country code.
// Falls back to "generic" if the country has no defined specialty.
func GetCountrySpecialty(countryCode string) string {
	if s, ok := CountrySpecialty[countryCode]; ok {
		return s
	}
	return "generic"
}

// ── 지역 유형 → 주요 자원 매핑 ──

// RegionTypePrimaryResource maps region types to their primary basic resource.
var RegionTypePrimaryResource = map[RegionType]ResourceType{
	RegionCapital:      ResourceTech,
	RegionIndustrial:   ResourceMinerals,
	RegionPort:         ResourceGold,
	RegionAgricultural: ResourceFood,
	RegionMilitary:     ResourceOil,
	RegionResource:     ResourceMinerals, // Minerals + Oil 혼합
	RegionCultural:     ResourceInfluence,
}

// GetPrimaryResourceForRegion returns the primary basic resource for a region type.
func GetPrimaryResourceForRegion(regionType RegionType) ResourceType {
	if r, ok := RegionTypePrimaryResource[regionType]; ok {
		return r
	}
	return ResourceMinerals // fallback
}

// ── 지역 유형별 자원 밀도 ──

// RegionResourceDensity defines how many resource nodes each region type gets
// as a multiplier of the base config (BasicNodes + SpecialtyNodes).
var RegionResourceDensity = map[RegionType]float64{
	RegionResource:     1.5, // 자원 지역 = 높음
	RegionIndustrial:   1.2, // 산업 지역 = 약간 높음
	RegionPort:         1.1, // 항구 지역
	RegionAgricultural: 1.0, // 농업 = 보통
	RegionMilitary:     0.9, // 군사 = 약간 낮음
	RegionCultural:     0.8, // 문화 = 낮음
	RegionCapital:      0.7, // 수도 = 가장 낮음 (PvP 집중)
}

// GetResourceDensity returns the density multiplier for a region type.
func GetResourceDensity(regionType RegionType) float64 {
	if d, ok := RegionResourceDensity[regionType]; ok {
		return d
	}
	return 1.0
}

// ── ResourceSpawner 팩토리 ──

// CreateRegionResourceSpawner creates a ResourceSpawner configured for a specific region.
// Uses COUNTRY_SPECIALTY mapping and region type density rules.
func CreateRegionResourceSpawner(regionDef RegionDef) *ResourceSpawner {
	specialty := GetCountrySpecialty(regionDef.CountryCode)
	if regionDef.SpecialtyResource != "" {
		specialty = regionDef.SpecialtyResource
	}

	// 지역 효과에서 채취 속도 배율 추출
	gatherRate := regionDef.Effects.ResourceGatherRate
	if gatherRate <= 0 {
		gatherRate = 1.0
	}

	// 스폰 설정 — 지역 유형별 밀도 반영
	density := GetResourceDensity(regionDef.Type)
	baseConfig := DefaultResourceSpawnConfig()

	config := ResourceSpawnConfig{
		BasicNodes:      int(float64(baseConfig.BasicNodes) * density),
		SpecialtyNodes:  int(float64(baseConfig.SpecialtyNodes) * density),
		RespawnInterval: baseConfig.RespawnInterval,
		GatherDuration:  baseConfig.GatherDuration,
		MaxPerPlayer:    baseConfig.MaxPerPlayer,
	}

	// 최소 노드 보장
	if config.BasicNodes < 5 {
		config.BasicNodes = 5
	}
	if config.SpecialtyNodes < 2 {
		config.SpecialtyNodes = 2
	}

	// 자원 지역은 특산 노드 추가 보너스
	if regionDef.Type == RegionResource {
		config.SpecialtyNodes += 2
	}

	spawner := NewResourceSpawner(ResourceSpawnerConfig{
		RegionId:      regionDef.RegionId,
		CountryCode:   regionDef.CountryCode,
		SpecialtyType: specialty,
		RegionType:    regionDef.Type,
		ArenaSize:     regionDef.ArenaSize,
		GatherRate:    gatherRate,
		SpawnConfig:   config,
	})

	return spawner
}

// ── 공통 자원 풀 (30% 배분용) ──

// CommonResourcePool is the list of 6 basic resource types
// used for the 30% common resource allocation.
var CommonResourcePool = []ResourceType{
	ResourceTech,
	ResourceMinerals,
	ResourceGold,
	ResourceFood,
	ResourceOil,
	ResourceInfluence,
}

// ── 밸런싱 상수 ──

const (
	// SpecialtyRatio is the fraction of resource nodes that are specialty (70%).
	SpecialtyRatio = 0.7

	// CommonRatio is the fraction of resource nodes that are common (30%).
	CommonRatio = 0.3

	// MinNodesPerRegion is the absolute minimum number of resource nodes.
	MinNodesPerRegion = 5

	// MaxNodesPerRegion is the absolute maximum to prevent server overload.
	MaxNodesPerRegion = 40
)

// ── 통합 자원 분배 계산 ──

// CalculateDistribution computes the exact node counts for a region.
// Returns (specialtyCount, commonCount, totalCount).
func CalculateDistribution(regionType RegionType, baseConfig ResourceSpawnConfig) (int, int, int) {
	density := GetResourceDensity(regionType)
	total := int(float64(baseConfig.BasicNodes+baseConfig.SpecialtyNodes) * density)

	// 범위 제한
	if total < MinNodesPerRegion {
		total = MinNodesPerRegion
	}
	if total > MaxNodesPerRegion {
		total = MaxNodesPerRegion
	}

	specialtyCount := int(float64(total) * SpecialtyRatio)
	commonCount := total - specialtyCount

	if specialtyCount < 2 {
		specialtyCount = 2
	}
	if commonCount < 2 {
		commonCount = 2
	}

	return specialtyCount, commonCount, specialtyCount + commonCount
}
