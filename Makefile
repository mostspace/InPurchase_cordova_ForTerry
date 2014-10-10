help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "available targets:"
	@echo "    build   ........ Generate javascript files for iOS and Android."
	@echo "    tests .......... Run all tests."
	@echo "    test-js ........ Test javascript files for errors."
	@echo "    test-install ... Test plugin installation on iOS and Android."
	@echo "    clean .......... Cleanup the project (temporary and generated files)."
	@echo ""
	@echo "(c)2014, Jean-Christophe Hoelt <hoelt@fovea.cc>"
	@echo ""

build: test-js
	@node_modules/.bin/preprocess src/javascript/store-ios.js src/javascript > www/store-ios.js
	@node_modules/.bin/preprocess src/javascript/store-android.js src/javascript > www/store-android.js

test-js: check-jshint
	@node_modules/.bin/jshint src/javascript/*.js

test-install: build
	@./test/run.sh cc.fovea.babygoo babygooinapp1

tests: test-js test-install
	@echo 'ok'

check-jshint:
	@test -e node_modules/.bin/jshint || ( echo 'Please install dependencies: npm install'; exit 1 )

clean:
	@find . -name '*~' -exec rm '{}' ';'
