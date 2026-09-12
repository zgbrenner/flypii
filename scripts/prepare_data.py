"""Build an unthresholded whole-proofread-brain CSR from the pinned FlyWire release.
Only duplicate (source, target) rows across neuropils are summed. No pruning,
random replacement, top-k selection, or minimum synapse-count filter is applied.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import json
import struct
import time
import urllib.request
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix

SOURCE = 'https://zenodo.org/records/10676866/files/'
FILES = {
    'proofread_root_ids_783.npy': 'e0e6c19732fd8c7a4e39a2d170105421',
    'proofread_connections_783.feather': 'f48f972d262323a102aed49af1396b8a',
}

def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(8 << 20), b''): h.update(block)
    return h.hexdigest()

def download(name, cache):
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / name
    if target.exists() and digest(target, 'md5') == FILES[name]: return target
    for attempt in range(3):
        temporary = target.with_suffix('.partial')
        try:
            req = urllib.request.Request(SOURCE + name + '?download=1', headers={'User-Agent': 'FlyPII-reproducible-research/0.2'})
            with urllib.request.urlopen(req, timeout=180) as src, open(temporary, 'wb') as dst:
                while block := src.read(8 << 20): dst.write(block)
            if digest(temporary, 'md5') != FILES[name]: raise ValueError('Upstream checksum mismatch: ' + name)
            temporary.replace(target)
            return target
        except Exception:
            temporary.unlink(missing_ok=True)
            if attempt == 2: raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError('Download failed')

def pack_connectome(root_ids, pre, post, counts):
    ids = np.sort(np.asarray(root_ids, dtype=np.uint64))
    if ids.ndim != 1 or not len(ids) or np.any(ids[1:] <= ids[:-1]): raise ValueError('Node IDs must be unique')
    pre, post = np.asarray(pre, dtype=np.uint64), np.asarray(post, dtype=np.uint64)
    weights = np.asarray(counts, dtype=np.float64)
    if pre.shape != post.shape or pre.shape != weights.shape or pre.ndim != 1: raise ValueError('Mismatched edge columns')
    if np.any(~np.isfinite(weights)) or np.any(weights <= 0) or np.any(weights != np.floor(weights)): raise ValueError('Counts must be positive integers')
    src, dst = np.searchsorted(ids, pre), np.searchsorted(ids, post)
    if np.any(src >= len(ids)) or np.any(dst >= len(ids)): raise ValueError('Edge references an unknown node')
    if np.any(ids[src] != pre) or np.any(ids[dst] != post): raise ValueError('Edge references an unknown node')
    mat = coo_matrix((weights.astype(np.int64), (src, dst)), shape=(len(ids), len(ids))).tocsr()
    mat.sort_indices()
    if mat.nnz >= 2**32 or int(mat.data.max(initial=0)) >= 2**32 or int(mat.sum()) >= 2**32: raise ValueError('Graph exceeds version-2 integer limits')
    return dict(ids=ids, indptr=mat.indptr.astype('<u4'), indices=mat.indices.astype('<u4'), counts=mat.data.astype('<u4'), neurons=len(ids), edges=mat.nnz, synapses=int(mat.sum()), inputRows=len(weights))

def serialize(g):
    header = struct.pack('<8s6I', b'FLYPII02', 2, g['neurons'], g['edges'], g['synapses'], 0, 0)
    return b''.join([header, g['ids'].astype('<u8').tobytes(), g['indptr'].tobytes(), g['indices'].tobytes(), g['counts'].tobytes()])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=Path('.cache/flywire'))
    parser.add_argument('--output', type=Path, default=Path('data'))
    args = parser.parse_args()
    paths = {name: download(name, args.cache) for name in FILES}
    import pyarrow.feather as feather
    ids = np.load(paths['proofread_root_ids_783.npy'], allow_pickle=False)
    if len(ids) != 139255: raise ValueError('Expected all 139,255 proofread neurons')
    table = feather.read_table(paths['proofread_connections_783.feather'], columns=['pre_pt_root_id', 'post_pt_root_id', 'syn_count'])
    g = pack_connectome(ids, table['pre_pt_root_id'].to_numpy(), table['post_pt_root_id'].to_numpy(), table['syn_count'].to_numpy())
    del table
    raw = serialize(g)
    args.output.mkdir(parents=True, exist_ok=True)
    parts = []
    for index, start in enumerate(range(0, len(raw), 8 << 20)):
        block = raw[start:start + (8 << 20)]
        payload = gzip.compress(block, compresslevel=6, mtime=0)
        name = f'connectome-{index:03d}.bin.gz'
        (args.output / name).write_bytes(payload)
        parts.append(dict(file=name, bytes=len(payload), rawBytes=len(block), sha256=hashlib.sha256(payload).hexdigest()))
    manifest = dict(format='flypii-csr', version=2, id='flywire783-proofread-all-1plus-v2', neurons=g['neurons'], edges=g['edges'], synapses=g['synapses'], inputRows=g['inputRows'], bytes=len(raw), downloadBytes=sum(p['bytes'] for p in parts), sha256=hashlib.sha256(raw).hexdigest(), parts=parts, source='https://zenodo.org/records/10676866', sourceVersion='783.0', sourceFiles={n:dict(md5=FILES[n], sha256=digest(p)) for n,p in paths.items()}, preprocessing='All proofread neurons retained, including isolated nodes. All positive connections retained. Counts summed across neuropils per directed neuron pair. No minimum-count filtering. No synapse sign inference.', citation='Dorkenwald et al. Nature 634, 124-138 (2024). doi:10.1038/s41586-024-07558-y')
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({k:v for k,v in manifest.items() if k != 'parts'}, indent=2), flush=True)

if __name__ == '__main__': main()
