package main

import (
	"bytes"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/storage"
	"encoding/json"
	"image"
	"image/png"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

const (
	BUCKET_NAME = "your-bucket-name" // TODO: Replace with actual bucket name
	REGION      = "us-east-1"        // TODO: Replace with your region
)

type CanvasData struct {
	Width  int     `json:"width"`
	Height int     `json:"height"`
	Data   []uint8 `json:"data"`  // This is the raw pixel data array
}

type Color struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Color string `json:"color"`
}

func main() {
	cfg := &config.Config{
		DatabaseURL:      "libsql://drawer-db-proctorinc.aws-us-west-2.turso.io?authToken=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDkwNjMxNjUsImlkIjoiN2ZiYzNhMjItNzZmOS00NWU0LWE4NGMtMjVkNTQ2ZWIyM2ZiIiwicmlkIjoiMWJiNjMyMzUtNTQ3Ny00ODNjLWJhZTAtYjk3NTczNDkxYzg1In0.HNeoKvrzD8a-P1vqFCp2SpItkmv--asvuQFh79oMFpIp6euv7uwuguoUqb-S2Yh-zZwEDV2hmNapZfOB616hBw",
		Env:              "production",
		S3BucketName: "proctorinc-drawer-s3",
		S3BucketRegion: "us-east-2",
	}

	storageService := storage.NewStorageService(cfg)

	// Open database connection
	db, err := db.InitDB(cfg)

	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}

	// Get all submissions with canvas data
	rows, err := db.Query(`
		SELECT id, user_id, canvas_data 
		FROM user_submissions
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	// Process each submission
	for rows.Next() {
		var id, userID string
		var canvasDataStr string

		if err := rows.Scan(&id, &userID, &canvasDataStr); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		// rawCanvasData := json.RawMessage(canvasDataStr)

		// Parse canvas data
		var canvasData CanvasData
		if err := json.Unmarshal([]byte(canvasDataStr), &canvasData); err != nil {
			// Try parsing as a double-encoded string
			var decodedStr string
			if err := json.Unmarshal([]byte(canvasDataStr), &decodedStr); err != nil {
				log.Printf("Error parsing canvas data for submission %s: %v", id, err)
				continue
			}
			if err := json.Unmarshal([]byte(decodedStr), &canvasData); err != nil {
				log.Printf("Error parsing decoded canvas data for submission %s: %v", id, err)
				continue
			}
		}

		// Add this debug log
		log.Printf("Raw canvas data: %s", canvasDataStr)
		log.Printf("Parsed canvas data: %+v", canvasData)

		// Create image from canvas data
		img := createImageFromCanvas(canvasData)

		// Convert image to bytes
		var buf bytes.Buffer
		if err := png.Encode(&buf, img); err != nil {
			log.Printf("Error encoding image for submission %s: %v", id, err)
			continue
		}

		imageURL, err := storageService.UploadImage(userID, id, buf.Bytes())

		if err != nil {
			log.Fatalf("Error uploading to S3 for submission %s: %v", id, err)
			continue
		}

		log.Printf("Successfully processed submission %s: imageURL: %s", id, imageURL)
	}
}

func createImageFromCanvas(canvas CanvasData) *image.RGBA {
	log.Printf("Creating image with dimensions: %dx%d, data length: %d", canvas.Width, canvas.Height, len(canvas.Data))
	
	img := image.NewRGBA(image.Rect(0, 0, canvas.Width, canvas.Height))
	
	// Copy the raw pixel data directly into the image
	copy(img.Pix, canvas.Data)
	
	return img
}
