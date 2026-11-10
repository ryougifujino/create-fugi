package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type helloResponse struct {
	OK        bool   `json:"ok"`
	Message   string `json:"message,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Error     string `json:"error,omitempty"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	api := http.NewServeMux()
	api.HandleFunc("GET /api/hello", hello)

	mux := http.NewServeMux()
	mux.Handle("/api/", api)
	mountWeb(mux)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("Server is running on http://localhost:%s", port)
	log.Fatal(server.ListenAndServe())
}

func hello(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, helloResponse{Error: "Please enter a name."})
		return
	}

	writeJSON(w, http.StatusOK, helloResponse{
		OK:        true,
		Message:   "Hello, " + name + "!",
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func writeJSON(w http.ResponseWriter, status int, response helloResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Write hello response: %v", err)
	}
}
