.PHONY: all setup build check test run dev clean

all: build

setup:
	./scripts/setup.sh

build:
	./scripts/build.sh

check:
	./scripts/verify.sh

test: check

run: dev

dev:
	./scripts/dev.sh

clean:
	$(MAKE) -C backend/c-engine clean
	rm -rf backend/api/dist frontend/dist

