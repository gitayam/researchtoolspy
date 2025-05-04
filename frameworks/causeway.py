# /frameworks/causeway.py

from collections import defaultdict
from dotenv import load_dotenv
import hashlib
import io
import json
import logging
from typing import Dict, List, Any, Optional, Tuple, Iterable
import uuid
import urllib.parse
import zipfile
import sys
import os

# Add the parent directory to sys.path to allow imports from utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import networkx as nx
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import streamlit.components.v1 as components
from titlecase import titlecase

from utilities.gpt import get_completion, get_chat_completion, normalize_field_across_entities


def identify_threat() -> None:
    st.markdown(
        "<h3 style='color: #8fbc8f; font-weight: 600;'>Develop Scenario</h3>",
        unsafe_allow_html=True
        )
    if "threat_suggestions" not in st.session_state:
        st.session_state["threat_suggestions"] = []

    col1, col2 = st.columns(2)
    with col1:
        issue = st.text_input(
            label="Issue",
            placeholder="Enter an issue of concern",
            help=(
                "Enter the issue that you are focused on, "
                "ensuring that it is not framed as a threat. "
                "Examples: Environmental sustainability, free speech, "
                "and rule of law."
                )
            )
        st.session_state["issue"] = titlecase(issue)

    with col2:
        location = st.text_input(
            label="Location",
            placeholder="Enter the location of concern"
            )
        st.session_state["location"] = titlecase(location)

    # Threat Selection
    st.markdown("---")
    st.markdown(
        "<h3 style='color: #8fbc8f; font-weight: 600;'>Threat Selection</h3>",
        unsafe_allow_html=True
        )
    # Display current threat with clear option
    if st.session_state.get("threat"):
        st.markdown(
            f"""
            <div class="success-box">Current Threat: <strong>{st.session_state['threat']}</strong></div>
            """,
            unsafe_allow_html=True,
            )

    # Manual threat input
    manual_threat = st.text_input(
        label=(
            "A phenomenon that poses a threat to your issue of concern. "
            "It should not identify the party responsible for the threat."
            ),
        placeholder="Manually enter a threat if desired",
        help=(
            "Examples: Water pollution from industrial waste, "
            "decreased trust in election integrity, disinformation"
            ),
        # label_visibility="collapsed",
        )

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button(label="✍️ Select Manually Entered Threat", use_container_width=True):
            if not issue or not location:
                st.warning("Please provide the issue and location of concern.")
            else:
                manual_threat = titlecase(manual_threat.strip())
                st.session_state["threat"] = manual_threat
                st.session_state.pop("threat_index", None)  # Clear selected threat index
                st.rerun()
    with col2:
        if st.button(
            label="🤖 AI: Generate Threat Suggestions",
            use_container_width=True
            ):
            if not issue or not location:
                st.warning("Please provide the issue and location of concern.")
            else:
                with st.spinner("Generating suggestions..."):
                    try:
                        system_msg = {
                            "role": "system",
                            "content": (
                                "You are a strategic planning AI specialized in identifying threats "
                                "to specific issues in particular areas of concern. You are especially "
                                "proficient with COG analysis."
                                )
                            }
                        user_msg = {
                            "role": "user",
                            "content": (
                                f"Based on this information:\n"
                                f"Issue: {st.session_state['issue']}\n"
                                f"Location: {st.session_state['location']}\n"
                                "Identify the ten most significant threats to the specified issue "
                                "in the specified location. Each identified threat should be along "
                                "the lines of a situation and should be general, not featuring any "
                                "responsible actors or entities suffering the consequences. Each "
                                "threat should be a concise phrase (3-7 words). Do not include any "
                                "additional text, such as explanations, numbering or a period at the "
                                "end of your output. Separate with semicolons."
                                )
                            }
                        response = get_chat_completion(messages=[system_msg, user_msg], model="gpt-4o-mini")
                        threat_suggestions = [
                            titlecase(threat.strip()) for threat 
                            in response.split(";") if threat.strip()
                            ]
                        threat_suggestions = threat_suggestions[:10]
                        for suggestion in threat_suggestions:
                            if suggestion not in st.session_state["threat_suggestions"]:
                                st.session_state["threat_suggestions"].append(suggestion)
                    except Exception as e:
                        logging.error(f"Error generating threats: {e}")
                        return e

    # Display and handle threat suggestions
    if (
        "threat_suggestions" in st.session_state and st.session_state["threat_suggestions"]
        ):
        st.markdown(
            "##### 🤖 AI-Generated Threats",
            unsafe_allow_html=True
            )
        cols = st.columns(2)
        for i, threat in enumerate(st.session_state["threat_suggestions"]):
            button_cell = cols[i % 2]
            with button_cell:
                # Adjusted inner column ratios
                col1, col2, col3 = st.columns([0.8, 8.0, 2.0])
                with col1:
                    query = urllib.parse.quote(threat + " in " + location)
                    st.markdown(
                        f"""
                        <div style='padding-left: 10px;'>
                            <a href="https://google.com/search?q={query}" target="_blank" style="text-decoration: none;">
                                <button class="custom-icon-button">
                                    <img src="https://www.google.com/favicon.ico" style="height: 20px;">
                                </button>
                            </a>
                        </div>
                        """,
                        unsafe_allow_html=True
                        )
                with col2:
                    st.markdown(
                        f"""
                        <div class="st-markdown-custom" style="
                            height: 40px;
                            font-size: 16px;
                            padding-left: 20px;
                            justify-content: flex-start;">
                            {threat}
                        </div>
                        """,
                        unsafe_allow_html=True
                        )
                with col3:
                    button_key = f"select_threat_{i}"
                    if st.button(label="Select", key=button_key):
                        st.session_state["threat"] = threat
                        st.session_state["threat_index"] = i
                        st.rerun()

        if st.button(label="🧹 Clear Suggested Threats"):
            if "threat" in st.session_state:
                if st.session_state["threat"] in st.session_state["threat_suggestions"]:
                    st.session_state.pop("threat")
                    st.session_state.pop("threat_index", None)
            st.session_state.pop("threat_suggestions")
            st.rerun()


def nominate_putars(
    threat: str,
    issue: str,
    location: str
    ) -> None:
    """Develop and select potential Ultimate Targets"""
    if "potential_utars" not in st.session_state:
        st.session_state["potential_utars"] = {}
    if "select_status" not in st.session_state:
        st.session_state["select_status"] = {}

    putar = st.text_input(
        label=(
            "An Ultimate Target is an entity that directly poses a threat to the "
            "specified issue. Its loss, degradation, or transformation would most "
            "decisively weaken or remove the threat."
            ),
        placeholder="Manually enter a potential ultimate target if desired",
        help="Examples: Alpha Natural Resources, Tatmadaw, Koch Industries"
        )
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button(
            label="➕ Add Manually Entered Ultimate Target",
            use_container_width=True
            ):
            putar = titlecase(putar.strip())
            if putar and putar not in st.session_state["select_status"]:
                st.session_state["select_status"][putar] = False
                st.rerun()
            elif putar:
                st.info(f"Potential target already exists: {putar}")
    with col2:
        if st.button(
            label="🤖 AI: Suggest Ultimate Targets",
            use_container_width=True
            ):
            try:
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are a strategic planning AI specialized in identifying specific "
                        "actors that directly pose threats to specific issues. You are "
                        "especially proficient with COG analysis."
                        )
                    }
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Given this threat: {threat}\n"
                        f"To this issue: {issue}\n"
                        f"In this location: {location}\n"
                        "List up to ten specific, named entities -- whether an organization "
                        "or an individual -- that directly pose the specified threat to the "
                        "specified issue in the specified location, ensuring not to include "
                        "entities which merely faciliate the threat, or any extraneous text "
                        "such as numbering, context, or explanations. Separate with semicolons "
                        "and do not mark the end of your output with any punctuation."
                        ),
                    }
                response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                putar_suggestions = [
                    titlecase(sug.strip()) for sug
                    in response.split(";") if sug.strip()
                    ]
                for putar in putar_suggestions:
                    if putar not in st.session_state["select_status"]:
                        st.session_state["select_status"][putar] = False
            except Exception as e:
                st.error(f"Error suggesting ultimate potential targets: {e}")

    if st.session_state["select_status"]:
        st.markdown(
            "##### 🎯 Ultimate Targets",
            unsafe_allow_html=True
            )
        cols = st.columns(2)
        for i, putar in enumerate(st.session_state["select_status"]):
            putar_cell = cols[i % 2]
            with putar_cell:
                col1, col2, col3 = st.columns([0.8, 8.0, 0.5])
                with col1:
                    query = urllib.parse.quote(
                        putar + " " +
                        st.session_state["threat"] + " in " +
                        st.session_state["location"]
                        )
                    st.markdown(
                        f"""
                        <div style='padding-left: 10px;'>
                            <a href="https://google.com/search?q={query}" target="_blank" style="text-decoration: none;">
                                <button class="custom-icon-button">
                                    <img src="https://www.google.com/favicon.ico" style="height: 20px;">
                                </button>
                            </a>
                        </div>
                        """,
                        unsafe_allow_html=True
                        )
                with col2:
                    st.markdown(
                        f"""
                        <div class="st-markdown-custom" style="
                            height: 40px;
                            font-size: 16px;
                            padding-left: 20px;
                            justify-content: flex-start;">
                            {putar}
                        </div>
                        """,
                        unsafe_allow_html=True
                        )
                with col3:
                    checkbox_key = f"toggle_{putar}"
                    checked = st.checkbox(
                        label="_",
                        key=checkbox_key,
                        label_visibility="collapsed"
                        )
                    st.session_state["select_status"][putar] = checked

        # Apply selection state to potential_utars
        for putar, is_selected in st.session_state["select_status"].items():
            if is_selected and putar not in st.session_state["potential_utars"]:
                st.session_state["potential_utars"][putar] = {}
            elif not is_selected and putar in st.session_state["potential_utars"]:
                st.session_state["potential_utars"].pop(putar)

        if st.button(label="🧹 Clear Ultimate Targets"):
            st.session_state["select_status"].clear()
            st.session_state["potential_utars"].clear()
            st.rerun()


def identify_capabilities(
    putar: str,
    issue: str,
    location: str,
    threat: str,
    iteration: int,
    ) -> None:
    # === Skip if this PUTAR is not currently selected
    if st.session_state.get("open_cap_panel") != putar:
        return
    potential_utars = st.session_state.get("potential_utars", {})
    if "capabilities" not in potential_utars[putar]:
        potential_utars[putar]["capabilities"] = {}

    if "actor_objective" not in potential_utars[putar]:
        potential_utars[putar]["actor_objective"] = ""

    # === Close Panel Button
    if st.button(
        label="❌ Close Panel",
        key=f"close_cappanel_{putar}_{iteration}",
        use_container_width=True
        ):
        st.session_state["open_cap_panel"] = None
        st.rerun()

    # === Header
    st.markdown(
        f"<h4 style='color: #ff6b6b; font-weight: 600;'>Critical Capabilities for {putar}</h4>",
        unsafe_allow_html=True
        )

    actor_objective = st.text_input(
        label="Add Actor Objective",
        help=(
            "Enter the actor's objective in pursuing the threat activity. "
            "Do this before attempting to add Critical Capabilities either "
            "via AI or user designation."
            ),
        key=f"{putar}_actorObj_{iteration}"
        )
    potential_utars[putar]["actor_objective"] = actor_objective

    cap = st.text_input(
        label=" ",
        placeholder=(
            "Manually enter a Critical Capability for this Ultimate Target if desired"
            ),
        help=(
            "Examples: Ability to influence media narratives, "
            "ability to engage in aggressive lobbying efforts, "
            "ability to surveil communications."
            ),
        key=f"{putar}_cap_input_{iteration}"
        )
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button(
            label="➕ Add Manually Entered Critical Capability",
            key=f"{putar}_add_cap_{iteration}",
            use_container_width=True
            ):
            if not st.session_state['potential_utars'][putar].get("actor_objective"):
                st.warning("Please specify the actor's objective first.")
            else:
                if cap.strip():
                    cap = titlecase(cap.strip())
                    if cap not in potential_utars[putar]["capabilities"]:
                        potential_utars[putar]["capabilities"][cap] = {
                            "requirements": {}
                            }
                        st.success(f"Added capability: {cap}")
                        st.rerun()
                    else:
                        st.info("Critical Capability already exists")
                else:
                    st.warning("Please enter a Critical Capability first")
    with col2:
        if st.button(
            label="🤖 AI: Suggest Capabilities",
            use_container_width=True,
            key=f"suggest_cap_{putar}_{iteration}"
            ):
            if not potential_utars[putar].get("actor_objective"):
                st.warning("Please specify the actor's objective first.")
            else:
                try:
                    system_msg = {
                        "role": "system",
                        "content": (
                            "You are a strategic planning AI specialized in COG analysis."
                            )
                        }
                    user_msg = {
                        "role": "user",
                        "content": (
                            f"Actor: {putar}\n"
                            f"Actor Objective: {actor_objective}\n"
                            f"Issue: {issue}\n"
                            f"Threat: {threat}\n"
                            f"Location: {location}\n"
                            "List up to five Critical Capabilities that this actor performs in "
                            "its pursuit of the objective that informs the threat that it poses "
                            "to this issue in this location. Ensure that the Critical Capabilities "
                            "identified do not combine conceptually distinct things, that they are "
                            "concise without any explanatory text, begin with an action verb, speak "
                            "to its functions and abilities rather than what these functions and "
                            "abilities require, and are not Critical Requirements. Ensure that these "
                            "Critical Capabilities are specific to this particular named entity rather "
                            "than generic to its class. Separate with semicolons and do not mark the "
                            "end of your output with any punctuation."
                            )
                        }
                    response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                    suggestions = [titlecase(cap.strip()) for cap in response.split(";") if cap.strip()]
                    for cap in suggestions:
                        if cap not in potential_utars[putar]["capabilities"]:
                            potential_utars[putar]["capabilities"][cap] = {
                                "requirements": {}
                                }
                except Exception as e:
                    st.error(f"Error suggesting capabilities: {e}")

    capabilities = potential_utars[putar]["capabilities"]
    if capabilities:
        st.markdown(f"##### 💪 Current Critical Capabilities for {putar}")
        cols = st.columns(2)
        for i, cap in enumerate(list(capabilities.keys())):
            cap_cell = cols[i % 2]
            with cap_cell:
                col1, col2, col3 = st.columns([5, 1.2, 1.2])
                with col1:
                    st.markdown(
                        f"""
                        <div class="st-markdown-custom" style="
                            height: 40px;
                            font-size: 16px;
                            padding-left: 20px;">
                            {cap}
                        </div>
                        """,
                        unsafe_allow_html=True
                        )
                with col2:
                    if st.button(
                        label="Edit",
                        key=f"edit_{putar}_{cap}_{i}",
                        use_container_width=True
                        ):
                        st.session_state[f"edit_mode_{putar}_{cap}_{i}"] = True
                with col3:
                    if st.button(
                        "Delete",
                        key=f"remove_{putar}_{cap}_{i}",
                        use_container_width=True
                        ):
                        capabilities.pop(cap)
                        st.rerun()

            if st.session_state.get(f"edit_mode_{putar}_{cap}_{i}"):
                edited = st.text_input(
                    label="Edit Capability",
                    value=cap,
                    key=f"edit_input_{putar}_{cap}_{i}"
                    )
                save_col, cancel_col = st.columns([1, 1])
                with save_col:
                    if st.button(
                        label="💾 Save",
                        key=f"save_{putar}_{cap}_{i}",
                        use_container_width=True
                        ):
                        st.session_state.pop(f"edit_mode_{putar}_{cap}_{i}")
                        if edited and edited != cap:
                            old_data = capabilities[cap]
                            capabilities.pop(cap)
                            capabilities[edited] = {
                                "requirements": old_data.get("requirements", {})
                                }
                            st.success("Capability updated.")
                        st.rerun()
                with cancel_col:
                    if st.button(
                        label="❌ Cancel",
                        key=f"cancel_{putar}_{cap}_{i}",
                        use_container_width=True
                        ):
                        st.session_state.pop(f"edit_mode_{putar}_{cap}_{i}", None)
                        st.rerun()


def identify_requirements(
    putar: str,
    issue: str,
    threat: str,
    location: str,
    iteration: int
    ) -> None:
    # === Skip if this PUTAR is not currently selected
    if st.session_state.get("open_req_panel") != putar:
        return
    potential_utars = st.session_state.get("potential_utars", {})
    capabilities = potential_utars.get(putar, {}).get("capabilities", {})
    actor_objective = potential_utars.get(putar, {}).get("actor_objective", "")

    # === Close Panel Button
    if st.button(
        label="❌ Close Panel",
        key=f"close_req_panel_{putar}_{iteration}",
        use_container_width=True
        ):
        st.session_state["open_req_panel"] = None
        st.rerun()

    # === Header
    st.markdown(
        f"<h4 style='color: #ff6b6b; font-weight: 600;'>Critical Requirements for {putar}</h4>",
        unsafe_allow_html=True
        )

    for cap, cap_data in capabilities.items():
        if not isinstance(cap_data, dict):
            continue
        with st.expander(f"Requirements for Critical Capability: {cap}", expanded=False):
            st.markdown(
                    f"<h5 style='color: #42a5f5; font-weight: 550;'>💪 Capability: {cap}</h5>",
                    unsafe_allow_html=True
                    )
            new_req = st.text_input(
                label=" ",
                placeholder=(
                    "Manually enter a Critical Requirement for this Critical Capability if desired"
                    ),
                help=(
                    "Examples: Public mistrust of traditional media, control of militias, "
                    "control over judicial appointments, centralized command structures."
                    ),
                key=f"{putar}_{cap}_req_input_{iteration}",
                )
            col1, col2 = st.columns([1, 1])
            with col1:
                if st.button(
                    label="➕ Add Manually Entered Requirement",
                    key=f"{putar}_{cap}_add_req_{iteration}",
                    use_container_width=True
                    ):
                    if new_req.strip():
                        new_req = titlecase(new_req.strip())
                        if new_req not in cap_data["requirements"]:
                            cap_data["requirements"][new_req] = {}
                            st.success(f"Added: {new_req}")
                            st.rerun()
                        else:
                            st.info("This requirement already exists.")
                    else:
                        st.warning("Please enter a requirement first.")
            with col2:
                if st.button(
                    label="🤖 AI: Suggest Requirements",
                    key=f"{putar}_{cap}_ai_req_{iteration}",
                    use_container_width=True
                    ):
                    try:
                        system_msg = {
                            "role": "system",
                            "content": "You are a strategic planning AI specialized in COG analysis."
                            }
                        user_msg = {
                            "role": "user",
                            "content": (
                                f"Actor: {putar}\n"
                                f"Actor Objective: {actor_objective}\n"
                                f"Issue: {issue}\n"
                                f"Threat: {threat}\n"
                                f"Location: {location}\n"
                                f"Critical Capability: {cap}\n"
                                "Identify up to five concise Critical Requirements for this Capability. "
                                "Critical Requirements are the essential conditions, resources, and means "
                                "that enable a Critical Capability to be fully operational or effective. "
                                "No explanations, numbering, or a period at the end of your output. Separate "
                                "with semicolons."
                                )
                            }
                        response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                        suggestions = [titlecase(r.strip()) for r in response.split(";") if r.strip()]
                        for r in suggestions:
                            if r not in cap_data["requirements"]:
                                cap_data["requirements"][r] = {}
                    except Exception as e:
                        st.error(f"Error suggesting requirements: {e}")

            current_reqs = cap_data["requirements"]
            if current_reqs:
                st.markdown(f"##### ⚙️ Current Critical Requirements for {cap}")
                cols = st.columns(2)
                for i, req in enumerate(list(current_reqs.keys())):
                    req_cell = cols[i % 2]
                    with req_cell:
                        col1, col2, col3 = st.columns([5, 1.2, 1.2])
                        with col1:
                            st.markdown(
                                f"""
                                <div class="st-markdown-custom" style="
                                    height: 40px;
                                    font-size: 16px;
                                    padding-left: 20px;">
                                    {req}
                                </div>
                                """,
                                unsafe_allow_html=True
                                )
                        with col2:
                            if st.button(
                                label="Edit",
                                key=f"edit_{putar}_{cap}_{req}_{i}",
                                use_container_width=True
                                ):
                                st.session_state[f"edit_mode_{putar}_{cap}_{req}_{i}"] = True
                        with col3:
                            if st.button(
                                label="Delete",
                                key=f"remove_{putar}_{cap}_{req}_{i}",
                                use_container_width=True
                                ):
                                current_reqs.pop(req)
                                st.rerun()
                    if st.session_state.get(f"edit_mode_{putar}_{cap}_{req}_{i}"):
                        edited = st.text_input(
                            label="Edit Requirement",
                            value=req,
                            key=f"edit_input_{putar}_{cap}_{req}_{i}"
                            )
                        save_col, cancel_col = st.columns([1, 1])
                        with save_col:
                            if st.button(
                                label="💾 Save",
                                key=f"save_{putar}_{cap}_{req}_{i}",
                                use_container_width=True
                                ):
                                st.session_state.pop(f"edit_mode_{putar}_{cap}_{req}_{i}")
                                if edited and edited != req:
                                    old_data = current_reqs[req]
                                    current_reqs.pop(req)
                                    current_reqs[edited] = {
                                        "potential_ptars": old_data.get("potential_ptars", {})
                                        }
                                    st.success("Requirement updated.")
                                st.rerun()
                        with cancel_col:
                            if st.button(
                                label="❌ Cancel",
                                key=f"cancel_{putar}_{cap}_{req}_{i}",
                                use_container_width=True
                                ):
                                st.session_state.pop(f"edit_mode_{putar}_{cap}_{req}_{i}", None)
                                st.rerun()


def identify_proximate_targets(
    putar: str,
    issue: str,
    threat: str,
    location: str,
    iteration: int
    ) -> None:
    # Render only if this PUTAR's panel is open
    if st.session_state.get("open_ptar_panel") != putar:
        return
    potential_utars = st.session_state["potential_utars"]
    actor_data = potential_utars.get(putar, {})
    actor_objective = actor_data.get("actor_objective", "")
    capabilities = actor_data.get("capabilities", {})

    if st.button(
        label="❌ Close Panel",
        key=f"close_ptar_panel_{putar}_{iteration}",
        use_container_width=True
        ):
        st.session_state["open_ptar_panel"] = None
        st.rerun()
    st.markdown(
        f"<h4 style='color: #ff6b6b; font-weight: 550;'>{putar}</h4>",
        unsafe_allow_html=True
        )

    # === Gather capability data for the currently selected PUTAR ===
    current_data = potential_utars[current]
    capabilities = current_data.get("capabilities", {})

    # Keep only those capabilities that already have at least one requirement
    valid_caps = {
        cap: cap_data
        for cap, cap_data in capabilities.items()
        if cap_data.get("requirements")
    }
    if not capabilities:
        # No Critical Capabilities have been added yet – guide the user.
        st.info(
            f"Please add at least one **Critical Capability** for "
            f"**{current}** in Tab 3 (Critical Capabilities)."
            )
    elif not valid_caps:
        # Capabilities exist but none contain Requirements – guide the user.
        st.info(
            f"Please define at least one **Critical Requirement** for "
            f"**{current}'s** capabilities in Tab 4 (Critical Requirements)."
            )
    else:
        # All prerequisites met – allow the user to work on Proximate Targets.
        for cap, cap_data in valid_caps.items():
            with st.expander(
                f"Proximate Targets for Critical Capability: {cap}",
                expanded=False
                ):
                for req, req_data in cap_data["requirements"].items():
                    st.markdown(
                        f"<h5 style='color: #42a5f5; font-weight: 550;'>⚙️ Requirement: {req}</h5>",
                        unsafe_allow_html=True
                        )
                    if "potential_ptars" not in req_data:
                        req_data["potential_ptars"] = []
                    new_pptar = st.text_input(
                        label=" ",
                        placeholder=(
                            "Manually enter a Proximate Target for this Critical Requirement if desired"
                            ),
                        help="Example: Deutsche Bank, Internet Research Agency, Etesalat d’Algérie",
                        key=f"add_pptar_{putar}_{cap}_{req}"
                        )
                    col1, col2 = st.columns([1, 1])
                    with col1:
                        if st.button(
                            label="➕ Add Manually Entered Proximate Target",
                            key=f"add_btn_{putar}_{cap}_{req}_{iteration}",
                            use_container_width=True
                            ):
                            cleaned = titlecase(new_pptar.strip())
                            if cleaned and cleaned not in req_data["potential_ptars"]:
                                req_data["potential_ptars"].append(cleaned)
                                st.success(f"Added: {new_pptar}")
                                st.rerun()
                    with col2:
                        if st.button(
                            label="🤖 AI: Suggest Proximate Targets",
                            key=f"{putar}_{cap}_{req}_gpt_{iteration}",
                            use_container_width=True
                            ):
                            try:
                                with st.spinner("Generating suggestions..."):
                                    system_msg = {
                                        "role": "system",
                                        "content": "You are an AI assistant helping identify proximate targets in a COG "
                                        "framework."
                                        }
                                    user_msg = {
                                        "role": "user",
                                        "content": (
                                            f"Actor: {putar}\n"
                                            f"Objective: {actor_objective}\n"
                                            f"Issue: {issue}\n"
                                            f"Threat: {threat}\n"
                                            f"Location: {location}\n"
                                            f"Critical Capability: {cap}\n"
                                            f"Critical Requirement: {req}\n"
                                            "List up to 5 real-world entities (organizations, companies, individuals) that "
                                            "this actor relies upon to support this Critical Requirement for this specific "
                                            "Critical Capability. No explanations, numbering or periods to mark the end of "
                                            "your output. Separate with semicolons."
                                            )
                                        }
                                    response = get_chat_completion([system_msg, user_msg], model="gpt-4o-mini")
                                    suggestions = [titlecase(s.strip()) for s in response.split(";") if s.strip()]
                                    for s in suggestions:
                                        if s not in req_data["potential_ptars"]:
                                            req_data["potential_ptars"].append(s)
                            except Exception as e:
                                st.error(f"Error generating suggestions: {e}")
                if req_data["potential_ptars"]:
                    st.markdown(f"##### 🚩 Current Proximate Targets for {req}")
                    cols = st.columns(2)
                    for i, pptar in enumerate(req_data["potential_ptars"]):
                        pptar_cell = cols[i % 2]
                        with pptar_cell:
                            col1, col2, col3, col4 = st.columns([0.8, 8.0, 1.5, 1.5])
                            with col1:
                                query = urllib.parse.quote(
                                    '("' + putar +  '") AND ' + '("' + pptar + '")'
                                    )
                                st.markdown(
                                    f"""
                                    <div style='padding-left: 10px;'>
                                        <a href="https://google.com/search?q={query}" target="_blank" style="text-decoration: none;">
                                            <button class="custom-icon-button">
                                                <img src="https://www.google.com/favicon.ico" style="height: 20px;">
                                            </button>
                                        </a>
                                    </div>
                                    """,
                                    unsafe_allow_html=True
                                    )                            
                            with col2:
                                st.markdown(
                                    f"""
                                    <div class="st-markdown-custom" style="
                                        height: 40px;
                                        font-size: 16px;
                                        padding-left: 20px;">
                                        {pptar}
                                    </div>
                                    """,
                                    unsafe_allow_html=True
                                    )
                            with col3:
                                if st.button(
                                    label="Edit",
                                    key=f"edit_{putar}_{cap}_{req}_{pptar}_{i}",
                                    use_container_width=True
                                    ):
                                    st.session_state[f"edit_mode_{putar}_{cap}_{req}_{pptar}_{i}"] = True
                            with col4:
                                if st.button(
                                    label="Delete",
                                    key=f"del_{putar}_{cap}_{req}_{pptar}_{i}",
                                    use_container_width=True
                                    ):
                                    req_data["potential_ptars"].remove(pptar)
                                    st.rerun()
                        if st.session_state.get(f"edit_mode_{putar}_{cap}_{req}_{pptar}_{i}"):
                            edited = st.text_input(
                                label="Edit Proximate Target",
                                value=pptar,
                                key=f"edit_input_{putar}_{cap}_{req}_{pptar}_{i}"
                                )
                            save_col, cancel_col = st.columns([1, 1])
                            with save_col:
                                if st.button(
                                    label="💾 Save",
                                    key=f"save_{putar}_{cap}_{req}_{pptar}_{i}",
                                    use_container_width=True
                                    ):
                                    st.session_state.pop(f"edit_{putar}_{cap}_{req}_{pptar}_{i}", None)
                                    if edited and edited != pptar:
                                        req_data["potential_ptars"][i] = edited
                                        st.success("Proximate Target updated.")
                                    st.rerun()
                            with cancel_col:
                                if st.button(
                                    label="❌ Cancel",
                                    key=f"cancel_{putar}_{cap}_{req}_{pptar}_{i}",
                                    use_container_width=True
                                    ):
                                    st.session_state.pop(f"edit_mode_{putar}_{cap}_{req}_{pptar}_{i}", None)
                                    st.rerun()
            
            col1, col2, _ = st.columns([0.3, 0.1, 0.74])
            with col1:
                # Normalisation uses GPT to harmonise naming of Proximate Targets across the dataset.
                clicked = st.button(
                    label="🔄 Normalize Proximate Targets",
                    use_container_width=True,
                    key="normalize_all_pptars"
                    )
            with col2:
                # Helper tooltip explaining what the normalisation button does.
                st.markdown(
                    """
                    <div title="Leverages AI to standardize Proximate Target phrasing within
                    and across Ultimate Targets. It may be necessary to run this multiple times. 
                    Perform QC for best results." 
                    style=
                        cursor: help;
                        font-size: 18px;
                        display: flex;
                        align-items: center;
                        height: 40px;">
                        ℹ️
                    </div>
                    """,
                    unsafe_allow_html=True
                    )

            # Trigger function if clicked
            if clicked:
                normalize_field_across_entities("potential_ptars")


def build_graph(
    data_structure,
    filter_out_reqs=False,
    filter_out_caps=False,
    filter_out_pptars=False
    ):
    G = nx.Graph()
    color_palette = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
        "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
        "#bcbd22", "#17becf"
    ]

    pptar_to_putars = defaultdict(set)
    for putar, putar_data in data_structure.items():
        for cap_data in putar_data.get("capabilities", {}).values():
            for req_data in cap_data.get("requirements", {}).values():
                for pptar in req_data.get("potential_ptars", []):
                    pptar_to_putars[pptar].add(putar)

    for i, (putar, putar_data) in enumerate(data_structure.items()):
        group_color = color_palette[i % len(color_palette)]
        putar_id = f"putar_{putar}"
        G.add_node(putar_id, label=putar, type='putar', group_color=group_color)

        for cap, cap_data in putar_data.get("capabilities", {}).items():
            cap_id = f"cap_{putar}_{cap}"
            if not filter_out_caps:
                G.add_node(cap_id, label=cap, type='capability', group_color=group_color)
                G.add_edge(putar_id, cap_id)

            for req, req_data in cap_data.get("requirements", {}).items():
                req_id = f"req_{putar}_{cap}_{req}"
                pptars = req_data.get("potential_ptars", [])

                if not filter_out_reqs:
                    G.add_node(req_id, label=req, type='requirement', group_color=group_color)
                    parent_id = cap_id if not filter_out_caps else putar_id
                    G.add_edge(parent_id, req_id)
                else:
                    parent_id = cap_id if not filter_out_caps else putar_id

                if not filter_out_pptars:
                    for pptar in pptars:
                        pptar_id = f"pptar_{pptar}"
                        is_shared = len(pptar_to_putars[pptar]) > 1
                        pptar_color = "#999999" if is_shared else group_color

                        if pptar_id not in G:
                            G.add_node(
                                pptar_id,
                                label=pptar,
                                type='pptar',
                                group_color=pptar_color
                            )

                        # Connect pptar to appropriate parent
                        if not filter_out_reqs:
                            G.add_edge(req_id, pptar_id)
                        elif not filter_out_caps:
                            G.add_edge(cap_id, pptar_id)
                        else:
                            G.add_edge(putar_id, pptar_id)

    return G

# --- Convert to D3.js compatible format ---
def convert_graph_to_d3(graph: nx.Graph) -> dict:
    def get_border_color(node_type: str) -> str:
        return {
            "putar": "#3f37c9",
            "capability": "#264653",
            "requirement": "#e76f51",
            "pptar": "#5e548e",
        }.get(node_type, "#999999")

    nodes = []
    links = []
    for node_id, data in graph.nodes(data=True):
        nodes.append({
            "id": node_id,
            "label": data.get("label", node_id),
            "type": data.get("type", "unknown"),
            "group_color": data.get("group_color", "#cccccc"),
            "border_color": get_border_color(data.get("type", "unknown")),
        })
    for source, target in graph.edges():
        links.append({"source": source, "target": target})
    return {"nodes": nodes, "links": links}


def causeway_page():
    # Inject shared CSS file
    try:
        with open('frameworks/visualization_styles.css', 'r', encoding='utf-8') as f:
            css_content = f.read()
        st.markdown(
            f"<style>{css_content}</style>",
            unsafe_allow_html=True,
        )
    except Exception as e:
        st.error(f"Error loading CSS: {e}")
    st.markdown(
        '<h1 class="main-header">🛤️ CauseWay</h1>',
        unsafe_allow_html=True,
        )
    st.markdown(
    '<em>CauseWay is intended to serve as an aid for issue-focused strategic research based '
    'loosely on the Center of Gravity (COG) framework. For information on COG analysis visit '
    '<a href="https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide" '
    'target="_blank">this page</a> on Irregularpedia.</em>',
    unsafe_allow_html=True
    )

    # Create tabs for better organization
    tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs(
        [
            "⚠️ Threat",
            "🎯 Ultimate Targets",
            "💪 Critical Capabilities",
            "⚙️ Critical Requirements",
            "🚩 Proximate Targets",
            "📊 Visualize",
            "🗂️ Data Structure"
            ])

    with tab1:
        identify_threat()

    with tab2:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>Develop Ultimate Targets</h3>",
            unsafe_allow_html=True
            )

        if all([
            st.session_state.get("threat"),
            st.session_state.get("issue"),
            st.session_state.get("location")
            ]):
            nominate_putars(
                st.session_state["threat"],
                st.session_state["issue"],
                st.session_state["location"]
                )
        else:
            st.info(
                "Please ensure that an **issue**, **location**, and "
                "**threat** have been provided in Tab 1 (Threat)."
                )

    with tab3:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>Develop Critical Capabilities</h3>",
            unsafe_allow_html=True
            )
        st.markdown(
            "**Critical Capabilities** are the primary abilities, functions, or actions "
            "that an **Ultimate Target** performs that enable it to achieve its objective "
            "or pose a threat."
            )

        potential_utars = st.session_state.get("potential_utars", {})
        iteration = 1
        if not potential_utars:
            st.info(
                "Please select at least one **Ultimate "
                "Target** in Tab 2 (Ultimate Targets)."
                )
        else:
            # === BUTTON PANEL (always appears at top)
            cols = st.columns(4)
            for idx, putar in enumerate(potential_utars.keys()):
                button_col = cols[idx % 4]
                with button_col:
                    if st.button(
                        label=putar,
                        key=f"cap_btn_{putar}_{iteration}",
                        use_container_width=True
                        ):
                        st.session_state["open_cap_panel"] = (
                            None if st.session_state.get("open_cap_panel") == putar else putar
                            )
                        st.rerun()

            # === Show panel only for the selected PUTAR
            current_putar = st.session_state.get("open_cap_panel")
            if current_putar and current_putar in potential_utars:
                capabilities = potential_utars[current_putar].get("capabilities", {})
                identify_capabilities(
                    current_putar,
                    st.session_state["threat"],
                    st.session_state["issue"],
                    st.session_state["location"],
                    iteration
                    )
            
            col1, col2, _ = st.columns([0.3, 0.1, 0.74])
            with col1:
                clicked = st.button(
                    label="🔄 Normalize Capabilities",
                    key="normalize_all_caps",
                    use_container_width=True
                    )
            with col2:
                st.markdown(
                    """
                    <div title="Leverages AI to standardize Critical Capability phrasing within
                    and across Ultimate Targets. It may be necessary to run this multiple times. 
                    Perform QC for best results." 
                    style=
                        cursor: help;
                        font-size: 18px;
                        display: flex;
                        align-items: center;
                        height: 40px;">
                        ℹ️
                    </div>
                    """,
                    unsafe_allow_html=True
                    )

            # Trigger function if clicked
            if clicked:
                normalize_field_across_entities("capabilities")

    with tab4:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>Develop Critical Requirements</h3>",
            unsafe_allow_html=True
            )
        st.markdown(
            "**Critical Requirements** are the essential conditions, resources, or means that "
            "are necessary for a **Critical Capability** to be fully operational or effective."
            )

        potential_utars = st.session_state.get("potential_utars", {})
        iteration = 1
        if not potential_utars:
            st.info(
                "Please select at least one **Ultimate "
                "Target** in Tab 2 (Potential Targets)."
                )
        else:
            # === BUTTON PANEL (always appears at top)
            #st.markdown("#### 🎯 Select a PUTAR to develop its Critical Requirements")
            cols = st.columns(4)

            for idx, putar in enumerate(potential_utars.keys()):
                button_col = cols[idx % 4]
                with button_col:
                    if st.button(
                        label=putar,
                        key=f"req_btn_{putar}_{iteration}",
                        use_container_width=True
                        ):
                        st.session_state["open_req_panel"] = (
                            None if st.session_state.get("open_req_panel") == putar else putar
                            )
                        st.rerun()

            # === Show panel only for the selected PUTAR
            current_putar = st.session_state.get("open_req_panel")
            if current_putar and current_putar in potential_utars:
                capabilities = potential_utars[current_putar].get("capabilities", {})
                if not capabilities:
                    st.info(
                        f"Please add at least one **Critical Capability** for "
                        f"**{current_putar}** in Tab 3 (Critical Capabilities)."
                        )
                else:
                    identify_requirements(
                        current_putar,
                        st.session_state["issue"],
                        st.session_state["threat"],
                        st.session_state["location"],
                        iteration
                        )
            
            col1, col2, _ = st.columns([0.3, 0.1, 0.74])
            with col1:
                clicked = st.button(
                    label="🔄 Normalize Requirements",
                    use_container_width=True,
                    key="normalize_all_reqs"
                    )
            with col2:
                st.markdown(
                    """
                    <div title="Leverages AI to standardize Critical Requirement phrasing within
                    and across Ultimate Targets. It may be necessary to run this multiple times. 
                    Perform QC for best results." 
                    style=
                        cursor: help;
                        font-size: 18px;
                        display: flex;
                        align-items: center;
                        height: 40px;">
                        ℹ️
                    </div>
                    """,
                    unsafe_allow_html=True
                    )

            # Trigger function if clicked
            if clicked:
                normalize_field_across_entities("requirements")

    with tab5:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>Identify Proximate Targets</h3>",
            unsafe_allow_html=True
            )
        st.markdown(
            "**Proximate Targets** are entities that **Ultimate Targets** rely on in order "
            "to satisfy their **Critical Requirements**."
            )

        potential_utars = st.session_state.get("potential_utars", {})
        if not potential_utars:
            st.info(
                "Please select at least one **Ultimate "
                "Target** in Tab 2 (Ultimate Targets)."
                )
        else:
            if "open_ptar_panel" not in st.session_state:
                st.session_state["open_ptar_panel"] = None
            with st.container():
                cols = st.columns(4)
                for idx, putar in enumerate(potential_utars.keys()):
                    data = potential_utars[putar]
                    capabilities = data.get("capabilities", {})
                    button_cell = cols[idx % 4]
                    with button_cell:
                        if st.button(
                            label=putar,
                            key=f"ptar_btn_{putar}",
                            use_container_width=True
                            ):
                            st.session_state["open_ptar_panel"] = (
                                putar if st.session_state["open_ptar_panel"] != putar else None
                                )
                            st.rerun()

            current = st.session_state["open_ptar_panel"]
            if current:
                current_data = potential_utars[current]
                capabilities = current_data.get("capabilities", {})
                valid_caps = {
                    cap: cap_data
                    for cap, cap_data in capabilities.items()
                    if cap_data.get("requirements")
                }
                if not capabilities:
                    st.info(
                        f"Please add at least one **Critical Capability** for "
                        f"**{current}** in Tab 3 (Critical Capabilities)."
                        )
                elif not valid_caps:
                    st.info(
                        f"Please define at least one **Critical Requirement** for "
                        f"**{current}'s** capabilities in Tab 4 (Critical Requirements)."
                        )
                else:
                    identify_proximate_targets(
                        current,
                        st.session_state["issue"],
                        st.session_state["threat"],
                        st.session_state["location"],
                        1
                        )
            
            col1, col2, _ = st.columns([0.3, 0.1, 0.74])
            with col1:
                clicked = st.button(
                    label="🔄 Normalize Proximate Targets",
                    use_container_width=True,
                    key="normalize_all_pptars"
                    )
            with col2:
                st.markdown(
                    """
                    <div title="Leverages AI to standardize Proximate Target phrasing within
                    and across Ultimate Targets. It may be necessary to run this multiple times. 
                    Perform QC for best results." 
                    style=
                        cursor: help;
                        font-size: 18px;
                        display: flex;
                        align-items: center;
                        height: 40px;">
                        ℹ️
                    </div>
                    """,
                    unsafe_allow_html=True
                    )

            # Trigger function if clicked
            if clicked:
                normalize_field_across_entities("potential_ptars")


    with tab6:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>COG Network Graph</h3>",
            unsafe_allow_html=True
            )

        if not st.session_state.get("potential_utars", {}):
            st.info(
                "Select at least one **Ultimate Target** in Tab 2 to begin "
                "building the COG network graph."
                )
        else:
            potential_utars = st.session_state["potential_utars"]

            # === Filter toggles (stateful) ===
            filter_out_reqs = st.checkbox("Hide Requirements", key="filter_out_reqs")
            filter_out_caps = st.checkbox("Hide Capabilities", key="filter_out_caps")
            filter_out_pptars = st.checkbox("Hide Proximate Targets", key="filter_out_pptars")

            # === Layout / visual controls ===
            repulsion_strength = st.slider(
                "Node Repulsion", 100, 1000, 300, 50, key="repulsion_strength"
            )
            node_size = st.slider("Node Size", 8, 40, 15, 1, key="node_size")
            show_legend = st.checkbox("Show Legend", value=True, key="show_legend")

            # === Export utilities ===
            export_cols = st.columns(4)
            with export_cols[0]:
                full_graph = build_graph(potential_utars, False, False, False)
                nodes_df = pd.DataFrame([
                    {**data, "id": node_id} for node_id, data in full_graph.nodes(data=True)
                ])
                st.download_button(
                    "🔽 Export Nodes CSV",
                    data=nodes_df.to_csv(index=False).encode("utf-8"),
                    file_name="all_nodes.csv",
                    mime="text/csv",
                    key='download_nodes'
                )
            with export_cols[1]:
                edges_df = pd.DataFrame([
                    {"source": u, "target": v} for u, v in full_graph.edges()
                ])
                st.download_button(
                    "🔽 Export Edges CSV",
                    data=edges_df.to_csv(index=False).encode("utf-8"),
                    file_name="all_edges.csv",
                    mime="text/csv",
                    key='download_edges'
                )
            with export_cols[2]:
                graphml_io = io.StringIO()
                nx.write_graphml(full_graph, graphml_io)
                st.download_button(
                    "🔽 Export GraphML",
                    data=graphml_io.getvalue(),
                    file_name="cog_graph.graphml",
                    mime="application/xml",
                    key="download_graphml",
                )
            with export_cols[3]:
                gexf_io = io.StringIO()
                nx.write_gexf(full_graph, gexf_io)
                st.download_button(
                    "🔽 Export GEXF",
                    data=gexf_io.getvalue(),
                    file_name="cog_graph.gexf",
                    mime="application/xml",
                    key="download_gexf",
                )

            # === Build and render interactive graph ===
            graph = build_graph(
                potential_utars, filter_out_reqs, filter_out_caps, filter_out_pptars
            )
            d3_data = convert_graph_to_d3(graph)
            d3_json = json.dumps(d3_data)
            html_code = f"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                .node-label {{
                  pointer-events: none;
                  fill: white;
                }}
                .legend text {{
                  font-size: 16px;
                  fill: white;
                }}
                #resetZoom {{
                  background:#12141C;
                  color:white;
                  border:1px solid #353842;
                  padding:6px 12px;
                  border-radius:6px;
                  cursor:pointer;
                }}
              </style>
            </head>
            <body>
            <button id="resetZoom">Reset Zoom</button>
            <div id="graph-container"
                 style="background-color:#0F1117;width:100%;height:700px;margin:0 auto;position:relative;">
              <svg width="100%" height="100%"></svg>
            </div>
            <script src="https://d3js.org/d3.v6.min.js"></script>
            <script>
            const graph = {d3_json};
            const NODE_SIZE = {node_size};
            const REPULSION = -{repulsion_strength};

            const container = document.getElementById("graph-container");
            const svg = d3.select("svg");
            const zoomGroup = svg.append("g");

            const zoom = d3.zoom()
              .scaleExtent([0.1, 2])
              .on("zoom", e => {{
                zoomGroup.attr("transform", e.transform);
              }});
            svg.call(zoom);

            const simulation = d3.forceSimulation(graph.nodes)
              .force("link", d3.forceLink(graph.links).id(d => d.id).distance(NODE_SIZE * 6))
              .force("charge", d3.forceManyBody().strength(REPULSION))
              .force("center", d3.forceCenter(0, 0))
              .force("collide", d3.forceCollide(NODE_SIZE + 4));

            // Links
            zoomGroup.append("g")
              .selectAll("line")
              .data(graph.links)
              .enter().append("line")
              .attr("stroke", "#aaa")
              .attr("stroke-width", 2);

            // Nodes with symbols
            const symbolMap = {{
              "putar": d3.symbolSquare,
              "capability": d3.symbolCircle,
              "requirement": d3.symbolTriangle,
              "pptar": d3.symbolDiamond
            }};
            const node = zoomGroup.append("g")
              .selectAll("path")
              .data(graph.nodes)
              .enter().append("path")
              .attr("d", d => d3.symbol().type(symbolMap[d.type] || d3.symbolCircle).size(Math.pow(NODE_SIZE, 2))())
              .attr("fill", d => d.group_color)
              .attr("stroke", d => d.border_color)
              .attr("stroke-width", 3)
              .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
            node.append("title").text(d => d.label);

            // Labels
            const label = zoomGroup.append("g")
              .selectAll("text")
              .data(graph.nodes)
              .enter().append("text")
                .attr("class", "node-label")
                .attr("text-anchor", "middle")
                .attr("dy", -NODE_SIZE - 2)
                .style("font-size", d => d.type === "putar" ? "20px" : d.type === "pptar" ? "14px" : "12px")
                .style("font-weight", d => (d.type === "putar" || d.type === "pptar") ? "bold" : "normal")
                .text(d => d.label);

            // Legend
            const legend = svg.append("g")
              .attr("class", "legend")
              .attr("transform", "translate(20,20)");

            const legendData = [
              {{ label: "Ultimate Target", color: "#3f37c9" }},
              {{ label: "Capability", color: "#264653" }},
              {{ label: "Requirement", color: "#e76f51" }},
              {{ label: "Proximate Target", color: "#5e548e" }}
            ];

            legend.selectAll("path")
              .data(legendData)
              .enter().append("path")
                .attr("d", d3.symbol().type(d3.symbolSquare).size(100))
                .attr("transform", (d,i) => `translate(0,${i*20})`)
                .attr("fill", "transparent")
                .attr("stroke", d => d.color)
                .attr("stroke-width", 3);

            legend.selectAll("text")
              .data(legendData)
              .enter().append("text")
                .attr("x", 12)
                .attr("y", (d,i) => i * 20 + 4)
                .attr("fill", "white")
                .text(d => d.label);

            if ({str(show_legend).lower()} === false) {{
              legend.style("display", "none");
            }}

            simulation.on("tick", () => {{
              zoomGroup.selectAll("line")
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

              node.attr("transform", d => `translate(${d.x},${d.y})`);
              label
                .attr("x", d => d.x)
                .attr("y", d => d.y - NODE_SIZE - 2);
            }});

            function dragstarted(event, d) {{
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x; d.fy = d.y;
            }}
            function dragged(event, d) {{
              d.fx = event.x; d.fy = event.y;
            }}
            function dragended(event, d) {{
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null; d.fy = null;
            }}

            // Reset zoom
            document.getElementById("resetZoom").addEventListener("click", () => {{
              svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
            }});
            </script>
            </body>
            </html>
            """
            components.html(html_code, height=700)


    with tab7:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>Data Structure</h3>",
            unsafe_allow_html=True
            )

        data = st.session_state.get("potential_utars", {})
        if data:
            # serialize and offer download
            json_str = json.dumps(data, indent=2)
            st.download_button(
                label="🔽 Export Data Structure (JSON)",
                data=json_str,
                file_name="causeway_data_structure.json",
                mime="application/json"
                )
            # show it
            st.write(data)

        else:
            st.info(
                "The data structure will begin to populate as soon as "
                "at least one potential **Ultimate Target** is selected in "
                "Tab 2 (Ultimate Targets)."
                )


def main():
    causeway_page()


if __name__ == "__main__":
    main()
