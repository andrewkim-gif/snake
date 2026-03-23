package game

import (
	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// --- Test helpers ---

func newTestAgent(id, name string) *domain.Agent {
	pos := domain.Position{X: 0, Y: 0}
	skin := domain.DefaultSkin()
	return NewAgent(id, name, pos, skin, false, 0, "")
}

func newTestAgentAt(id, name string, x, y float64) *domain.Agent {
	pos := domain.Position{X: x, Y: y}
	skin := domain.DefaultSkin()
	return NewAgent(id, name, pos, skin, false, 0, "")
}

func newTestBotAgent(id, name string) *domain.Agent {
	pos := domain.Position{X: 0, Y: 0}
	skin := domain.DefaultSkin()
	return NewAgent(id, name, pos, skin, true, 0, "")
}
