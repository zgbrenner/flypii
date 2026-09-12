# FlyWire data license and attribution

The graph in `data/` is a transformed copy of FlyWire public release v783. It is not covered by the application code's MIT license. FlyWire's official public-release guidelines specify **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

- Official terms and citation guidance: https://flywire.ai/guidelines
- License: https://creativecommons.org/licenses/by-nc/4.0/
- Canonical source: FlyWire Consortium, FlyWire Whole-brain Connectome Connectivity Data, version 783.0, https://zenodo.org/records/10676866
- Connectome reference: Dorkenwald et al., Neuronal wiring diagram of an adult brain, Nature 634, 124-138 (2024), https://doi.org/10.1038/s41586-024-07558-y

Credit the FlyWire Consortium and the original authors, preserve the license and source links, and identify modifications. Commercial use requires checking and obtaining the appropriate permissions from the rights holders. The MIT license on this repository's original software does not grant additional rights in third-party data. Do not describe these data as unrestricted commercial assets.

## Modifications by FlyPII

All 139,255 proofread root IDs are retained and sorted. Positive source-to-target counts are summed across neuropils, yielding 15,091,983 directed neuron pairs and 54,492,922 synaptic contacts. No minimum-count threshold, top-k filter, or neuron subsampling is applied. The graph is serialized to a compact CSR binary and split into 15 gzip chunks. Each chunk and the reconstructed binary have SHA-256 checksums in `data/manifest.json`.

This is the complete published **proofread brain** dataset, not an entire fly nervous system, a complete physical account of neural dynamics, or an uploaded consciousness. The simulation's normalization, artificial input projection, rate equations and learned readout are engineering choices, not measurements from this animal.
