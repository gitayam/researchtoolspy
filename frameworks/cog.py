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
import networkx as nx
import plotly.graph_objects as go

load_dotenv()

def initialize_session_state():
    if "capabilities" not in st.session_state:
        st.session_state["capabilities"] = []
    if "vulnerabilities_dict" not in st.session_state:
        st.session_state["vulnerabilities_dict"] = {}
    if "criteria" not in st.session_state:
        st.session_state["criteria"] = ["Impact", "Attainability", "Strategic Advantage Potential"]
    if "cog_suggestions" not in st.session_state:
        st.session_state["cog_suggestions"] = []
    if "requirements_text" not in st.session_state:
        st.session_state["requirements_text"] = ""
    if "vulnerability_scores" not in st.session_state:
        st.session_state["vulnerability_scores"] = {}

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

    data = []
    index_labels = []
    for (cap, vuln) in all_vulnerabilities_list:
        row = {}
        for crit in st.session_state["criteria"]:
            key = (cap, vuln, crit)
            if key not in st.session_state["vulnerability_scores"]:
                st.session_state["vulnerability_scores"][key] = 1
            row[crit] = st.session_state["vulnerability_scores"][key]
        index_labels.append(f"Capability: {cap} | Vulnerability: {vuln}")
        data.append(row)

    df_scores = pd.DataFrame(data, index=index_labels, columns=st.session_state["criteria"])

    st.markdown("### Score Each Vulnerability on Each Criterion")
    st.write("Adjust scores in the table below (scroll horizontally if needed):")
    
    updated_df = st.data_editor(
        df_scores,
        num_rows="dynamic",
        use_container_width=True,
        key="vuln_scores_table"
    )
    
    # Update session state with any changes
    for idx, row in updated_df.iterrows():
        try:
            parts = idx.split("|")
            cap = parts[0].replace("Capability:", "").strip()
            vuln = parts[1].replace("Vulnerability:", "").strip()
        except Exception:
            continue
        for crit in st.session_state["criteria"]:
            key = (cap, vuln, crit)
            st.session_state["vulnerability_scores"][key] = row[crit]

    if st.button("Calculate & Show Priorities"):
        if not all_vulnerabilities_list:
            st.warning("No vulnerabilities to score yet.")
        else:
            final_scores = []
            for (cap, vuln) in all_vulnerabilities_list:
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
            st.subheader("Prioritized Vulnerabilities by Composite Score")
            for idx, (cap, vuln, score, details) in enumerate(final_scores, 1):
                st.write(f"{idx}. **[{cap}]** {vuln} – Composite: **{score}** ({', '.join(details)})")

def visualize_cog_network(cog: str, capabilities: List[str], vulnerabilities_dict: Dict[str, List[str]], requirements_text: str):
    """Visualize the COG analysis as an interactive network using Plotly"""
    if not cog or not capabilities:
        st.info("Add a Center of Gravity and capabilities to see the network visualization")
        return

    G = nx.DiGraph()
    
    # Add COG as central node
    G.add_node(cog, node_type="COG", importance=10)
    
    # Add capabilities as second-level nodes
    for cap in capabilities:
        G.add_node(cap, node_type="Capability", importance=7)
        G.add_edge(cog, cap, edge_type="enables")
    
    # Add requirements as nodes
    if requirements_text:
        requirements = [req.strip() for req in requirements_text.split(";") if req.strip()]
        for req in requirements:
            G.add_node(req, node_type="Requirement", importance=5)
            # Connect requirements to capabilities they support
            for cap in capabilities:
                G.add_edge(req, cap, edge_type="supports")
    
    # Add vulnerabilities as leaf nodes
    for cap, vulns in vulnerabilities_dict.items():
        for vuln in vulns:
            G.add_node(vuln, node_type="Vulnerability", importance=3)
            G.add_edge(cap, vuln, edge_type="exposes")
    
    # Create Plotly visualization
    pos = nx.spring_layout(G, k=1, iterations=50)
    
    # Edge trace
    edge_x = []
    edge_y = []
    edge_text = []
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        edge_text.append(f"{edge[0]} → {edge[1]}<br>Type: {G.edges[edge]['edge_type']}")
    
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        line=dict(width=1, color='rgba(136, 136, 136, 0.6)'),
        hoverinfo='text',
        text=edge_text,
        mode='lines'
    )

    # Node trace
    node_x = []
    node_y = []
    node_text = []
    node_color = []
    node_size = []
    
    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_text.append(f"{node}<br>Type: {G.nodes[node]['node_type']}")
        node_color.append(G.nodes[node]['importance'])
        node_size.append(G.nodes[node]['importance'] * 5)
    
    node_trace = go.Scatter(
        x=node_x, y=node_y,
        mode='markers+text',
        hoverinfo='text',
        text=node_text,
        textposition="top center",
        marker=dict(
            showscale=True,
            colorscale='Viridis',
            size=node_size,
            color=node_color,
            colorbar=dict(
                title=dict(
                    text='Importance',
                    side='right'
                ),
                thickness=15,
                xanchor='left'
            )
        )
    )

    # Create figure
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
                text=f"Center of Gravity Analysis Network",
                x=0.5,
                y=0.95
            )
        )
    )

    st.plotly_chart(fig, use_container_width=True)
    return G

def export_graph(G: nx.DiGraph, format: str = "gexf"):
    """Export the COG network graph in various formats"""
    import io
    import networkx as nx
    
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
        if "cog_graph" in st.session_state:
            export_format = st.selectbox(
                "Select Graph Format",
                ["gexf", "graphml", "json"],
                help="GEXF works with Gephi, GraphML is widely supported, JSON is human-readable"
            )
            
            if st.button(f"Export as {export_format.upper()}"):
                try:
                    graph_data = export_graph(st.session_state.cog_graph, export_format)
                    st.download_button(
                        label=f"Download {export_format.upper()}",
                        data=graph_data,
                        file_name=f"COG_Analysis.{export_format}",
                        mime=f"application/{export_format}"
                    )
                except Exception as e:
                    st.error(f"Error exporting graph: {e}")

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

def generate_cog_suggestions(entity_type: str, entity_name: str, entity_goals: str, entity_presence: str, desired_end_state: str) -> Dict:
    """Generate AI suggestions for COG analysis components"""
    try:
        system_msg = {
            "role": "system",
            "content": "You are an AI specialized in Center of Gravity analysis. Generate a comprehensive analysis based on the provided information."
        }
        
        user_msg = {
            "role": "user",
            "content": f"""
            Analyze this entity and suggest a complete COG analysis:
            Entity Type: {entity_type}
            Entity Name: {entity_name}
            Goals: {entity_goals}
            Areas of Presence: {entity_presence}
            Desired End State: {desired_end_state}
            
            Format your response as a JSON structure with:
            1. cog: The primary Center of Gravity
            2. capabilities: List of 3-5 critical capabilities
            3. requirements: List of key requirements for each capability
            4. vulnerabilities: List of potential vulnerabilities for each capability
            """
        }
        
        # Example structure of suggestions (replace with actual AI response)
        suggestions = {
            'cog': {
                'name': 'Command and Control Network',
                'description': 'Central nervous system of operations, enabling decision-making and coordination',
                'rationale': 'Critical for maintaining operational effectiveness and strategic advantage'
            },
            'capabilities': [
                {
                    'name': 'Rapid Decision Making',
                    'type': 'Command',
                    'importance': 9,
                    'rationale': 'Enables quick response to changing situations'
                },
                {
                    'name': 'Information Distribution',
                    'type': 'Support',
                    'importance': 8,
                    'rationale': 'Ensures all elements have necessary intelligence'
                },
                {
                    'name': 'Resource Allocation',
                    'type': 'Logistics',
                    'importance': 7,
                    'rationale': 'Manages and directs critical resources'
                }
            ],
            'requirements': [
                {
                    'capability': 'Rapid Decision Making',
                    'items': [
                        'Secure communication infrastructure',
                        'Trained command staff',
                        'Real-time intelligence feeds'
                    ]
                },
                {
                    'capability': 'Information Distribution',
                    'items': [
                        'Redundant communication channels',
                        'Data processing centers',
                        'Trained communications personnel'
                    ]
                },
                {
                    'capability': 'Resource Allocation',
                    'items': [
                        'Supply chain management system',
                        'Transportation network',
                        'Storage facilities'
                    ]
                }
            ],
            'vulnerabilities': [
                {
                    'capability': 'Rapid Decision Making',
                    'items': [
                        {
                            'name': 'Communication Disruption',
                            'impact': 8,
                            'rationale': 'Loss of command links would severely degrade decision speed'
                        },
                        {
                            'name': 'Personnel Gaps',
                            'impact': 7,
                            'rationale': 'Key decision-makers may become unavailable'
                        }
                    ]
                },
                {
                    'capability': 'Information Distribution',
                    'items': [
                        {
                            'name': 'Network Security Weaknesses',
                            'impact': 9,
                            'rationale': 'Vulnerable to cyber attacks and information compromise'
                        },
                        {
                            'name': 'Single Points of Failure',
                            'impact': 8,
                            'rationale': 'Critical nodes in the network lack redundancy'
                        }
                    ]
                },
                {
                    'capability': 'Resource Allocation',
                    'items': [
                        {
                            'name': 'Supply Chain Disruption',
                            'impact': 8,
                            'rationale': 'Dependencies on specific routes or suppliers'
                        },
                        {
                            'name': 'Resource Depletion',
                            'impact': 7,
                            'rationale': 'Limited stockpiles and resupply capabilities'
                        }
                    ]
                }
            ]
        }
        
        return suggestions
    except Exception as e:
        st.error(f"Error generating suggestions: {e}")
        return None

def display_ai_suggestions(suggestions: Dict):
    """Display AI-generated suggestions with options to add them to the analysis"""
    if not suggestions:
        return
    
    st.markdown("### 🤖 AI-Generated Analysis Suggestions")
    
    # Display COG suggestion
    st.markdown("#### Suggested Center of Gravity")
    with st.container():
        st.markdown(
            f"""
            <div style='padding: 10px; border-radius: 5px; background-color: #f0f2f6; margin: 5px 0;'>
            <strong>{suggestions['cog']['name']}</strong><br>
            Description: {suggestions['cog']['description']}<br>
            Rationale: {suggestions['cog']['rationale']}
            </div>
            """,
            unsafe_allow_html=True
        )
        if st.button("Use This COG"):
            st.session_state["final_cog"] = suggestions['cog']['name']
            st.success(f"Set COG to: {suggestions['cog']['name']}")
            st.rerun()
    
    # Display capability suggestions
    st.markdown("#### Suggested Capabilities")
    col1, col2 = st.columns(2)
    
    with col1:
        for i, cap in enumerate(suggestions['capabilities']):
            with st.container():
                st.markdown(
                    f"""
                    <div style='padding: 10px; border-radius: 5px; background-color: #f0f2f6; margin: 5px 0;'>
                    <strong>{cap['name']}</strong><br>
                    Type: {cap['type']}<br>
                    Importance: {cap['importance']}/10<br>
                    Rationale: {cap['rationale']}
                    </div>
                    """,
                    unsafe_allow_html=True
                )
                if st.button(f"Add Capability: {cap['name']}", key=f"add_cap_{i}"):
                    if cap['name'] not in st.session_state["capabilities"]:
                        st.session_state["capabilities"].append(cap['name'])
                        st.success(f"Added capability: {cap['name']}")
                        st.rerun()
    
    # Display requirements suggestions
    with col2:
        st.markdown("#### Suggested Requirements")
        for req_group in suggestions['requirements']:
            cap_name = req_group['capability']
            if cap_name in st.session_state["capabilities"]:
                with st.container():
                    st.markdown(f"**For {cap_name}:**")
                    requirements_text = "; ".join(req_group['items'])
                    if st.button(f"Add Requirements for {cap_name}", key=f"add_req_{cap_name}"):
                        current_reqs = st.session_state["requirements_text"]
                        new_reqs = f"{current_reqs}\n{requirements_text}" if current_reqs else requirements_text
                        st.session_state["requirements_text"] = new_reqs
                        st.success(f"Added requirements for {cap_name}")
                        st.rerun()
    
    # Display vulnerability suggestions
    st.markdown("#### Suggested Vulnerabilities")
    for vuln_group in suggestions['vulnerabilities']:
        cap_name = vuln_group['capability']
        if cap_name in st.session_state["capabilities"]:
            with st.container():
                st.markdown(f"**Vulnerabilities for {cap_name}:**")
                for i, vuln in enumerate(vuln_group['items']):
                    st.markdown(
                        f"""
                        <div style='padding: 10px; border-radius: 5px; background-color: #f0f2f6; margin: 5px 0;'>
                        <strong>{vuln['name']}</strong><br>
                        Impact: {vuln['impact']}/10<br>
                        Rationale: {vuln['rationale']}
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                    if st.button(f"Add Vulnerability: {vuln['name']}", key=f"add_vuln_{cap_name}_{i}"):
                        if cap_name not in st.session_state["vulnerabilities_dict"]:
                            st.session_state["vulnerabilities_dict"][cap_name] = []
                        if vuln['name'] not in st.session_state["vulnerabilities_dict"][cap_name]:
                            st.session_state["vulnerabilities_dict"][cap_name].append(vuln['name'])
                            st.success(f"Added vulnerability to {cap_name}")
                            st.rerun()

def cog_analysis():
    st.title("Enhanced Center of Gravity (COG) Analysis Flow")
    st.write("""
    This flow helps you:
    1. Identify the entity type and basic details.
    2. See relevant domain considerations.
    3. Generate or manually define potential Centers of Gravity.
    4. Identify Critical Capabilities & Requirements.
    5. Manage Assumptions and Search for Supporting Data.
    6. Identify Critical Vulnerabilities.
    7. Define / Edit Scoring Criteria and Prioritize Vulnerabilities.
    8. Export and Save Analysis.
    """)
    
    domain_guidance = {
        "Friendly": {
            "description": """
**Friendly COG**:  
Assess our foundational strengths across various domains while considering different perspectives.  
            """,
            "perspectives": {
                "Strategic": {
                    "questions": [
                        "What international alliances and diplomatic relations fortify our position?",
                        "How do global policies impact our strategic objectives?"
                    ]
                },
                "Operational": {
                    "questions": [
                        "Which communication and propaganda efforts are most influential?",
                        "What operational challenges are we currently facing in key regions?"
                    ]
                },
                "Tactical": {
                    "questions": [
                        "Which units or systems provide the tactical edge?",
                        "How can ground-level actions be optimized for success?"
                    ]
                },
                "Business": {
                    "questions": [
                        "What market dynamics and competitive factors contribute to our strength?",
                        "How does financial health affect our operational decisions?"
                    ]
                },
                "Personal": {
                    "questions": [
                        "How do leadership and personnel morale contribute to our overall performance?",
                        "What individual skills and expertise set us apart?"
                    ]
                }
            }
        },
        "Opponent": {
            "description": """
**Opponent COG**:  
Examine the opponent's sources of power by evaluating the situation from multiple perspectives.
            """,
            "perspectives": {
                "Strategic": {
                    "questions": [
                        "How do their international relationships influence their global strategy?",
                        "What strategic shifts have been observed recently?"
                    ]
                },
                "Operational": {
                    "questions": [
                        "Which military capabilities give them an edge on the ground?",
                        "How are their operations coordinated across regions?"
                    ]
                },
                "Tactical": {
                    "questions": [
                        "Which assets or maneuvers create vulnerabilities?",
                        "How resilient are their short-term tactical operations?"
                    ]
                },
                "Business": {
                    "questions": [
                        "What economic dependencies can be exploited?",
                        "How do market forces or trade relationships work in their favor?"
                    ]
                },
                "Personal": {
                    "questions": [
                        "What does the leadership style reveal about their decision-making?",
                        "How do internal dynamics affect their cohesion?"
                    ]
                }
            }
        },
        "Host Nation": {
            "description": """
**Host Nation COG**:  
Assess the host nation's pivotal strengths and vulnerabilities:
            """,
            "questions": [
                "What is the host nation's stance, and how does it influence the conflict?",
                "What are their capabilities in managing or disseminating information?",
                "What military aspects of the host nation could influence their role in the conflict?",
                "How do the economic conditions affect their alignment in the conflict?",
                "Assess the cyberinfrastructure and defenses of the host nation.",
                "Evaluate the host nation's reliance and capabilities on space-based assets."
            ]
        },
        "Customer": {
            "description": """
**Customer COG**:  
Focus on purchasing and viewership criteria rather than the usual levers of power:
            """,
            "questions": [
                "Which communication channels are most influential for their decisions?",
                "What drives their buying or subscription choices?",
                "Are there brand or relationship factors that keep them engaged?",
                "Financial or budget constraints that affect their decisions?",
                "How do peer networks or social communities guide preferences?"
            ]
        }
    }

    # Initialize session state
    initialize_session_state()

    entity_type, entity_name, entity_goals, entity_presence = get_entity_info_form(domain_guidance)
    domain_answers = display_domain_questions(domain_guidance, entity_type)

    # Now add the Identify/Generate Possible CoG section with helpful tooltips and detailed descriptions.
    cog_identification = generate_cog_identification()

    st.markdown("---")
    st.subheader("Identify / Generate Possible Centers of Gravity")

    if "cog_suggestions" not in st.session_state:
        st.session_state["cog_suggestions"] = []

    desired_end_state = st.text_input(
        "Desired End State or Effect (Optional)",
        help="What outcome do you want? Helps AI generate relevant CoGs."
    )

    generate_cog(entity_type, entity_name, entity_goals, entity_presence, desired_end_state)

    if st.session_state["cog_suggestions"]:
        user_selected_cog = st.selectbox(
            "Select a CoG from AI suggestions (or type your own)",
            ["(None)"] + st.session_state["cog_suggestions"]
        )
    else:
        user_selected_cog = "(None)"

    user_cog = st.text_input(
        "Or manually define the COG here",
        help="e.g. 'Key Influencer Network; Critical Infrastructure Hub; ...'"
    )
    final_cog = user_cog.strip() if user_cog.strip() else (
        user_selected_cog if user_selected_cog != "(None)" else ""
    )
    st.markdown(f"**Selected CoG**: {final_cog if final_cog else '(None)'}")

    st.markdown("---")
    st.subheader("Identify Critical Capabilities & Requirements")
    manage_capabilities(final_cog, entity_type, entity_name, entity_goals, entity_presence)

    if "requirements_text" not in st.session_state:
        st.session_state["requirements_text"] = ""

    requirements_label = """
Enter any known *Requirements* (resources, conditions) that the CoG must have in order 
to perform its critical capabilities. Separate them by semicolons or lines.
"""
    st.session_state["requirements_text"] = st.text_area(
        "Critical Requirements",
        help=requirements_label,
        value=st.session_state["requirements_text"],
        height=100
    )

    if st.button("AI: Suggest Requirements"):
        if not final_cog:
            st.warning("Please specify/select a CoG first.")
        else:
            try:
                system_msg = {"role": "system", "content": "You are an AI that identifies requirements for a CoG."}
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Entity Type: {entity_type}\n"
                        f"Entity Name: {entity_name}\n"
                        f"Goals: {entity_goals}\n"
                        f"Areas of Presence: {entity_presence}\n"
                        f"CoG: {final_cog}\n\n"
                        "List about 5 critical requirements (resources/conditions the CoG needs) as semicolons."
                    )
                }
                resp = get_completion([system_msg, user_msg], model="gpt-4o-mini")
                st.session_state["requirements_text"] += f"\n{resp}"
                st.success("Appended AI-suggested requirements.")
            except Exception as e:
                st.error(f"Error suggesting requirements: {e}")

    st.markdown("---")
    st.subheader("Identify Critical Vulnerabilities")
    manage_vulnerabilities(entity_type, entity_name, entity_goals, entity_presence, final_cog)

    all_vulnerabilities_list = []
    for cap in st.session_state["capabilities"]:
        for v_item in st.session_state["vulnerabilities_dict"].get(cap, []):
            all_vulnerabilities_list.append((cap, v_item))

    st.subheader("Define / Edit Scoring Criteria")
    score_and_prioritize(all_vulnerabilities_list)

    st.markdown("---")
    st.subheader("Network Visualization")
    G = visualize_cog_network(
        final_cog,
        st.session_state["capabilities"],
        st.session_state["vulnerabilities_dict"],
        st.session_state["requirements_text"]
    )
    if G:
        st.session_state.cog_graph = G

    st.markdown("---")
    st.subheader("Export / Save Results")
    export_results(all_vulnerabilities_list)

    # New sections for assumptions management and reference searches:
    st.markdown("---")
    manage_assumptions()
    
    st.markdown("---")
    search_references()

    # New: Save / Load section for resuming work later
    save_and_load_analysis()

    # Add AI-assisted analysis section at the top
    st.markdown("### 🤖 AI-Assisted Analysis")
    if st.button("Generate Complete COG Analysis", type="primary"):
        if not entity_type or not entity_name:
            st.warning("Please provide entity type and name first.")
        else:
            with st.spinner("Generating COG analysis suggestions..."):
                suggestions = generate_cog_suggestions(
                    entity_type,
                    entity_name,
                    entity_goals,
                    entity_presence,
                    desired_end_state
                )
                if suggestions:
                    display_ai_suggestions(suggestions)

def main():
    cog_analysis()

if __name__ == "__main__":
    main()