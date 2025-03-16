import streamlit as st
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple
import plotly.graph_objects as go

def fundamental_flow_page():
    st.title("🌊 Fundamental Flow Analysis")
    
    st.markdown("""
    ## Understanding Flows Theory
    Flows Theory is an adaptation of industrial web thinking to the information age. It envisions adversary 
    power as the nexus of many different flows, seeking to find the most efficient way to interdict these 
    flows while protecting friendly flows.
    """)

    # Initialize session state variables
    if 'flow_data' not in st.session_state:
        st.session_state.flow_data = {
            'People': {'nodes': [], 'links': []},
            'Material': {'nodes': [], 'links': []},
            'Data': {'nodes': [], 'links': []},
            'Energy': {'nodes': [], 'links': []},
            'Money': {'nodes': [], 'links': []}
        }

    # Sidebar for flow selection and analysis options
    st.sidebar.subheader("Flow Analysis Controls")
    selected_flow = st.sidebar.selectbox(
        "Select Flow Type",
        ["People", "Material", "Data", "Energy", "Money"]
    )

    analysis_mode = st.sidebar.radio(
        "Analysis Mode",
        ["Flow Mapping", "Node Analysis", "Vulnerability Assessment", "Flow Integration"]
    )

    # Main content area
    st.subheader(f"Analyzing {selected_flow} Flow")
    
    # Description of the selected flow
    flow_descriptions = {
        "People": "Human intent and will animate and drive all actions and choices in warfare, from tactical details to strategic aims.",
        "Material": "From unrefined resources to usable products, matter is central to warfighting.",
        "Data": "Ranges from raw data through information and intelligence to insights, including designs and plans.",
        "Energy": "Enables matter (people and materiel) to do work, can be transformed between states.",
        "Money": "Acts as the pressuring force behind all other flows and sets reference value to nodes and edges."
    }
    
    st.info(flow_descriptions[selected_flow])

    # Flow Mapping Interface
    if analysis_mode == "Flow Mapping":
        st.subheader("Flow Mapping")
        
        col1, col2 = st.columns(2)
        
        with col1:
            node_name = st.text_input("Node Name")
            node_type = st.selectbox("Node Type", ["Effector", "Transport"])
            node_refinement = st.slider("Refinement Level", 1, 10, 5)
            
            if st.button("Add Node"):
                if node_name:
                    st.session_state.flow_data[selected_flow]['nodes'].append({
                        'name': node_name,
                        'type': node_type,
                        'refinement': node_refinement
                    })
                    st.success(f"Added node: {node_name}")

        with col2:
            if len(st.session_state.flow_data[selected_flow]['nodes']) >= 2:
                source_node = st.selectbox(
                    "Source Node",
                    [node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']]
                )
                target_node = st.selectbox(
                    "Target Node",
                    [node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']]
                )
                link_type = st.selectbox("Link Type", ["Direct", "Transpose"])
                capacity = st.slider("Link Capacity", 1, 100, 50)
                
                if st.button("Add Link"):
                    if source_node and target_node:
                        st.session_state.flow_data[selected_flow]['links'].append({
                            'source': source_node,
                            'target': target_node,
                            'type': link_type,
                            'capacity': capacity
                        })
                        st.success("Added link")

        # Visualize the flow network
        if st.session_state.flow_data[selected_flow]['nodes']:
            st.subheader("Flow Network Visualization")
            visualize_flow_network(selected_flow)

    # Node Analysis Interface
    elif analysis_mode == "Node Analysis":
        st.subheader("Node Analysis")
        
        if st.session_state.flow_data[selected_flow]['nodes']:
            selected_node = st.selectbox(
                "Select Node to Analyze",
                [node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']]
            )
            
            node_data = next(node for node in st.session_state.flow_data[selected_flow]['nodes'] 
                           if node['name'] == selected_node)
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.metric("Refinement Level", node_data['refinement'])
                st.metric("Node Type", node_data['type'])
            
            with col2:
                incoming = len([link for link in st.session_state.flow_data[selected_flow]['links'] 
                              if link['target'] == selected_node])
                outgoing = len([link for link in st.session_state.flow_data[selected_flow]['links'] 
                              if link['source'] == selected_node])
                
                st.metric("Incoming Connections", incoming)
                st.metric("Outgoing Connections", outgoing)

    # Vulnerability Assessment Interface
    elif analysis_mode == "Vulnerability Assessment":
        st.subheader("Vulnerability Assessment")
        
        if st.session_state.flow_data[selected_flow]['nodes']:
            vulnerabilities = assess_vulnerabilities(selected_flow)
            
            st.markdown("### Critical Nodes")
            for node, score in vulnerabilities['critical_nodes']:
                st.warning(f"Node: {node} - Vulnerability Score: {score:.2f}")
            
            st.markdown("### Critical Links")
            for link, score in vulnerabilities['critical_links']:
                st.warning(f"Link: {link[0]} → {link[1]} - Vulnerability Score: {score:.2f}")

    # Flow Integration Interface
    elif analysis_mode == "Flow Integration":
        st.subheader("Flow Integration Analysis")
        
        other_flows = [flow for flow in st.session_state.flow_data.keys() if flow != selected_flow]
        integration_flow = st.selectbox("Select Flow to Integrate With", other_flows)
        
        if st.button("Analyze Integration"):
            integration_points = analyze_flow_integration(selected_flow, integration_flow)
            
            st.markdown("### Integration Points")
            for point in integration_points:
                st.info(f"Integration Opportunity: {point}")

def visualize_flow_network(flow_type: str):
    """Visualize the flow network using Plotly"""
    nodes = st.session_state.flow_data[flow_type]['nodes']
    links = st.session_state.flow_data[flow_type]['links']
    
    G = nx.DiGraph()
    
    # Add nodes
    for node in nodes:
        G.add_node(node['name'], 
                  node_type=node['type'],
                  refinement=node['refinement'])
    
    # Add edges
    for link in links:
        G.add_edge(link['source'], 
                  link['target'], 
                  link_type=link['type'],
                  capacity=link['capacity'])
    
    # Create Plotly figure
    pos = nx.spring_layout(G)
    
    edge_trace = go.Scatter(
        x=[], y=[],
        line=dict(width=0.5, color='#888'),
        hoverinfo='none',
        mode='lines')

    node_trace = go.Scatter(
        x=[], y=[],
        mode='markers+text',
        hoverinfo='text',
        text=[],
        marker=dict(
            showscale=True,
            colorscale='YlGnBu',
            size=10,
        ))

    # Add edges to visualization
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_trace['x'] += tuple([x0, x1, None])
        edge_trace['y'] += tuple([y0, y1, None])

    # Add nodes to visualization
    node_trace['x'] = [pos[node][0] for node in G.nodes()]
    node_trace['y'] = [pos[node][1] for node in G.nodes()]
    node_trace['text'] = list(G.nodes())

    # Create the figure
    fig = go.Figure(data=[edge_trace, node_trace],
                   layout=go.Layout(
                       showlegend=False,
                       hovermode='closest',
                       margin=dict(b=0,l=0,r=0,t=0),
                       xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                       yaxis=dict(showgrid=False, zeroline=False, showticklabels=False))
                   )

    st.plotly_chart(fig)

def assess_vulnerabilities(flow_type: str) -> Dict:
    """Assess vulnerabilities in the flow network"""
    nodes = st.session_state.flow_data[flow_type]['nodes']
    links = st.session_state.flow_data[flow_type]['links']
    
    # Create a simple scoring system
    critical_nodes = []
    critical_links = []
    
    # Analyze node criticality
    for node in nodes:
        incoming = len([link for link in links if link['target'] == node['name']])
        outgoing = len([link for link in links if link['source'] == node['name']])
        
        # Simple vulnerability score based on connectivity and refinement
        score = (incoming + outgoing) * node['refinement'] / 10
        critical_nodes.append((node['name'], score))
    
    # Analyze link criticality
    for link in links:
        # Simple vulnerability score based on capacity
        score = link['capacity'] / 100
        critical_links.append(((link['source'], link['target']), score))
    
    return {
        'critical_nodes': sorted(critical_nodes, key=lambda x: x[1], reverse=True),
        'critical_links': sorted(critical_links, key=lambda x: x[1], reverse=True)
    }

def analyze_flow_integration(flow_type: str, other_flow: str) -> List[str]:
    """Analyze potential integration points between two flows"""
    flow1_nodes = st.session_state.flow_data[flow_type]['nodes']
    flow2_nodes = st.session_state.flow_data[other_flow]['nodes']
    
    integration_points = []
    
    # Simple analysis looking for nodes of similar refinement levels
    for node1 in flow1_nodes:
        for node2 in flow2_nodes:
            if abs(node1['refinement'] - node2['refinement']) <= 2:
                integration_points.append(
                    f"{flow_type} node '{node1['name']}' could integrate with "
                    f"{other_flow} node '{node2['name']}' (Refinement match)"
                )
    
    return integration_points

if __name__ == "__main__":
    fundamental_flow_page() 