package meta

import (
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"
)

// ============================================================
// v30 Task 2-17: Non-Sovereign Country Sovereignty Auction
// 48-hour English auction for non-sovereign countries.
// Highest bidder wins sovereignty (level 1) for their faction.
// 80% of winning bid is burned, 20% goes to treasury.
// ============================================================

// AuctionDuration is the standard auction duration.
const AuctionDuration = 48 * time.Hour

// AuctionBurnRate is the percentage of the winning bid that is burned.
const AuctionBurnRate = 0.80

// AuctionTreasuryRate is the percentage of the winning bid that goes to treasury.
const AuctionTreasuryRate = 0.20

// MinBidByTier defines minimum bid amounts by country tier.
var MinBidByTier = map[string]float64{
	"S": 10000,
	"A": 5000,
	"B": 2000,
	"C": 500,
	"D": 200,
}

// AuctionStatus represents the current status of an auction.
type AuctionStatus string

const (
	AuctionStatusActive    AuctionStatus = "active"
	AuctionStatusEnded     AuctionStatus = "ended"
	AuctionStatusCancelled AuctionStatus = "cancelled"
	AuctionStatusSettled   AuctionStatus = "settled"
)

// AuctionBid represents a single bid in an auction.
type AuctionBid struct {
	BidderID   string  `json:"bidderId"`
	FactionID  string  `json:"factionId"`
	Amount     float64 `json:"amount"`
	Timestamp  int64   `json:"timestamp"`
}

// Auction represents a sovereignty auction for a non-sovereign country.
type Auction struct {
	ID          string        `json:"id"`
	CountryISO  string        `json:"countryIso"`
	CountryName string        `json:"countryName"`
	Tier        string        `json:"tier"`
	Status      AuctionStatus `json:"status"`
	MinBid      float64       `json:"minBid"`
	CurrentBid  float64       `json:"currentBid"`
	TopBidder   string        `json:"topBidder,omitempty"`
	TopFaction  string        `json:"topFaction,omitempty"`
	Bids        []AuctionBid  `json:"bids"`
	StartedAt   int64         `json:"startedAt"`
	EndsAt      int64         `json:"endsAt"`
	SettledAt   int64         `json:"settledAt,omitempty"`
	BurnAmount  float64       `json:"burnAmount,omitempty"`
	TreasuryAmt float64       `json:"treasuryAmount,omitempty"`
}

// AuctionSettlement holds the result of settling an auction.
type AuctionSettlement struct {
	AuctionID     string  `json:"auctionId"`
	CountryISO    string  `json:"countryIso"`
	WinnerID      string  `json:"winnerId"`
	WinnerFaction string  `json:"winnerFaction"`
	WinningBid    float64 `json:"winningBid"`
	BurnAmount    float64 `json:"burnAmount"`
	TreasuryAmt   float64 `json:"treasuryAmount"`
}

// AuctionManager manages sovereignty auctions.
type AuctionManager struct {
	mu       sync.RWMutex
	auctions map[string]*Auction // auctionID → Auction
	counter  int

	// Callbacks
	OnAuctionSettled func(settlement AuctionSettlement)
}

// NewAuctionManager creates a new auction manager.
func NewAuctionManager() *AuctionManager {
	return &AuctionManager{
		auctions: make(map[string]*Auction),
	}
}

// CreateAuction creates a new sovereignty auction for a non-sovereign country.
func (am *AuctionManager) CreateAuction(countryISO, countryName, tier string) (*Auction, error) {
	am.mu.Lock()
	defer am.mu.Unlock()

	// Check if there's already an active auction for this country
	for _, a := range am.auctions {
		if a.CountryISO == countryISO && a.Status == AuctionStatusActive {
			return nil, fmt.Errorf("active auction already exists for %s", countryISO)
		}
	}

	minBid, ok := MinBidByTier[tier]
	if !ok {
		minBid = 500 // default
	}

	now := time.Now()
	am.counter++
	id := fmt.Sprintf("auction_%s_%d", countryISO, am.counter)

	auction := &Auction{
		ID:          id,
		CountryISO:  countryISO,
		CountryName: countryName,
		Tier:        tier,
		Status:      AuctionStatusActive,
		MinBid:      minBid,
		CurrentBid:  0,
		Bids:        make([]AuctionBid, 0),
		StartedAt:   now.UnixMilli(),
		EndsAt:      now.Add(AuctionDuration).UnixMilli(),
	}

	am.auctions[id] = auction

	slog.Info("auction created",
		"id", id,
		"country", countryISO,
		"tier", tier,
		"minBid", minBid,
		"endsAt", now.Add(AuctionDuration).Format(time.RFC3339),
	)

	return auction, nil
}

// PlaceBid places a bid on an active auction.
// Returns the updated auction or error.
func (am *AuctionManager) PlaceBid(auctionID, bidderID, factionID string, amount float64) (*Auction, error) {
	am.mu.Lock()
	defer am.mu.Unlock()

	auction, ok := am.auctions[auctionID]
	if !ok {
		return nil, fmt.Errorf("auction %s not found", auctionID)
	}

	if auction.Status != AuctionStatusActive {
		return nil, fmt.Errorf("auction %s is not active (status: %s)", auctionID, auction.Status)
	}

	now := time.Now().UnixMilli()
	if now > auction.EndsAt {
		return nil, fmt.Errorf("auction %s has expired", auctionID)
	}

	// Validate bid amount
	if amount < auction.MinBid {
		return nil, fmt.Errorf("bid %.0f is below minimum %.0f AWW", amount, auction.MinBid)
	}

	if amount <= auction.CurrentBid {
		return nil, fmt.Errorf("bid %.0f must exceed current bid %.0f AWW", amount, auction.CurrentBid)
	}

	// Record bid
	bid := AuctionBid{
		BidderID:  bidderID,
		FactionID: factionID,
		Amount:    amount,
		Timestamp: now,
	}
	auction.Bids = append(auction.Bids, bid)
	auction.CurrentBid = amount
	auction.TopBidder = bidderID
	auction.TopFaction = factionID

	slog.Info("auction bid placed",
		"auctionId", auctionID,
		"bidder", bidderID,
		"amount", amount,
		"country", auction.CountryISO,
	)

	return auction, nil
}

// CheckAndSettleExpired checks for expired auctions and settles them.
// Returns list of settlements.
func (am *AuctionManager) CheckAndSettleExpired() []AuctionSettlement {
	am.mu.Lock()
	defer am.mu.Unlock()

	now := time.Now().UnixMilli()
	var settlements []AuctionSettlement

	for _, auction := range am.auctions {
		if auction.Status != AuctionStatusActive {
			continue
		}
		if now < auction.EndsAt {
			continue
		}

		// Auction has expired
		if auction.CurrentBid <= 0 || auction.TopBidder == "" {
			// No bids — cancel
			auction.Status = AuctionStatusCancelled
			slog.Info("auction cancelled (no bids)",
				"id", auction.ID,
				"country", auction.CountryISO,
			)
			continue
		}

		// Settle with highest bidder
		burnAmount := auction.CurrentBid * AuctionBurnRate
		treasuryAmount := auction.CurrentBid * AuctionTreasuryRate

		auction.Status = AuctionStatusSettled
		auction.SettledAt = now
		auction.BurnAmount = burnAmount
		auction.TreasuryAmt = treasuryAmount

		settlement := AuctionSettlement{
			AuctionID:     auction.ID,
			CountryISO:    auction.CountryISO,
			WinnerID:      auction.TopBidder,
			WinnerFaction: auction.TopFaction,
			WinningBid:    auction.CurrentBid,
			BurnAmount:    burnAmount,
			TreasuryAmt:   treasuryAmount,
		}

		settlements = append(settlements, settlement)

		slog.Info("auction settled",
			"id", auction.ID,
			"country", auction.CountryISO,
			"winner", auction.TopBidder,
			"faction", auction.TopFaction,
			"winningBid", auction.CurrentBid,
			"burned", burnAmount,
			"treasury", treasuryAmount,
		)

		// Fire callback
		if am.OnAuctionSettled != nil {
			am.OnAuctionSettled(settlement)
		}
	}

	return settlements
}

// GetAuction returns an auction by ID.
func (am *AuctionManager) GetAuction(auctionID string) *Auction {
	am.mu.RLock()
	defer am.mu.RUnlock()

	a, ok := am.auctions[auctionID]
	if !ok {
		return nil
	}
	copied := *a
	copied.Bids = make([]AuctionBid, len(a.Bids))
	copy(copied.Bids, a.Bids)
	return &copied
}

// ListActiveAuctions returns all active auctions sorted by ending time.
func (am *AuctionManager) ListActiveAuctions() []*Auction {
	am.mu.RLock()
	defer am.mu.RUnlock()

	var active []*Auction
	for _, a := range am.auctions {
		if a.Status == AuctionStatusActive {
			copied := *a
			copied.Bids = make([]AuctionBid, len(a.Bids))
			copy(copied.Bids, a.Bids)
			active = append(active, &copied)
		}
	}

	sort.Slice(active, func(i, j int) bool {
		return active[i].EndsAt < active[j].EndsAt
	})

	return active
}

// ListAllAuctions returns all auctions.
func (am *AuctionManager) ListAllAuctions() []*Auction {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make([]*Auction, 0, len(am.auctions))
	for _, a := range am.auctions {
		copied := *a
		copied.Bids = make([]AuctionBid, len(a.Bids))
		copy(copied.Bids, a.Bids)
		result = append(result, &copied)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].StartedAt > result[j].StartedAt // newest first
	})

	return result
}
