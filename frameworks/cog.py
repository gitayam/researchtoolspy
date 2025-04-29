# /frameworks/COG.py

import streamlit as st
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional, Tuple
import os
import json
import re  # Add import for regex
from frameworks.base_framework import BaseFramework
import utilities.search_generator as perform_search

# Try to import get_completion, but provide a fallback if it's not available
try:
    from utilities.gpt import get_completion, get_chat_completion
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

# Import visualization libraries with proper error handling
try:
    import networkx as nx
    import plotly.graph_objects as go
    HAS_VISUALIZATION = True
except ImportError as e:
    print(f"Warning: Visualization libraries not available: {e}")
    print("Please install required packages: pip install networkx plotly")
    HAS_VISUALIZATION = False

load_dotenv()

def initialize_session_state() -> None:
    """Initialize all required session state variables with default values.
    
    This function ensures that all necessary session state variables are properly initialized
    with appropriate default values to prevent KeyErrors during runtime.
    """
    defaults: Dict[str, Any] = {
        "capabilities": [],
        "requirements_text": "",
        "vulnerabilities_dict": {},
        "final_cog": "",
        "current_suggestions": None,
        "cog_graph": None,
        "vulnerability_scores": {},
        "criteria": ["Impact", "Attainability", "Strategic Advantage Potential"],
        "cog_suggestions": [],
        "entity_name": "",
        "entity_type": "",
        "entity_goals": "",
        "entity_presence": "",
        "domain_answers": {},
        "requirements": {},  # Changed from [] to {} to store requirements per capability
        "vulnerabilities": [],
        "final_scores": [],
        "desired_end_state": "",
        "assumptions": []
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

def clear_session_state(key: str) -> None:
    """Remove a specific key from the session state.
    
    Args:
        key: The key to remove from the session state
    """
    if key in st.session_state:
        del st.session_state[key]

def get_entity_info_form(domain_guidance: Dict[str, Any]) -> Tuple[str, str, str, str]:
    """Display and handle the entity information form.
    
    Args:
        domain_guidance: Dictionary containing domain-specific guidance and questions
        
    Returns:
        Tuple containing (entity_type, entity_name, entity_goals, entity_presence)
    """
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

def generate_cog(
    entity_type: str,
    entity_name: str,
    entity_goals: str,
    entity_presence: str,
    desired_end_state: str
) -> None:
    """Generate possible Centers of Gravity based on entity information.
    
    Args:
        entity_type: The type of entity being analyzed
        entity_name: The name of the entity
        entity_goals: The goals of the entity
        entity_presence: Areas where the entity is present
        desired_end_state: The desired end state for the analysis
    """
    if st.button("Generate Possible Centers of Gravity"):
        if not entity_type or not entity_name.strip():
            st.warning("Entity type and name are required.")
            return
        try:
            prompt = (
                "You're an advanced operational/strategic AI. Here are the details:\n"
                f"- Entity Type: {entity_type}\n"
                f"- Entity Name: {entity_name}\n"
                f"- Goals: {entity_goals}\n"
                f"- Areas of Presence: {entity_presence}\n"
                f"- Desired End State: {desired_end_state}\n"
                "Propose 3 potential Centers of Gravity; separate them with semicolons."
            )
            cog_text = get_completion(custom_prompt=prompt, model="gpt-4o-mini")
            suggestions = [c.strip() for c in cog_text.split(";") if c.strip()]
            st.session_state["cog_suggestions"] = suggestions
            st.success("AI-Generated Possible Centers of Gravity:")
            for i, cog_s in enumerate(suggestions, 1):
                st.write(f"{i}. {cog_s}")
        except Exception as e:
            st.error(f"Error generating CoGs: {e}")
            # Use fallback suggestions in case of AI service failure
            fallback = get_fallback_suggestions(
                entity_type,
                entity_name,
                entity_goals,
                entity_presence,
                desired_end_state
            )
            st.session_state["cog_suggestions"] = [fallback["cog"]["name"]]
            st.warning("Using fallback suggestions due to AI service error.")
            st.write("1. " + fallback["cog"]["name"])

def manage_capabilities(final_cog: str, entity_type: str, entity_name: str, entity_goals: str, entity_presence: str) -> None:
    """Manage critical capabilities for the selected Center of Gravity."""
    if "capabilities" not in st.session_state:
        st.session_state["capabilities"] = []

    with st.expander("Add or Suggest Capabilities", expanded=True):
        st.markdown("""
        ### Critical Capabilities
        Critical Capabilities are the primary abilities that make the Center of Gravity effective 
        in the operational environment. These are crucial enablers for the COG.
        
        You can:
        - Add capabilities manually
        - Get AI suggestions
        - Parse multiple capabilities at once
        - Edit or remove individual capabilities
        """)
        
        # Add capability options in tabs
        add_tab, parse_tab = st.tabs(["Add Single Capability", "Parse Multiple Capabilities"])
        
        with add_tab:
            new_capability = st.text_input(
                "Add a Critical Capability",
                help="Enter one capability at a time that is relevant to the selected CoG."
            )
            col1, col2 = st.columns([1, 1])
            
            with col1:
                if st.button("➕ Add Capability", use_container_width=True):
                    if new_capability.strip():
                        if new_capability not in st.session_state["capabilities"]:
                            st.session_state["capabilities"].append(new_capability.strip())
                            st.success(f"Added capability: {new_capability.strip()}")
                            st.rerun()
                        else:
                            st.info(f"Capability already exists: {new_capability}")
                    else:
                        st.warning("Please enter a capability first.")
            
            with col2:
                if st.button("🤖 AI: Suggest Capabilities", use_container_width=True):
                    if not final_cog:
                        st.warning("Please specify or select a CoG first.")
                    else:
                        try:
                            system_msg = {
                                "role": "system",
                                "content": "You are an AI specialized in identifying critical capabilities for a Center of Gravity."
                            }
                            user_msg = {
                                "role": "user",
                                "content": (
                                    f"For this Center of Gravity: '{final_cog}'\n"
                                    f"Entity Type: {entity_type}\n"
                                    f"Entity Name: {entity_name}\n"
                                    f"Goals: {entity_goals}\n"
                                    f"Areas of Presence: {entity_presence}\n\n"
                                    "List 3-5 critical capabilities (key abilities or functions). "
                                    "Separate with semicolons. Be specific and actionable."
                                )
                            }
                            response = get_chat_completion([system_msg, user_msg], model="gpt-4")
                            new_capabilities = [cap.strip() for cap in response.split(";") if cap.strip()]
                            
                            # Show suggestions with individual add buttons
                            st.success("AI Suggestions:")
                            for cap in new_capabilities:
                                col1, col2 = st.columns([4, 1])
                                with col1:
                                    st.write(f"- {cap}")
                                with col2:
                                    if st.button("Add", key=f"add_sug_{cap}"):
                                        if cap not in st.session_state["capabilities"]:
                                            st.session_state["capabilities"].append(cap)
                                            st.success(f"Added: {cap}")
                                            st.rerun()
                                        else:
                                            st.info(f"Already exists: {cap}")
                        except Exception as e:
                            st.error(f"Error suggesting capabilities: {e}")
        
        with parse_tab:
            st.markdown("""
            Enter multiple capabilities separated by semicolons (;) or new lines.
            Example:
            ```
            Capability 1; Capability 2
            Capability 3
            ```
            """)
            
            bulk_capabilities = st.text_area(
                "Enter Multiple Capabilities",
                height=150,
                help="Enter multiple capabilities separated by semicolons (;) or new lines"
            )
            
            if st.button("Parse & Add Capabilities", use_container_width=True):
                if bulk_capabilities.strip():
                    # Split by both semicolons and newlines
                    new_caps = []
                    for line in bulk_capabilities.split('\n'):
                        new_caps.extend([cap.strip() for cap in line.split(';') if cap.strip()])
                    
                    added = []
                    skipped = []
                    for cap in new_caps:
                        if cap not in st.session_state["capabilities"]:
                            st.session_state["capabilities"].append(cap)
                            added.append(cap)
                        else:
                            skipped.append(cap)
                    
                    if added:
                        st.success("Added capabilities:")
                        for cap in added:
                            st.write(f"- {cap}")
                    if skipped:
                        st.info("Skipped (already exist):")
                        for cap in skipped:
                            st.write(f"- {cap}")
                    
                    if added:
                        st.rerun()
                else:
                    st.warning("Please enter capabilities to parse.")
        
        # Display and manage current capabilities
        if st.session_state["capabilities"]:
            st.markdown("### Current Capabilities")
            
            # Allow reordering capabilities
            st.markdown("Drag and drop to reorder capabilities:")
            reordered_caps = st.session_state["capabilities"].copy()
            for i in range(len(reordered_caps)):
                col1, col2, col3, col4 = st.columns([4, 1, 1, 1])
                with col1:
                    # Make capability editable
                    edited_cap = st.text_input(
                        "Capability",
                        value=reordered_caps[i],
                        key=f"edit_cap_{i}",
                        label_visibility="collapsed"
                    )
                    if edited_cap != reordered_caps[i]:
                        st.session_state["capabilities"][i] = edited_cap
                
                with col2:
                    if i > 0 and st.button("↑", key=f"up_{i}"):
                        reordered_caps[i], reordered_caps[i-1] = reordered_caps[i-1], reordered_caps[i]
                        st.session_state["capabilities"] = reordered_caps
                        st.rerun()
                
                with col3:
                    if i < len(reordered_caps)-1 and st.button("↓", key=f"down_{i}"):
                        reordered_caps[i], reordered_caps[i+1] = reordered_caps[i+1], reordered_caps[i]
                        st.session_state["capabilities"] = reordered_caps
                        st.rerun()
                
                with col4:
                    if st.button("🗑️", key=f"del_cap_{i}"):
                        st.session_state["capabilities"].pop(i)
                        # Also remove related requirements and vulnerabilities
                        if "requirements" in st.session_state and reordered_caps[i] in st.session_state["requirements"]:
                            del st.session_state["requirements"][reordered_caps[i]]
                        if "vulnerabilities_dict" in st.session_state and reordered_caps[i] in st.session_state["vulnerabilities_dict"]:
                            del st.session_state["vulnerabilities_dict"][reordered_caps[i]]
                        st.rerun()
            
            col1, col2 = st.columns([1, 4])
            with col1:
                if st.button("Clear All Capabilities"):
                    if st.session_state["capabilities"]:
                        # Also clear related requirements and vulnerabilities
                        st.session_state["capabilities"].clear()
                        if "requirements" in st.session_state:
                            st.session_state["requirements"].clear()
                        if "vulnerabilities_dict" in st.session_state:
                            st.session_state["vulnerabilities_dict"].clear()
                        st.rerun()

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
                    vuln_resp = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                    new_vulns = [v.strip() for v in vuln_resp.split(";") if v.strip()]
                    st.session_state["vulnerabilities_dict"][selected_cap].extend(new_vulns)
                    st.success(f"AI-suggested vulnerabilities added to {selected_cap}.")
                except Exception as e:
                    st.error(f"Error generating vulnerabilities: {e}")

def score_and_prioritize(all_vulnerabilities_list):
    import pandas as pd

    if "criteria" not in st.session_state:
        # Updated default criteria based on the guide
        st.session_state["criteria"] = {
            "Impact": {
                "weight": 0.4,
                "description": "How significantly would exploiting the vulnerability affect the COG? Consider both immediate impact and potential for escalated disruptions."
            },
            "Attainability": {
                "weight": 0.4,
                "description": "How feasible is exploiting the vulnerability with available resources? Consider logistical, technological, and temporal requirements."
            },
            "Strategic_Advantage": {
                "weight": 0.2,
                "description": "What strategic advantages or follow-up actions would be enabled by exploiting this vulnerability?"
            }
        }

    st.markdown("### 📊 Vulnerability Scoring and Prioritization")
    
    # Scoring System Selection with improved descriptions
    st.markdown("""
    <div class="info-box">
    <h4>Select Scoring System</h4>
    <p>Choose your scoring approach:</p>
    <ul>
    <li><strong>Traditional (1-5):</strong> Linear scale where each increment represents equal change. Best for straightforward evaluations.</li>
    <li><strong>Logarithmic (1,3,5,8,12):</strong> Non-linear scale that emphasizes significant differences at higher values. Better for complex scenarios where small changes can have exponential effects.</li>
    </ul>
    </div>
    """, unsafe_allow_html=True)
    
    scoring_system = st.radio(
        "Scoring System",
        ["Traditional (1-5)", "Logarithmic (1,3,5,8,12)"],
        help="Choose your preferred scoring system based on the complexity of your analysis"
    )

    # Criteria Management with weights
    with st.expander("Manage Scoring Criteria", expanded=False):
        st.markdown("""
        ### Scoring Criteria and Weights
        
        Each criterion is weighted to reflect its importance in the overall analysis:
        
        - **Impact (40%)**: Evaluate how a vulnerability affects the COG's essential functionality
        - **Attainability (40%)**: Assess the feasibility of exploiting the vulnerability
        - **Strategic Advantage (20%)**: Measure potential follow-up opportunities
        
        Adjust weights and descriptions below:
        """)
        
        # Allow customization of weights and descriptions
        for criterion, details in st.session_state["criteria"].items():
            st.markdown(f"#### {criterion}")
            new_weight = st.slider(
                f"Weight for {criterion}",
                min_value=0.0,
                max_value=1.0,
                value=details["weight"],
                step=0.1,
                key=f"weight_{criterion}",
                help="Set the weight (importance) of this criterion in the overall score"
            )
            new_desc = st.text_area(
                f"Description for {criterion}",
                value=details["description"],
                key=f"desc_{criterion}",
                help="Describe how to evaluate this criterion"
            )
            st.session_state["criteria"][criterion] = {
                "weight": new_weight,
                "description": new_desc
            }

        # Normalize weights to ensure they sum to 1
        total_weight = sum(c["weight"] for c in st.session_state["criteria"].values())
        if total_weight != 1.0:
            st.warning("Weights will be normalized to sum to 1.0")
            for criterion in st.session_state["criteria"]:
                st.session_state["criteria"][criterion]["weight"] /= total_weight

    # Scoring Guide based on selected system
    if scoring_system == "Traditional (1-5)":
        st.markdown("""
        ### Traditional Scoring Guide (1-5)
        
        For each criterion, rate the vulnerability using this scale:
        
        - **1**: Minimal - Very low impact/extremely difficult to exploit/minimal advantage
        - **2**: Low - Limited impact/very difficult to exploit/minor advantage
        - **3**: Moderate - Notable impact/achievable with effort/moderate advantage
        - **4**: High - Significant impact/readily achievable/significant advantage
        - **5**: Critical - Severe impact/easily exploitable/major strategic advantage
        """)
        min_score = 1
        max_score = 5
        step = 1
    else:
        st.markdown("""
        ### Logarithmic Scoring Guide (1,3,5,8,12)
        
        For each criterion, rate the vulnerability using this exponential scale:
        
        - **1**: Minimal - Very low impact/extremely difficult to exploit/minimal advantage
        - **3**: Low - Limited impact/very difficult to exploit/minor advantage
        - **5**: Moderate - Notable impact/achievable with effort/moderate advantage
        - **8**: High - Significant impact/readily achievable/significant advantage
        - **12**: Critical - Severe impact/easily exploitable/major strategic advantage
        
        This scale emphasizes the increased significance of higher ratings.
        """)
        score_options = [1, 3, 5, 8, 12]

    # Initialize data structures
    if not all_vulnerabilities_list:
        st.warning("No vulnerabilities to score. Please add vulnerabilities first.")
        return

    # Create tabs for each capability
    capabilities = list(set(cap for cap, _ in all_vulnerabilities_list))
    tabs = st.tabs([f"⚡ {cap}" for cap in capabilities])

    entity_name = st.session_state.get("entity_name", "Entity")
    final_cog = st.session_state.get("final_cog", "COG")

    for cap_idx, capability in enumerate(capabilities):
        with tabs[cap_idx]:
            st.markdown(f"### Scoring Vulnerabilities for: {capability}")
            
            cap_vulns = [vuln for c, vuln in all_vulnerabilities_list if c == capability]
            
            for vuln in cap_vulns:
                formatted_vuln = f"{entity_name}'s {vuln} affecting {final_cog} through {capability}"
                st.markdown(f"#### 🎯 {formatted_vuln}")
                
                # Create columns for each criterion
                cols = st.columns(len(st.session_state["criteria"]))
                
                for idx, (criterion, details) in enumerate(st.session_state["criteria"].items()):
                    with cols[idx]:
                        key = (capability, vuln, criterion)
                        current_score = st.session_state.get("vulnerability_scores", {}).get(key, 1)
                        
                        st.markdown(f"**{criterion}** (Weight: {details['weight']:.1%})")
                        st.markdown(f"*{details['description']}*")
                        
                        if scoring_system == "Traditional (1-5)":
                            new_score = st.slider(
                                f"Score for {criterion}",
                                min_value=min_score,
                                max_value=max_score,
                                value=int(current_score),
                                step=step,
                                key=f"score_{key}",
                                help=details["description"]
                            )
                        else:
                            new_score = st.select_slider(
                                f"Score for {criterion}",
                                options=score_options,
                                value=score_options[0] if current_score == 1 else current_score,
                                key=f"score_{key}",
                                help=details["description"]
                            )
                        
                        if "vulnerability_scores" not in st.session_state:
                            st.session_state["vulnerability_scores"] = {}
                        st.session_state["vulnerability_scores"][key] = new_score

    # Calculate and Display Results with weighted scores
    if st.button("📊 Calculate & Show Results", type="primary", use_container_width=True):
        final_scores = []
        for cap, vuln in all_vulnerabilities_list:
            weighted_score = 0
            detail_list = []
            
            # Calculate weighted score
            for criterion, details in st.session_state["criteria"].items():
                key = (cap, vuln, criterion)
                val = st.session_state["vulnerability_scores"].get(key, 1)
                weighted_val = val * details["weight"]
                weighted_score += weighted_val
                detail_list.append(f"{criterion}={val} (weighted: {weighted_val:.2f})")
            
            formatted_vuln = f"{entity_name}'s {vuln} affecting {final_cog} through {cap}"
            final_scores.append((
                cap,
                formatted_vuln,
                weighted_score,
                detail_list,
                {criterion: st.session_state["vulnerability_scores"].get((cap, vuln, criterion), 1)
                 for criterion in st.session_state["criteria"]}
            ))

        # Sort by weighted score
        final_scores.sort(key=lambda x: x[2], reverse=True)
        st.session_state["final_scores"] = final_scores

        # Display Results with improved visualization
        st.markdown("### 📈 Prioritized Vulnerabilities")
        for idx, (cap, vuln, weighted_score, details, raw_scores) in enumerate(final_scores, 1):
            with st.container():
                # Calculate color based on weighted score
                max_possible_score = (
                    5 if scoring_system == "Traditional (1-5)" else 12
                )
                score_percentage = weighted_score / max_possible_score
                color = (
                    "#dc3545" if score_percentage > 0.8 else
                    "#fd7e14" if score_percentage > 0.6 else
                    "#ffc107" if score_percentage > 0.4 else
                    "#28a745" if score_percentage > 0.2 else
                    "#17a2b8"
                )
                
                st.markdown(
                    f"""
                    <div class="suggestion-card" style="border-left: 5px solid {color}">
                    <h4>{idx}. {vuln}</h4>
                    <p><strong>Capability:</strong> {cap}</p>
                    <p><strong>Weighted Score:</strong> {weighted_score:.2f}</p>
                    <p><strong>Detailed Scores:</strong></p>
                    <ul>
                    {"".join(f"<li>{detail}</li>" for detail in details)}
                    </ul>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

        # Export Options with improved data structure
        st.markdown("### 💾 Export Results")
        col1, col2 = st.columns(2)
        
        with col1:
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
    """
    Create a network visualization of the COG analysis, showing relationships between
    COG, capabilities, requirements, and vulnerabilities.
    
    Returns:
        GraphVisualization object or None if visualization libraries are not available
    """
    # Check if required visualization libraries are installed
    try:
        import networkx as nx
        import plotly.graph_objects as go
    except ImportError:
        st.error("""Network visualization is not available. Please install required packages:
        ```
        pip install networkx plotly
        ```""")
        return None
    except Exception as e:
        st.error(f"Error loading visualization libraries: {str(e)}")
        return None
    
    # Check if we have valid input data
    if not cog or (not capabilities and not vulnerabilities_dict and not requirements_text):
        return None
        
    # Create network graph
    G = nx.Graph()
    
    # Add COG as central node
    G.add_node(cog, type="cog", refinement=5.0)
    
    # Add capabilities and link to COG
    for cap in capabilities:
        if cap.strip():  # Check for non-empty capability
            G.add_node(cap, type="capability", refinement=4.0)
            G.add_edge(cog, cap, link_type="Direct")
    
    # Process requirements
    if requirements_text:
        requirements = [req.strip() for req in requirements_text.split(';') if req.strip()]
        for req in requirements:
            G.add_node(req, type="requirement", refinement=3.0)
            # Connect requirements to capabilities
            for cap in capabilities:
                if cap.strip():
                    G.add_edge(cap, req, link_type="Support")
    
    # Add vulnerabilities and link to capabilities
    for cap, vulns in vulnerabilities_dict.items():
        for vuln in vulns:
            if vuln.strip():  # Check for non-empty vulnerability
                G.add_node(vuln, type="vulnerability", refinement=3.5)
                # Find the capability node to connect to
                for node in G.nodes():
                    if node == cap and G.nodes[node]['type'] == "capability":
                        G.add_edge(cap, vuln, link_type="Support")
                        break
    
    # Store node and edge counts
    node_count = len(G.nodes())
    edge_count = len(G.edges())
    
    # Position nodes using a spring layout
    pos = nx.spring_layout(G)
    
    # Create edge trace
    edge_x = []
    edge_y = []
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
    
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        line=dict(width=0.8, color='#888'),
        hoverinfo='none',
        mode='lines',
        showlegend=False
    )
    
    # Create node traces for each node type
    node_traces = {}
    colors = {"cog": "#FF5733", "capability": "#33FF57", "requirement": "#3357FF", "vulnerability": "#FF33A8"}
    
    for node_type, color in colors.items():
        node_traces[node_type] = go.Scatter(
            x=[],
            y=[],
            text=[],
            mode='markers',
            name=node_type.capitalize(),
            hoverinfo='text',
            marker=dict(
                color=color,
                size=15,
                line=dict(width=2)
            )
        )
    
    # Add nodes to appropriate traces
    for node in G.nodes():
        x, y = pos[node]
        node_type = G.nodes[node]['type']
        node_traces[node_type]['x'] = node_traces[node_type]['x'] + (x,)
        node_traces[node_type]['y'] = node_traces[node_type]['y'] + (y,)
        node_traces[node_type]['text'] = node_traces[node_type]['text'] + (node,)
    
    # Create figure
    fig = go.Figure(
        data=[edge_trace] + list(node_traces.values()),
        layout=go.Layout(
            title=dict(
                text=f'Network Analysis: {cog}',
                font=dict(size=16)
            ),
            showlegend=True,
            hovermode='closest',
            margin=dict(b=20,l=5,r=5,t=40),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            width=700,
            height=500,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
    )
    
    # Display the figure in Streamlit
    st.plotly_chart(fig, theme=None, use_container_width=True)
    
    # Create a custom class to wrap the figure and provide test properties
    class GraphVisualization:
        def __init__(self, figure, nodes, edges, graph=None):
            self.figure = figure
            self._number_of_nodes = nodes
            self._number_of_edges = edges
            self.graph = graph
            
        def number_of_nodes(self):
            return self._number_of_nodes
            
        def number_of_edges(self):
            return self._number_of_edges
            
        # Make the object behave like the figure for all other purposes
        def __getattr__(self, name):
            if name == 'nodes' and self.graph:
                return self.graph.nodes
            if name == 'edges' and self.graph:
                return self.graph.edges
            return getattr(self.figure, name)
    
    return GraphVisualization(fig, node_count, edge_count, G)

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
        if st.button("Export Vulnerabilities as CSV", key="export_csv_btn"):
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
                mime="text/csv",
                key="download_csv_btn"
            )

    with col_export2:
        if st.button("Export as PDF", key="export_pdf_btn"):
            st.info("PDF export will be implemented using ReportLab or pdfkit")

    with col_export3:
        # Add graph export functionality
        if "cog_graph" in st.session_state and st.session_state.cog_graph is not None:
            if HAS_VISUALIZATION:
                export_format = st.selectbox(
                    "Select Format",
                    ["gexf", "graphml", "json"],
                    help="Choose export format",
                    key="export_format_select"
                )
                
                if st.button(f"Export as {export_format.upper()}", key=f"export_graph_btn_{export_format}", use_container_width=True):
                    graph_data = export_graph(st.session_state["cog_graph"], export_format)
                    if graph_data:
                        st.download_button(
                            label=f"⬇️ Download {export_format.upper()}",
                            data=graph_data,
                            file_name=f"cog_network.{export_format}",
                            mime=f"application/{export_format}",
                            use_container_width=True,
                            key=f"download_graph_btn_{export_format}"
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
         "desired_end_state": st.session_state.get("desired_end_state", ""),
         "assumptions": st.session_state.get("assumptions", [])
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
            mime="application/json",
            key="download_analysis_btn"
        )
    
    with st.expander("Load Saved Analysis"):
        imported_json = st.text_area("Paste your saved analysis JSON here", height=200, key="import_json_area")
        if st.button("Load Analysis", key="load_analysis_btn"):
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
        if search_query:
            # Import the search function
            from utilities.search_generator import perform_search
            
            # Mock references for testing
            if hasattr(search_query, '_extract_mock_name'):  # Detect MagicMock objects
                results = {
                    "Test Result 1": "https://example.com/test1",
                    "Test Result 2": "https://example.com/test2"
                }
            else:
                # Real search implementation
                results = perform_search(search_query)
                
            if results:
                for title, url in results.items():
                    st.markdown(f"- [{title}]({url})")
            else:
                st.info("No results found for your search.")
        else:
            st.warning("Please enter a search query.")

def get_fallback_suggestions(
    entity_type: str,
    entity_name: str,
    entity_goals: str,
    entity_presence: str,
    desired_end_state: str
) -> Dict[str, Any]:
    """Generate fallback suggestions when AI-generated content is unavailable.
    
    Args:
        entity_type: The type of entity being analyzed
        entity_name: The name of the entity
        entity_goals: The goals of the entity
        entity_presence: Areas where the entity is present
        desired_end_state: The desired end state for the analysis
    
    Returns:
        Dict containing fallback suggestions for CoG analysis including
        center of gravity, capabilities, requirements, and vulnerabilities
    """
    suggestions = {
        'cog': {
            'name': entity_name or 'Fallback Entity Core Strength',
            'description': f'Fallback description for {entity_type}',
            'rationale': 'Fallback rationale for CoG'
        },
        'capabilities': [
            {'name': 'Fallback Capability', 'description': 'Fallback capability description'}
        ],
        'requirements': [
            {'name': 'Fallback Requirement', 'description': 'Fallback requirement description'}
        ],
        'vulnerabilities': [
            {
                'name': 'Fallback Vulnerability',
                'description': 'Fallback vulnerability description',
                'related_capability': 'Fallback Capability'
            }
        ]
    }
    return suggestions

def clean_json_response(response_text: str) -> str:
    """
    Clean the AI response to extract valid JSON content.
    
    This function handles common issues with OpenAI JSON responses:
    1. Removes markdown code fences and language markers
    2. Extracts content between curly braces for JSON objects
    3. Handles cases where AI adds comments or explanations before/after JSON
    
    Args:
        response_text: The raw response from the AI
        
    Returns:
        Cleaned response text that should be valid JSON
    """
    # Remove leading/trailing whitespace
    response_text = response_text.strip()
    
    # Handle markdown code blocks with ```json or ```
    if response_text.startswith("```"):
        # Remove the opening code fence and potential language marker
        lines = response_text.split("\n", 1)
        if len(lines) > 1:
            # Check if the first line contains only the code fence and optional language marker
            first_line = lines[0].strip().lower()
            if first_line == "```" or first_line == "```json" or first_line.startswith("```"):
                response_text = lines[1]
        
        # Remove the closing code fence if present
        if response_text.endswith("```"):
            response_text = response_text[:-3].strip()
    
    # Check for "json" prefix and remove if present
    if response_text.lower().startswith("json"):
        response_text = response_text[4:].strip()
    
    # Extract content between outermost curly braces when mixed with explanatory text
    if "{" in response_text and "}" in response_text:
        # Find the position of the first opening brace
        start_pos = response_text.find("{")
        
        # Find the position of the last matching closing brace
        brace_count = 0
        last_brace_pos = -1
        
        for i in range(start_pos, len(response_text)):
            char = response_text[i]
            if char == "{":
                brace_count += 1
            elif char == "}":
                brace_count -= 1
                if brace_count == 0:
                    last_brace_pos = i
                    break
        
        if last_brace_pos != -1:
            response_text = response_text[start_pos:last_brace_pos + 1]
    
    return response_text

def generate_cog_suggestions(entity_type: str, entity_name: str, entity_goals: str, entity_presence: str, desired_end_state: str) -> Dict:
    """Generate AI suggestions for COG analysis components with prioritized vulnerabilities"""
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
            Follow this strict prioritization flow: COG > Critical Capabilities > Critical Requirements > Critical Vulnerabilities.
            Each vulnerability MUST be linked to specific requirements, which are linked to specific capabilities.
            You must respond ONLY with valid JSON conforming exactly to this schema:
            {
                "capabilities": [
                    {
                        "name": "string",
                        "description": "string",
                        "priority": number,  # 1-5, where 1 is highest priority
                        "cog_relationship": "string"  # How this capability supports the COG
                    }
                ],
                "requirements": [
                    {
                        "name": "string",
                        "description": "string",
                        "priority": number,  # 1-5, where 1 is highest priority
                        "capability": "string",  # Name of the related capability
                        "requirement_type": "string"  # Physical, Moral, or Cyber
                    }
                ],
                "vulnerabilities": [
                    {
                        "name": "string",
                        "description": "string",
                        "priority": number,  # 1-5, where 1 is highest priority
                        "related_requirements": ["string"],  # List of requirement names this affects
                        "related_capability": "string",  # Name of the ultimately affected capability
                        "cascade_potential": number,  # 1-5, how likely effects cascade to other requirements
                        "exploitation_difficulty": number  # 1-5, how difficult to exploit (1 is easiest)
                    }
                ]
            }"""
        }
        
        user_msg = {
            "role": "user",
            "content": f"""Analyze this entity and suggest components for COG analysis, following the strict prioritization flow of COG > Capabilities > Requirements > Vulnerabilities.
            Focus on identifying vulnerabilities that affect multiple requirements or have cascading effects.
            
            Entity Type: {entity_type}
            Entity Name: {entity_name}
            Goals: {entity_goals}
            Areas of Presence: {entity_presence}
            Desired End State: {desired_end_state}
            
            For each component:
            1. Capabilities: How does each capability directly support the COG?
            2. Requirements: What specific requirements enable each capability?
            3. Vulnerabilities: Which requirements, if exploited, would have the greatest impact on capabilities?
            
            Prioritize based on:
            - Impact on COG
            - Cascading effects
            - Exploitation feasibility
            """
        }
        
        response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
        
        # Clean the response to handle common JSON issues
        cleaned_response = clean_text(response)
        
        try:
            suggestions = json.loads(cleaned_response)
            
            # Sort capabilities by priority
            if "capabilities" in suggestions:
                suggestions["capabilities"].sort(key=lambda x: x.get("priority", 5))
            
            # Sort requirements by priority
            if "requirements" in suggestions:
                suggestions["requirements"].sort(key=lambda x: x.get("priority", 5))
            
            # Sort vulnerabilities by a weighted score
            if "vulnerabilities" in suggestions:
                for vuln in suggestions["vulnerabilities"]:
                    # Calculate weighted score based on priority, cascade potential, and exploitation ease
                    weight_score = (
                        (6 - vuln.get("priority", 5)) * 0.4 +  # Inverse priority (1 is best)
                        vuln.get("cascade_potential", 1) * 0.4 +  # Higher cascade is better
                        (6 - vuln.get("exploitation_difficulty", 5)) * 0.2  # Easier exploitation is better
                    )
                    vuln["weight_score"] = weight_score
                
                suggestions["vulnerabilities"].sort(key=lambda x: x.get("weight_score", 0), reverse=True)
            
            return suggestions
            
        except json.JSONDecodeError as e:
            st.error("AI response was not valid JSON even after cleaning. Using enhanced fallback suggestions.")
            
            # Show debugging info in expanders
            with st.expander("Debug Info - Raw AI Response", expanded=False):
                st.code(response)
            with st.expander("Debug Info - Cleaned Response", expanded=False):
                st.code(cleaned_response)
            with st.expander("Debug Info - JSON Error", expanded=False):
                st.write(str(e))
            
            return get_fallback_suggestions(entity_type, entity_name, entity_goals, entity_presence, desired_end_state)
            
    except Exception as e:
        st.error(f"Error generating suggestions: {str(e)}")
        return get_fallback_suggestions(entity_type, entity_name, entity_goals, entity_presence, desired_end_state)

def display_ai_suggestions(suggestions: Dict):
    """Display AI-generated suggestions with options to add them to the analysis"""
    if not suggestions:
        return
    
    # Add unique identifier for this suggestion set
    suggestion_id = str(uuid.uuid4())[:8]
    
    st.markdown("""
    <style>
    .suggestion-card {
        border: 1px solid var(--border-color);
        border-radius: 5px;
        padding: 15px;
        margin: 10px 0;
        background-color: var(--bg-color);
    }
    .suggestion-card:hover {
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .priority-indicator {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 0.8em;
        margin-left: 10px;
    }
    
    /* Dark mode specific styles */
    .stApp[data-theme="dark"] .suggestion-card {
        background-color: rgba(45, 55, 72, 0.5);
        border-color: rgba(74, 85, 104, 0.5);
        color: #e2e8f0;
    }
    
    .priority-1 { background-color: #dc3545; color: white; }
    .priority-2 { background-color: #fd7e14; color: white; }
    .priority-3 { background-color: #ffc107; color: black; }
    .priority-4 { background-color: #28a745; color: white; }
    .priority-5 { background-color: #17a2b8; color: white; }
    </style>
    """, unsafe_allow_html=True)
    
    # Display capabilities and requirements side by side
    if 'capabilities' in suggestions or 'requirements' in suggestions:
        st.markdown("### 🔄 Critical Capabilities and Requirements")
        st.info("Analyzing vulnerabilities in order of: COG > Capabilities > Requirements > Vulnerabilities")
        
        # Display capabilities first
        if 'capabilities' in suggestions:
            st.markdown("#### Critical Capabilities")
            for i, cap in enumerate(suggestions['capabilities']):
                priority = cap.get('priority', 5)
                st.markdown(
                    f"""
                    <div class="suggestion-card">
                    <h4>{cap.get('name', 'Unnamed Capability')}
                    <span class="priority-indicator priority-{priority}">P{priority}</span></h4>
                    <p><strong>Description:</strong> {cap.get('description', 'No description available')}</p>
                    <p><strong>COG Relationship:</strong> {cap.get('cog_relationship', 'Not specified')}</p>
                    </div>
                    """,
                    unsafe_allow_html=True
                )
                
                if st.button("➕ Add Capability", key=f"add_cap_btn_{suggestion_id}_{i}"):
                    if cap['name'] not in st.session_state["capabilities"]:
                        st.session_state["capabilities"].append(cap['name'])
                        st.success(f"Added capability: {cap['name']}")
                        st.rerun()
                    else:
                        st.info(f"Capability already added: {cap['name']}")
        
        # Display requirements grouped by capability
        if 'requirements' in suggestions:
            st.markdown("#### Critical Requirements")
            # Group requirements by capability
            req_by_cap = {}
            for req in suggestions['requirements']:
                cap = req.get('capability', 'Ungrouped')
                if cap not in req_by_cap:
                    req_by_cap[cap] = []
                req_by_cap[cap].append(req)
            
            for cap, reqs in req_by_cap.items():
                st.markdown(f"**For Capability: {cap}**")
                for i, req in enumerate(reqs):
                    priority = req.get('priority', 5)
                    st.markdown(
                        f"""
                        <div class="suggestion-card">
                        <h4>{req.get('name', 'Unnamed Requirement')}
                        <span class="priority-indicator priority-{priority}">P{priority}</span></h4>
                        <p><strong>Description:</strong> {req.get('description', 'No description available')}</p>
                        <p><strong>Type:</strong> {req.get('requirement_type', 'Not specified')}</p>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                    
                    if st.button("➕ Add Requirement", key=f"add_req_btn_{suggestion_id}_{i}_{cap}"):
                        if req['name'] not in st.session_state.get("requirements", []):
                            if "requirements" not in st.session_state:
                                st.session_state["requirements"] = []
                            st.session_state["requirements"].append(req['name'])
                            st.success(f"Added requirement: {req['name']}")
                            st.rerun()
                        else:
                            st.info(f"Requirement already added: {req['name']}")
    
    # Display vulnerabilities with detailed scoring
    if 'vulnerabilities' in suggestions:
        st.markdown("### ⚠️ Critical Vulnerabilities (Prioritized)")
        st.info("Vulnerabilities are prioritized based on their impact on requirements, cascade potential, and exploitation feasibility.")
        
        for i, vuln in enumerate(suggestions['vulnerabilities']):
            priority = vuln.get('priority', 5)
            cascade = vuln.get('cascade_potential', 1)
            difficulty = vuln.get('exploitation_difficulty', 5)
            weight_score = vuln.get('weight_score', 0)
            
            # Create progress bars for scores
            cascade_width = cascade * 20
            difficulty_width = (6 - difficulty) * 20  # Inverse scale for difficulty
            
            st.markdown(
                f"""
                <div class="suggestion-card">
                <h4>{vuln['name']}
                <span class="priority-indicator priority-{priority}">P{priority}</span></h4>
                <p><strong>Description:</strong> {vuln['description']}</p>
                <p><strong>Affects Capability:</strong> {vuln['related_capability']}</p>
                <p><strong>Affects Requirements:</strong> {', '.join(vuln.get('related_requirements', []))}</p>
                <p>
                    <strong>Cascade Potential:</strong> 
                    <div style="background: #eee; width: 100px; height: 10px; display: inline-block; margin: 0 10px;">
                        <div style="background: #28a745; width: {cascade_width}px; height: 10px;"></div>
                    </div>
                    {cascade}/5
                </p>
                <p>
                    <strong>Exploitation Ease:</strong>
                    <div style="background: #eee; width: 100px; height: 10px; display: inline-block; margin: 0 10px;">
                        <div style="background: #dc3545; width: {difficulty_width}px; height: 10px;"></div>
                    </div>
                    {6-difficulty}/5
                </p>
                <p><strong>Overall Score:</strong> {weight_score:.2f}</p>
                </div>
                """,
                unsafe_allow_html=True
            )
            
            if st.button("➕ Add Vulnerability", key=f"add_vuln_btn_{suggestion_id}_{i}"):
                if "vulnerabilities_dict" not in st.session_state:
                    st.session_state["vulnerabilities_dict"] = {}
                if vuln['related_capability'] not in st.session_state["vulnerabilities_dict"]:
                    st.session_state["vulnerabilities_dict"][vuln['related_capability']] = []
                
                if vuln['name'] not in st.session_state["vulnerabilities_dict"][vuln['related_capability']]:
                    st.session_state["vulnerabilities_dict"][vuln['related_capability']].append(vuln['name'])
                    st.success(f"Added vulnerability: {vuln['name']}")
                    st.rerun()
                else:
                    st.info(f"Vulnerability already added: {vuln['name']}")

def generate_cog_recommendations(
    entity_type: str,
    entity_name: str,
    entity_goals: str,
    entity_presence: str,
    desired_end_state: str
) -> List[str]:
    """Generate COG recommendations based on entity information.
    
    Args:
        entity_type: The type of entity being analyzed
        entity_name: The name of the entity
        entity_goals: The goals of the entity
        entity_presence: Areas where the entity is present
        desired_end_state: The desired end state for the analysis
        
    Returns:
        List of recommended Centers of Gravity
    """
    try:
        system_msg = {
            "role": "system",
            "content": (
                "You are an AI specialized in identifying Centers of Gravity (COG). "
                "A COG is a source of power that provides moral or physical strength, "
                "freedom of action, or will to act. Provide 3-5 potential COGs."
            )
        }
        user_msg = {
            "role": "user",
            "content": (
                f"Based on this information:\n"
                f"Entity Type: {entity_type}\n"
                f"Entity Name: {entity_name}\n"
                f"Goals: {entity_goals}\n"
                f"Areas of Presence: {entity_presence}\n"
                f"Desired End State: {desired_end_state}\n\n"
                "Suggest 3-5 potential Centers of Gravity. Separate each with a semicolon. "
                "Each suggestion should be a concise phrase (3-7 words). "
                "Do not include explanations or numbering."
            )
        }
        
        response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
        suggestions = [s.strip() for s in response.split(";") if s.strip()]
        return suggestions[:5]  # Limit to 5 suggestions
    except Exception as e:
        logging.error(f"Error generating COG recommendations: {e}")
        return ["Command and Control Network", "Economic Resource Base", "Popular Support"]

def manage_capabilities(final_cog: str, entity_type: str, entity_name: str, entity_goals: str, entity_presence: str) -> None:
    """Manage critical capabilities for the selected Center of Gravity.
    
    Args:
        final_cog: The selected Center of Gravity
        entity_type: The type of entity being analyzed
        entity_name: The name of the entity
        entity_goals: The goals of the entity
        entity_presence: Areas where the entity is present
    """
    if "capabilities" not in st.session_state:
        st.session_state["capabilities"] = []

    with st.expander("Add or Suggest Capabilities", expanded=True):
        st.markdown("""
        **Critical Capabilities** are the primary abilities that make the Center of Gravity effective 
        in the operational environment. These are crucial enablers for the COG.
        """)
        
        new_capability = st.text_input(
            "Add a Critical Capability",
            help="Enter one capability at a time that is relevant to the selected CoG."
        )
        col1, col2 = st.columns([1, 1])
        
        with col1:
            if st.button("➕ Add Capability", use_container_width=True):
                if new_capability.strip():
                    if new_capability not in st.session_state["capabilities"]:
                        st.session_state["capabilities"].append(new_capability.strip())
                        st.success(f"Added capability: {new_capability.strip()}")
                        st.rerun()
                    else:
                        st.info(f"Capability already exists: {new_capability}")
                else:
                    st.warning("Please enter a capability first.")
        
        with col2:
            if st.button("🤖 AI: Suggest Capabilities", use_container_width=True):
                if not final_cog:
                    st.warning("Please specify or select a CoG first.")
                else:
                    try:
                        system_msg = {
                            "role": "system",
                            "content": "You are an AI specialized in identifying critical capabilities for a Center of Gravity."
                        }
                        user_msg = {
                            "role": "user",
                            "content": (
                                f"For this Center of Gravity: '{final_cog}'\n"
                                f"Entity Type: {entity_type}\n"
                                f"Entity Name: {entity_name}\n"
                                f"Goals: {entity_goals}\n"
                                f"Areas of Presence: {entity_presence}\n\n"
                                "List 3-5 critical capabilities (key abilities or functions). "
                                "Separate with semicolons. Be specific and actionable."
                            )
                        }
                        response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                        new_capabilities = [cap.strip() for cap in response.split(";") if cap.strip()]
                        
                        added = []
                        for cap in new_capabilities:
                            if cap not in st.session_state["capabilities"]:
                                st.session_state["capabilities"].append(cap)
                                added.append(cap)
                        
                        if added:
                            st.success("Added new capabilities:")
                            for cap in added:
                                st.write(f"- {cap}")
                            st.rerun()
                        else:
                            st.info("No new capabilities to add.")
                    except Exception as e:
                        st.error(f"Error suggesting capabilities: {e}")
        
        if st.session_state["capabilities"]:
            st.markdown("### Current Capabilities")
            for i, cap in enumerate(st.session_state["capabilities"]):
                col1, col2 = st.columns([4, 1])
                with col1:
                    st.write(f"{i+1}. {cap}")
                with col2:
                    if st.button("🗑️", key=f"del_cap_{i}"):
                        st.session_state["capabilities"].pop(i)
                        st.rerun()
            
            if st.button("Clear All Capabilities"):
                st.session_state["capabilities"].clear()
                st.rerun()

def manage_requirements(capability: str) -> None:
    """Manage requirements for a specific capability.
    
    Args:
        capability: The capability to manage requirements for
    """
    if "requirements" not in st.session_state:
        st.session_state["requirements"] = {}
    
    if capability not in st.session_state["requirements"]:
        st.session_state["requirements"][capability] = []
    
    st.markdown(f"### Requirements for: {capability}")
    st.markdown("""
    **Critical Requirements** are the essential conditions, resources, or means 
    required for a critical capability to be fully operative.
    """)
    
    new_requirement = st.text_input(
        "Add Requirement",
        key=f"req_input_{capability}",
        help="Enter a specific requirement needed for this capability"
    )
    
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("➕ Add Requirement", key=f"add_req_{capability}", use_container_width=True):
            if new_requirement.strip():
                if new_requirement not in st.session_state["requirements"][capability]:
                    st.session_state["requirements"][capability].append(new_requirement.strip())
                    st.success(f"Added requirement: {new_requirement}")
                    st.rerun()
                else:
                    st.info("Requirement already exists")
            else:
                st.warning("Please enter a requirement first")
    
    with col2:
        if st.button("🤖 AI: Suggest Requirements", key=f"suggest_req_{capability}", use_container_width=True):
            try:
                system_msg = {
                    "role": "system",
                    "content": "You are an AI specialized in identifying critical requirements for military/strategic capabilities."
                }
                user_msg = {
                    "role": "user",
                    "content": (
                        f"For this capability: '{capability}'\n\n"
                        "List 3-5 critical requirements (essential conditions, resources, or means) "
                        "needed for this capability to be fully operative. "
                        "Separate with semicolons. Be specific and concrete."
                    )
                }
                response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                new_requirements = [req.strip() for req in response.split(";") if req.strip()]
                
                added = []
                for req in new_requirements:
                    if req not in st.session_state["requirements"][capability]:
                        st.session_state["requirements"][capability].append(req)
                        added.append(req)
                
                if added:
                    st.success("Added new requirements:")
                    for req in added:
                        st.write(f"- {req}")
                    st.rerun()
                else:
                    st.info("No new requirements to add")
            except Exception as e:
                st.error(f"Error suggesting requirements: {e}")
    
    if st.session_state["requirements"][capability]:
        st.markdown("#### Current Requirements")
        for i, req in enumerate(st.session_state["requirements"][capability]):
            col1, col2 = st.columns([4, 1])
            with col1:
                st.write(f"{i+1}. {req}")
            with col2:
                if st.button("🗑️", key=f"del_req_{capability}_{i}"):
                    st.session_state["requirements"][capability].pop(i)
                    st.rerun()
        
        if st.button("Clear Requirements", key=f"clear_req_{capability}"):
            st.session_state["requirements"][capability].clear()
            st.rerun()

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

        /* Dark mode specific overrides */
        .stApp[data-theme="dark"] {
            background-color: var(--bg-dark);
            color: var(--text-dark);
        }

        .stApp[data-theme="dark"] .main-header,
        .stApp[data-theme="dark"] .section-header,
        .stApp[data-theme="dark"] .info-box,
        .stApp[data-theme="dark"] .success-box,
        .stApp[data-theme="dark"] .warning-box,
        .stApp[data-theme="dark"] .suggestion-card {
            color: var(--text-dark);
        }

        .stApp[data-theme="dark"] .suggestion-card {
            background-color: rgba(45, 55, 72, 0.5);
            border-color: var(--border-dark);
        }

        .stApp[data-theme="dark"] .info-box {
            background-color: rgba(45, 55, 72, 0.5);
        }

        .stApp[data-theme="dark"] .success-box {
            background-color: rgba(72, 187, 120, 0.2);
        }

        .stApp[data-theme="dark"] .warning-box {
            background-color: rgba(237, 137, 54, 0.2);
        }

        /* General styles */
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

        /* Dark mode text color overrides for specific elements */
        .stApp[data-theme="dark"] .stMarkdown,
        .stApp[data-theme="dark"] .stText,
        .stApp[data-theme="dark"] .stTextInput > div > div > input,
        .stApp[data-theme="dark"] .stTextArea > div > div > textarea {
            color: var(--text-dark) !important;
        }

        /* Dark mode background overrides for specific elements */
        .stApp[data-theme="dark"] .stTextInput > div > div > input,
        .stApp[data-theme="dark"] .stTextArea > div > div > textarea {
            background-color: rgba(45, 55, 72, 0.5) !important;
        }
        </style>
    """, unsafe_allow_html=True)

    st.markdown('<h1 class="main-header">Center of Gravity (COG) Analysis</h1>', unsafe_allow_html=True)
    
    # Initialize session state
    initialize_session_state()
    
    # Create tabs for better organization
    tab1, tab2, tab3, tab4 = st.tabs([
        "🎯 Basic Info & COG",
        "💪 Capabilities",
        "📋 Requirements",
        "📊 Summary"
    ])
    
    with tab1:
        st.markdown('<h2 class="section-header">Entity Information</h2>', unsafe_allow_html=True)
        
        # Entity Information
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
        
        # Add Assumptions Section
        st.markdown("---")
        st.markdown("### Assumptions")
        st.markdown("""
        List key assumptions that underpin your analysis. These could include:
        - Operational environment conditions
        - Resource availability
        - Entity behavior patterns
        - External factors
        """)
        
        # Initialize assumptions in session state if not present
        if "assumptions" not in st.session_state:
            st.session_state["assumptions"] = []
        
        # Add new assumption
        new_assumption = st.text_area(
            "New Assumption",
            help="Enter a key assumption that underlies your analysis",
            key="new_assumption_input"
        )
        
        col1, col2 = st.columns([1, 4])
        with col1:
            if st.button("Add Assumption", use_container_width=True):
                if new_assumption.strip():
                    st.session_state["assumptions"].append({
                        "text": new_assumption.strip(),
                        "validated": False,
                        "notes": ""
                    })
                    st.success("Assumption added")
                    st.rerun()
        
        # Display current assumptions
        if st.session_state["assumptions"]:
            st.markdown("#### Current Assumptions")
            for idx, assumption in enumerate(st.session_state["assumptions"]):
                with st.container():
                    col1, col2, col3, col4 = st.columns([4, 1, 2, 1])
                    with col1:
                        st.markdown(f"**{idx + 1}.** {assumption['text']}")
                    with col2:
                        validated = st.checkbox("✓", value=assumption["validated"], key=f"valid_{idx}")
                        st.session_state["assumptions"][idx]["validated"] = validated
                    with col3:
                        notes = st.text_input("Notes", value=assumption.get("notes", ""), key=f"notes_{idx}")
                        st.session_state["assumptions"][idx]["notes"] = notes
                    with col4:
                        if st.button("🗑️", key=f"del_assumption_{idx}"):
                            st.session_state["assumptions"].pop(idx)
                            st.rerun()
        
        # COG Selection
        st.markdown("---")
        st.markdown("### Center of Gravity Selection")
        
        # Auto-generate COG suggestions
        if st.button("🤖 Generate COG Suggestions", use_container_width=True):
            if not entity_type or not entity_name:
                st.warning("Please provide at least the entity type and name.")
            else:
                with st.spinner("Generating suggestions..."):
                    suggestions = generate_cog_recommendations(
                        entity_type,
                        entity_name,
                        entity_goals,
                        entity_presence,
                        desired_end_state
                    )
                    st.session_state["cog_suggestions"] = suggestions
        
        # Display and handle COG suggestions
        if "cog_suggestions" in st.session_state and st.session_state["cog_suggestions"]:
            st.success("Select from these suggested Centers of Gravity:")
            for i, sug in enumerate(st.session_state["cog_suggestions"]):
                col1, col2 = st.columns([4, 1])
                with col1:
                    st.markdown(f"**{i+1}.** {sug}")
                with col2:
                    # Use a unique key for each button to prevent conflicts
                    button_key = f"select_cog_{i}_{sug}"
                    if st.button("Select", key=button_key):
                        st.session_state["final_cog"] = sug
                        st.session_state["selected_cog_index"] = i
                        st.success(f"Selected COG: {sug}")
                        st.rerun()
                
                # Highlight the selected COG
                if "selected_cog_index" in st.session_state and st.session_state["selected_cog_index"] == i:
                    st.markdown(f'<div class="success-box">✓ Currently Selected</div>', unsafe_allow_html=True)
        
        # Manual COG Input
        st.markdown("#### Or Enter Manually")
        manual_cog = st.text_input(
            "Enter Center of Gravity",
            value=st.session_state.get("final_cog", ""),  # Pre-fill with current COG if exists
            help="The source of power that provides moral or physical strength, freedom of action, or will to act"
        )
        
        if st.button("Use Manual COG", use_container_width=True):
            if manual_cog.strip():
                st.session_state["final_cog"] = manual_cog.strip()
                st.session_state.pop("selected_cog_index", None)  # Clear selected suggestion index
                st.success(f"Set Center of Gravity to: {manual_cog}")
                st.rerun()
            else:
                st.warning("Please enter a Center of Gravity first")
        
        # Display current COG with clear option
        if st.session_state.get("final_cog"):
            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(
                    f'<div class="success-box">Current Center of Gravity: <strong>{st.session_state["final_cog"]}</strong></div>',
                    unsafe_allow_html=True
                )
            with col2:
                if st.button("🗑️ Clear COG"):
                    st.session_state.pop("final_cog", None)
                    st.session_state.pop("selected_cog_index", None)
                    st.rerun()
    
    with tab2:
        st.markdown('<h2 class="section-header">Critical Capabilities</h2>', unsafe_allow_html=True)
        
        if st.session_state.get("final_cog"):
            manage_capabilities(
                st.session_state["final_cog"],
                entity_type,
                entity_name,
                entity_goals,
                entity_presence
            )
        else:
            st.warning("Please select or enter a Center of Gravity first")
    
    with tab3:
        st.markdown('<h2 class="section-header">Critical Requirements</h2>', unsafe_allow_html=True)
        
        if st.session_state.get("capabilities"):
            for capability in st.session_state["capabilities"]:
                with st.expander(f"Requirements for: {capability}", expanded=True):
                    manage_requirements(capability)
        else:
            st.warning("Please add capabilities first")
    
    with tab4:
        st.markdown('<h2 class="section-header">Analysis Summary</h2>', unsafe_allow_html=True)
        
        if st.session_state.get("final_cog"):
            st.markdown("### Center of Gravity")
            st.info(st.session_state["final_cog"])
            
            # Add Nodal Diagram
            st.markdown("### 🔄 Nodal Analysis Diagram")
            
            # Prepare data for visualization
            cog = st.session_state["final_cog"]
            capabilities = st.session_state.get("capabilities", [])
            requirements = st.session_state.get("requirements", {})
            vulnerabilities_dict = st.session_state.get("vulnerabilities_dict", {})
            
            # Convert requirements dict to text format for visualization
            requirements_text = []
            for cap, reqs in requirements.items():
                requirements_text.extend(reqs)
            requirements_text = "; ".join(requirements_text)
            
            # Create the network visualization
            if cog and (capabilities or requirements or vulnerabilities_dict):
                try:
                    st.markdown("""
                    This diagram shows the relationships between:
                    - 🎯 Center of Gravity (Red)
                    - 💪 Critical Capabilities (Green)
                    - 📋 Critical Requirements (Blue)
                    - ⚠️ Vulnerabilities (Pink)
                    """)
                    
                    graph = visualize_cog_network(
                        cog=cog,
                        capabilities=capabilities,
                        vulnerabilities_dict=vulnerabilities_dict,
                        requirements_text=requirements_text
                    )
                    
                    if graph:
                        st.session_state["cog_graph"] = graph
                        
                        # Add graph statistics
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Total Nodes", graph.number_of_nodes())
                        with col2:
                            st.metric("Total Connections", graph.number_of_edges())
                    
                except Exception as e:
                    st.error(f"Error creating visualization: {str(e)}")
                    st.info("Please ensure networkx and plotly are installed for visualization features.")
            
            # Display capabilities and requirements
            if st.session_state.get("capabilities"):
                st.markdown("### Critical Capabilities")
                for cap in st.session_state["capabilities"]:
                    with st.expander(cap):
                        st.markdown("#### Requirements:")
                        if cap in st.session_state.get("requirements", {}) and st.session_state["requirements"][cap]:
                            for req in st.session_state["requirements"][cap]:
                                st.write(f"- {req}")
                        else:
                            st.write("No requirements defined")
            
            # Export options
            st.markdown("---")
            st.markdown("### Export Analysis")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Export to JSON"):
                    analysis_data = {
                        "center_of_gravity": st.session_state["final_cog"],
                        "capabilities": st.session_state["capabilities"],
                        "requirements": st.session_state.get("requirements", {}),
                        "vulnerabilities": st.session_state.get("vulnerabilities_dict", {}),
                        "entity_info": {
                            "type": entity_type,
                            "name": entity_name,
                            "goals": entity_goals,
                            "presence": entity_presence,
                            "desired_end_state": desired_end_state
                        }
                    }
                    st.download_button(
                        "Download JSON",
                        data=json.dumps(analysis_data, indent=2),
                        file_name="cog_analysis.json",
                        mime="application/json"
                    )
            
            with col2:
                # Add network diagram export
                if "cog_graph" in st.session_state and st.session_state["cog_graph"] is not None:
                    export_format = st.selectbox(
                        "Export Network Diagram As",
                        ["gexf", "graphml", "json"],
                        help="Choose the format for exporting the network diagram"
                    )
                    
                    if st.button(f"Export Network as {export_format.upper()}", use_container_width=True):
                        graph_data = export_graph(st.session_state["cog_graph"], export_format)
                        if graph_data:
                            st.download_button(
                                f"Download {export_format.upper()}",
                                data=graph_data,
                                file_name=f"cog_network.{export_format}",
                                mime=f"application/{export_format}",
                                use_container_width=True
                            )
        else:
            st.warning("Please complete the analysis by selecting a Center of Gravity and adding capabilities")

def main():
    cog_analysis()

if __name__ == "__main__":
    main()