
deploy: ./src/index.mjs node_modules
	@wrangler deploy

node_modules: package.json
	@npm i

log: tail

tail:
	 @wrangler tail

.PHONY: tail