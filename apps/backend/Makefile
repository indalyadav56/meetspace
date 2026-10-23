.PHONY: build run worker migrate seed test lint

build:
	go build ./...

run:
	go run ./cmd/server

worker:
	go run ./cmd/worker

migrate:
	go run ./cmd/migrator up

seed:
	go run ./cmd/seed

test:
	go test ./...

lint:
	go vet ./...
