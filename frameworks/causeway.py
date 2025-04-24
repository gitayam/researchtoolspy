# /frameworks/causeway.py

from collections import defaultdict
from dotenv import load_dotenv
import hashlib
import io
import json
import logging
import networkx as nx
import plotly.graph_objects as go
import psycopg2
from psycopg2.extras import DictCursor
import streamlit as st
from titlecase import titlecase
from typing import Dict, List, Any, Optional, Tuple, Iterable
from utilities.gpt import get_completion, get_chat_completion, normalize_field_across_entities
import uuid


def clear_session_state(key: str) -> None:
    """Remove a specific key from the session state.

    Args:
        key: The key to remove from the session state
    """
    if key in st.session_state:
        del st.session_state[key]


def identify_threat() -> None:
    st.markdown(
        "<h3 style='color: #8fbc8f; font-weight: 600;'>Develop Scenario</h3>",
        unsafe_allow_html=True
    )
    col1, col2 = st.columns(2)
    with col1:
        issue = st.text_area(
            "Issue",
            help=(
                "Enter the issue that you are focused on, "
                "ensuring that it is not framed as a threat. "
                "Examples include: Environmental sustainability, free speech, "
                "rule of law."
                )
        )
        st.session_state["issue"] = titlecase(issue)

    with col2:
        location = st.text_area(
            "Location",
            help="Enter the the location of concern."
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
        col1, col2 = st.columns([4, 1])
        with col1:
            st.markdown(
                f"""
                <div class="success-box">Current Threat: <strong>{st.session_state['threat']}</strong></div>
                """,
                unsafe_allow_html=True,
            )
        with col2:
            if st.button("🧹️ Clear Threat"):
                st.session_state.pop("threat", None)
                st.session_state.pop("threat_index", None)
                st.rerun()

    # Manual threat input
    manual_threat = st.text_input(
        label="Enter User-Generated Threat",
        help=(
                "A phenomenon that poses a threat to your issue of concern. "
                "It should not identify the party responsible for the threat."
            )
        )

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("✍️ Select User-Designated Threat", use_container_width=True):
            if not issue or not location:
                st.warning("Please provide the issue and location of concern.")
            else:
                manual_threat = titlecase(manual_threat.strip())
                st.session_state["threat"] = manual_threat
                st.session_state.pop("threat_index", None)  # Clear selected threat index
                st.success(f"Set threat to: {manual_threat}")
                st.rerun()

    # AI Threat Generation
    with col2:
        if st.button(
            "🤖 Generate Threat Suggestions",
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
                                "Identify the most significant threats to the identified issue "
                                "in the specified location. Each identified threat should be along "
                                "the lines of a situation and should be general, not featuring any "
                                "responsible actors or entities suffering the consequences. Each "
                                "threat should be a concise phrase (3-7 words). Do not include any "
                                "additional text, such as explanations or numbering Separate with "
                                "semicolons and do not mark the end of your output with any punctuation."
                                )
                            }

                        response = get_chat_completion(
                            model="gpt-4",
                            messages=[system_msg, user_msg]
                            )
                        threat_suggestions = [
                            titlecase(threat.strip()) for threat in response.split(";") if threat.strip()
                        ]
                        threat_suggestions = threat_suggestions[:10]
                    except Exception as e:
                        logging.error(f"Error generating threats: {e}")
                        return e
                    st.session_state["threat_suggestions"] = threat_suggestions

    # Display and handle threat suggestions
    if (
        "threat_suggestions" in st.session_state and st.session_state["threat_suggestions"]
        ):
        st.markdown(
            "##### 🤖 AI-Generated Threats",
            unsafe_allow_html=True
        )
        for i, threat in enumerate(st.session_state["threat_suggestions"]):
            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(
                    f"<div style='padding-left: 20px'>{threat}</div>",
                    unsafe_allow_html=True
                    )
            with col2:
                button_key = f"select_threat_{i}"
                if st.button("Select", key=button_key):
                    st.session_state["threat"] = threat
                    st.session_state["threat_index"] = i
                    # st.success(f"Selected Threat: {threat}")
                    st.rerun()

            # Highlight the selected threat
            if (
                "threat_index" in st.session_state
                and st.session_state["threat_index"] == i
            ):
                st.markdown(
                    f'<div class="success-box">✓ Currently Selected</div>',
                    unsafe_allow_html=True,
                )

def nominate_putars(
    threat: str,
    issue: str,
    location: str
) -> None:
    """Manage critical threats for the selected issue."""

    if "potential_utars" not in st.session_state:
        st.session_state["potential_utars"] = {}
    if "select_status" not in st.session_state:
        st.session_state["select_status"] = {}

    putar = st.text_input(
        label="User-Designated Potential Ultimate Target",
        help="Enter a potential Ultimate Target."          
    )

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("➕ Add User-Designated Potential Ultimate Target", use_container_width=True):
            putar = titlecase(putar.strip())
            if putar and putar not in st.session_state["select_status"]:
                st.session_state["select_status"][putar] = False
                st.rerun()
            elif putar:
                st.info(f"Potential target already exists: {putar}")

    with col2:
        if st.button("🤖 AI: Suggest Potential Ultimate Targets", use_container_width=True):
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
                        "List up to five specific, named entities -- whether an organization "
                        "or an individual -- that directly pose the specified threat to the "
                        "specified issue in the specified location, ensuring not to include "
                        "entities which merely faciliate the threat, or any extraneous text. "
                        "such as numbering, context, or explanations. Separate with semicolons "
                        "and do not mark the end of your output with any punctuation."
                    ),
                }
                response = get_chat_completion([system_msg, user_msg], model="gpt-4")
                gpt_suggestions = [titlecase(p.strip()) for p in response.split(";") if p.strip()]

                added = []
                for putar in gpt_suggestions:
                    if putar not in st.session_state["select_status"]:
                        st.session_state["select_status"][putar] = False
                        added.append(putar)

                if added:
                    st.rerun()
            except Exception as e:
                st.error(f"Error suggesting ultimate potential targets: {e}")

    if st.session_state["select_status"]:
        st.markdown(
            "##### 🎯 Current Potential Ultimate Targets",
            unsafe_allow_html=True
        )

        for putar in st.session_state["select_status"]:
            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(
                    f"<div style='padding-left: 20px'>{putar}</div>",
                    unsafe_allow_html=True
                    )
            with col2:
                checkbox_key = f"toggle_{putar}"
                checked = st.checkbox("Include", key=checkbox_key)
                st.session_state["select_status"][putar] = checked

        # Apply selection state to potential_utars
        rerun_needed = False
        for putar, is_selected in st.session_state["select_status"].items():
            if is_selected and putar not in st.session_state["potential_utars"]:
                st.session_state["potential_utars"][putar] = {}
                rerun_needed = True
            elif not is_selected and putar in st.session_state["potential_utars"]:
                st.session_state["potential_utars"].pop(putar)
                rerun_needed = True

        if rerun_needed:
            st.rerun()

        if st.button("🧹 Clear All Potential Ultimate Targets"):
            st.session_state["select_status"].clear()
            st.session_state["potential_utars"].clear()
            st.rerun()


def identify_capabilites(
    putar: str,
    issue: str,
    location: str,
    threat: str,
    iteration: int,
    ) -> None:

    if "capabilities" not in st.session_state["potential_utars"][putar]:
        st.session_state["potential_utars"][putar]["capabilities"] = {}

    if "actor_objective" not in st.session_state["potential_utars"][putar]:
        st.session_state["potential_utars"][putar]["actor_objective"] = ""

    st.markdown(
        f"<h4 style='color: #ff6b6b; font-weight: 600;'>🎯 {putar}</h4>",
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
    st.session_state['potential_utars'][putar]["actor_objective"] = actor_objective

    cap = st.text_input(
        label="User-Designated Critical Capability",
        help="Manually enter  a Critical Capability for this potential Ultimate Target if desired.",
        key=f"{putar}_cap_input_{iteration}",
    )

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button(
            "➕ Add User-Designated Critical Capability",
            key=f"{putar}_add_cap_{iteration}",
            use_container_width=True
        ):
            if not st.session_state['potential_utars'][putar].get("actor_objective"):
                st.warning("Please specify the actor's objective first.")
            else:
                if cap.strip():
                    cap = titlecase(cap.strip())
                    if cap not in st.session_state["potential_utars"][putar]["capabilities"]:
                        st.session_state["potential_utars"][putar]["capabilities"][cap] = {
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
            "🤖 AI: Suggest Capabilities",
            use_container_width=True,
            key=f"suggest_cap_{putar}_{iteration}"
        ):
            if not st.session_state['potential_utars'][putar].get("actor_objective"):
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
                    response = get_chat_completion([system_msg, user_msg], model="gpt-4")
                    suggestions = [titlecase(cap.strip()) for cap in response.split(";") if cap.strip()]
                    for cap in suggestions:
                        if cap not in st.session_state["potential_utars"][putar]["capabilities"]:
                            st.session_state["potential_utars"][putar]["capabilities"][cap] = {
                                "requirements": {}
                            }
                    st.success("Suggestions added.")
                    st.rerun()
                except Exception as e:
                    st.error(f"Error suggesting capabilities: {e}")

    capabilities = st.session_state["potential_utars"][putar]["capabilities"]
    if capabilities:
        st.markdown(f"###### 💪 Current Critical Capabilities for {putar}")
        for i, cap in enumerate(list(capabilities.keys())):
            col1, col2, col3 = st.columns([6, 0.6, 0.6])
            with col1:
                st.markdown(
                    f"<div style='padding-left: 20px'>{cap}</div>",
                    unsafe_allow_html=True
                )
            with col2:
                if st.button(
                    "Edit",
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
                        "💾 Save",
                        key=f"save_{putar}_{cap}_{i}",
                        use_container_width=True
                        ):
                        st.session_state.pop(f"edit_mode_{putar}_{cap}_{i}", None)
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
                        "❌ Cancel",
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
    potential_utars = st.session_state.get("potential_utars", {})
    capabilities = potential_utars.get(putar, {}).get("capabilities", {})
    actor_objective = potential_utars.get(putar, {}).get("actor_objective", "")

    # === Skip if this PUTAR is not currently selected
    if st.session_state.get("open_req_panel") != putar:
        return

    # === Header
    st.markdown(
        f"<h4 style='color: #ff6b6b; font-weight: 600;'>Critical Requirements for {putar}</h4>",
        unsafe_allow_html=True
    )

    # === Close Panel Button
    if st.button("❌ Close Panel", key=f"close_req_panel_{putar}_{iteration}", use_container_width=True):
        st.session_state["open_req_panel"] = None
        st.rerun()

    for cap, cap_data in capabilities.items():
        if not isinstance(cap_data, dict):
            continue

        if "requirements" not in cap_data:
            cap_data["requirements"] = {}

        with st.expander(f"Requirements for Critical Capability: {cap}", expanded=False):
            st.markdown(
                    f"<h5 style='color: #42a5f5; font-weight: 550;'>💪 Capability: {cap}</h5>",
                    unsafe_allow_html=True
                    )
            new_req = st.text_input(
                label="User-Designated Critical Requirement",
                key=f"{putar}_{cap}_req_input_{iteration}",
                help=(
                    "Manually enter a Critical Requirement for this Critical Capability if desired."
                    )
            )

            col1, col2 = st.columns([1, 1])
            with col1:
                if st.button(
                    "➕ Add Requirement",
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
                    "🤖 AI: Suggest Requirements",
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
                        response = get_chat_completion([system_msg, user_msg], model="gpt-4")
                        suggestions = [titlecase(r.strip()) for r in response.split(";") if r.strip()]
                        for r in suggestions:
                            if r not in cap_data["requirements"]:
                                cap_data["requirements"][r] = {}
                        st.success("Suggestions added.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error suggesting requirements: {e}")

            current_reqs = cap_data["requirements"]
            if current_reqs:
                st.markdown(f"###### ⚙️ Current Critical Requirements for {cap}")
                for i, req in enumerate(list(current_reqs.keys())):
                    col1, col2, col3 = st.columns([6, 0.6, 0.6])
                    with col1:
                        st.markdown(
                            f"<div style='padding-left: 20px'>{req}</div>",
                            unsafe_allow_html=True
                        )
                    with col2:
                        if st.button(
                            "Edit",
                            key=f"edit_{putar}_{cap}_{req}_{i}",
                            use_container_width=True
                            ):
                            st.session_state[f"edit_mode_{putar}_{cap}_{req}_{i}"] = True
                    with col3:
                        if st.button(
                            "Delete",
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
                                "Save",
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
                                "❌ Cancel",
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
    potential_utars = st.session_state["potential_utars"]
    actor_data = potential_utars.get(putar, {})
    actor_objective = actor_data.get("actor_objective", "")
    capabilities = actor_data.get("capabilities", {})

    # Render only if this PUTAR's panel is open
    if st.session_state.get("open_ptar_panel") != putar:
        return

    st.markdown(
        f"<h4 style='color: #ff6b6b; font-weight: 550;'>{putar}</h4>",
        unsafe_allow_html=True
    )

    if st.button("❌ Close Panel", key=f"close_ptar_panel_{putar}_{iteration}", use_container_width=True):
        st.session_state["open_ptar_panel"] = None
        st.rerun()

    for cap, cap_data in capabilities.items():
        if not cap_data.get("requirements"):
            continue

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
                    label="User-Designated Proximate Target",
                    help=(
                        "Manually enter a User-Designated Proximate Target for this Critical "
                        "Requirement if desired."
                        ),
                    key=f"add_pptar_{putar}_{cap}_{req}"
                )

                col1, col2 = st.columns([1, 1])
                with col1:
                    if st.button(
                        "➕ Add Entity",
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
                        "🤖 AI Suggest Proximate Targets",
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
                                response = get_chat_completion([system_msg, user_msg], model="gpt-4")
                                suggestions = [titlecase(s.strip()) for s in response.split(";") if s.strip()]
                                for s in suggestions:
                                    if s not in req_data["potential_ptars"]:
                                        req_data["potential_ptars"].append(s)
                                st.success("Suggested entities added.")
                                st.rerun()
                        except Exception as e:
                            st.error(f"Error generating suggestions: {e}")

                if req_data["potential_ptars"]:
                    st.markdown(f"###### 🚩 Current Proximate Targets for {req}")
                    for i, pptar in enumerate(req_data["potential_ptars"]):
                        col1, col2, col3 = st.columns([6, 0.6, 0.6])
                        with col1:
                            st.markdown(
                                f"<div style='padding-left: 20px'>{pptar}</div>",
                                unsafe_allow_html=True
                            )
                        with col2:
                            if st.button(
                                "Edit",
                                key=f"edit_{putar}_{cap}_{req}_{pptar}_{i}",
                                use_container_width=True
                                ):
                                st.session_state[f"edit_mode_{putar}_{cap}_{req}_{pptar}_{i}"] = True
                        with col3:
                            if st.button(
                                "Delete",
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
                                    "Save",
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
                                    "❌ Cancel",
                                    key=f"cancel_{putar}_{cap}_{req}_{pptar}_{i}",
                                    use_container_width=True
                                ):
                                    st.session_state.pop(f"edit_mode_{putar}_{cap}_{req}_{pptar}_{i}", None)
                                    st.rerun()


def build_graph(
    data_structure,
    filter_out_reqs=False,
    filter_out_caps=False
    ):
    G = nx.Graph()
    color_palette = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
        "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
        "#bcbd22", "#17becf"
    ]

    pptar_to_putars = defaultdict(set)

    # First pass: track shared pptars
    for putar, putar_data in data_structure.items():
        for cap_data in putar_data.get("capabilities", {}).values():
            for req_data in cap_data.get("requirements", {}).values():
                for pptar in req_data.get("potential_ptars", []):
                    pptar_to_putars[pptar].add(putar)

    # Second pass: build graph nodes and edges
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
                    parent = cap_id if not filter_out_caps else putar_id
                    G.add_edge(parent, req_id)

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

                    # Decide the most appropriate parent node to attach pptar
                    if not filter_out_reqs:
                        parent_id = req_id
                    elif not filter_out_caps:
                        parent_id = cap_id
                    else:
                        parent_id = putar_id

                    G.add_edge(parent_id, pptar_id)
    return G


def build_figure(edge_trace, node_traces):
    return go.Figure(
        data=[edge_trace] + node_traces,
        layout=go.Layout(
            title="Network Graph with Node Categories",
            hovermode='closest',
            showlegend=True,
            margin=dict(t=40, b=20),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False)
        )
    )


def build_edge_trace(graph, pos):
    edge_x, edge_y = [], []
    for edge in graph.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])

    return go.Scatter(
        x=edge_x, y=edge_y,
        mode='lines',
        line=dict(width=2, color='gray'),
        hoverinfo='none'
    )


def build_node_traces(graph, pos, filter_out_reqs=False, filter_out_caps=False):
    traces = []
    text_positions = ["top center", "bottom center", "top right", "bottom right"]

    type_styles = {
        "putar": {"size": 40, "border_color": "#3f37c9", "font_size": 18, "legend": "Ultimate Targets"},
        "capability": {"size": 20, "border_color": "#264653", "font_size": 10, "legend": "Critical Capabilities"},
        "requirement": {"size": 20, "border_color": "#e76f51", "font_size": 10, "legend": "Critical Requirements"},
        "pptar": {"size": 20, "border_color": "#5e548e", "font_size": 11, "legend": "Proximate Targets"},
    }

    for node_type, style in type_styles.items():
        node_x, node_y, node_text, node_colors, text_position_cycle, opacities = [], [], [], [], [], []

        relevant_nodes = [n for n in graph.nodes() if graph.nodes[n].get("type") == node_type]

        for i, node in enumerate(relevant_nodes):
            x, y = pos[node]
            label = graph.nodes[node].get("label", node)
            color = graph.nodes[node].get("group_color", "#cccccc")

            node_x.append(x)
            node_y.append(y)
            node_text.append(label)
            node_colors.append(color)
            text_position_cycle.append(text_positions[i % len(text_positions)])

            # Apply lower opacity if node is filtered
            if (node_type == "capability" and filter_out_caps) or (node_type == "requirement" and filter_out_reqs):
                opacities.append(0.2)
            else:
                opacities.append(1.0)

        # Dummy trace for legend entry
        dummy = go.Scatter(
            x=[None],
            y=[None],
            mode='markers',
            marker=dict(
                color="#1f77b4",
                size=style["size"],
                symbol='circle',
                line=dict(width=4, color=style["border_color"])
            ),
            name=style["legend"],
            hoverinfo='skip',
            showlegend=True
        )
        traces.append(dummy)

        if node_x:
            trace = go.Scatter(
                x=node_x,
                y=node_y,
                mode='markers+text',
                hoverinfo='text+name',
                marker=dict(
                    color=node_colors,
                    size=style["size"],
                    symbol='circle',
                    line=dict(width=4, color=style["border_color"]),
                    opacity=opacities
                ),
                text=node_text,
                textposition=text_position_cycle,
                textfont=dict(
                    size=style["font_size"],
                    family="Arial Black" if node_type in ["putar", "pptar"] else "Arial"
                ),
                name=style["legend"],
                showlegend=False
            )
            traces.append(trace)

    return traces


def causeway_page():
    # Add custom CSS for better styling
    st.markdown(
        """
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
    """,
        unsafe_allow_html=True,
    )

    st.markdown(
        '<h1 class="main-header">🛤️ CauseWay</h1>',
        unsafe_allow_html=True,
    )
    st.markdown(
    '<em>CauseWay is intended to serve as an aid for issue-focused strategic research based '
    'loosely on the Center of Gravity (COG) framework. For information on COG analysis visit '
    '<a href="https://irregularpedia.org/index.php/Main_Page" target="_blank">this page</a> '
    'on Irregularpedia.</em>',
    unsafe_allow_html=True
    )

    # Initialize session state
    # initialize_session_state()

    # Create tabs for better organization
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(
        [
            "⚠️ Threat",
            "🎯 Potential Ultimate Targets",
            "💪 Critical Capabilities",
            "⚙️ Critical Requirements",
            "🚩 Proximate Targets",
            "📊 Visualize"
        ]
    )


    with tab1:
        identify_threat()

    with tab2:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>Develop Potential Ultimate Targets</h3>",
            unsafe_allow_html=True
        )
        st.markdown(
            "**Ultimate Targets** are the entities that directly pose a threat to the identified "
            "issue. Degrading an **Ultimate Target's** ability to pose this threat is the overarching "
            "objective."
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

        if st.session_state.get('potential_utars', {}):
            iteration = 1
            for putar in st.session_state.get('potential_utars').keys():
                with st.expander(
                    f"Critical Capabilities for {putar}",
                    expanded=False
                ):
                    identify_capabilites(
                        putar,
                        st.session_state["issue"],
                        st.session_state["location"],
                        st.session_state["threat"],
                        iteration
                    )
                iteration += 1

            # Create three tightly sized columns
            col1, col2, _ = st.columns([0.245, 0.005, 0.75])

            with col1:
                clicked = st.button(
                    "🔄 Normalize Capabilities Across All Entities",
                    key="normalize_all_caps"
                )

            with col2:
                st.markdown(
                    """
                    <div title="Leverages AI to standardize Critical Capability phrasing across entities. 
                    It may be necessary to run this multiple times. Perform QC for best results." 
                    style="cursor: help; font-size: 18px;">
                        ℹ️
                    </div>
                    """,
                    unsafe_allow_html=True
                )

            # Trigger function if clicked
            if clicked:
                normalize_field_across_entities("capabilities")

        else:
            st.info(
            "Please select at least one **Potential Ultimate Target** in Tab 2 (Potential Ultimate Targets)."
            )


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
                "Please select at least one **Potential Ultimate "
                "Target** in Tab 2 (Potential Ultimate Targets)."
            )
        else:
            # === BUTTON PANEL (always appears at top)
            #st.markdown("#### 🎯 Select a PUTAR to develop its Critical Requirements")
            cols = st.columns(4)

            for idx, putar in enumerate(potential_utars.keys()):
                button_col = cols[idx % 4]
                with button_col:
                    if st.button(
                        putar,
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
            
            # Create three tightly sized columns
            col1, col2, _ = st.columns([0.255, 0.005, 0.74])

            with col1:
                clicked = st.button(
                    "🔄 Normalize Requirements Across All Entities",
                    key="normalize_all_reqs"
                )

            with col2:
                st.markdown(
                    """
                    <div title="Leverages AI to standardize Critical Requirement phrasing across entities. 
                    It may be necessary to run this multiple times. Perform QC for best results." 
                    style="cursor: help; font-size: 18px;">
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
        if potential_utars:
            if "open_ptar_panel" not in st.session_state:
                st.session_state["open_ptar_panel"] = None

            with st.container():
                cols = st.columns(4)
                for idx, putar in enumerate(potential_utars.keys()):
                    data = potential_utars[putar]
                    capabilities = data.get("capabilities", {})

                    # if not capabilities:
                    #     continue
                    # if not any(cap_data.get("requirements") for cap_data in capabilities.values()):
                    #     continue

                    button_col = cols[idx % 4]
                    with button_col:
                        if st.button(
                            putar,
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
                        1  # iteration isn't critical anymore under single draw
                    )

        else:
            st.info(
                "Please select at least one **Potential Ultimate "
                "Target** in Tab 2 (Potential Ultimate Targets)."
            )


    with tab6:
        st.markdown(
            "<h3 style='color: #8fbc8f; font-weight: 700;'>COG Network Graph</h3>",
            unsafe_allow_html=True
        )

        potential_utars = st.session_state.get("potential_utars", {})

        if not potential_utars:
            st.info(
                "Select at least one **Potential Ultimate Target** in Tab 2 to begin "
                "building the COG network graph."
            )
        else:
            # Use local variables only — no session_state needed
            col1, col2 = st.columns([1, 1])
            with col1:
                filter_out_reqs = st.checkbox("Hide Requirements", value=False)
            with col2:
                filter_out_caps = st.checkbox("Hide Capabilities", value=False)

            # Build graph using current filter settings
            graph = build_graph(
                potential_utars,
                filter_out_reqs=filter_out_reqs,
                filter_out_caps=filter_out_caps
            )

            pos = nx.spring_layout(graph, seed=42, k=0.25)
            edge_trace = build_edge_trace(graph, pos)
            node_traces = build_node_traces(graph, pos)
            figure = build_figure(edge_trace, node_traces)
            st.plotly_chart(figure, use_container_width=True)


def main():
    causeway_page()


if __name__ == "__main__":
    main()
