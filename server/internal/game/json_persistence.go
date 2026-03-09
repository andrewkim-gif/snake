package game

import (
	"encoding/json"
	"log/slog"
	"os"
	"sync"
	"time"
)

// JSONPersistence provides file-based data persistence for token economy data.
// v30 Task 2-10: Supabase 대신 JSON 파일 기반 영속화로 구현합니다.
// 서버 시작 시 JSON 로드, 30분마다 JSON 덤프.

const (
	// DefaultPersistFile is the default file path for JSON persistence.
	DefaultPersistFile = "data/token_economy.json"

	// PersistInterval is how often data is auto-saved.
	PersistInterval = 30 * time.Minute
)

// PersistentData holds all token economy data that needs to survive server restarts.
type PersistentData struct {
	// Player AWW balances
	PlayerBalances map[string]float64 `json:"playerBalances"`

	// Reward history (recent N entries)
	RewardHistory []TokenRewardEvent `json:"rewardHistory"`

	// Ramp balances (player -> credit balance)
	RampBalances map[string]float64 `json:"rampBalances"`

	// Staking data
	StakingData map[string]*SeasonStakeData `json:"stakingData,omitempty"`

	// Burn total tracking
	TotalBurned float64 `json:"totalBurned"`

	// Last saved timestamp
	SavedAt int64 `json:"savedAt"`
}

// SeasonStakeData holds a player's staking information (for persistence).
type SeasonStakeData struct {
	Amount     float64 `json:"amount"`
	StakedAt   int64   `json:"stakedAt"`
	SeasonID   string  `json:"seasonId"`
	Multiplier float64 `json:"multiplier"`
}

// JSONPersistenceManager manages loading and saving token economy data.
type JSONPersistenceManager struct {
	mu       sync.RWMutex
	filePath string
	data     PersistentData
	stopChan chan struct{}
}

// NewJSONPersistenceManager creates a new persistence manager.
func NewJSONPersistenceManager(filePath string) *JSONPersistenceManager {
	if filePath == "" {
		filePath = DefaultPersistFile
	}
	return &JSONPersistenceManager{
		filePath: filePath,
		data: PersistentData{
			PlayerBalances: make(map[string]float64),
			RewardHistory:  make([]TokenRewardEvent, 0),
			RampBalances:   make(map[string]float64),
			StakingData:    make(map[string]*SeasonStakeData),
		},
		stopChan: make(chan struct{}),
	}
}

// Load reads data from the JSON file. Returns false if file does not exist.
func (pm *JSONPersistenceManager) Load() bool {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	fileData, err := os.ReadFile(pm.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			slog.Info("[JSONPersistence] No existing data file, starting fresh", "path", pm.filePath)
			return false
		}
		slog.Error("[JSONPersistence] Failed to read data file", "error", err, "path", pm.filePath)
		return false
	}

	var loaded PersistentData
	if err := json.Unmarshal(fileData, &loaded); err != nil {
		slog.Error("[JSONPersistence] Failed to parse data file", "error", err, "path", pm.filePath)
		return false
	}

	// Initialize nil maps
	if loaded.PlayerBalances == nil {
		loaded.PlayerBalances = make(map[string]float64)
	}
	if loaded.RewardHistory == nil {
		loaded.RewardHistory = make([]TokenRewardEvent, 0)
	}
	if loaded.RampBalances == nil {
		loaded.RampBalances = make(map[string]float64)
	}
	if loaded.StakingData == nil {
		loaded.StakingData = make(map[string]*SeasonStakeData)
	}

	pm.data = loaded
	slog.Info("[JSONPersistence] Data loaded successfully",
		"players", len(loaded.PlayerBalances),
		"rewards", len(loaded.RewardHistory),
		"rampBalances", len(loaded.RampBalances),
		"savedAt", time.UnixMilli(loaded.SavedAt).Format(time.RFC3339),
	)
	return true
}

// Save writes data to the JSON file.
func (pm *JSONPersistenceManager) Save() error {
	pm.mu.RLock()
	dataCopy := pm.data
	dataCopy.SavedAt = time.Now().UnixMilli()
	pm.mu.RUnlock()

	fileData, err := json.MarshalIndent(dataCopy, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := pm.filePath
	for i := len(dir) - 1; i >= 0; i-- {
		if dir[i] == '/' || dir[i] == '\\' {
			dir = dir[:i]
			break
		}
	}
	if dir != pm.filePath {
		os.MkdirAll(dir, 0755)
	}

	if err := os.WriteFile(pm.filePath, fileData, 0644); err != nil {
		return err
	}

	slog.Info("[JSONPersistence] Data saved",
		"players", len(dataCopy.PlayerBalances),
		"rewards", len(dataCopy.RewardHistory),
		"path", pm.filePath,
	)
	return nil
}

// StartAutoSave begins the 30-minute auto-save loop.
func (pm *JSONPersistenceManager) StartAutoSave() {
	go func() {
		ticker := time.NewTicker(PersistInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := pm.Save(); err != nil {
					slog.Error("[JSONPersistence] Auto-save failed", "error", err)
				}
			case <-pm.stopChan:
				// Final save on shutdown
				if err := pm.Save(); err != nil {
					slog.Error("[JSONPersistence] Shutdown save failed", "error", err)
				}
				return
			}
		}
	}()
	slog.Info("[JSONPersistence] Auto-save started", "interval", PersistInterval)
}

// Stop stops the auto-save loop and performs a final save.
func (pm *JSONPersistenceManager) Stop() {
	close(pm.stopChan)
}

// --- Data Access Methods ---

// GetPlayerBalance returns a player's AWW balance.
func (pm *JSONPersistenceManager) GetPlayerBalance(playerID string) float64 {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.data.PlayerBalances[playerID]
}

// SetPlayerBalance sets a player's AWW balance.
func (pm *JSONPersistenceManager) SetPlayerBalance(playerID string, balance float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.data.PlayerBalances[playerID] = balance
}

// AddPlayerBalance adds to a player's AWW balance.
func (pm *JSONPersistenceManager) AddPlayerBalance(playerID string, amount float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.data.PlayerBalances[playerID] += amount
}

// GetAllBalances returns a copy of all player balances.
func (pm *JSONPersistenceManager) GetAllBalances() map[string]float64 {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	result := make(map[string]float64, len(pm.data.PlayerBalances))
	for k, v := range pm.data.PlayerBalances {
		result[k] = v
	}
	return result
}

// AppendRewardHistory adds a reward event to the history.
func (pm *JSONPersistenceManager) AppendRewardHistory(event TokenRewardEvent) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	const maxHistory = 5000
	pm.data.RewardHistory = append(pm.data.RewardHistory, event)
	if len(pm.data.RewardHistory) > maxHistory {
		pm.data.RewardHistory = pm.data.RewardHistory[len(pm.data.RewardHistory)-maxHistory:]
	}
}

// GetRewardHistory returns reward history for a player.
func (pm *JSONPersistenceManager) GetRewardHistory(playerID string, limit int) []TokenRewardEvent {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	var result []TokenRewardEvent
	for i := len(pm.data.RewardHistory) - 1; i >= 0 && len(result) < limit; i-- {
		if pm.data.RewardHistory[i].PlayerID == playerID {
			result = append(result, pm.data.RewardHistory[i])
		}
	}
	return result
}

// SetRampBalance sets a player's Ramp credit balance.
func (pm *JSONPersistenceManager) SetRampBalance(playerID string, balance float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.data.RampBalances[playerID] = balance
}

// GetRampBalance returns a player's Ramp credit balance.
func (pm *JSONPersistenceManager) GetRampBalance(playerID string) float64 {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.data.RampBalances[playerID]
}

// SetStakingData sets a player's staking data.
func (pm *JSONPersistenceManager) SetStakingData(playerID string, data *SeasonStakeData) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if data == nil {
		delete(pm.data.StakingData, playerID)
	} else {
		pm.data.StakingData[playerID] = data
	}
}

// GetStakingData returns a player's staking data.
func (pm *JSONPersistenceManager) GetStakingData(playerID string) *SeasonStakeData {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	if sd, ok := pm.data.StakingData[playerID]; ok {
		copied := *sd
		return &copied
	}
	return nil
}

// GetAllStakingData returns all staking data.
func (pm *JSONPersistenceManager) GetAllStakingData() map[string]*SeasonStakeData {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	result := make(map[string]*SeasonStakeData, len(pm.data.StakingData))
	for k, v := range pm.data.StakingData {
		copied := *v
		result[k] = &copied
	}
	return result
}

// AddTotalBurned increments the total burned amount.
func (pm *JSONPersistenceManager) AddTotalBurned(amount float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.data.TotalBurned += amount
}

// GetTotalBurned returns the total burned amount.
func (pm *JSONPersistenceManager) GetTotalBurned() float64 {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.data.TotalBurned
}

// SyncFromAWWBalance loads balances from PlayerAWWBalance into persistence.
func (pm *JSONPersistenceManager) SyncFromAWWBalance(awwBalance *PlayerAWWBalance) {
	if awwBalance == nil {
		return
	}
	awwBalance.mu.RLock()
	defer awwBalance.mu.RUnlock()
	pm.mu.Lock()
	defer pm.mu.Unlock()
	for k, v := range awwBalance.balances {
		pm.data.PlayerBalances[k] = v
	}
}

// SyncToAWWBalance loads balances from persistence into PlayerAWWBalance.
func (pm *JSONPersistenceManager) SyncToAWWBalance(awwBalance *PlayerAWWBalance) {
	if awwBalance == nil {
		return
	}
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	awwBalance.mu.Lock()
	defer awwBalance.mu.Unlock()
	for k, v := range pm.data.PlayerBalances {
		awwBalance.balances[k] = v
	}
}
