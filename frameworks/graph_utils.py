"""Reusable graph construction and conversion utilities.
Designed for CauseWay and other apps (e.g. cog.py).
"""
from collections import defaultdict
from typing import Dict, Any
import itertools
import networkx as nx

__all__ = ["build_graph", "convert_graph_to_d3"]


def build_graph(
    # Convert the nested CauseWay data_structure into a NetworkX graph.

    data_structure: Dict[str, Any],
    filter_out_reqs: bool = False,
    filter_out_caps: bool = False,
    filter_out_pptars: bool = False,
) -> nx.Graph:
    """Convert the nested CauseWay data_structure into a NetworkX graph.

    Node types:
    - putar (Ultimate Target)
    - capability (Critical Capability)
    - requirement (Critical Requirement)
    - pptar (Proximate Target)
    """
    G = nx.Graph()

    # Deterministic colour palette (cycled when > len palette)
    color_palette = [
        "#1f77b4", # blue
        "#ff7f0e", # orange
        "#2ca02c", # green
        "#d62728", # red
        "#9467bd", # purple
        "#8c564b", # brown
        "#e377c2", # pink
        "#7f7f7f", # gray
        "#bcbd22", # yellow
        "#17becf", # cyan
    ]

    pptar_to_putars = defaultdict(set)
    for putar, putar_data in data_structure.items():
        # Add PUTAR node
        for cap_data in putar_data.get("capabilities", {}).values():
            for req_data in cap_data.get("requirements", {}).values():
                for pptar in req_data.get("potential_ptars", []):
                    pptar_to_putars[pptar].add(putar)

    # Assign a colour per pptar cluster (shared across PUTARs)
    pptar_color_map = {
        # Add PPTAR node
        pptar: color_palette[i % len(color_palette)]
        for i, pptar in enumerate(sorted(pptar_to_putars))
    }

    for putar, putar_data in data_structure.items():
        # Add PUTAR node
        putar_id = f"putar::{putar}"
        G.add_node(putar_id, label=putar, type="putar", group_color="#3f37c9")

        for cap, cap_data in putar_data.get("capabilities", {}).items():
            # Add CAP node
            cap_id = f"cap::{putar}::{cap}"
            if not filter_out_caps:
                G.add_node(cap_id, label=cap, type="capability", group_color="#264653")
                G.add_edge(putar_id, cap_id)

            for req, req_data in cap_data.get("requirements", {}).items():
                # Add REQ node
                req_id = f"req::{putar}::{cap}::{req}"
                if not filter_out_reqs:
                    G.add_node(req_id, label=req, type="requirement", group_color="#e76f51")
                    parent = cap_id if not filter_out_caps else putar_id
                    G.add_edge(parent, req_id)

                for pptar in req_data.get("potential_ptars", []):
                    # Add PPTAR node
                    pptar_id = f"pptar::{pptar}"
                    pptar_color = pptar_color_map[pptar]
                    if not filter_out_pptars:
                        if pptar_id not in G:
                            G.add_node(
                                pptar_id,
                                label=pptar,
                                type="pptar",
                                group_color=pptar_color,
                            )
                        # Connect pptar to appropriate parent
                        if not filter_out_reqs:
                            G.add_edge(req_id, pptar_id)
                        elif not filter_out_caps:
                            G.add_edge(cap_id, pptar_id)
                        else:
                            G.add_edge(putar_id, pptar_id)

    return G


def convert_graph_to_d3(graph: nx.Graph) -> dict:
    """Convert a NetworkX graph to a D3-compatible dict (nodes + links)."""

    def border_color(node_type: str) -> str:
            return {
            "putar": "#3f37c9",
            "capability": "#264653",
            "requirement": "#e76f51",
            "pptar": "#5e548e",
        }.get(node_type, "#999999")

    nodes = [
        {
            "id": node_id,
            "label": data.get("label", node_id),
            "type": data.get("type", "unknown"),
            "group_color": data.get("group_color", "#cccccc"),
            "border_color": border_color(data.get("type", "unknown")),
        }
        for node_id, data in graph.nodes(data=True)
    ]

    links = [{"source": u, "target": v} for u, v in graph.edges()]
    return {"nodes": nodes, "links": links}
