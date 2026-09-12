# FlyWire data license and attribution

The graph in `data/` is a transformed copy of FlyWire public release v783. It is not covered by the application code's MIT license. FlyWire's official public-release guidelines specify **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

- Official terms and citation guidance: https://flywire.ai/guidelines
- License: https://creativecommons.org/licenses/by-nc/4.0/
- Canonical source: FlyWire Consortium, FlyWire Whole-brain Connectome Connectivity Data, version 783.0, https://zenodo.org/records/10676866
- Connectome reference: Dorkenwald et al., Neuronal wiring diagram of an adult brain, Nature 634, 124-138 (2024), https://doi.org/10.1038/s41586-024-07558-y

Credit the FlyWire Consortium and original authors, preserve the license and source links, and identify modifications. Commercial use requires checking and obtaining appropriate permissions from the rights holders. MIT licensing of original software does not grant additional rights in third-party data.

## Modifications by FlyPII

All 139,255 proofread root IDs are retained and sorted. Positive source-to-target counts are summed across neuropils, yielding 15,091,983 directed neuron pairs and 54,492,922 synaptic contacts. No minimum-count threshold, top-k filter, or neuron subsampling is applied. CSR binary serialization and 15 gzip chunks are protected by SHA-256 checksums in `data/manifest.json`.

This is the complete published proofread brain dataset, not an entire nervous system, full biological dynamics, or an uploaded consciousness. Normalization, artificial input projection, rate equations and learned readouts are engineering choices, not measurements from this animal.
