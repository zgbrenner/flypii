import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).parents[1] / 'scripts' / 'prepare_data.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class PreparationTests(unittest.TestCase):
    def test_all_nodes_duplicates_and_direction(self):
        graph = prepare.pack_connectome(np.array([30, 10, 20], dtype='uint64'), [10, 10, 20], [20, 20, 10], [2, 3, 7])
        self.assertEqual(graph['neurons'], 3)
        self.assertEqual(graph['edges'], 2)
        self.assertEqual(graph['synapses'], 12)
        self.assertEqual(graph['ids'].tolist(), [10, 20, 30])
        self.assertEqual(graph['indptr'].tolist(), [0, 1, 2, 2])
        self.assertEqual(graph['indices'].tolist(), [1, 0])
        self.assertEqual(graph['counts'].tolist(), [5, 7])
    def test_unknown_id_rejected(self):
        with self.assertRaises(ValueError):
            prepare.pack_connectome([10,20], [10], [99], [1])
    def test_nonpositive_weight_rejected(self):
        for value in [0, -1, .5, float('nan')]:
            with self.assertRaises(ValueError):
                prepare.pack_connectome([10,20], [10], [20], [value])
    def test_duplicate_node_rejected(self):
        with self.assertRaises(ValueError):
            prepare.pack_connectome([10,10], [10], [10], [1])
    def test_binary_roundtrip(self):
        g=prepare.pack_connectome([10,20], [10], [20], [1])
        raw=prepare.serialize(g)
        self.assertEqual(raw[:8], b'FLYPII02')
        self.assertEqual(len(raw), 32+16+12+4+4)

if __name__ == '__main__': unittest.main()
