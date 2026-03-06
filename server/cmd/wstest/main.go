package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

// WSFrame matches the server protocol
type WSFrame struct {
	E string          `json:"e"`
	D json.RawMessage `json:"d"`
}

func sendFrame(conn *websocket.Conn, event string, data interface{}) error {
	d, _ := json.Marshal(data)
	frame := WSFrame{E: event, D: d}
	raw, _ := json.Marshal(frame)
	return conn.WriteMessage(websocket.TextMessage, raw)
}

func main() {
	numClients := 5
	duration := 60 * time.Second
	serverURL := "ws://localhost:9000/ws"

	if len(os.Args) > 1 {
		serverURL = os.Args[1]
	}

	fmt.Printf("WebSocket Stress Test: %d clients for %v → %s\n", numClients, duration, serverURL)

	var connected atomic.Int32
	var messages atomic.Int64
	var errors atomic.Int64
	var disconnects atomic.Int32

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	done := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < numClients; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			name := fmt.Sprintf("TestBot_%d", id)

			u, _ := url.Parse(serverURL)
			conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
			if err != nil {
				log.Printf("[%s] connect failed: %v", name, err)
				errors.Add(1)
				return
			}
			defer conn.Close()
			connected.Add(1)
			fmt.Printf("[%s] connected\n", name)

			// Join room
			joinPayload := map[string]interface{}{
				"roomId": "quick",
				"name":   name,
				"skinId": rand.Intn(24),
			}
			if err := sendFrame(conn, "join_room", joinPayload); err != nil {
				log.Printf("[%s] join error: %v", name, err)
				errors.Add(1)
				return
			}

			// Read goroutine
			readDone := make(chan struct{})
			go func() {
				defer close(readDone)
				for {
					_, msg, err := conn.ReadMessage()
					if err != nil {
						disconnects.Add(1)
						fmt.Printf("[%s] read error: %v\n", name, err)
						return
					}
					messages.Add(1)
					// Parse to check for errors
					var frame WSFrame
					if json.Unmarshal(msg, &frame) == nil {
						if frame.E == "error" {
							fmt.Printf("[%s] server error: %s\n", name, string(frame.D))
						}
					}
				}
			}()

			// Input loop (20Hz)
			inputTicker := time.NewTicker(50 * time.Millisecond)
			defer inputTicker.Stop()

			angle := rand.Float64() * 2 * math.Pi
			seq := 0

			for {
				select {
				case <-done:
					return
				case <-readDone:
					fmt.Printf("[%s] disconnected unexpectedly\n", name)
					return
				case <-inputTicker.C:
					// Random movement
					angle += (rand.Float64() - 0.5) * 0.3
					seq++
					boost := 0
					if rand.Float64() < 0.1 {
						boost = 1
					}
					input := map[string]interface{}{
						"a": angle,
						"b": boost,
						"s": seq,
					}
					if err := sendFrame(conn, "input", input); err != nil {
						errors.Add(1)
						return
					}
				}
			}
		}(i)
	}

	// Status printer
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				fmt.Printf("  Status: connected=%d msgs=%d errs=%d disconnects=%d\n",
					connected.Load(), messages.Load(), errors.Load(), disconnects.Load())
			}
		}
	}()

	// Wait for duration or signal
	select {
	case <-sigChan:
		fmt.Println("\nSignal received, stopping...")
	case <-time.After(duration):
		fmt.Println("\nDuration elapsed, stopping...")
	}

	close(done)
	wg.Wait()

	fmt.Printf("\n=== Results ===\n")
	fmt.Printf("Connected: %d/%d\n", connected.Load(), numClients)
	fmt.Printf("Messages received: %d\n", messages.Load())
	fmt.Printf("Errors: %d\n", errors.Load())
	fmt.Printf("Unexpected disconnects: %d\n", disconnects.Load())

	if disconnects.Load() == 0 && errors.Load() == 0 {
		fmt.Println("PASS: Server remained stable")
	} else {
		fmt.Println("FAIL: Server had issues")
		os.Exit(1)
	}
}
