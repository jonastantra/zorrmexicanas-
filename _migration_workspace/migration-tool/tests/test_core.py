import tempfile
import unittest
from pathlib import Path

from src.core import _estimate_insert_rows, _unsafe_member


class CoreTests(unittest.TestCase):
    def test_estimate_insert_rows_ignores_parentheses_in_strings(self):
        line = "INSERT INTO `x` (`a`) VALUES (1,'hello (x)'),(2,'ok');"
        self.assertEqual(_estimate_insert_rows(line), 2)

    def test_archive_path_validation(self):
        self.assertTrue(_unsafe_member("../escape.txt"))
        self.assertTrue(_unsafe_member("/absolute.txt"))
        self.assertFalse(_unsafe_member("theme/style.css"))


if __name__ == "__main__":
    unittest.main()

