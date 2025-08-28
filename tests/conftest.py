import pytest
import pandas as pd

@pytest.fixture
def sample_dataframe():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame({
        "col1": [1, 2, 3],
        "col2": ["a", "b", "c"]
    })

@pytest.fixture
def sample_ach_data():
    """Create sample ACH analysis data for testing."""
    hypotheses = ["H1", "H2"]
    evidence = ["E1", "E2", "E3"]
    matrix = {
        ("E1", "H1"): "CC",
        ("E1", "H2"): "I",
        ("E2", "H1"): "N",
        ("E2", "H2"): "CC",
        ("E3", "H1"): "I",
        ("E3", "H2"): "N"
    }
    weights = {"E1": 3, "E2": 2, "E3": 1}
    return hypotheses, evidence, matrix, weights
