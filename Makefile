test:
	./support/expresso/bin/expresso \
		-I lib \
		-I support/connect/lib \
		-I support/haml/lib \
		-I support/jade/lib \
		-I support/ejs/lib \
		$(TESTFLAGS) \
		test/*.test.js

