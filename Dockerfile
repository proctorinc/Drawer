# Stage 1: Build the frontend
FROM node:18 AS frontend-builder

# Set the working directory for the frontend
# This is where your package.json and frontend code live
WORKDIR /app/frontend

# Copy the package.json and package-lock.json files first to leverage Docker cache
COPY package.json package-lock.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the frontend source code
COPY . .

# Build the frontend
# This should output static files into a 'dist' directory (or similar, adjust if needed)
RUN npm run build

# Stage 2: Build the backend
FROM golang:1.23.0 AS backend-builder

# Set the working directory for the backend
# This is where your go.mod and backend code live
WORKDIR /app/server

# Copy the Go module files first to leverage Docker cache
COPY server/go.mod server/go.sum ./

# Download Go dependencies
RUN go mod download

# Copy the rest of the backend source code
COPY server/ ./

# Build the Go application
# -o drawer-service: specifies the output filename
# ./cmd/drawer/main.go: specifies the entry point relative to the WORKDIR (/app/server)
# || exit 1: ensures the Docker build fails if the go build command fails
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o drawer-service ./cmd/drawer/main.go || exit 1

# Stage 3: Create the final image
FROM debian:bullseye-slim

# Install necessary tools and set timezone
RUN apt-get update && apt-get install -y ca-certificates tzdata && rm -rf /var/lib/apt/lists/*

# Set timezone to PST
ENV TZ=PST

# Set the working directory
WORKDIR /root/

# Copy the backend binary and frontend files
COPY --from=backend-builder /app/server/drawer-service .
COPY --from=frontend-builder /app/frontend/dist ./frontend

# Expose the port
EXPOSE 8080

RUN chmod +x /root/drawer-service

# Command to run the backend server
CMD ["/root/drawer-service"]