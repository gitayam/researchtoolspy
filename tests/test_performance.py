import pytest
import time
from utilities.helpers import remove_markdown, export_ach_matrix_to_excel

def test_remove_markdown_performance():
    # Generate a large markdown document
    large_markdown = "**Bold text**\n" * 1000
    
    start_time = time.time()
    remove_markdown(large_markdown)
    end_time = time.time()
    
    # Assert that processing takes less than a reasonable threshold (e.g., 1 second)
    assert end_time - start_time < 1.0

def test_export_ach_matrix_performance():
    # Generate a large ACH matrix
    hypotheses = [f"Hypothesis {i}" for i in range(20)]
    evidence = [f"Evidence {i}" for i in range(100)]
    ach_matrix = {(e, h): "Consistent" for e in evidence for h in hypotheses}
    evidence_weights = {e: i % 5 + 1 for i, e in enumerate(evidence)}
    
    start_time = time.time()
    export_ach_matrix_to_excel(hypotheses, evidence, ach_matrix, evidence_weights)
    end_time = time.time()
    
    # Assert that processing takes less than a reasonable threshold (e.g., 5 seconds)
    assert end_time - start_time < 5.0
