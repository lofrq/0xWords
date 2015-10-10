NPM_BIN=./node_modules/.bin

lint:
	@$(NPM_BIN)/jscs * **/**

.PHONY: lint