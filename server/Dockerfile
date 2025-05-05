# Use the official Golang image as a build stage
FROM golang:1.23.0 AS builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy the go.mod and go.sum files first to leverage Docker cache
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code into the container
COPY . .

# Build the Go app
RUN go build -o drawer-service-backend ./cmd/drawer/main.go

# Expose port 8080 (or the port defined in your config)
EXPOSE 8080

# Command to run the executable
CMD ["/app/drawer-service-backend"]
