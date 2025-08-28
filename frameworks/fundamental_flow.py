import streamlit as st
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple
import plotly.graph_objects as go

def fundamental_flow_page():
    st.title("🌊 Fundamental Flow Analysis")
    
    # Introduction with clear explanation
    st.markdown("""
    ## Understanding Flows Theory
    Flows Theory helps analyze how different resources move through a system. It envisions adversary power 
    as the nexus of many different flows, seeking to find the most efficient way to interdict these flows 
    while protecting friendly flows.
    
    ### Key Concepts:
    - 🔄 **Flows**: Networks of resources moving through a system
    - 🎯 **Nodes**: Connection points where flows meet or transform
    - 🔗 **Links**: Pathways between nodes
    - 📊 **Refinement**: How processed/valuable a resource becomes
    """)

    # Add example diagram using HTML/CSS
    st.markdown("""
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h4 style="text-align: center;">Example Flow Network Structure</h4>
        <div style="text-align: center;">
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDwhLS0gRWZmZWN0b3IgTm9kZSAtLT4KICAgIDxjaXJjbGUgY3g9IjIwMCIgY3k9IjUwIiByPSIzMCIgZmlsbD0iI2FhYWFhYSIvPgogICAgPHRleHQgeD0iMjAwIiB5PSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iYmxhY2siPkVmZmVjdG9yPC90ZXh0PgogICAgPHRleHQgeD0iMjAwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iYmxhY2siPk5vZGU8L3RleHQ+CgogICAgPCEtLSBUcmFuc3BvcnQgTm9kZXMgLS0+CiAgICA8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSIjODg4ODg4Ii8+CiAgICA8Y2lyY2xlIGN4PSIzMDAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSIjODg4ODg4Ii8+CiAgICA8dGV4dCB4PSIxMDAiIHk9IjE0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iYmxhY2siPlRyYW5zcG9ydDwvdGV4dD4KICAgIDx0ZXh0IHg9IjEwMCIgeT0iMTYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+Tm9kZTwvdGV4dD4KICAgIDx0ZXh0IHg9IjMwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+VHJhbnNwb3J0PC90ZXh0PgogICAgPHRleHQgeD0iMzAwIiB5PSIxNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9ImJsYWNrIj5Ob2RlPC90ZXh0PgoKICAgIDwhLS0gRGlyZWN0IExpbmtzIC0tPgogICAgPGxpbmUgeDE9IjEyMCIgeTE9IjEzMCIgeDI9IjE4MCIgeTI9IjcwIiBzdHJva2U9IiMwMDY2Y2MiIHN0cm9rZS13aWR0aD0iMyIvPgogICAgPGxpbmUgeDE9IjI4MCIgeTE9IjEzMCIgeDI9IjIyMCIgeTI9IjcwIiBzdHJva2U9IiMwMGNjMDAiIHN0cm9rZS13aWR0aD0iMyIvPgoKICAgIDwhLS0gVHJhbnNwb3NlIExpbmsgLS0+CiAgICA8bGluZSB4MT0iMTIwIiB5MT0iMTUwIiB4Mj0iMjgwIiB5Mj0iMTUwIiBzdHJva2U9IiNmZjY2MDAiIHN0cm9rZS13aWR0aD0iMyIvPgoKICAgIDwhLS0gTGluayBMYWJlbHMgLS0+CiAgICA8dGV4dCB4PSIxMzAiIHk9IjkwIiBmaWxsPSIjMDA2NmNjIj5EaXJlY3QgTGlua3M8L3RleHQ+CiAgICA8dGV4dCB4PSIyMDAiIHk9IjE4MCIgZmlsbD0iI2ZmNjYwMCI+VHJhbnNwb3NlIExpbms8L3RleHQ+Cjwvc3ZnPg==" 
                 alt="Flow Network Example" 
                 style="max-width: 100%; height: auto;">
        </div>
        <div style="margin-top: 15px;">
            <p><strong>Node Types:</strong></p>
            <ul>
                <li><strong>Effector Nodes:</strong> Integrate flows to produce tactical effects (e.g., platforms)</li>
                <li><strong>Transport Nodes:</strong> Direct, refine, store, or distribute flows</li>
            </ul>
            <p><strong>Link Types:</strong></p>
            <ul>
                <li><strong>Direct Links:</strong> Move flows downstream (e.g., supply routes, data links)</li>
                <li><strong>Transpose Links:</strong> Convert one flow type to another (e.g., energy to refined material)</li>
            </ul>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Initialize session state variables
    if 'flow_data' not in st.session_state:
        st.session_state.flow_data = {
            'People': {'nodes': [], 'links': []},
            'Material': {'nodes': [], 'links': []},
            'Data': {'nodes': [], 'links': []},
            'Energy': {'nodes': [], 'links': []},
            'Money': {'nodes': [], 'links': []}
        }

    # Create two columns for main layout
    main_col1, main_col2 = st.columns([2, 1])
    
    with main_col2:
        st.sidebar.subheader("📊 Flow Analysis Controls")
        selected_flow = st.sidebar.selectbox(
            "Select Flow Type",
            ["People", "Material", "Data", "Energy", "Money"],
            help="Choose which type of flow you want to analyze"
        )

        analysis_mode = st.sidebar.radio(
            "Analysis Mode",
            ["Flow Mapping", "Guided Analysis", "Node Analysis", "Vulnerability Assessment", "Flow Integration"],
            help="""
            Flow Mapping: Create and visualize flow networks
            Guided Analysis: AI-assisted flow analysis questions
            Node Analysis: Examine individual components
            Vulnerability Assessment: Find weak points
            Flow Integration: Connect different flow types
            """
        )

    with main_col1:
        # Description of the selected flow with icons and expanded descriptions
        flow_icons = {
            "People": "👥",
            "Material": "📦",
            "Data": "💾",
            "Energy": "⚡",
            "Money": "💰"
        }
        
        st.subheader(f"{flow_icons[selected_flow]} Analyzing {selected_flow} Flow")
        
        flow_descriptions = {
            "People": {
                "summary": "Human intent and will animate and drive all actions and choices in warfare, from tactical details to strategic aims.",
                "details": """
                - Includes operators, decision makers, and support personnel
                - Extends to societal & governmental values
                - Encompasses relationships and authorities
                - Requires training, motivation, and coordination
                """
            },
            "Material": {
                "summary": "From unrefined resources to usable products, matter is central to warfighting.",
                "details": """
                - Raw materials and resources
                - Manufacturing and production
                - Supply chains and logistics
                - Maintenance and repair
                """
            },
            "Data": {
                "summary": "Ranges from raw data through information and intelligence to insights, including designs and plans.",
                "details": """
                - Intelligence and surveillance
                - Command and control systems
                - Communications networks
                - Planning and analysis tools
                """
            },
            "Energy": {
                "summary": "Enables matter (people and materiel) to do work, can be transformed between states.",
                "details": """
                - Fuel and power generation
                - Distribution networks
                - Storage systems
                - Conversion efficiency
                """
            },
            "Money": {
                "summary": "Acts as the pressuring force behind all other flows and sets reference value to nodes and edges.",
                "details": """
                - Financial resources
                - Budgeting and allocation
                - Economic constraints
                - Value assessment
                """
            }
        }
        
        with st.expander(f"About {selected_flow} Flow", expanded=True):
            st.info(flow_descriptions[selected_flow]["summary"])
            st.markdown(flow_descriptions[selected_flow]["details"])

        # Guided Analysis Mode
        if analysis_mode == "Guided Analysis":
            st.markdown(f"### 🤔 Guided {selected_flow} Flow Analysis")
            
            analysis_questions = {
                # fall back questions if ai fails and questions passed to ai to create specific ones 
                "People": [
                    "What are the key decision-making nodes in the system?",
                    "How are personnel trained and prepared for their roles?",
                    "What are the critical command and control relationships?",
                    "Where are the bottlenecks in personnel deployment?",
                    "How do cultural factors influence the flow of people?",
                    "What backup systems exist for key personnel positions?",
                    "How are specialized skills developed and maintained?"
                ],
                "Material": [
                    "What are the primary supply routes and alternatives?",
                    "Where are critical stockpiles located?",
                    "How are maintenance and repair capabilities distributed?",
                    "What are the key manufacturing or production nodes?",
                    "How are quality control measures implemented?",
                    "What are the most vulnerable points in the supply chain?",
                    "How are material flows prioritized during constraints?"
                ],
                "Data": [
                    "What are the primary communication pathways?",
                    "How is critical information backed up and secured?",
                    "Where are the key data processing nodes?",
                    "What redundancies exist in the information network?",
                    "How is data quality maintained through the system?",
                    "What are the critical intelligence collection points?",
                    "How is data transformed into actionable intelligence?"
                ],
                "Energy": [
                    "What are the primary power generation sources?",
                    "How is energy stored and distributed?",
                    "What are the key energy conversion points?",
                    "Where are the critical power infrastructure nodes?",
                    "How are energy reserves managed?",
                    "What backup power systems are in place?",
                    "How is energy efficiency optimized?"
                ],
                "Money": [
                    "What are the key funding sources and mechanisms?",
                    "How are resources allocated across the system?",
                    "Where are the critical financial decision points?",
                    "What economic constraints affect the system?",
                    "How are costs monitored and controlled?",
                    "What financial redundancies exist?",
                    "How are budgets adjusted during crisis?"
                ]
            }
            
            st.markdown("""
            Answer these questions to analyze your flow network. Consider both offensive (interdiction) 
            and defensive (protection) perspectives.
            """)
            
            for i, question in enumerate(analysis_questions[selected_flow], 1):
                response = st.text_area(
                    f"Q{i}: {question}",
                    key=f"q_{selected_flow}_{i}",
                    height=100,
                    help="Consider both offensive (interdiction) and defensive (protection) aspects"
                )
                
                if response:
                    # Suggest nodes or links based on the response
                    st.info(f"💡 Consider adding nodes or links related to: {response.split('.')[0]}")

        # Flow Mapping Interface with better organization
        if analysis_mode == "Flow Mapping":
            st.markdown("""
            ### 🗺️ Flow Mapping
            Create a network of nodes (points) and links (connections) to visualize your flow.
            """)

            # Move AI-assisted network building to the top
            st.markdown("### 🤖 Generate Network with AI")
            
            # Network Context Identification - moved up and simplified
            network_prompt = st.text_area(
                "Network Description",
                placeholder="""Describe the system you want to analyze. For example:
                'Analyzing the logistics network for maintaining forward-deployed aircraft, including maintenance crews, 
                spare parts supply chain, and technical data flow...'""",
                help="Provide context about the system you want to model, and AI will suggest nodes and connections",
                height=100
            )
            
            col1, col2 = st.columns(2)
            with col1:
                network_scope = st.selectbox(
                    "Network Scope",
                    ["Tactical", "Operational", "Strategic"],
                    help="""
                    - Tactical: Immediate battlefield effects
                    - Operational: Theater-level campaign
                    - Strategic: National/international impact
                    """
                )
            
            with col2:
                network_perspective = st.selectbox(
                    "Analysis Perspective",
                    ["Friendly Forces", "Adversary Forces", "Neutral/Third Party"],
                    help="Choose whose perspective you're analyzing from"
                )
            
            if st.button("🤖 Generate Network Suggestions", type="primary"):
                if network_prompt:
                    # Generate suggestions based on the flow type and prompt
                    suggestions = generate_network_suggestions(selected_flow, network_prompt)
                    
                    # Store suggestions in session state to maintain them
                    st.session_state.current_suggestions = suggestions
                    
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.markdown("#### Suggested Nodes")
                        for i, node in enumerate(suggestions['nodes']):
                            with st.container():
                                st.markdown(
                                    f"""
                                    <div style='padding: 10px; border-radius: 5px; background-color: #f0f2f6; margin: 5px 0;'>
                                    <strong>{node['name']}</strong><br>
                                    Type: {node['type']}<br>
                                    Refinement: {node['refinement']}/10<br>
                                    Rationale: {node['rationale']}
                                    </div>
                                    """,
                                    unsafe_allow_html=True
                                )
                                
                                if st.button(f"Add {node['name']}", key=f"add_node_{i}"):
                                    # Check if node already exists
                                    existing_names = [n['name'] for n in st.session_state.flow_data[selected_flow]['nodes']]
                                    if node['name'] not in existing_names:
                                        st.session_state.flow_data[selected_flow]['nodes'].append({
                                            'name': node['name'],
                                            'type': node['type'],
                                            'refinement': node['refinement'],
                                            'context': {
                                                'scope': network_scope,
                                                'perspective': network_perspective,
                                                'description': network_prompt
                                            }
                                        })
                                        st.success(f"Added node: {node['name']}")
                                        st.rerun()
                                    else:
                                        st.warning(f"Node {node['name']} already exists")
                    
                    with col2:
                        st.markdown("#### Suggested Connections")
                        for i, link in enumerate(suggestions['links']):
                            with st.container():
                                st.markdown(
                                    f"""
                                    <div style='padding: 10px; border-radius: 5px; background-color: #f0f2f6; margin: 5px 0;'>
                                    <strong>{link['source']} → {link['target']}</strong><br>
                                    Type: {link['type']}<br>
                                    Capacity: {link['capacity']}/100<br>
                                    Rationale: {link['rationale']}
                                    </div>
                                    """,
                                    unsafe_allow_html=True
                                )
                                
                                # Only show add button if both nodes exist
                                existing_names = [n['name'] for n in st.session_state.flow_data[selected_flow]['nodes']]
                                if link['source'] in existing_names and link['target'] in existing_names:
                                    if st.button(f"Add Connection", key=f"add_link_{i}"):
                                        # Check if link already exists
                                        existing_links = [(l['source'], l['target']) for l in st.session_state.flow_data[selected_flow]['links']]
                                        if (link['source'], link['target']) not in existing_links:
                                            st.session_state.flow_data[selected_flow]['links'].append({
                                                'source': link['source'],
                                                'target': link['target'],
                                                'type': link['type'],
                                                'capacity': link['capacity']
                                            })
                                            st.success(f"Added link: {link['source']} → {link['target']}")
                                            st.rerun()
                                        else:
                                            st.warning(f"Connection already exists")
                                else:
                                    st.info("Add both nodes first to create this connection")
                else:
                    st.warning("Please provide a description of the network you want to analyze")
            
            st.divider()
            
            # Flow-specific refinement level descriptions
            refinement_descriptions = {
                "People": {
                    1: "Raw recruits, untrained personnel",
                    3: "Basic training completed",
                    5: "Experienced operators",
                    7: "Specialized expertise",
                    10: "Strategic leadership, key decision makers"
                },
                "Material": {
                    1: "Raw resources, unprocessed materials",
                    3: "Basic processed materials",
                    5: "Assembled components",
                    7: "Advanced systems integration",
                    10: "Final operational platforms/systems"
                },
                "Data": {
                    1: "Raw data points, unprocessed signals",
                    3: "Filtered/cleaned data",
                    5: "Processed information",
                    7: "Analyzed intelligence",
                    10: "Strategic insights/decisions"
                },
                "Energy": {
                    1: "Raw energy sources (crude oil, uranium ore)",
                    3: "Processed fuels",
                    5: "Refined energy products",
                    7: "Specialized energy systems",
                    10: "Advanced power generation/distribution"
                },
                "Money": {
                    1: "Basic funding sources",
                    3: "Allocated budgets",
                    5: "Managed investments",
                    7: "Strategic financial instruments",
                    10: "Critical financial control points"
                }
            }
            
            # Add expander for instructions
            with st.expander("ℹ️ How to Map Flows"):
                st.markdown("""
                1. **Add Nodes**: Create points in your network
                   - Name: Give it a descriptive name
                   - Type: Choose between Effector (action point) or Transport (movement point)
                   - Refinement: Set sophistication level based on flow type
                
                2. **Add Links**: Connect your nodes
                   - Source: Starting point
                   - Target: Ending point
                   - Type: Direct (straight) or Transpose (transformed)
                   - Capacity: How much can flow through (1-100)
                
                3. **Best Practices**:
                   - Start with key effector nodes (end points)
                   - Add transport nodes that support them
                   - Connect nodes with appropriate links
                   - Consider both friendly and adversary perspectives
                """)
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("#### Add Node")
                node_name = st.text_input(
                    "Node Name",
                    help="Enter a descriptive name for this point in your network"
                )
                node_type = st.selectbox(
                    "Node Type",
                    ["Effector", "Transport"],
                    help="Effector: Takes action, Transport: Moves resources"
                )
                
                # Enhanced refinement level selection with descriptions
                st.markdown(f"**Refinement Level for {selected_flow}**")
                refinement_help = "\n".join([f"Level {level}: {desc}" for level, desc 
                                           in refinement_descriptions[selected_flow].items()])
                node_refinement = st.slider(
                    "Select Refinement Level",
                    1, 10, 5,
                    help=refinement_help
                )
                
                # Show current refinement level description
                closest_level = min(refinement_descriptions[selected_flow].keys(), 
                                  key=lambda x: abs(x - node_refinement))
                st.info(f"Level {node_refinement}: Similar to '{refinement_descriptions[selected_flow][closest_level]}'")
                
                if st.button("➕ Add Node", help="Click to add this node to your network"):
                    if node_name:
                        st.session_state.flow_data[selected_flow]['nodes'].append({
                            'name': node_name,
                            'type': node_type,
                            'refinement': node_refinement,
                            'context': {
                                'scope': network_scope,
                                'perspective': network_perspective,
                                'description': network_prompt
                            }
                        })
                        st.success(f"Added node: {node_name}")

            with col2:
                if len(st.session_state.flow_data[selected_flow]['nodes']) >= 2:
                    st.markdown("#### Connect Nodes")
                    source_node = st.selectbox(
                        "Source Node",
                        [node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']],
                        help="Select the starting point"
                    )
                    target_node = st.selectbox(
                        "Target Node",
                        [node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']],
                        help="Select the ending point"
                    )
                    link_type = st.selectbox(
                        "Link Type",
                        ["Direct", "Transpose"],
                        help="Direct: Simple movement, Transpose: Resource changes form"
                    )
                    capacity = st.slider(
                        "Link Capacity",
                        1, 100, 50,
                        help="How much can flow through this connection? (1=Low, 100=High)"
                    )
                    
                    if st.button("🔗 Add Link", help="Click to connect these nodes"):
                        if source_node and target_node and source_node != target_node:
                            st.session_state.flow_data[selected_flow]['links'].append({
                                'source': source_node,
                                'target': target_node,
                                'type': link_type,
                                'capacity': capacity
                            })
                            st.success("Added link")
                        elif source_node == target_node:
                            st.error("Source and target nodes must be different")
                else:
                    st.info("Add at least 2 nodes to create connections")

            # Enhance network visualization with context
            if st.session_state.flow_data[selected_flow]['nodes']:
                st.markdown("### Network Visualization")
                st.markdown(f"""
                **Current Network Context:**
                - Scope: {network_scope}
                - Perspective: {network_perspective}
                - Description: {network_prompt if network_prompt else "No description provided"}
                """)
                visualize_flow_network(selected_flow)
                
                # Network Statistics
                st.markdown("### Network Statistics")
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    total_nodes = len(st.session_state.flow_data[selected_flow]['nodes'])
                    effector_nodes = len([n for n in st.session_state.flow_data[selected_flow]['nodes'] 
                                        if n['type'] == 'Effector'])
                    transport_nodes = total_nodes - effector_nodes
                    st.metric("Total Nodes", total_nodes,
                            f"Effector: {effector_nodes}, Transport: {transport_nodes}")
                
                with col2:
                    total_links = len(st.session_state.flow_data[selected_flow]['links'])
                    direct_links = len([l for l in st.session_state.flow_data[selected_flow]['links'] 
                                      if l['type'] == 'Direct'])
                    transpose_links = total_links - direct_links
                    st.metric("Total Links", total_links,
                            f"Direct: {direct_links}, Transpose: {transpose_links}")
                
                with col3:
                    avg_refinement = sum(n['refinement'] for n in st.session_state.flow_data[selected_flow]['nodes']) / total_nodes
                    st.metric("Average Refinement", f"{avg_refinement:.1f}")
                
                # Add clear button with confirmation
                if st.button("🗑️ Clear Network", help="Remove all nodes and links"):
                    if st.session_state.flow_data[selected_flow]['nodes']:
                        if st.checkbox("⚠️ Confirm clearing the network"):
                            st.session_state.flow_data[selected_flow] = {'nodes': [], 'links': []}
                            st.rerun()
                    else:
                        st.info("Network is already empty")
        # Node Analysis Interface
        elif analysis_mode == "Node Analysis":
            st.markdown("""
            ### 📊 Node Analysis
            Examine the properties and connections of individual nodes in your network.
            Focus on understanding each node's role, relationships, and potential vulnerabilities.
            """)
            
            if st.session_state.flow_data[selected_flow]['nodes']:
                selected_node = st.selectbox(
                    "Select Node to Analyze",
                    [node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']],
                    help="Choose a node to examine its properties"
                )
                
                node_data = next(node for node in st.session_state.flow_data[selected_flow]['nodes'] 
                            if node['name'] == selected_node)
                
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.metric(
                        "Refinement Level",
                        node_data['refinement'],
                        help="How sophisticated this node is (1-10)"
                    )
                
                with col2:
                    st.metric(
                        "Node Type",
                        node_data['type'],
                        help="Effector (action point) or Transport (movement)"
                    )
                
                with col3:
                    incoming = len([link for link in st.session_state.flow_data[selected_flow]['links'] 
                                if link['target'] == selected_node])
                    outgoing = len([link for link in st.session_state.flow_data[selected_flow]['links'] 
                                if link['source'] == selected_node])
                    
                    st.metric(
                        "Total Connections",
                        incoming + outgoing,
                        f"{incoming} in, {outgoing} out",
                        help="Number of connections to/from this node"
                    )
                
                # Show node relationships
                st.markdown("#### Node Relationships")
                
                incoming_links = [link for link in st.session_state.flow_data[selected_flow]['links'] 
                                if link['target'] == selected_node]
                outgoing_links = [link for link in st.session_state.flow_data[selected_flow]['links'] 
                                if link['source'] == selected_node]
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**Incoming Links**")
                    if incoming_links:
                        for link in incoming_links:
                            st.info(
                                f"From: {link['source']}\n"
                                f"Type: {link['type']}\n"
                                f"Capacity: {link['capacity']}"
                            )
                    else:
                        st.info("No incoming links")
                
                with col2:
                    st.markdown("**Outgoing Links**")
                    if outgoing_links:
                        for link in outgoing_links:
                            st.info(
                                f"To: {link['target']}\n"
                                f"Type: {link['type']}\n"
                                f"Capacity: {link['capacity']}"
                            )
                    else:
                        st.info("No outgoing links")
                
                # Node analysis insights
                st.markdown("#### Analysis Insights")
                
                # Calculate node importance score
                importance_score = (
                    (incoming + outgoing) * 0.4 +  # Connectivity
                    node_data['refinement'] * 0.6   # Refinement level
                ) / 10
                
                st.progress(
                    importance_score,
                    text=f"Node Importance Score: {importance_score:.2f}/1.0"
                )
                
                # Generate insights based on node properties
                insights = []
                
                if node_data['type'] == "Effector":
                    if incoming == 0:
                        insights.append("⚠️ Effector node has no incoming connections - consider how it receives resources")
                    if outgoing == 0:
                        insights.append("⚠️ Effector node has no outgoing connections - consider its effects on other nodes")
                else:  # Transport node
                    if incoming == 0:
                        insights.append("⚠️ Transport node has no incoming connections - consider its source")
                    if outgoing == 0:
                        insights.append("⚠️ Transport node has no outgoing connections - consider its purpose")
                
                if node_data['refinement'] >= 8:
                    insights.append("🎯 High refinement level suggests this is a critical node requiring protection")
                elif node_data['refinement'] <= 3:
                    insights.append("⚠️ Low refinement level may indicate a vulnerability")
                
                if incoming + outgoing >= 4:
                    insights.append("🔍 High connectivity makes this node both important and potentially vulnerable")
                
                for insight in insights:
                    st.markdown(insight)
            else:
                st.info("Add some nodes to your network to analyze them")
        # Vulnerability Assessment Interface
        elif analysis_mode == "Vulnerability Assessment":
            st.markdown("""
            ### 🎯 Vulnerability Assessment
            Identify critical points and potential weaknesses in your flow network.
            Consider both defensive protection and offensive targeting opportunities.
            """)
            
            if st.session_state.flow_data[selected_flow]['nodes']:
                vulnerabilities = assess_vulnerabilities(selected_flow)
                
                # Overall network metrics
                st.markdown("#### Network Overview")
                
                total_nodes = len(st.session_state.flow_data[selected_flow]['nodes'])
                total_links = len(st.session_state.flow_data[selected_flow]['links'])
                
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.metric("Total Nodes", total_nodes)
                
                with col2:
                    st.metric("Total Links", total_links)
                
                with col3:
                    if total_nodes > 0:
                        connectivity = total_links / total_nodes
                        st.metric(
                            "Network Connectivity",
                            f"{connectivity:.2f}",
                            help="Average links per node"
                        )
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("#### Critical Nodes")
                    st.markdown("""
                    Nodes that are most important or vulnerable based on:
                    - Number of connections
                    - Refinement level
                    - Position in network
                    """)
                    
                    for node, score in vulnerabilities['critical_nodes']:
                        color = "red" if score > 0.7 else "orange" if score > 0.4 else "blue"
                        st.markdown(
                            f"<div style='padding: 10px; border-radius: 5px; background-color: {color}20; "
                            f"border-left: 5px solid {color};'>"
                            f"<strong>{node}</strong><br>"
                            f"Vulnerability Score: {score:.2f}/1.0"
                            "</div>",
                            unsafe_allow_html=True
                        )
                
                with col2:
                    st.markdown("#### Critical Links")
                    st.markdown("""
                    Connections that are most important based on:
                    - Capacity
                    - Connected node importance
                    - Alternative paths
                    """)
                    
                    for link, score in vulnerabilities['critical_links']:
                        color = "red" if score > 0.7 else "orange" if score > 0.4 else "blue"
                        st.markdown(
                            f"<div style='padding: 10px; border-radius: 5px; background-color: {color}20; "
                            f"border-left: 5px solid {color};'>"
                            f"<strong>{link[0]} → {link[1]}</strong><br>"
                            f"Vulnerability Score: {score:.2f}/1.0"
                            "</div>",
                            unsafe_allow_html=True
                        )
                
                # Protection recommendations
                st.markdown("#### Protection Recommendations")
                recommendations = []
                
                # Analyze network structure for recommendations
                if total_nodes < 3:
                    recommendations.append("🔍 Add more nodes to increase network resilience")
                
                if total_links < total_nodes:
                    recommendations.append("🔗 Consider adding alternative paths between nodes")
                
                high_value_nodes = [node for node, score in vulnerabilities['critical_nodes'] if score > 0.7]
                if high_value_nodes:
                    recommendations.append(f"🛡️ Protect high-value nodes: {', '.join(high_value_nodes)}")
                
                single_path_nodes = [
                    node['name'] for node in st.session_state.flow_data[selected_flow]['nodes']
                    if len([l for l in st.session_state.flow_data[selected_flow]['links']
                           if l['source'] == node['name'] or l['target'] == node['name']]) == 1
                ]
                if single_path_nodes:
                    recommendations.append(f"⚠️ Create redundant connections for: {', '.join(single_path_nodes)}")
                
                for recommendation in recommendations:
                    st.markdown(recommendation)
            else:
                st.info("Add nodes and links to your network to assess vulnerabilities")
        # Flow Integration Interface
        elif analysis_mode == "Flow Integration":
            st.markdown("""
            ### 🔄 Flow Integration Analysis
            Discover how different types of flows can interact and influence each other.
            Look for opportunities to leverage relationships between different flow types.
            """)
            
            if not st.session_state.flow_data[selected_flow]['nodes']:
                st.info("Add some nodes to your current flow to analyze integration possibilities")
                return
                
            other_flows = [flow for flow in st.session_state.flow_data.keys() if flow != selected_flow]
            integration_flow = st.selectbox(
                "Select Flow to Integrate With",
                other_flows,
                help="Choose another flow type to analyze potential connections"
            )
            
            if not st.session_state.flow_data[integration_flow]['nodes']:
                st.info(f"Add some nodes to the {integration_flow} flow to analyze integration possibilities")
                return
                
            st.markdown("""
            #### Integration Considerations
            When analyzing flow integration, consider:
            1. **Resource Conversion**: How one flow type can be transformed into another
            2. **Shared Infrastructure**: Nodes that support multiple flow types
            3. **Cascading Effects**: How disruption in one flow affects others
            4. **Synergies**: Opportunities to enhance multiple flows simultaneously
            """)
            
            if st.button("🔄 Analyze Integration", help="Find potential connections between flows"):
                integration_points = analyze_flow_integration(selected_flow, integration_flow)
                
                if integration_points:
                    st.markdown("#### Integration Opportunities")
                    for point in integration_points:
                        st.info(point, icon="🔗")
                    
                    # Add specific recommendations
                    st.markdown("#### Integration Recommendations")
                    st.markdown("""
                    Consider these actions to improve flow integration:
                    1. Create shared nodes for resource conversion
                    2. Establish backup pathways between flows
                    3. Identify critical dependencies between flows
                    4. Plan for cascading effects across flows
                    """)
                else:
                    st.info("No immediate integration opportunities found. Try adjusting node refinement levels.")

def visualize_flow_network(flow_type: str):
    """Visualize the flow network using Plotly"""
    nodes = st.session_state.flow_data[flow_type]['nodes']
    links = st.session_state.flow_data[flow_type]['links']
    
    if not nodes:
        st.info("Add some nodes to see the network visualization")
        return
        
    G = nx.DiGraph()
    
    # Add nodes with improved visual attributes
    for node in nodes:
        G.add_node(
            node['name'],
            node_type=node['type'],
            refinement=node['refinement']
        )
    
    # Add edges with improved visual attributes
    for link in links:
        G.add_edge(
            link['source'],
            link['target'],
            link_type=link['type'],
            capacity=link['capacity']
        )
    
    # Create Plotly figure with improved styling
    pos = nx.spring_layout(G)
    
    # Edge trace with better visibility
    edge_trace = go.Scatter(
        x=[], y=[],
        line=dict(width=1.5, color='rgba(136, 136, 136, 0.6)'),
        hoverinfo='text',
        mode='lines'
    )

    # Node trace with better visibility and information
    node_trace = go.Scatter(
        x=[], y=[],
        mode='markers+text',
        hoverinfo='text',
        text=[],
        textposition="top center",
        marker=dict(
            showscale=True,
            colorscale='Viridis',
            size=20,
            colorbar=dict(
                title=dict(
                    text='Refinement Level',
                    side='right'
                ),
                thickness=15,
                xanchor='left'
            )
        )
    )

    # Add edges to visualization with hover info
    edge_x = []
    edge_y = []
    edge_text = []
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        edge_text.append(f"{edge[0]} → {edge[1]}<br>Type: {G.edges[edge]['link_type']}<br>Capacity: {G.edges[edge]['capacity']}")
    
    edge_trace.x = edge_x
    edge_trace.y = edge_y
    edge_trace.text = edge_text

    # Add nodes to visualization with hover info
    node_x = []
    node_y = []
    node_text = []
    node_color = []
    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_text.append(f"{node}<br>Type: {G.nodes[node]['node_type']}<br>Refinement: {G.nodes[node]['refinement']}")
        node_color.append(G.nodes[node]['refinement'])
    
    node_trace.x = node_x
    node_trace.y = node_y
    node_trace.text = node_text
    node_trace.marker.color = node_color

    # Create the figure with improved layout
    fig = go.Figure(
        data=[edge_trace, node_trace],
        layout=go.Layout(
            showlegend=False,
            hovermode='closest',
            margin=dict(b=20, l=5, r=5, t=40),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            plot_bgcolor='rgba(255,255,255,0.8)',
            paper_bgcolor='rgba(255,255,255,0.8)',
            title=dict(
                text=f"{flow_type} Flow Network",
                x=0.5,
                y=0.95
            )
        )
    )

    st.plotly_chart(fig, use_container_width=True)

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

def generate_network_suggestions(flow_type: str, prompt: str) -> Dict:
    """Generate network suggestions based on flow type and user prompt"""
    # This is where we would integrate with an AI model to generate suggestions
    # For now, using example suggestions based on flow type
    
    suggestions = {
        'nodes': [],
        'links': []
    }
    
    if flow_type == "People":
        suggestions['nodes'] = [
            {
                'name': 'Command Center',
                'type': 'Effector',
                'refinement': 9,
                'rationale': 'Central decision-making hub for operational control'
            },
            {
                'name': 'Training Facility',
                'type': 'Transport',
                'refinement': 7,
                'rationale': 'Develops and maintains personnel capabilities'
            },
            {
                'name': 'Field Operations',
                'type': 'Effector',
                'refinement': 6,
                'rationale': 'Direct tactical implementation of missions'
            }
        ]
        suggestions['links'] = [
            {
                'source': 'Command Center',
                'target': 'Field Operations',
                'type': 'Direct',
                'capacity': 80,
                'rationale': 'Command and control flow'
            },
            {
                'source': 'Training Facility',
                'target': 'Field Operations',
                'type': 'Direct',
                'capacity': 60,
                'rationale': 'Personnel deployment pipeline'
            }
        ]
    elif flow_type == "Material":
        suggestions['nodes'] = [
            {
                'name': 'Central Depot',
                'type': 'Transport',
                'refinement': 8,
                'rationale': 'Main storage and distribution hub'
            },
            {
                'name': 'Forward Supply Point',
                'type': 'Transport',
                'refinement': 6,
                'rationale': 'Tactical level distribution point'
            },
            {
                'name': 'Maintenance Facility',
                'type': 'Effector',
                'refinement': 7,
                'rationale': 'Equipment repair and servicing'
            }
        ]
        suggestions['links'] = [
            {
                'source': 'Central Depot',
                'target': 'Forward Supply Point',
                'type': 'Direct',
                'capacity': 90,
                'rationale': 'Main supply route'
            },
            {
                'source': 'Forward Supply Point',
                'target': 'Maintenance Facility',
                'type': 'Direct',
                'capacity': 70,
                'rationale': 'Local distribution network'
            }
        ]
    elif flow_type == "Data":
        suggestions['nodes'] = [
            {
                'name': 'Intelligence Center',
                'type': 'Effector',
                'refinement': 9,
                'rationale': 'Primary intelligence processing facility'
            },
            {
                'name': 'Communications Hub',
                'type': 'Transport',
                'refinement': 8,
                'rationale': 'Network routing and distribution'
            },
            {
                'name': 'Field Sensors',
                'type': 'Transport',
                'refinement': 5,
                'rationale': 'Data collection points'
            }
        ]
        suggestions['links'] = [
            {
                'source': 'Field Sensors',
                'target': 'Communications Hub',
                'type': 'Direct',
                'capacity': 85,
                'rationale': 'Raw data transmission'
            },
            {
                'source': 'Communications Hub',
                'target': 'Intelligence Center',
                'type': 'Transpose',
                'capacity': 75,
                'rationale': 'Data processing and analysis pipeline'
            }
        ]
    elif flow_type == "Energy":
        suggestions['nodes'] = [
            {
                'name': 'Power Plant',
                'type': 'Effector',
                'refinement': 9,
                'rationale': 'Primary power generation facility'
            },
            {
                'name': 'Distribution Grid',
                'type': 'Transport',
                'refinement': 7,
                'rationale': 'Power distribution network'
            },
            {
                'name': 'Storage Facility',
                'type': 'Transport',
                'refinement': 6,
                'rationale': 'Energy reserve storage'
            }
        ]
        suggestions['links'] = [
            {
                'source': 'Power Plant',
                'target': 'Distribution Grid',
                'type': 'Direct',
                'capacity': 95,
                'rationale': 'Main power transmission'
            },
            {
                'source': 'Distribution Grid',
                'target': 'Storage Facility',
                'type': 'Transpose',
                'capacity': 65,
                'rationale': 'Energy storage and backup'
            }
        ]
    elif flow_type == "Money":
        suggestions['nodes'] = [
            {
                'name': 'Budget Office',
                'type': 'Effector',
                'refinement': 9,
                'rationale': 'Financial planning and control'
            },
            {
                'name': 'Resource Allocation',
                'type': 'Transport',
                'refinement': 7,
                'rationale': 'Funds distribution system'
            },
            {
                'name': 'Program Management',
                'type': 'Effector',
                'refinement': 6,
                'rationale': 'Project-level financial control'
            }
        ]
        suggestions['links'] = [
            {
                'source': 'Budget Office',
                'target': 'Resource Allocation',
                'type': 'Direct',
                'capacity': 90,
                'rationale': 'Budget distribution'
            },
            {
                'source': 'Resource Allocation',
                'target': 'Program Management',
                'type': 'Direct',
                'capacity': 75,
                'rationale': 'Program funding pipeline'
            }
        ]
    
    return suggestions

if __name__ == "__main__":
    fundamental_flow_page() 