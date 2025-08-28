import streamlit as st
from typing import Dict, List, Any, Optional, Union, Callable, Tuple
import json
from datetime import datetime

def create_form_section(title: str, description: str = "", expanded: bool = True):
    """Create a consistent form section with title and optional description"""
    st.subheader(title)
    if description:
        st.markdown(description)
    return st.expander("Show/Hide Section", expanded=expanded)

def create_ai_assisted_input(
    label: str,
    key: str,
    ai_button_label: str = "AI: Suggest",
    ai_function: Optional[Callable] = None,
    ai_params: Dict[str, Any] = None,
    placeholder: str = "",
    help_text: str = "",
    height: int = 150
) -> str:
    """Create a text area with an AI suggestion button"""
    if key not in st.session_state:
        st.session_state[key] = ""
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        value = st.text_area(
            label=label,
            value=st.session_state[key],
            placeholder=placeholder,
            help=help_text,
            height=height,
            key=f"{key}_input"
        )
        st.session_state[key] = value
    
    with col2:
        if st.button(ai_button_label, key=f"{key}_ai_button"):
            if ai_function:
                try:
                    with st.spinner("Generating suggestion..."):
                        suggestion = ai_function(**(ai_params or {}))
                        if suggestion:
                            # Append the suggestion to the existing text
                            if st.session_state[key]:
                                st.session_state[key] += f"\n{suggestion}"
                            else:
                                st.session_state[key] = suggestion
                            st.rerun()
                except Exception as e:
                    st.error(f"Error generating suggestion: {e}")
            else:
                st.warning("AI suggestion function not provided")
    
    return value

def create_multi_field_form(
    form_id: str,
    fields: List[Dict[str, Any]],
    submit_label: str = "Submit",
    on_submit: Optional[Callable] = None,
    validation: Optional[Callable] = None
) -> Tuple[bool, Dict[str, Any]]:
    """Create a form with multiple fields and validation"""
    with st.form(form_id):
        field_values = {}
        
        for field in fields:
            field_type = field.get("type", "text_input")
            label = field.get("label", "")
            key = field.get("key", "")
            help_text = field.get("help", "")
            placeholder = field.get("placeholder", "")
            options = field.get("options", None)
            
            # Extract additional kwargs
            kwargs = {k: v for k, v in field.items() 
                     if k not in ["type", "label", "key", "help", "placeholder", "options"]}
            
            # Render the appropriate field type
            if field_type == "text_input":
                field_values[key] = st.text_input(
                    label=label, key=key, help=help_text, 
                    placeholder=placeholder, **kwargs
                )
            elif field_type == "text_area":
                field_values[key] = st.text_area(
                    label=label, key=key, help=help_text, 
                    placeholder=placeholder, **kwargs
                )
            elif field_type == "selectbox":
                if not options:
                    raise ValueError(f"Options must be provided for selectbox field '{label}'")
                field_values[key] = st.selectbox(
                    label=label, options=options, key=key, 
                    help=help_text, **kwargs
                )
            elif field_type == "multiselect":
                if not options:
                    raise ValueError(f"Options must be provided for multiselect field '{label}'")
                field_values[key] = st.multiselect(
                    label=label, options=options, key=key, 
                    help=help_text, **kwargs
                )
            elif field_type == "slider":
                field_values[key] = st.slider(
                    label=label, key=key, help=help_text, **kwargs
                )
            elif field_type == "checkbox":
                field_values[key] = st.checkbox(
                    label=label, key=key, help=help_text, **kwargs
                )
            elif field_type == "radio":
                if not options:
                    raise ValueError(f"Options must be provided for radio field '{label}'")
                field_values[key] = st.radio(
                    label=label, options=options, key=key, 
                    help=help_text, **kwargs
                )
            else:
                st.warning(f"Unsupported field type: {field_type}")
        
        submitted = st.form_submit_button(submit_label)
        
        if submitted:
            # Perform validation if provided
            if validation:
                is_valid, errors = validation(field_values)
                if not is_valid:
                    for error in errors:
                        st.error(error)
                    return False, field_values
            
            # Call on_submit callback if provided
            if on_submit:
                on_submit(field_values)
        
        return submitted, field_values

def validate_required_fields(values: Dict[str, Any], required_fields: List[str]) -> Tuple[bool, List[str]]:
    """Validate that required fields are not empty"""
    errors = []
    
    for field in required_fields:
        if field not in values or not values[field]:
            errors.append(f"Field '{field}' is required")
    
    return len(errors) == 0, errors

def create_import_export_section(
    export_function: Callable[[], str],
    import_function: Callable[[str], bool],
    filename_prefix: str = "analysis"
):
    """Create a section for importing and exporting analysis data"""
    st.subheader("Import/Export Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Export Analysis")
        export_format = st.selectbox(
            "Export Format",
            ["JSON", "Text"],
            key="export_format"
        )
        
        if st.button("Export Analysis", key="export_button"):
            try:
                data = export_function()
                if export_format == "JSON":
                    mime_type = "application/json"
                    file_ext = "json"
                else:
                    mime_type = "text/plain"
                    file_ext = "txt"
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{filename_prefix}_{timestamp}.{file_ext}"
                
                st.download_button(
                    label="Download Analysis",
                    data=data,
                    file_name=filename,
                    mime=mime_type,
                    key="download_analysis"
                )
            except Exception as e:
                st.error(f"Error exporting analysis: {e}")
    
    with col2:
        st.markdown("### Import Analysis")
        uploaded_file = st.file_uploader(
            "Upload Analysis File",
            type=["json", "txt"],
            key="import_file"
        )
        
        if uploaded_file is not None:
            try:
                content = uploaded_file.getvalue().decode("utf-8")
                if st.button("Import Analysis", key="import_button"):
                    success = import_function(content)
                    if success:
                        st.success("Analysis imported successfully!")
                        st.rerun()
                    else:
                        st.error("Failed to import analysis. Please check the file format.")
            except Exception as e:
                st.error(f"Error importing analysis: {e}")

def create_tabbed_interface(tabs: List[Dict[str, Any]]):
    """Create a tabbed interface with consistent styling"""
    tab_objects = st.tabs([tab["title"] for tab in tabs])
    
    for i, tab in enumerate(tabs):
        with tab_objects[i]:
            if "content" in tab and callable(tab["content"]):
                tab["content"]()
            elif "content" in tab:
                st.markdown(tab["content"])
