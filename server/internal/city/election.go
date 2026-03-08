package city

import (
	"fmt"
	"math"
	"math/rand"
)

// ─── Election System Constants ───

const (
	// ElectionCycleTicks is how often elections occur (100 ticks = ~16 minutes at 10s tick).
	ElectionCycleTicks = 100

	// ElectionCampaignTicks is how many ticks the campaign/voting phase lasts.
	ElectionCampaignTicks = 20

	// MaxCandidates is the maximum number of candidates per election.
	MaxCandidates = 4

	// MaxElectionHistory is the number of past elections to keep.
	MaxElectionHistory = 5
)

// ElectionPhase represents the current phase of the election cycle.
type ElectionPhase string

const (
	PhaseNone     ElectionPhase = "none"      // No election in progress
	PhaseCampaign ElectionPhase = "campaign"  // Candidates announced, campaigning
	PhaseVoting   ElectionPhase = "voting"    // Citizens casting votes
	PhaseResults  ElectionPhase = "results"   // Results announced, edicts enacted
)

// ─── Candidate ───

// Candidate represents an election candidate.
type Candidate struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	IsIncumbent  bool          `json:"isIncumbent"`
	FactionAxes  FactionAxes   `json:"factionAxes"`  // Candidate's political stance
	Pledges      []EdictID     `json:"pledges"`       // Edicts to enact if elected
	SupportPct   float64       `json:"supportPct"`    // Current support percentage (0~100)
	Votes        int           `json:"votes"`         // Actual vote count
	PlayerVoted  bool          `json:"playerVoted"`   // Whether player voted for this candidate
}

// ─── Election Record ───

// ElectionRecord holds the result of a completed election.
type ElectionRecord struct {
	Tick       uint64       `json:"tick"`
	WinnerID   string       `json:"winnerId"`
	WinnerName string       `json:"winnerName"`
	Candidates []*Candidate `json:"candidates"`
	TotalVotes int          `json:"totalVotes"`
}

// ─── Candidate Name Generation ───

var candidateFirstNames = []string{
	"Alexander", "Maria", "Viktor", "Elena", "Dmitri",
	"Sofia", "Nikolai", "Anna", "Boris", "Katya",
	"Omar", "Fatima", "Chen", "Mei", "Raj",
	"Priya", "James", "Sarah", "Carlos", "Isabella",
}

var candidateLastNames = []string{
	"Volkov", "Petrov", "Kim", "Chen", "Singh",
	"Mueller", "Santos", "Johnson", "Al-Rashid", "Tanaka",
	"Kowalski", "Rivera", "Anderson", "Nakamura", "Park",
	"Garcia", "Thompson", "Ivanova", "Fernandez", "Yamamoto",
}

func generateCandidateName(rng *rand.Rand) string {
	first := candidateFirstNames[rng.Intn(len(candidateFirstNames))]
	last := candidateLastNames[rng.Intn(len(candidateLastNames))]
	return first + " " + last
}

// ─── ElectionEngine ───

// ElectionEngine manages the election cycle for a single city.
type ElectionEngine struct {
	// Current election state
	Phase       ElectionPhase `json:"phase"`
	Candidates  []*Candidate  `json:"candidates,omitempty"`
	PhaseStart  uint64        `json:"phaseStart"`  // Tick when current phase began
	NextElection uint64       `json:"nextElection"` // Tick of next election

	// Player's vote (candidate ID, empty if not voted)
	PlayerVote string `json:"playerVote"`

	// History of completed elections
	History []ElectionRecord `json:"history,omitempty"`
}

// NewElectionEngine creates a fresh election engine.
func NewElectionEngine() *ElectionEngine {
	return &ElectionEngine{
		Phase:        PhaseNone,
		NextElection: ElectionCycleTicks, // First election at tick 100
		History:      make([]ElectionRecord, 0, MaxElectionHistory),
	}
}

// TickElection advances the election state machine.
// Returns a list of edicts to enact if an election just concluded.
func (el *ElectionEngine) TickElection(
	currentTick uint64,
	citizens []*CitizenAgent,
	politics *PoliticsEngine,
	rng *rand.Rand,
) []EdictID {
	switch el.Phase {
	case PhaseNone:
		// Check if it's time to start a new election
		if currentTick >= el.NextElection {
			el.startCampaign(currentTick, politics, rng)
		}

	case PhaseCampaign:
		// Update support polls based on citizen affinities
		el.updatePolls(citizens)
		// After campaign period, move to voting
		if currentTick >= el.PhaseStart+ElectionCampaignTicks/2 {
			el.Phase = PhaseVoting
		}

	case PhaseVoting:
		// Update support continuously
		el.updatePolls(citizens)
		// After voting period, tally results
		if currentTick >= el.PhaseStart+ElectionCampaignTicks {
			return el.tallyResults(currentTick, citizens, politics, rng)
		}

	case PhaseResults:
		// Results phase lasts 5 ticks for display, then reset
		if currentTick >= el.PhaseStart+5 {
			el.Phase = PhaseNone
			el.NextElection = currentTick + ElectionCycleTicks
			el.Candidates = nil
			el.PlayerVote = ""
		}
	}

	return nil
}

// startCampaign generates candidates and begins the campaign phase.
func (el *ElectionEngine) startCampaign(
	currentTick uint64,
	politics *PoliticsEngine,
	rng *rand.Rand,
) {
	el.Phase = PhaseCampaign
	el.PhaseStart = currentTick
	el.PlayerVote = ""

	candidates := make([]*Candidate, 0, MaxCandidates)

	// Candidate 1: Incumbent (aligned with current faction average)
	incumbent := &Candidate{
		ID:          fmt.Sprintf("cand_%d_inc", currentTick),
		Name:        generateCandidateName(rng),
		IsIncumbent: true,
		FactionAxes: politics.FactionAvg, // Matches current population
		Pledges:     selectPledges(politics.FactionAvg, rng, true),
	}
	candidates = append(candidates, incumbent)

	// Candidates 2-4: Challengers with different political stances
	archetypes := []FactionAxes{
		{+0.5, -0.3, +0.4, -0.2}, // Capitalist-Militarist-Conservative
		{-0.4, -0.5, -0.3, +0.6}, // Communist-Environmentalist-Progressive
		{+0.2, +0.3, -0.4, +0.3}, // Moderate-Industrial-Religious-Progressive
	}

	for i := 0; i < MaxCandidates-1 && i < len(archetypes); i++ {
		// Blend archetype with some random noise
		axes := archetypes[i]
		for j := 0; j < NumAxes; j++ {
			axes[j] = clampF(axes[j]+rng.Float64()*0.4-0.2, -1, 1)
		}

		challenger := &Candidate{
			ID:          fmt.Sprintf("cand_%d_%d", currentTick, i),
			Name:        generateCandidateName(rng),
			IsIncumbent: false,
			FactionAxes: axes,
			Pledges:     selectPledges(axes, rng, false),
		}
		candidates = append(candidates, challenger)
	}

	el.Candidates = candidates
}

// selectPledges picks 2-3 edicts that align with the candidate's political stance.
func selectPledges(axes FactionAxes, rng *rand.Rand, isIncumbent bool) []EdictID {
	type scored struct {
		id    EdictID
		score float64
	}

	var scored_edicts []scored
	for _, def := range AllEdicts {
		// Compute alignment: dot product of candidate stance with edict effect
		alignment := 0.0
		for i := 0; i < NumAxes; i++ {
			alignment += axes[i] * def.FactionEffect[i]
		}
		scored_edicts = append(scored_edicts, scored{id: def.ID, score: alignment})
	}

	// Sort by alignment (highest first)
	for i := 0; i < len(scored_edicts)-1; i++ {
		for j := i + 1; j < len(scored_edicts); j++ {
			if scored_edicts[j].score > scored_edicts[i].score {
				scored_edicts[i], scored_edicts[j] = scored_edicts[j], scored_edicts[i]
			}
		}
	}

	// Pick top 2-3 edicts
	count := 2
	if rng.Float64() < 0.5 {
		count = 3
	}
	if count > len(scored_edicts) {
		count = len(scored_edicts)
	}

	pledges := make([]EdictID, count)
	for i := 0; i < count; i++ {
		pledges[i] = scored_edicts[i].id
	}
	return pledges
}

// updatePolls calculates each candidate's support based on citizen affinities.
func (el *ElectionEngine) updatePolls(citizens []*CitizenAgent) {
	if len(el.Candidates) == 0 || len(citizens) == 0 {
		return
	}

	// Calculate support for each candidate
	supports := make([]float64, len(el.Candidates))
	totalSupport := 0.0

	for _, citizen := range citizens {
		bestScore := math.Inf(-1)
		bestIdx := 0

		for ci, cand := range el.Candidates {
			// Alignment = dot product of citizen's faction affinities with candidate's stance
			score := 0.0
			for i := 0; i < NumAxes; i++ {
				if i < len(citizen.FactionAffinities) {
					score += citizen.FactionAffinities[i] * cand.FactionAxes[i]
				}
			}
			// Incumbent bonus: +0.1 (status quo bias)
			if cand.IsIncumbent {
				score += 0.1
			}
			if score > bestScore {
				bestScore = score
				bestIdx = ci
			}
		}

		supports[bestIdx] += 1.0
		totalSupport += 1.0
	}

	// Convert to percentages
	if totalSupport > 0 {
		for i := range el.Candidates {
			el.Candidates[i].SupportPct = (supports[i] / totalSupport) * 100
		}
	}
}

// CastVote records the player's vote for a candidate.
func (el *ElectionEngine) CastVote(candidateID string) error {
	if el.Phase != PhaseVoting && el.Phase != PhaseCampaign {
		return fmt.Errorf("not in voting phase")
	}

	found := false
	for _, cand := range el.Candidates {
		if cand.ID == candidateID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("candidate not found: %s", candidateID)
	}

	el.PlayerVote = candidateID
	return nil
}

// tallyResults counts votes, determines winner, and enacts winner's pledged edicts.
func (el *ElectionEngine) tallyResults(
	currentTick uint64,
	citizens []*CitizenAgent,
	politics *PoliticsEngine,
	rng *rand.Rand,
) []EdictID {
	if len(el.Candidates) == 0 {
		el.Phase = PhaseResults
		el.PhaseStart = currentTick
		return nil
	}

	// Each citizen votes based on alignment (same as poll logic)
	votes := make([]int, len(el.Candidates))
	totalVotes := 0

	for _, citizen := range citizens {
		bestScore := math.Inf(-1)
		bestIdx := 0

		for ci, cand := range el.Candidates {
			score := 0.0
			for i := 0; i < NumAxes; i++ {
				if i < len(citizen.FactionAffinities) {
					score += citizen.FactionAffinities[i] * cand.FactionAxes[i]
				}
			}
			if cand.IsIncumbent {
				score += 0.1
			}
			// Add small randomness for vote variability
			score += rng.Float64() * 0.05
			if score > bestScore {
				bestScore = score
				bestIdx = ci
			}
		}

		votes[bestIdx]++
		totalVotes++
	}

	// Apply votes and find winner
	winnerIdx := 0
	maxVotes := 0
	for i, cand := range el.Candidates {
		cand.Votes = votes[i]
		if totalVotes > 0 {
			cand.SupportPct = float64(votes[i]) / float64(totalVotes) * 100
		}
		if votes[i] > maxVotes {
			maxVotes = votes[i]
			winnerIdx = i
		}
	}

	winner := el.Candidates[winnerIdx]

	// Record election result
	record := ElectionRecord{
		Tick:       currentTick,
		WinnerID:   winner.ID,
		WinnerName: winner.Name,
		Candidates: el.Candidates,
		TotalVotes: totalVotes,
	}
	el.History = append(el.History, record)
	if len(el.History) > MaxElectionHistory {
		el.History = el.History[len(el.History)-MaxElectionHistory:]
	}

	// Losing factions become more dissatisfied
	for _, cand := range el.Candidates {
		if cand.ID != winner.ID && cand.SupportPct > 20 {
			// Losers with significant support cause increased dissatisfaction
			politics.Dissatisfaction += cand.SupportPct * 0.05
		}
	}
	if politics.Dissatisfaction > 100 {
		politics.Dissatisfaction = 100
	}

	// Transition to results phase
	el.Phase = PhaseResults
	el.PhaseStart = currentTick

	// Add political event
	politics.addEvent(PoliticalEvent{
		Type:     EventEdictEnacted,
		Message:  fmt.Sprintf("Election won by %s (%.0f%% votes). Pledged edicts being enacted.", winner.Name, winner.SupportPct),
		Severity: "info",
		Tick:     currentTick,
	})

	// Return winner's pledges for enactment
	return winner.Pledges
}

// ─── Election Snapshot for Client ───

// ElectionSnapshot is the serializable election state sent to clients.
type ElectionSnapshot struct {
	Phase        ElectionPhase      `json:"phase"`
	Candidates   []CandidateSnapshot `json:"candidates,omitempty"`
	PhaseStart   uint64             `json:"phaseStart"`
	NextElection uint64             `json:"nextElection"`
	PlayerVote   string             `json:"playerVote"`
	History      []ElectionRecord   `json:"history,omitempty"`
}

// CandidateSnapshot is the client-safe candidate data.
type CandidateSnapshot struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	IsIncumbent bool                `json:"isIncumbent"`
	FactionAxes FactionAxesSnapshot `json:"factionAxes"`
	Pledges     []PledgeSnapshot    `json:"pledges"`
	SupportPct  float64             `json:"supportPct"`
	Votes       int                 `json:"votes"`
}

// PledgeSnapshot is a simplified edict reference for client display.
type PledgeSnapshot struct {
	EdictID     string `json:"edictId"`
	EdictName   string `json:"edictName"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

// Snapshot creates a client-ready election snapshot.
func (el *ElectionEngine) Snapshot() ElectionSnapshot {
	snap := ElectionSnapshot{
		Phase:        el.Phase,
		PhaseStart:   el.PhaseStart,
		NextElection: el.NextElection,
		PlayerVote:   el.PlayerVote,
		History:      el.History,
	}

	if el.Candidates != nil {
		snap.Candidates = make([]CandidateSnapshot, len(el.Candidates))
		for i, cand := range el.Candidates {
			pledges := make([]PledgeSnapshot, len(cand.Pledges))
			for j, pid := range cand.Pledges {
				def := GetEdictDef(pid)
				if def != nil {
					pledges[j] = PledgeSnapshot{
						EdictID:     string(pid),
						EdictName:   def.Name,
						Category:    def.Category,
						Description: def.Description,
					}
				} else {
					pledges[j] = PledgeSnapshot{
						EdictID:   string(pid),
						EdictName: string(pid),
					}
				}
			}

			snap.Candidates[i] = CandidateSnapshot{
				ID:          cand.ID,
				Name:        cand.Name,
				IsIncumbent: cand.IsIncumbent,
				FactionAxes: FactionAxesSnapshot{
					Economic:    cand.FactionAxes[AxisEconomic],
					Environment: cand.FactionAxes[AxisEnvironment],
					Governance:  cand.FactionAxes[AxisGovernance],
					Social:      cand.FactionAxes[AxisSocial],
				},
				Pledges:    pledges,
				SupportPct: cand.SupportPct,
				Votes:      cand.Votes,
			}
		}
	}

	return snap
}
