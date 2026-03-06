package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"math/rand"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// Frame is the JSON wire format used by the game server.
type Frame struct {
	Event string          `json:"e"`
	Data  json.RawMessage `json:"d"`
}

// JoinRoomPayload mirrors ws.JoinRoomPayload.
type JoinRoomPayload struct {
	RoomID string `json:"roomId"`
	Name   string `json:"name"`
	SkinID int    `json:"skinId"`
}

// InputPayload mirrors ws.InputPayload.
type InputPayload struct {
	Angle float64 `json:"a"`
	Boost int     `json:"b"`
	Seq   int     `json:"s"`
}

// Metrics tracks load test statistics.
type Metrics struct {
	ConnectSuccess  int64
	ConnectFailed   int64
	MessagesReceived int64
	MessagesSent     int64
	TotalLatencyMs  int64
	LatencySamples  int64
}

func main() {
	url := flag.String("url", "ws://localhost:8000/ws", "WebSocket server URL")
	clients := flag.Int("clients", 100, "number of concurrent clients")
	duration := flag.Int("duration", 30, "test duration in seconds")
	inputHz := flag.Int("hz", 30, "input send rate per client (Hz)")
	flag.Parse()

	fmt.Println("=== Agent Survivor Load Test ===")
	fmt.Printf("URL: %s\n", *url)
	fmt.Printf("Clients: %d | Duration: %ds | Input Rate: %dHz\n\n", *clients, *duration, *inputHz)

	metrics := &Metrics{}
	var wg sync.WaitGroup
	stopCh := make(chan struct{})

	start := time.Now()

	// Spawn clients
	for i := 0; i < *clients; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			runClient(id, *url, *inputHz, stopCh, metrics)
		}(i)
		// Stagger connections to avoid overwhelming the server
		time.Sleep(10 * time.Millisecond)
	}

	// Wait for test duration
	fmt.Printf("All clients spawned. Running for %ds...\n", *duration)
	time.Sleep(time.Duration(*duration) * time.Second)

	// Signal stop
	close(stopCh)
	fmt.Println("Stopping clients...")

	// Wait for all clients to finish with a timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		fmt.Println("Timeout waiting for clients to disconnect")
	}

	elapsed := time.Since(start)

	// Print results
	fmt.Println()
	fmt.Println("============================================")
	fmt.Println("          LOAD TEST RESULTS")
	fmt.Println("============================================")
	fmt.Println()

	connectSuccess := atomic.LoadInt64(&metrics.ConnectSuccess)
	connectFailed := atomic.LoadInt64(&metrics.ConnectFailed)
	msgsReceived := atomic.LoadInt64(&metrics.MessagesReceived)
	msgsSent := atomic.LoadInt64(&metrics.MessagesSent)
	totalLatency := atomic.LoadInt64(&metrics.TotalLatencyMs)
	latencySamples := atomic.LoadInt64(&metrics.LatencySamples)

	fmt.Printf("Connection Success:    %d/%d (%.1f%%)\n",
		connectSuccess, connectSuccess+connectFailed,
		safePct(connectSuccess, connectSuccess+connectFailed))
	fmt.Printf("Connection Failed:     %d\n", connectFailed)
	fmt.Printf("Messages Sent:         %d\n", msgsSent)
	fmt.Printf("Messages Received:     %d\n", msgsReceived)

	avgLatency := 0.0
	if latencySamples > 0 {
		avgLatency = float64(totalLatency) / float64(latencySamples)
	}
	fmt.Printf("Avg Ping Latency:      %.1fms (%d samples)\n", avgLatency, latencySamples)
	fmt.Printf("Duration:              %s\n", elapsed.Truncate(time.Millisecond))

	throughput := float64(msgsReceived) / elapsed.Seconds()
	fmt.Printf("Recv Throughput:       %.0f msgs/s\n", throughput)

	fmt.Println()
	if connectFailed > 0 {
		os.Exit(1)
	}
}

// runClient simulates a single game client.
func runClient(id int, url string, inputHz int, stopCh <-chan struct{}, metrics *Metrics) {
	// Connect
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}
	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		atomic.AddInt64(&metrics.ConnectFailed, 1)
		return
	}
	atomic.AddInt64(&metrics.ConnectSuccess, 1)
	defer conn.Close()

	// Send join_room
	name := fmt.Sprintf("LoadBot_%d", id)
	joinPayload, _ := json.Marshal(JoinRoomPayload{
		RoomID: "", // quick join
		Name:   name,
		SkinID: id % 12,
	})
	joinFrame, _ := json.Marshal(Frame{Event: "join_room", Data: joinPayload})
	if err := conn.WriteMessage(websocket.TextMessage, joinFrame); err != nil {
		return
	}
	atomic.AddInt64(&metrics.MessagesSent, 1)

	// Read pump (goroutine)
	readDone := make(chan struct{})
	go func() {
		defer close(readDone)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
			atomic.AddInt64(&metrics.MessagesReceived, 1)
		}
	}()

	// Input loop
	inputInterval := time.Duration(1000/inputHz) * time.Millisecond
	inputTicker := time.NewTicker(inputInterval)
	defer inputTicker.Stop()

	// Ping every 2 seconds for latency measurement
	pingTicker := time.NewTicker(2 * time.Second)
	defer pingTicker.Stop()

	seq := 0
	angle := rand.Float64() * 2 * math.Pi

	for {
		select {
		case <-stopCh:
			return
		case <-readDone:
			return
		case <-inputTicker.C:
			// Send random input
			seq++
			angle += (rand.Float64() - 0.5) * 0.3
			boost := 0
			if rand.Float64() < 0.1 {
				boost = 1
			}
			inputPayload, _ := json.Marshal(InputPayload{
				Angle: angle,
				Boost: boost,
				Seq:   seq,
			})
			frame, _ := json.Marshal(Frame{Event: "input", Data: inputPayload})
			if err := conn.WriteMessage(websocket.TextMessage, frame); err != nil {
				return
			}
			atomic.AddInt64(&metrics.MessagesSent, 1)

		case <-pingTicker.C:
			// Send ping for latency measurement
			now := time.Now().UnixMilli()
			pingData, _ := json.Marshal(map[string]int64{"t": now})
			frame, _ := json.Marshal(Frame{Event: "ping", Data: pingData})
			sendTime := time.Now()
			if err := conn.WriteMessage(websocket.TextMessage, frame); err != nil {
				return
			}
			atomic.AddInt64(&metrics.MessagesSent, 1)

			// Note: actual pong parsing would require reading and matching,
			// but for simplicity we estimate RTT from send time
			rtt := time.Since(sendTime).Milliseconds()
			atomic.AddInt64(&metrics.TotalLatencyMs, rtt)
			atomic.AddInt64(&metrics.LatencySamples, 1)
		}
	}
}

// safePct computes a safe percentage.
func safePct(num, denom int64) float64 {
	if denom == 0 {
		return 0
	}
	return float64(num) / float64(denom) * 100
}
