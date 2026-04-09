.PHONY: install build dev start clean

install:
	npm install

build: install
	npm run build -w @catan/shared
	npm run build -w @catan/server
	npm run build -w @catan/client

dev: packages/shared/dist/index.js
	npm run dev

packages/shared/dist/index.js: install
	npm run build -w @catan/shared

start: build
	npm run start -w @catan/server

clean:
	rm -rf packages/shared/dist packages/server/dist packages/client/dist
