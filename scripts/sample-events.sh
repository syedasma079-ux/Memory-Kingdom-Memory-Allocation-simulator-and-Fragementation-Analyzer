#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend/c-engine"
printf '%s\n' \
  '{"id":1,"cmd":"workload.assignment"}' \
  '{"id":2,"cmd":"sim.run","untilT":1}' \
  '{"id":3,"cmd":"snapshot.get"}' \
  '{"id":4,"cmd":"compare.run"}' | ./memk-sim --server
