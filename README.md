# FlyPII

A complete adult fruit-fly connectome used as a computational reservoir for **text-level PII-pattern classification**, in a website. Training and inference run locally in a browser worker. No API keys, backend inference, telemetry or text uploads.

This replaces the earlier 209-neuron prototype. It is an experiment, not an uploaded consciousness or a production privacy safeguard.

## What is actually full

The official FlyWire v783 proofread brain release is retained without minimum-strength filtering:

| Quantity | Retained |
|---|---:|
| Proofread neurons, including isolated IDs | 139,255 |
| Directed neuron pairs | 15,091,983 |
| Synaptic contacts represented by those pairs | 54,492,922 |
| Compressed download | 48,569,326 bytes |
| Uncompressed graph | 122,406,960 bytes |

Connections across neuropils are summed per directed pair. No top-k, five-synapse cutoff, neuron sampling or random replacement is used. Each analysis performs **835,530 node updates and 90,551,898 connection visits**. The 512-node readout selects features only; it does not shrink the simulated graph. Visualization displays one pixel for every neuron.

The graph is the full **published proofread brain**, not the fly's ventral nerve cord or all cellular biophysics.

## Run

Requires Node.js 22 or later and a current desktop browser. No npm dependency installation is necessary.

```sh
git clone https://github.com/zgbrenner/flypii.git
cd flypii
npm run data
npm start
```

Open `http://127.0.0.1:4173`. The data command fetches an immutable, checksummed graph from this repository's `connectome-data` branch. The verified starter model is in `models/starter.json`. If reproducing before the model is present, run `npm run train` first.

For static hosting, run `npm run build` and serve `dist/` over HTTPS. No application server is needed. The successful verification workflow also provides a complete `FlyPII-full-static-website` artifact containing data and weights. Opening `index.html` with `file://` is not supported because module workers and local data fetches require an origin.

After setup, analysis and training use local resources only. Exported weights contain no raw training examples, but learned parameters must not be assumed to forget sensitive information. Use invented examples.

## Use the lab

**Playground:** analyze text using the full circuit, source-shuffled circuit, disconnected circuit or encoder-only baseline. Inspect real simulated states, replay the six computed steps, and change the score threshold. Scores are uncalibrated, not reliable probabilities.

**Training lab:** add invented labeled examples, import JSON/JSONL, train all four learned models, cancel safely, and import/export graph-bound weights. Internal connectome weights remain fixed; only the logistic readouts learn.

```json
{"text":"Write to fictional@example.com","labels":["email"]}
```

Labels are `email`, `phone`, `ssn`, or `none`. Multiple PII labels may be combined; `none` must appear alone. Inputs are limited to 2,000 characters and custom data to 400 examples. Unsupported or oversized inputs fail visibly rather than being silently truncated.

**Benchmark:** compare all four learned detectors and a separate regex baseline on 320 synthetic holdout examples. Inspect confusion counts, precision, recall, F1, class-specific results and actual mistakes. Nothing routes fly predictions through regex or another detector.

## Model and controls

Generic character 1-4-grams are hashed into 512 features. A seeded artificial projection stimulates every neuron. Six recurrent rate-model steps propagate activity over every recorded edge. Positive synaptic counts are normalized by total incoming count and scaled by 0.85. The state equation is:

```
h_next = 0.45 * h + 0.55 * tanh(text_drive + W * h)
```

The final and time-mean states of 512 seeded nodes feed a three-head logistic readout. These artificial ports are not identified sensory or motor neurons. The model does not simulate spikes, transmitter signs, dopamine or biological learning. It tests the usefulness of the recorded wiring, not the faithfulness of a whole-animal emulation.

The source-shuffled control preserves in/out edge-count degrees and target weight totals, but permits parallel edges and does not preserve per-source total weight. The disconnected control retains the same input projection with recurrence removed. Encoder-only removes the entire circuit. These controls matter: more neurons are not evidence of a better detector.

## Evidence and reproduction

```sh
npm test
npm run train
npm run build
python -m pip install playwright==1.56.0
python -m playwright install --with-deps chromium
npm run test:browser
```

`reports/full-benchmark.json` is measured using the complete graph in Node. `reports/browser-benchmark.json` measures the same models through the browser. `reports/browser-verification.json` records actual workflow checks, graph coverage, numerical parity and viewport sizes. Screenshots are in `reports/`. The Actions run is the source of truth for whether a particular commit passed.

The data build is separately reproducible with Python 3.12, numpy 2.2.6, scipy 1.15.3 and pyarrow 20.0.0: `python scripts/prepare_data.py`. It downloads the canonical Zenodo files, verifies upstream MD5s, aggregates positive directed pairs, retains all IDs and emits SHA-256-protected chunks. `python -m unittest discover -s tests -p test_prepare.py` checks preparation invariants.

`npm run test:fixture` creates **explicit synthetic test data**, not a smaller fly. Production loaders reject those data. Only local preflight tests may opt in using `FLYPII_TEST_FIXTURE=1` and `?fixture=1`; CI for the full model never uses that flag. Never publish fixture weights as full-brain results.

## Limits

Only email, US-phone and SSN-shaped text patterns are targeted. The model does not validate real identities, extract entity spans, recognize all names/addresses, or promise protection against obfuscation and real-world distribution shifts. Synthetic training and holdout templates differ, but both are part of the same development generator. Reported F1 is not an independent external evaluation. There is no claim that biological wiring beats the controls.

Desktop Chromium and a mobile-sized Chromium viewport are tested. This is not physical phone testing; Safari/iOS and low-memory device performance remain unverified. The full graph uses substantial memory, especially while training both original and shuffled models. Training or benchmarking may take several minutes.

## Licensing

Original application code follows this repository's MIT `LICENSE`. **FlyWire public-release data is CC BY-NC 4.0**, not unrestricted commercial data. Preserve attribution and obtain appropriate permissions before commercial use. See [DATA_LICENSE.md](DATA_LICENSE.md) for source links, modifications and terms. The code license does not override third-party data rights.

Source: FlyWire Consortium, [v783 connectivity release](https://zenodo.org/records/10676866); Dorkenwald et al., [Nature 634, 124-138 (2024)](https://doi.org/10.1038/s41586-024-07558-y).
