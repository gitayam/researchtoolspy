import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import networkx as nx
from frameworks import causeway as causeway_module

# Direct import from the actual file to avoid NoneType due to __init__.py
import importlib.util
spec = importlib.util.spec_from_file_location("causeway", os.path.join(os.path.dirname(__file__), "../frameworks/causeway.py"))
causeway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(causeway)

# Test build_graph with a simple data structure
def test_build_graph_basic():
    data = {
        'UT1': {
            'capabilities': {
                'Cap1': {'requirements': ['Req1', 'Req2']},
                'Cap2': {'requirements': []},
            }
        },
        'UT2': {
            'capabilities': {
                'Cap3': {'requirements': ['Req3']}
            }
        }
    }
    graph = causeway.build_graph(data)
    assert isinstance(graph, nx.DiGraph)
    # Check nodes and edges
    nodes = set(graph.nodes)
    edges = set(graph.edges)
    # Updated assertions to match the actual node naming convention
    assert 'putar::UT1' in nodes
    assert 'cap::UT1::Cap1' in nodes
    assert 'req::UT1::Cap1::Req1' in nodes
    assert ('putar::UT1', 'cap::UT1::Cap1') in edges
    assert ('cap::UT1::Cap1', 'req::UT1::Cap1::Req1') in edges

# Test build_edge_trace returns a Plotly Scatter object
def test_build_edge_trace_type():
    G = nx.DiGraph()
    G.add_edge('A', 'B')
    pos = {'A': (0, 0), 'B': (1, 1)}
    trace = causeway.build_edge_trace(G, pos)
    import plotly.graph_objs as go
    assert isinstance(trace, go.Scatter)

# Test build_node_traces returns a list of Plotly Scatter objects
def test_build_node_traces_type():
    G = nx.DiGraph()
    G.add_edge('A', 'B')
    pos = {'A': (0, 0), 'B': (1, 1)}
    traces = causeway.build_node_traces(G, pos)
    import plotly.graph_objs as go
    assert isinstance(traces, list)
    assert all(isinstance(t, go.Scatter) for t in traces)

# Smoke test for main (should not raise exceptions)
def test_main_smoke(monkeypatch):
    # Patch streamlit functions to avoid UI calls
    import types
    import streamlit as st
    
    # Create a context manager compatible SimpleNamespace
    class ContextManagerNamespace(types.SimpleNamespace):
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            return False
    
    # Handle both integer and list arguments for columns
    def mock_columns(*a, **k):
        if a and isinstance(a[0], list):
            return [ContextManagerNamespace() for _ in range(len(a[0]))]
        else:
            return [ContextManagerNamespace() for _ in range(a[0] if a else 2)]
    
    monkeypatch.setattr(st, 'markdown', lambda *a, **k: None)
    monkeypatch.setattr(st, 'text_input', lambda *a, **k: '')
    monkeypatch.setattr(st, 'columns', mock_columns)
    monkeypatch.setattr(st, 'button', lambda *a, **k: False)
    monkeypatch.setattr(st, 'warning', lambda *a, **k: None)
    monkeypatch.setattr(st, 'spinner', lambda *a, **k: ContextManagerNamespace())
    monkeypatch.setattr(st, 'session_state', {})
    monkeypatch.setattr(st, 'info', lambda *a, **k: None)
    monkeypatch.setattr(st, 'checkbox', lambda *a, **k: False)
    monkeypatch.setattr(st, 'plotly_chart', lambda *a, **k: None)
    monkeypatch.setattr(st, 'write', lambda *a, **k: None)
    monkeypatch.setattr(st, 'tabs', lambda *a, **k: [ContextManagerNamespace() for _ in range(len(a[0]) if a else 2)])
    # Patch rerun
    monkeypatch.setattr(st, 'rerun', lambda: None)
    # Patch get_completion and get_chat_completion
    monkeypatch.setattr(causeway, 'get_completion', lambda *a, **k: '')
    monkeypatch.setattr(causeway, 'get_chat_completion', lambda *a, **k: '')
    # Patch normalize_field_across_entities
    monkeypatch.setattr(causeway, 'normalize_field_across_entities', lambda *a, **k: None)
    # Run main (should not raise)
    causeway.main()
