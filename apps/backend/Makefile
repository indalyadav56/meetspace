.PHONY: build run migrate test lint

build:
	go build ./...

run:
	go run ./cmd/server

migrate:
	go run ./cmd/migrator

test:
	go test ./...

lint:
	go vet ./...
