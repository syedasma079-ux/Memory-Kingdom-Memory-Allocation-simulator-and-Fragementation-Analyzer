# Architectural and Implementation Decisions

| Decision ID | Description | Rationale |
|---|---|---|
| D1 | One C engine (`libmemk`), multiple front-ends (sim, dispatch, Node, React) | Keeps C memory engine as single source of truth; avoids redundant implementations. |
| D2 | No globals in arena logic (`Arena` context structure) | Allows multiple arenas (e.g. 4 policies side-by-side in Royal Strategy Room) to run simultaneously. |
| D3 | Exact assignment `mab` struct and 5 functions preserved verbatim | Exact academic compatibility. Owner PID tracked in scheduler layer, not inside `mab`. |
| D4 | Event sourcing with monotonic seq and time $t$ | Frontend renders from snapshots and animates events without owning state. |
| D5 | Memory unit is 1 MB; time unit is 1 simulated tick | Deterministic and matches assignment specification. |
| D6 | Rewind is read-only snapshot inspection; deterministic mode supports branch seek | Reliable time travel debugging. |
| D7 | Internal 480x270 canvas with integer scaling; bundled retro fonts | Retro 16-bit SNES aesthetics without external font CDNs or blurry scaling. |
| D8 | 1024 MB arena total locked in Assignment mode | Enforces strict compliance with academic dataset. |
| D9 | Single source of truth: all allocation decisions, splits, merges, offsets, traces, and metrics calculated in C | Enforced by `scripts/check-single-source.sh`. |
