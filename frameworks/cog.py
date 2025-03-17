# /frameworks/COG.py

import streamlit as st
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional
import os
import json
from frameworks.base_framework import BaseFramework

# Try to import get_completion, but provide a fallback if it's not available
try:
    from utilities.gpt import get_completion
except ImportError:
    # Fallback function if get_completion is not available
    def get_completion(prompt, **kwargs):
        print("Warning: get_completion function not available. Using fallback.")
        return f"AI analysis not available. Please implement the get_completion function.\n\nPrompt: {prompt[:100]}..."

from utilities.helpers import clean_text
import csv
import io
import pandas as pd
import uuid
import psycopg2
from psycopg2.extras import DictCursor

# Optional imports with fallbacks
try:
    import networkx as nx
    import plotly.graph_objects as go
    HAS_VISUALIZATION = True
except ImportError:
    HAS_VISUALIZATION = False
    print("Warning: networkx or plotly not available. Network visualization will be disabled.")

load_dotenv()

def initialize_session_state():
    """Initialize session state variables"""
    if "capabilities" not in st.session_state:
        st.session_state["capabilities"] = []
    if "requirements_text" not in st.session_state:
        st.session_state["requirements_text"] = ""
    if "vulnerabilities_dict" not in st.session_state:
        st.session_state["vulnerabilities_dict"] = {}
    if "final_cog" not in st.session_state:
        st.session_state["final_cog"] = ""
    if "current_suggestions" not in st.session_state:
        st.session_state["current_suggestions"] = None
    if "cog_graph" not in st.session_state:
        st.session_state["cog_graph"] = None
    if "vulnerability_scores" not in st.session_state:
        st.session_state["vulnerability_scores"] = {}
    if "criteria" not in st.session_state:
        st.session_state["criteria"] = ["Impact", "Attainability", "Strategic Advantage Potential"]
    if "cog_suggestions" not in st.session_state:
        st.session_state["cog_suggestions"] = []

def clear_session_state(key):
    if key in st.session_state:
        del st.session_state[key]

def get_entity_info_form(domain_guidance):
    with st.form("basic_info_form"):
        # Use an expander to hide detailed instructions
        with st.expander("Instructions for Basic Info", expanded=False):
            st.markdown("Fill out the details below about the entity. These details help generate more accurate AI suggestions for Centers of Gravity (CoG).")
        
        entity_type = st.selectbox(
            "Select Entity Type for COG Analysis",
            list(domain_guidance.keys()),
            help="Select an entity type (e.g., 'Friendly', 'Opponent', 'Host Nation', 'Customer') that you are analyzing."
        )
        entity_name = st.text_input(
            "Name of Entity",
            help="Enter a clear, recognizable name for the entity. Example: 'Competitor X'."
        )
        entity_goals = st.text_area(
            "Entity Goals",
            help="Outline the primary goals or objectives of the entity. Example: 'Expand market share' or 'Maintain regional control'."
        )
        entity_presence = st.text_area(
            "Entity Areas of Presence",
            help="Describe the geographical or operational areas where the entity is influential."
        )
        submitted = st.form_submit_button("Save Basic Info")
    
    if not submitted:
        st.info("Fill out the basic info and click submit.")
    
    return entity_type, entity_name, entity_goals, entity_presence

def display_domain_questions(domain_guidance, entity_type):
    st.markdown("---")
    st.write("### Domain Considerations")
    st.markdown(domain_guidance[entity_type]["description"])
    domain_answers = {}

    # Loop through each perspective and generate an expander with the respective questions
    for perspective, details in domain_guidance[entity_type]["perspectives"].items():
        with st.expander(f"{perspective} Perspective Questions", expanded=False):
            st.markdown(f"**{perspective} Level:**")
            for question in details["questions"]:
                answer = st.text_area(
                    question,
                    key=f"{entity_type}_{perspective}_{question}",
                    help="Provide your insights or data here."
                )
                # Store answers with the key as combination of perspective and question
                domain_answers[f"{perspective}: {question}"] = answer
    return domain_answers

def generate_cog(entity_type, entity_name, entity_goals, entity_presence, desired_end_state):
    if st.button("Generate Possible Centers of Gravity"):
        # Validate required inputs before calling the AI service.
        if not entity_type or not entity_name.strip():
            st.warning("Entity type and name are required. Please complete these fields before generating suggestions.")
            return
        try:
            prompt = (
                "You're an advanced operational/strategic AI. Here are the details:\n"
                f"- Entity Type: {entity_type}\n"
                f"- Entity Name: {entity_name}\n"
                f"- Goals: {entity_goals}\n"
                f"- Areas of Presence: {entity_presence}\n"
                f"- Desired End State: {desired_end_state}\n"
                "Propose 3-5 potential Centers of Gravity (sources of power and morale) for this entity. "
                "Separate them with semicolons, no bullet points."
            )
            cog_text = get_completion(
                user_details="",  # if needed
                desired_end_state=desired_end_state or "",
                entity_type=entity_type,
                custom_prompt=prompt,
                model="gpt-4o-mini"
            )
            suggestions = [c.strip() for c in cog_text.split(";") if c.strip()]
            st.session_state["cog_suggestions"] = suggestions
            st.success("AI-Generated Possible Centers of Gravity:")
            for i, cog_s in enumerate(suggestions, 1):
                st.write(f"{i}. {cog_s}")
        except Exception as e:
            st.error(f"Error generating CoGs: {e}")

def manage_capabilities(final_cog, entity_type, entity_name, entity_goals, entity_presence):
    if "capabilities" not in st.session_state:
        st.session_state["capabilities"] = []

    with st.expander("Add or Suggest Capabilities (Optional)", expanded=False):
        new_capability = st.text_input(
            "Add a Critical Capability",
            help="Enter one capability at a time that is relevant to the selected CoG."
        )
        if st.button("Add Capability"):
            if new_capability.strip():
                st.session_state["capabilities"].append(new_capability.strip())
                st.success(f"Added capability: {new_capability.strip()}")
            else:
                st.warning("Capability cannot be empty.")

        if st.button("AI: Suggest Capabilities"):
            if not final_cog:
                st.warning("Please specify or select a CoG first.")
            else:
                try:
                    system_msg = {"role": "system", "content": "You are an AI specialized in COG analysis."}
                    user_msg = {
                        "role": "user",
                        "content": (
                            "List ~5 critical capabilities (actions or functions) the CoG can perform, "
                            "semicolon separated. Here are the details:\n"
                            f"Entity Type: {entity_type}\n"
                            f"Entity Name: {entity_name}\n"
                            f"Goals: {entity_goals}\n"
                            f"Areas of Presence: {entity_presence}\n"
                            f"CoG: {final_cog}\n"
                        )
                    }
                    response = get_completion([system_msg, user_msg], model="gpt-4o-mini")
                    new_suggestions = [cap.strip() for cap in response.split(";") if cap.strip()]
                    st.session_state["capabilities"].extend(new_suggestions)
                    st.success("AI-suggested capabilities added.")
                except Exception as e:
                    st.error(f"Error suggesting capabilities: {e}")

        if st.session_state["capabilities"]:
            st.write("Current Capabilities:")
            for i, cap in enumerate(st.session_state["capabilities"]):
                st.write(f"{i+1}. {cap}")
            if st.button("Clear All Capabilities"):
                st.session_state["capabilities"].clear()

def manage_vulnerabilities(entity_type, entity_name, entity_goals, entity_presence, final_cog):
    if "vulnerabilities_dict" not in st.session_state:
        st.session_state["vulnerabilities_dict"] = {}

    for cap in st.session_state["capabilities"]:
        if cap not in st.session_state["vulnerabilities_dict"]:
            st.session_state["vulnerabilities_dict"][cap] = []

    with st.expander("Enter or Suggest Vulnerabilities (Optional)", expanded=False):
        if st.session_state["capabilities"]:
            selected_cap = st.selectbox(
                "Select a Capability to Add Vulnerabilities",
                st.session_state["capabilities"]
            )
            new_vulnerability = st.text_input(
                f"New Vulnerability for '{selected_cap}'",
                help="Example: 'Inadequate trained personnel to operate mission-critical system'"
            )
            if st.button(f"Add Vulnerability to '{selected_cap}'"):
                if new_vulnerability.strip():
                    st.session_state["vulnerabilities_dict"][selected_cap].append(new_vulnerability.strip())
                    st.success(f"Added vulnerability to {selected_cap}")
                else:
                    st.warning("Vulnerability cannot be empty.")

            if st.button(f"AI: Suggest Vulnerabilities for '{selected_cap}'"):
                try:
                    system_msg = {
                        "role": "system",
                        "content": "You are an AI that identifies critical vulnerabilities for a CoG capability."
                    }
                    user_msg_content = (
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n\n"
                        "Requirements potentially relevant:\n" + st.session_state["requirements_text"] + "\n\n"
                        "List 3-5 vulnerabilities for this capability. Use semicolons, no bullet points."
                    )
                    user_msg = {"role": "user", "content": user_msg_content}
                    vuln_resp = get_completion([system_msg, user_msg], model="gpt-4o-mini")
                    new_vulns = [v.strip() for v in vuln_resp.split(";") if v.strip()]
                    st.session_state["vulnerabilities_dict"][selected_cap].extend(new_vulns)
                    st.success(f"AI-suggested vulnerabilities added to {selected_cap}.")
                except Exception as e:
                    st.error(f"Error generating vulnerabilities: {e}")

def score_and_prioritize(all_vulnerabilities_list):
    import pandas as pd

    if "criteria" not in st.session_state:
        st.session_state["criteria"] = ["Impact", "Attainability", "Strategic Advantage Potential"]

    st.markdown("### 📊 Vulnerability Scoring")
    
    # Criteria Management
    with st.expander("Manage Scoring Criteria", expanded=False):
        st.markdown("""
        Define the criteria used to evaluate each vulnerability. Default criteria are:
        - **Impact**: The potential effect if the vulnerability is exploited
        - **Attainability**: How feasible it is to exploit this vulnerability
        - **Strategic Advantage**: The strategic benefit gained from exploiting this vulnerability
        """)
        
        criteria_text = st.text_area(
            "Current Criteria (one per line)",
            value="\n".join(st.session_state["criteria"]),
            height=100,
            help="Edit the list of criteria below. Each line is a separate criterion."
        )
        if st.button("Update Criteria"):
            new_list = [c.strip() for c in criteria_text.split("\n") if c.strip()]
            st.session_state["criteria"] = new_list
            st.success("Criteria updated.")

    # Guided Scoring Interface
    st.markdown("### Score Vulnerabilities")
    st.markdown("""
    For each vulnerability, rate it on a scale of 1-10 for each criterion:
    - 1-3: Low significance/difficulty
    - 4-7: Moderate significance/difficulty
    - 8-10: High significance/difficulty
    """)

    # Initialize data structures
    if not all_vulnerabilities_list:
        st.warning("No vulnerabilities to score. Please add vulnerabilities first.")
        return

    # Create tabs for each capability to organize scoring
    capabilities = list(set(cap for cap, _ in all_vulnerabilities_list))
    tabs = st.tabs([f"⚡ {cap}" for cap in capabilities])

    for cap_idx, capability in enumerate(capabilities):
        with tabs[cap_idx]:
            st.markdown(f"### Scoring Vulnerabilities for: {capability}")
            
            # Get vulnerabilities for this capability
            cap_vulns = [vuln for c, vuln in all_vulnerabilities_list if c == capability]
            
            for vuln in cap_vulns:
                st.markdown(f"#### 🎯 {vuln}")
                cols = st.columns(len(st.session_state["criteria"]))
                
                for idx, criterion in enumerate(st.session_state["criteria"]):
                    with cols[idx]:
                        key = (capability, vuln, criterion)
                        current_score = st.session_state["vulnerability_scores"].get(key, 5)
                        
                        new_score = st.slider(
                            criterion,
                            min_value=1,
                            max_value=10,
                            value=int(current_score),
                            help=f"Rate the {criterion.lower()} of this vulnerability",
                            key=f"slider_{capability}_{vuln}_{criterion}"
                        )
                        st.session_state["vulnerability_scores"][key] = new_score

    # Calculate and Display Results
    if st.button("📊 Calculate & Show Results", type="primary", use_container_width=True):
        final_scores = []
        for cap, vuln in all_vulnerabilities_list:
            total_score = 0
            detail_list = []
            for crit in st.session_state["criteria"]:
                key = (cap, vuln, crit)
                val = st.session_state["vulnerability_scores"].get(key, 1)
                total_score += val
                detail_list.append(f"{crit}={val}")
            final_scores.append((cap, vuln, total_score, detail_list))

        final_scores.sort(key=lambda x: x[2], reverse=True)
        st.session_state["final_scores"] = final_scores

        # Display Results
        st.markdown("### 📈 Prioritized Vulnerabilities")
        for idx, (cap, vuln, score, details) in enumerate(final_scores, 1):
            with st.container():
                st.markdown(
                    f"""
                    <div class="suggestion-card">
                    <h4>{idx}. {vuln}</h4>
                    <p><strong>Capability:</strong> {cap}</p>
                    <p><strong>Composite Score:</strong> {score}</p>
                    <p><strong>Detailed Scores:</strong> {', '.join(details)}</p>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

        # Export Options
        st.markdown("### 💾 Export Results")
        col1, col2 = st.columns(2)
        
        with col1:
            # Export as CSV
            if st.button("📄 Export as CSV", use_container_width=True):
                csv_data = export_results(final_scores)
                st.download_button(
                    label="⬇️ Download CSV",
                    data=csv_data,
                    file_name="vulnerability_scores.csv",
                    mime="text/csv",
                    use_container_width=True
                )
        
        with col2:
            # Export as JSON
            if st.button("📋 Export as JSON", use_container_width=True):
                json_data = export_cog_analysis()
                st.download_button(
                    label="⬇️ Download JSON",
                    data=json_data,
                    file_name="cog_analysis.json",
                    mime="application/json",
                    use_container_width=True
                )

def visualize_cog_network(cog: str, capabilities: List[str], vulnerabilities_dict: Dict[str, List[str]], requirements_text: str) -> Optional[Any]:
    """Create a network visualization of the COG analysis"""
    if not HAS_VISUALIZATION:
        st.warning("Network visualization is not available. Please install networkx and plotly to enable this feature.")
        return None
        
    try:
        # Create a directed graph
        G = nx.DiGraph()
        
        # Add COG as central node with highest refinement
        G.add_node(cog, node_type="cog", refinement=10)
        
        # Add capabilities and connect to COG
        for cap in capabilities:
            G.add_node(cap, node_type="capability", refinement=8)
            G.add_edge(cog, cap, link_type="Direct", capacity=90)
            
            # Add vulnerabilities for this capability
            if cap in vulnerabilities_dict:
                for vuln in vulnerabilities_dict[cap]:
                    G.add_node(vuln, node_type="vulnerability", refinement=5)
                    G.add_edge(cap, vuln, link_type="Direct", capacity=70)
        
        # Add requirements as nodes
        if requirements_text:
            requirements = [r.strip() for r in requirements_text.split(";") if r.strip()]
            for req in requirements:
                G.add_node(req, node_type="requirement", refinement=6)
                # Connect requirements to capabilities they support
                for cap in capabilities:
                    G.add_edge(req, cap, link_type="Support", capacity=80)
        
        # Create Plotly figure with improved styling
        pos = nx.spring_layout(G)
        
        # Edge trace with better visibility and hover info
        edge_x = []
        edge_y = []
        edge_text = []
        for edge in G.edges():
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            edge_x.extend([x0, x1, None])
            edge_y.extend([y0, y1, None])
            edge_text.append(
                f"{edge[0]} → {edge[1]}<br>"
                f"Type: {G.edges[edge]['link_type']}<br>"
                f"Capacity: {G.edges[edge]['capacity']}"
            )
            
        edge_trace = go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=1.5, color='rgba(136, 136, 136, 0.6)'),
            hoverinfo='text',
            text=edge_text,
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

        # Add nodes to visualization with hover info
        node_x = []
        node_y = []
        node_text = []
        node_color = []
        node_size = []
        
        for node in G.nodes():
            x, y = pos[node]
            node_x.append(x)
            node_y.append(y)
            node_type = G.nodes[node]['node_type']
            refinement = G.nodes[node]['refinement']
            
            # Customize node size based on type
            size = 30 if node_type == "cog" else 25 if node_type == "capability" else 20
            node_size.append(size)
            
            # Add hover text with node information
            node_text.append(
                f"{node}<br>"
                f"Type: {node_type}<br>"
                f"Refinement: {refinement}"
            )
            node_color.append(refinement)
        
        node_trace.x = node_x
        node_trace.y = node_y
        node_trace.text = node_text
        node_trace.marker.color = node_color
        node_trace.marker.size = node_size

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
                    text="Center of Gravity Network Analysis",
                    x=0.5,
                    y=0.95
                )
            )
        )

        st.plotly_chart(fig, use_container_width=True)
        
        return G
    except Exception as e:
        st.error(f"Error creating visualization: {e}")
        return None

def export_graph(G: Optional[Any], format: str = "gexf") -> Optional[str]:
    """Export the COG network graph in various formats"""
    if not HAS_VISUALIZATION:
        st.warning("Graph export is not available. Please install networkx to enable this feature.")
        return None
        
    try:
        if format == "gexf":
            # Export as GEXF (compatible with Gephi)
            output = io.StringIO()
            nx.write_gexf(G, output)
            return output.getvalue()
        elif format == "graphml":
            # Export as GraphML
            output = io.StringIO()
            nx.write_graphml(G, output)
            return output.getvalue()
        elif format == "json":
            # Export as JSON
            data = nx.node_link_data(G)
            return json.dumps(data, indent=2)
        else:
            raise ValueError(f"Unsupported format: {format}")
    except Exception as e:
        st.error(f"Error exporting graph: {e}")
        return None

def export_results(final_scores):
    import io
    import csv

    st.session_state["final_scores"] = final_scores

    col_export1, col_export2, col_export3 = st.columns(3)
    
    with col_export1:
        if st.button("Export Vulnerabilities as CSV"):
            vulns_csv = io.StringIO()
            writer = csv.writer(vulns_csv)
            writer.writerow(["Capability", "Vulnerability", "Score Details", "Composite Score"])
            if final_scores:
                for cap, vuln, total_score, detail_list in final_scores:
                    details = ", ".join(detail_list) if detail_list else "N/A"
                    writer.writerow([cap, vuln, details, total_score])
            csv_data = vulns_csv.getvalue()
            st.download_button(
                label="Download CSV",
                data=csv_data,
                file_name="COG_Vulnerabilities.csv",
                mime="text/csv"
            )

    with col_export2:
        if st.button("Export as PDF"):
            st.info("PDF export will be implemented using ReportLab or pdfkit")

    with col_export3:
        # Add graph export functionality
        if "cog_graph" in st.session_state and st.session_state.cog_graph is not None:
            if HAS_VISUALIZATION:
                export_format = st.selectbox(
                    "Select Format",
                    ["gexf", "graphml", "json"],
                    help="Choose export format"
                )
                
                if st.button(f"Export as {export_format.upper()}", use_container_width=True):
                    graph_data = export_graph(st.session_state["cog_graph"], export_format)
                    if graph_data:
                        st.download_button(
                            label=f"Download {export_format.upper()}",
                            data=graph_data,
                            file_name=f"cog_network.{export_format}",
                            mime=f"application/{export_format}",
                            use_container_width=True
                        )
            else:
                st.warning("Graph export is not available. Please install networkx to enable this feature.")

def export_cog_analysis():
    """
    Collects analysis data and exports it as a well-structured JSON string.
    This JSON string should match the format expected by load_cog_analysis_from_db().
    """
    data = {
         "entity_info": {
             "entity_type": st.session_state.get("entity_type", ""),
             "entity_name": st.session_state.get("entity_name", ""),
             "entity_goals": st.session_state.get("entity_goals", ""),
             "entity_presence": st.session_state.get("entity_presence", "")
         },
         "domain_answers": st.session_state.get("domain_answers", {}),
         "cog_suggestions": st.session_state.get("cog_suggestions", []),
         "final_cog": st.session_state.get("final_cog", ""),
         "capabilities": st.session_state.get("capabilities", []),
         "vulnerabilities_dict": st.session_state.get("vulnerabilities_dict", {}),
         "requirements_text": st.session_state.get("requirements_text", ""),
         "criteria": st.session_state.get("criteria", []),
         "vulnerability_scores": st.session_state.get("vulnerability_scores", {}),
         "final_scores": st.session_state.get("final_scores", []),
         "desired_end_state": st.session_state.get("desired_end_state", "")
    }
    json_data = json.dumps(data, indent=2)
    return json_data

def load_cog_analysis_from_db(analysis_hash):
    """
    Loads an analysis JSON from the PostgreSQL database using the provided hash.
    
    This function connects to a Postgres service (assumed to be available as 'db' in docker-compose),
    retrieves the analysis data from the cog_analyses table, and loads it via json.loads().
    
    If the stored JSON data is invalid (e.g., contains extra data that causes a JSONDecodeError),
    an error is displayed.
    """
    try:
        conn = psycopg2.connect(
            host="db",          # service name defined in docker-compose
            port=5432,
            database="analysisdb",
            user="postgres",
            password="yourpassword"    # update this as needed
        )
        cursor = conn.cursor(cursor_factory=DictCursor)
        cursor.execute("SELECT analysis_data FROM cog_analyses WHERE analysis_hash = %s", (analysis_hash,))
        result = cursor.fetchone()
        if result is None:
            st.error("No analysis data found for the provided hash.")
            return None
        
        analysis_str = result['analysis_data']
        try:
            analysis_data = json.loads(analysis_str)
        except json.JSONDecodeError as json_err:
            st.error(f"Error parsing JSON analysis data: {json_err}")
            return None
        
        return analysis_data

    except Exception as e:
        st.error(f"Error loading analysis data: {e}")
        return None

    finally:
        if 'conn' in locals():
            conn.close()

def save_and_load_analysis():
    """
    Provides an expander section that allows users to export their current analysis as JSON
    or load a previously saved JSON to continue their work.
    """
    st.markdown("---")
    st.subheader("Save / Load Analysis")
    
    with st.expander("Save Analysis"):
        json_data = export_cog_analysis()
        # Generate a unique hash which can serve as an ID for the user's saved session
        unique_hash = str(uuid.uuid4())
        st.write("Your unique session ID (save this for your records to return to this analysis):")
        st.info(unique_hash)
        st.download_button(
            label="Download Analysis as JSON",
            data=json_data,
            file_name=f"COG_Analysis_{unique_hash}.json",
            mime="application/json"
        )
    
    with st.expander("Load Saved Analysis"):
        imported_json = st.text_area("Paste your saved analysis JSON here", height=200)
        if st.button("Load Analysis"):
            load_cog_analysis_from_db(imported_json)

def generate_cog_identification():
    """
    This method renders the section to help users identify potential Centers of Gravity,
    as well as their associated Critical Capabilities, Critical Requirements, and Critical Vulnerabilities.
    Tooltips and descriptions are provided to guide the user with clear definitions and examples.
    """
    st.subheader("Identify / Generate Possible Centers of Gravity")
    st.markdown(
        """
        In this section, you can pinpoint potential Centers of Gravity (CoG) and break them down into:
        
        - **Center of Gravity:** The source of power that provides moral or physical strength,
          freedom of action, or will to act.  
          *Example: In Operation Desert Storm, one possible CoG was achieving air superiority.*
        
        - **Critical Capability:** The crucial enabler or ability through which the CoG can impact the adversary.
          *Example: Ability to suppress enemy air defenses.*
        
        - **Critical Requirement:** The necessary conditions, resources, or means required for the CoG to function.
          *Example: Availability of high-performance aircraft, well-maintained runways, and aerial refueling capabilities.*
        
        - **Critical Vulnerability:** The weak links or deficiencies in these requirements that can be exploited.
          *Example: Limited fuel supplies or maintenance constraints that may jeopardize sustained air superiority.*
        """
    )
    
    # Input for a proposed Center of Gravity.
    cog = st.text_area("Possible Center of Gravity",
                       help="Enter a potential Center of Gravity. Example: 'Air Superiority' or 'Command and Control'.")
    
    # Input for associated Critical Capability.
    cc = st.text_area("Critical Capability",
                      help="Describe the capability enabled by the CoG. Example: 'Enables suppression of enemy defenses' or 'Facilitates rapid decision-making'.")
    
    # Input for associated Critical Requirement.
    cr = st.text_area("Critical Requirement",
                      help="List the necessary condition, resource or means. Example: 'Access to stealth technology and advanced fighter jets'.")
    
    # Input for associated Critical Vulnerability.
    cv = st.text_area("Critical Vulnerability",
                      help="Specify any perceived weakness of the CoG. Example: 'Limited logistic support or vulnerability to cyber-attacks'.")
    
    return cog, cc, cr, cv

def edit_co_data(data):
    """
    Renders an editable table using st.data_editor.
    
    Note:
    - st.experimental_data_editor has been replaced with st.data_editor.
    - The edited_rows format is now: {0: {"column name": "edited value"}}.
      If your app uses st.session_state to track edits, you may need to adjust your handling logic.
    """
    # Use the new st.data_editor function
    edited_data = st.data_editor(data, key="co_data_editor")
    # If necessary, process the returned edited_data which now uses the new format.
    # For example, here we simply return the data as is.
    return edited_data

def manage_assumptions():
    """
    Provides a section for managing assumptions. Planners can:
    - Add new assumptions.
    - Mark assumptions as validated or invalidated.
    - Remove assumptions when they are proven false or no longer relevant.
    """
    if "assumptions" not in st.session_state:
        # Assumption structure: A list of dictionaries
        st.session_state["assumptions"] = []
    
    st.subheader("Manage Assumptions")
    
    assumption_text = st.text_area(
        "Add a New Assumption",
        help="Enter an assumption that your planning is based on, e.g., 'Market conditions remain stable.'"
    )
    
    if st.button("Add Assumption"):
        if assumption_text.strip():
            new_assumption = {
                "text": assumption_text.strip(),
                "validated": False,  # default state
                "notes": ""
            }
            st.session_state["assumptions"].append(new_assumption)
            st.success("Assumption added.")
        else:
            st.warning("Please enter a valid assumption.")
    
    # Display the current assumptions
    if st.session_state["assumptions"]:
        st.write("### Current Assumptions")
        for i, assumption in enumerate(st.session_state["assumptions"]):
            col1, col2, col3, col4 = st.columns([5, 1, 2, 2])
            with col1:
                st.write(assumption["text"])
            with col2:
                # Toggle button for validation status
                validated = st.checkbox("Valid", value=assumption["validated"], key=f"assump_valid_{i}")
                st.session_state["assumptions"][i]["validated"] = validated
            with col3:
                new_notes = st.text_input("Notes", assumption.get("notes", ""), key=f"assump_notes_{i}")
                st.session_state["assumptions"][i]["notes"] = new_notes
            with col4:
                if st.button("Remove", key=f"assump_remove_{i}"):
                    st.session_state["assumptions"].pop(i)
                    st.rerun()  # Rerun to update the list and keys
    else:
        st.info("No assumptions added yet.")

def search_references():
    """
    Provides a search function for users to look up external or internal reference materials.
    In a real-world implementation, you might query an external API or a reference database.
    """
    st.subheader("Search References")
    search_query = st.text_input("Enter keywords to search for e.g. market trends, historical data")
    
    if st.button("Search"):
        # In this demo, we'll show a placeholder message.
        # Replace this with actual search logic or integration with resources.
        st.info(f"Searching for: {search_query} ...")
        # Dummy results:
        results = {
            "Article 1": "https://example.com/article1",
            "Research Paper A": "https://example.com/researchA"
        }
        for title, url in results.items():
            st.markdown(f"- [{title}]({url})")

def get_fallback_suggestions(entity_type: str, entity_name: str, entity_goals: str, entity_presence: str, desired_end_state: str) -> Dict:
    """Return context-aware fallback suggestions when AI generation fails"""
    
    # Basic template that we'll customize based on input
    suggestions = {
        'cog': {
            'name': '',
            'description': '',
            'rationale': ''
        },
        'capabilities': [],
        'requirements': [],
        'vulnerabilities': []
    }
    
    # Customize based on entity type and goals
    if entity_type == "Opponent":
        if "panama" in entity_presence.lower() or "canal" in entity_goals.lower():
            suggestions['cog'] = {
                'name': 'Economic Control Network',
                'description': 'Network of economic influence and infrastructure control in the Panama Canal region',
                'rationale': 'Control over critical infrastructure and economic leverage in the region serves as the primary source of power'
            }
            suggestions['capabilities'] = [
                {
                    'name': 'Infrastructure Investment',
                    'type': 'Economic',
                    'importance': 9,
                    'rationale': 'Ability to secure and control infrastructure through financial means'
                },
                {
                    'name': 'Contract Negotiation',
                    'type': 'Diplomatic',
                    'importance': 8,
                    'rationale': 'Capability to secure favorable contracts and agreements'
                },
                {
                    'name': 'Regional Influence',
                    'type': 'Political',
                    'importance': 8,
                    'rationale': 'Ability to shape regional policies and decisions'
                }
            ]
    elif entity_type == "Friendly":
        suggestions['cog'] = {
            'name': 'Allied Coalition Network',
            'description': 'Network of diplomatic and military partnerships',
            'rationale': 'Strength through international cooperation and combined capabilities'
        }
    elif entity_type == "Host Nation":
        suggestions['cog'] = {
            'name': 'Sovereign Authority',
            'description': 'Legal and political control over territory',
            'rationale': 'Authority derived from recognized sovereignty and governance'
        }
    else:
        suggestions['cog'] = {
            'name': 'Market Position',
            'description': 'Competitive position in target market',
            'rationale': 'Power derived from market share and customer relationships'
        }
    
    # Add requirements based on capabilities
    for cap in suggestions['capabilities']:
        suggestions['requirements'].append({
            'capability': cap['name'],
            'items': [
                f"Resources for {cap['name'].lower()}",
                f"Personnel trained in {cap['name'].lower()}",
                f"Support infrastructure for {cap['name'].lower()}"
            ]
        })
        
        # Add vulnerabilities based on capabilities
        suggestions['vulnerabilities'].append({
            'capability': cap['name'],
            'items': [
                {
                    'name': f"Limited {cap['name']} Resources",
                    'impact': 7,
                    'rationale': f"Insufficient resources could impair {cap['name'].lower()}"
                },
                {
                    'name': f"Opposition to {cap['name']}",
                    'impact': 6,
                    'rationale': f"External opposition could disrupt {cap['name'].lower()}"
                }
            ]
        })
    
    return suggestions

def generate_cog_suggestions(entity_type: str, entity_name: str, entity_goals: str, entity_presence: str, desired_end_state: str) -> Dict:
    """Generate AI suggestions for COG analysis components"""
    try:
        # First check if OpenAI is available
        try:
            from utilities.gpt import get_chat_completion
        except ImportError:
            st.warning("OpenAI package not installed. Using enhanced fallback suggestions.")
            return get_fallback_suggestions(entity_type, entity_name, entity_goals, entity_presence, desired_end_state)

        system_msg = {
            "role": "system",
            "content": """You are an AI specialized in Center of Gravity analysis. 
            Generate a complete analysis in valid JSON format following this exact structure:
            {
                "cog": {"name": "str", "description": "str", "rationale": "str"},
                "capabilities": [{"name": "str", "type": "str", "importance": int, "rationale": "str"}],
                "requirements": [{"capability": "str", "items": ["str"]}],
                "vulnerabilities": [{"capability": "str", "items": [{"name": "str", "impact": int, "rationale": "str"}]}]
            }"""
        }
        
        user_msg = {
            "role": "user",
            "content": f"""
            Entity Type: {entity_type}
            Entity Name: {entity_name}
            Goals: {entity_goals}
            Areas of Presence: {entity_presence}
            Desired End State: {desired_end_state}
            
            Analyze this entity and provide a complete COG analysis in the specified JSON format.
            Ensure all capabilities referenced in requirements and vulnerabilities match the capabilities array.
            """
        }
        
        response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
        
        try:
            suggestions = json.loads(response)
            return suggestions
        except json.JSONDecodeError as e:
            st.error(f"AI response was not valid JSON. Using enhanced fallback suggestions.")
            return get_fallback_suggestions(entity_type, entity_name, entity_goals, entity_presence, desired_end_state)
            
    except Exception as e:
        st.error(f"Error in suggestion generation: {str(e)}")
        return get_fallback_suggestions(entity_type, entity_name, entity_goals, entity_presence, desired_end_state)

def display_ai_suggestions(suggestions: Dict):
    """Display AI-generated suggestions with options to add them to the analysis"""
    if not suggestions:
        return
    
    st.markdown("""
    <style>
    .suggestion-card {
        border: 1px solid #e0e0e0;
        border-radius: 5px;
        padding: 15px;
        margin: 10px 0;
        background-color: #f8f9fa;
    }
    .suggestion-card:hover {
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .importance-high { color: #28a745; }
    .importance-medium { color: #ffc107; }
    .importance-low { color: #dc3545; }
    </style>
    """, unsafe_allow_html=True)
    
    # Display COG suggestion in a prominent card
    st.markdown("### 🎯 Suggested Center of Gravity")
    with st.container():
        st.markdown(
            f"""
            <div class="suggestion-card">
            <h4>{suggestions['cog']['name']}</h4>
            <p><strong>Description:</strong> {suggestions['cog']['description']}</p>
            <p><strong>Rationale:</strong> {suggestions['cog']['rationale']}</p>
            </div>
            """,
            unsafe_allow_html=True
        )
        if st.button("✅ Use This Center of Gravity", type="primary"):
            st.session_state["final_cog"] = suggestions['cog']['name']
            st.success(f"Set Center of Gravity to: {suggestions['cog']['name']}")
            st.rerun()
    
    # Display capabilities and requirements side by side
    st.markdown("### 🔄 Capabilities and Requirements")
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### Critical Capabilities")
        for i, cap in enumerate(suggestions['capabilities']):
            importance_class = (
                "importance-high" if cap['importance'] >= 8
                else "importance-medium" if cap['importance'] >= 5
                else "importance-low"
            )
            
            st.markdown(
                f"""
                <div class="suggestion-card">
                <h5>{cap['name']}</h5>
                <p><strong>Type:</strong> {cap['type']}</p>
                <p><strong>Importance:</strong> <span class="{importance_class}">{cap['importance']}/10</span></p>
                <p><strong>Rationale:</strong> {cap['rationale']}</p>
                </div>
                """,
                unsafe_allow_html=True
            )
            if st.button(f"✅ Add Capability: {cap['name']}", key=f"add_cap_{i}"):
                if cap['name'] not in st.session_state["capabilities"]:
                    st.session_state["capabilities"].append(cap['name'])
                    st.success(f"Added capability: {cap['name']}")
                    st.rerun()
    
    with col2:
        st.markdown("#### Critical Requirements")
        for req_group in suggestions['requirements']:
            cap_name = req_group['capability']
            if cap_name in st.session_state["capabilities"]:
                st.markdown(f"**For {cap_name}:**")
                with st.expander(f"View Requirements for {cap_name}", expanded=True):
                    for item in req_group['items']:
                        st.markdown(f"- {item}")
                    if st.button(f"✅ Add Requirements for {cap_name}", key=f"add_req_{cap_name}"):
                        requirements_text = "; ".join(req_group['items'])
                        current_reqs = st.session_state["requirements_text"]
                        new_reqs = f"{current_reqs}\n{requirements_text}" if current_reqs else requirements_text
                        st.session_state["requirements_text"] = new_reqs
                        st.success(f"Added requirements for {cap_name}")
                        st.rerun()
    
    # Display vulnerabilities in an organized grid
    st.markdown("### ⚠️ Critical Vulnerabilities")
    for vuln_group in suggestions['vulnerabilities']:
        cap_name = vuln_group['capability']
        if cap_name in st.session_state["capabilities"]:
            st.markdown(f"#### Vulnerabilities for {cap_name}")
            cols = st.columns(2)
            for i, vuln in enumerate(vuln_group['items']):
                with cols[i % 2]:
                    impact_class = (
                        "importance-high" if vuln['impact'] >= 8
                        else "importance-medium" if vuln['impact'] >= 5
                        else "importance-low"
                    )
                    st.markdown(
                        f"""
                        <div class="suggestion-card">
                        <h5>{vuln['name']}</h5>
                        <p><strong>Impact:</strong> <span class="{impact_class}">{vuln['impact']}/10</span></p>
                        <p><strong>Rationale:</strong> {vuln['rationale']}</p>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                    if st.button(f"✅ Add Vulnerability: {vuln['name']}", key=f"add_vuln_{cap_name}_{i}"):
                        if cap_name not in st.session_state["vulnerabilities_dict"]:
                            st.session_state["vulnerabilities_dict"][cap_name] = []
                        if vuln['name'] not in st.session_state["vulnerabilities_dict"][cap_name]:
                            st.session_state["vulnerabilities_dict"][cap_name].append(vuln['name'])
                            st.success(f"Added vulnerability to {cap_name}")
                            st.rerun()
    
    # Add a summary of what's been added
    if st.session_state.get("capabilities") or st.session_state.get("final_cog"):
        st.markdown("### 📊 Current Analysis Summary")
        if st.session_state.get("final_cog"):
            st.markdown(f"**Selected COG:** {st.session_state['final_cog']}")
        if st.session_state.get("capabilities"):
            st.markdown("**Added Capabilities:**")
            for cap in st.session_state["capabilities"]:
                st.markdown(f"- {cap}")
                if cap in st.session_state.get("vulnerabilities_dict", {}):
                    st.markdown("  *Vulnerabilities:*")
                    for vuln in st.session_state["vulnerabilities_dict"][cap]:
                        st.markdown(f"  - {vuln}")

def cog_analysis():
    # Add custom CSS for better styling
    st.markdown("""
        <style>
        /* Base styles */
        :root {
            --primary-color: #4299e1;
            --success-color: #48bb78;
            --warning-color: #ed8936;
            --bg-light: #f8f9fa;
            --bg-dark: #1a202c;
            --text-light: #2d3748;
            --text-dark: #e2e8f0;
            --border-light: #e2e8f0;
            --border-dark: #4a5568;
        }

        /* Dark mode adjustments */
        [data-theme="dark"] {
            --bg-color: var(--bg-dark);
            --text-color: var(--text-dark);
            --border-color: var(--border-dark);
        }

        [data-theme="light"] {
            --bg-color: var(--bg-light);
            --text-color: var(--text-light);
            --border-color: var(--border-light);
        }

        .main-header {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 2rem;
            color: var(--text-color);
        }

        .section-header {
            font-size: 1.5rem;
            font-weight: bold;
            margin: 1.5rem 0;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border-color);
            color: var(--text-color);
        }

        .info-box {
            padding: 1rem;
            border-radius: 0.5rem;
            background-color: var(--bg-color);
            border-left: 4px solid var(--primary-color);
            margin: 1rem 0;
            color: var(--text-color);
        }

        .success-box {
            padding: 1rem;
            border-radius: 0.5rem;
            background-color: rgba(72, 187, 120, 0.1);
            border-left: 4px solid var(--success-color);
            margin: 1rem 0;
            color: var(--text-color);
        }

        .warning-box {
            padding: 1rem;
            border-radius: 0.5rem;
            background-color: rgba(237, 137, 54, 0.1);
            border-left: 4px solid var(--warning-color);
            margin: 1rem 0;
            color: var(--text-color);
        }

        .suggestion-card {
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1rem;
            margin: 0.5rem 0;
            background-color: var(--bg-color);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            color: var(--text-color);
        }

        .suggestion-card:hover {
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
        }

        /* Importance indicators */
        .importance-high {
            color: #48bb78;
            font-weight: bold;
        }

        .importance-medium {
            color: #ecc94b;
            font-weight: bold;
        }

        .importance-low {
            color: #f56565;
            font-weight: bold;
        }

        /* Dark mode specific overrides */
        [data-theme="dark"] .suggestion-card {
            background-color: rgba(45, 55, 72, 0.3);
        }

        [data-theme="dark"] .info-box {
            background-color: rgba(45, 55, 72, 0.3);
        }

        [data-theme="dark"] .success-box {
            background-color: rgba(72, 187, 120, 0.1);
        }

        [data-theme="dark"] .warning-box {
            background-color: rgba(237, 137, 54, 0.1);
        }
        </style>
    """, unsafe_allow_html=True)

    st.markdown('<h1 class="main-header">Center of Gravity (COG) Analysis</h1>', unsafe_allow_html=True)
    
    # Initialize session state
    initialize_session_state()
    
    # Create tabs for better organization
    tab1, tab2, tab3, tab4 = st.tabs([
        "🎯 Basic Info & AI Analysis",
        "🔄 Capabilities & Requirements",
        "⚠️ Vulnerabilities & Scoring",
        "📊 Visualization & Export"
    ])
    
    with tab1:
        st.markdown('<h2 class="section-header">🤖 AI-Assisted Analysis</h2>', unsafe_allow_html=True)
        
        # Entity Information in a cleaner layout
        st.markdown('<div class="info-box">', unsafe_allow_html=True)
        col1, col2 = st.columns(2)
        
        with col1:
            entity_type = st.selectbox(
                "Entity Type",
                ["Friendly", "Opponent", "Host Nation", "Customer"],
                help="Select the type of entity you're analyzing"
            )
            entity_name = st.text_input(
                "Entity Name",
                help="Enter a clear identifier for the entity"
            )
        
        with col2:
            entity_goals = st.text_area(
                "Entity Goals",
                help="What are the entity's primary objectives?",
                height=100
            )
            entity_presence = st.text_area(
                "Areas of Presence",
                help="Where does this entity operate or have influence?",
                height=100
            )
        
        desired_end_state = st.text_area(
            "Desired End State",
            help="What outcome do you want to achieve?",
            height=100
        )
        st.markdown('</div>', unsafe_allow_html=True)
        
        # AI Generation with better visual feedback
        if st.button("🤖 Generate Complete COG Analysis", type="primary", use_container_width=True):
            if not entity_type or not entity_name:
                st.warning("⚠️ Please provide at least the entity type and name.")
            else:
                with st.spinner("🔄 Analyzing entity and generating suggestions..."):
                    suggestions = generate_cog_suggestions(
                        entity_type,
                        entity_name,
                        entity_goals,
                        entity_presence,
                        desired_end_state
                    )
                    if suggestions:
                        st.session_state["current_suggestions"] = suggestions
                        st.success("✅ Analysis generated successfully!")
                        display_ai_suggestions(suggestions)
        
        # Show current suggestions if they exist
        if "current_suggestions" in st.session_state:
            display_ai_suggestions(st.session_state["current_suggestions"])
    
    with tab2:
        st.markdown('<h2 class="section-header">💪 Capabilities & Requirements</h2>', unsafe_allow_html=True)
        
        # Display current COG
        if st.session_state.get("final_cog"):
            st.markdown(
                f'<div class="success-box">Current Center of Gravity: <strong>{st.session_state["final_cog"]}</strong></div>',
                unsafe_allow_html=True
            )
        
        # Capabilities Management
        col1, col2 = st.columns([2, 1])
        with col1:
            manage_capabilities(
                st.session_state.get("final_cog", ""),
                entity_type,
                entity_name,
                entity_goals,
                entity_presence
            )
        
        with col2:
            if st.session_state.get("capabilities"):
                st.markdown('<div class="info-box">', unsafe_allow_html=True)
                st.markdown("### Current Capabilities")
                for cap in st.session_state["capabilities"]:
                    st.markdown(f"- {cap}")
                st.markdown('</div>', unsafe_allow_html=True)
    
    with tab3:
        st.markdown('<h2 class="section-header">🎯 Vulnerabilities & Scoring</h2>', unsafe_allow_html=True)
        
        # Vulnerabilities Management
        manage_vulnerabilities(
            entity_type,
            entity_name,
            entity_goals,
            entity_presence,
            st.session_state.get("final_cog", "")
        )
        
        # Scoring Interface
        if st.session_state.get("vulnerabilities_dict"):
            all_vulnerabilities_list = [
                (cap, v_item)
                for cap in st.session_state["capabilities"]
                for v_item in st.session_state["vulnerabilities_dict"].get(cap, [])
            ]
            score_and_prioritize(all_vulnerabilities_list)
    
    with tab4:
        st.markdown('<h2 class="section-header">📊 Visualization & Export</h2>', unsafe_allow_html=True)
        
        # Network Visualization
        if st.session_state.get("final_cog"):
            G = visualize_cog_network(
                st.session_state["final_cog"],
                st.session_state.get("capabilities", []),
                st.session_state.get("vulnerabilities_dict", {}),
                st.session_state.get("requirements_text", "")
            )
            if G:
                st.session_state["cog_graph"] = G
                
                # Network Statistics
                st.markdown("### Network Statistics")
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    total_nodes = G.number_of_nodes()
                    node_types = {
                        node_type: len([n for n, attr in G.nodes(data=True) 
                                      if attr.get('node_type') == node_type])
                        for node_type in ["cog", "capability", "vulnerability", "requirement"]
                    }
                    st.metric("Total Nodes", total_nodes,
                            f"COG: {node_types['cog']}, Cap: {node_types['capability']}, Vuln: {node_types['vulnerability']}")
                
                with col2:
                    total_edges = G.number_of_edges()
                    edge_types = {
                        edge_type: len([(u, v) for u, v, attr in G.edges(data=True) 
                                      if attr.get('link_type') == edge_type])
                        for edge_type in ["Direct", "Support"]
                    }
                    st.metric("Total Links", total_edges,
                            f"Direct: {edge_types['Direct']}, Support: {edge_types['Support']}")
                
                with col3:
                    avg_refinement = sum(attr['refinement'] for _, attr in G.nodes(data=True)) / total_nodes
                    st.metric("Average Refinement", f"{avg_refinement:.1f}")
        
        # Export Options
        st.markdown("### 💾 Export Options")
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("#### Analysis Export")
            if st.button("Export Analysis", type="primary", use_container_width=True):
                json_data = export_cog_analysis()
                st.download_button(
                    label="⬇️ Download JSON",
                    data=json_data,
                    file_name="cog_analysis.json",
                    mime="application/json",
                    use_container_width=True
                )
        
        with col2:
            st.markdown("#### Network Graph Export")
            if st.session_state.get("cog_graph") and HAS_VISUALIZATION:
                export_format = st.selectbox(
                    "Select Format",
                    ["gexf", "graphml", "json"],
                    help="""
                    - GEXF: Compatible with Gephi and other graph visualization tools
                    - GraphML: Standard graph format, widely supported
                    - JSON: Web-friendly format for custom visualizations
                    """
                )
                if st.button(f"Export as {export_format.upper()}", use_container_width=True):
                    graph_data = export_graph(st.session_state["cog_graph"], export_format)
                    if graph_data:
                        st.download_button(
                            label=f"⬇️ Download {export_format.upper()}",
                            data=graph_data,
                            file_name=f"cog_network.{export_format}",
                            mime=f"application/{export_format}",
                            use_container_width=True
                        )
            else:
                st.info("Create a COG network to enable graph export")
    
    # Footer with assumptions and references
    st.markdown("---")
    col1, col2 = st.columns(2)
    with col1:
        manage_assumptions()
    with col2:
        search_references()

def main():
    cog_analysis()

if __name__ == "__main__":
    main()