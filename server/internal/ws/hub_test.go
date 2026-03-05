package ws

import (
	"context"
	"testing"
	"time"
)

// mockClient creates a minimal client for testing (no real WebSocket).
func mockClient(id string) *Client {
	return &Client{
		ID:           id,
		send:         make(chan []byte, sendBufferSize),
		done:         make(chan struct{}),
		rateLimiters: makeDefaultRateLimiters(),
	}
}

func TestHub_RegisterAndRoomcast(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)
	// Give hub time to start
	time.Sleep(10 * time.Millisecond)

	// Create clients
	c1 := mockClient("client-1")
	c2 := mockClient("client-2")
	c3 := mockClient("client-3")

	// Register c1 and c2 in room "test-room"
	hub.Register <- &Registration{Client: c1, RoomID: "test-room"}
	hub.Register <- &Registration{Client: c2, RoomID: "test-room"}
	// Register c3 in a different room
	hub.Register <- &Registration{Client: c3, RoomID: "other-room"}

	time.Sleep(20 * time.Millisecond)

	// Roomcast to "test-room"
	testMsg := []byte(`{"e":"state","d":{}}`)
	hub.Roomcast <- &RoomcastMsg{RoomID: "test-room", Data: testMsg}

	time.Sleep(20 * time.Millisecond)

	// c1 and c2 should receive the message
	select {
	case msg := <-c1.send:
		if string(msg) != string(testMsg) {
			t.Fatalf("c1 received wrong message: %s", string(msg))
		}
	default:
		t.Fatal("c1 did not receive message")
	}

	select {
	case msg := <-c2.send:
		if string(msg) != string(testMsg) {
			t.Fatalf("c2 received wrong message: %s", string(msg))
		}
	default:
		t.Fatal("c2 did not receive message")
	}

	// c3 should NOT receive the message
	select {
	case msg := <-c3.send:
		t.Fatalf("c3 should not receive message but got: %s", string(msg))
	default:
		// expected
	}
}

func TestHub_Unicast(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)
	time.Sleep(10 * time.Millisecond)

	c1 := mockClient("client-1")
	c2 := mockClient("client-2")

	hub.Register <- &Registration{Client: c1, RoomID: "room"}
	hub.Register <- &Registration{Client: c2, RoomID: "room"}
	time.Sleep(20 * time.Millisecond)

	testMsg := []byte(`{"e":"joined","d":{"id":"client-1"}}`)
	hub.Unicast <- &UnicastMsg{ClientID: "client-1", Data: testMsg}

	time.Sleep(20 * time.Millisecond)

	select {
	case msg := <-c1.send:
		if string(msg) != string(testMsg) {
			t.Fatalf("wrong message: %s", string(msg))
		}
	default:
		t.Fatal("c1 did not receive unicast")
	}

	select {
	case <-c2.send:
		t.Fatal("c2 should not receive unicast")
	default:
		// expected
	}
}

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)
	time.Sleep(10 * time.Millisecond)

	c1 := mockClient("c1")
	c2 := mockClient("c2")

	hub.Register <- &Registration{Client: c1, RoomID: "room-a"}
	hub.Register <- &Registration{Client: c2, RoomID: "room-b"}
	time.Sleep(20 * time.Millisecond)

	testMsg := []byte(`{"e":"rooms_update","d":{}}`)
	hub.Broadcast <- &BroadcastMsg{Data: testMsg}

	time.Sleep(20 * time.Millisecond)

	// Both clients should receive
	select {
	case <-c1.send:
	default:
		t.Fatal("c1 did not receive broadcast")
	}
	select {
	case <-c2.send:
	default:
		t.Fatal("c2 did not receive broadcast")
	}
}

func TestHub_UnregisterCleanup(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)
	time.Sleep(10 * time.Millisecond)

	c1 := mockClient("c1")
	hub.Register <- &Registration{Client: c1, RoomID: "room"}
	time.Sleep(20 * time.Millisecond)

	hub.Unregister <- c1
	time.Sleep(20 * time.Millisecond)

	// Unicast to unregistered client should not panic
	hub.Unicast <- &UnicastMsg{ClientID: "c1", Data: []byte("test")}
	time.Sleep(20 * time.Millisecond)
}

func TestHub_RoomcastWithExclude(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)
	time.Sleep(10 * time.Millisecond)

	c1 := mockClient("c1")
	c2 := mockClient("c2")
	hub.Register <- &Registration{Client: c1, RoomID: "room"}
	hub.Register <- &Registration{Client: c2, RoomID: "room"}
	time.Sleep(20 * time.Millisecond)

	// Roomcast excluding c1
	hub.Roomcast <- &RoomcastMsg{RoomID: "room", Data: []byte("msg"), Exclude: "c1"}
	time.Sleep(20 * time.Millisecond)

	select {
	case <-c1.send:
		t.Fatal("c1 should be excluded")
	default:
		// expected
	}

	select {
	case <-c2.send:
		// expected
	default:
		t.Fatal("c2 should receive message")
	}
}
