# Full-connectome FlyPII implementation plan

## Scope approved by the user
Replace the 209-neuron proof of concept with a browser website using the full adult FlyWire proofread brain. Test actual full-size computation and publish the complete implementation and evidence in zgbrenner/flypii.

## Architecture
Pinned official FlyWire v783 data, all 139,255 neuron IDs and all positive directed connections. Aggregate duplicate neuropil rows only. Lossless compressed CSR chunks with SHA-256 validation. CPU typed-array recurrent rate reservoir in a browser worker; fixed connectivity and trainable logistic readout. All-node computation and a one-pixel-per-neuron activity visualization. No external inference or transmission of user text.

## Work and verification
1. Data: test aggregation, direction, isolated nodes, unknown IDs, invalid weights, binary layout. Run official source MD5 checks and publish data on the dedicated connectome-data branch without overwriting any branch.
2. Engine: implement and test binary validation, deterministic sparse recurrent propagation against a literal dense reference, all-node updates, all-edge use, ablations, input validation, readout training, serialization, holdout separation and cancellation.
3. Interface: retain the existing white/purple lab design; full-brain playground, local labeled training, real benchmark comparison, downloadable model/report and explicit limitations. Show download/initialization progress and errors. Do not silently use a small fallback.
4. Integration: train on synthetic examples with held-out templates, run the actual 139,255-node graph in Node and Chromium, verify desktop/mobile layouts and no text egress. CI fetches and verifies every data chunk, trains and measures the real model and publishes reproducible reports and static build artifacts.
5. Review and delivery: inspect screenshots, fix test failures, verify remote files and run status, provide repository and measured results. Mark untested browsers and scientific limitations honestly.

## Non-goals
No claim of consciousness, biological fidelity beyond connectivity, measured spikes, production-grade privacy protection, or superiority to conventional classifiers. Internal weights are not trained. No model quality numbers are invented.
