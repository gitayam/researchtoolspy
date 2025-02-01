# /pages/Transformers.py
import streamlit as st
import requests
from utilities.utils_openai import generate_advanced_query
from utilities.utils_conversion import convert_input
from sidebar_menu import sidebar_menu
from utilities.search_generator import advanced_query_options
from utilities.ImageSearch import image_search_page
from utilities.WaybackTool import wayback_tool_page
from utilities.social_media_download import social_media_download_page

def transformers_page():
    st.header("Text Transformation Tools")
    with st.expander("About This Page", expanded=False):
        st.write("""
        This page allows you to:
        - **Paste or upload** CSV/JSON data and convert it in various ways (Comma Separated, JSON, Social Media Download).
        - Generate **Advanced Queries** for search platforms (Google, Microsoft Portal, or Windows CMD) using an OpenAI model.
        - **Hash images** and generate search queries.
        - **Archive URLs** using the Wayback Machine.
        """)
    sidebar_menu()

    # Choose format
    st.subheader("Select Format / Action")
    format_options = [
        "List to JSON", 
        "JSON to List", 
        "Social Media Download", 
        "Advanced Query", 
        "Image to Hash", 
        "Process URLs",
    ]
    selected_format = st.selectbox(
        "Select how to process your data:",
        format_options,
        index=0
    )

    # Initialize variables
    remove_quotes = False
    remove_hashtags = False
    remove_top_row = False
    process_limit = 0
    json_option = None
    json_attribute = None

    # Conditional display based on chosen format
    if selected_format == "List to JSON":
        st.subheader("List - JSON Conversion")
        input_text = st.text_area(
            "Paste your data here:",
            height=150,
            help="Enter the data you want to process."
        )
        
        # Compact layout for options
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            remove_quotes = st.checkbox("Remove quotes", value=True, help="Remove all double quotes from lines.")
            remove_hashtags = st.checkbox("Remove hashtags", value=False, help="Remove # symbols.")
        with col2:
            remove_top_row = st.checkbox("Remove top row", value=True, help="Skip the first line if it's a header.")
            process_limit = st.number_input(
                "Values to Process",
                min_value=0,
                value=0,
                step=1,
                help="Limit the output to this many rows/values."
            )
        with col3:
            json_option = st.selectbox(
                "JSON Option",
                ["Default", "Custom", "Location"],
                index=0,
                help="Choose how the JSON should be structured."
            )
            if json_option == "Custom":
                json_attribute = st.text_input(
                    "Custom JSON Attribute",
                    help="Enter the attribute name for your custom JSON structure."
                )

    elif selected_format == "JSON to List":
        st.subheader("JSON - List Conversion")
        input_text = st.text_area(
            "Paste your JSON data here:",
            height=150,
            help="Enter the JSON data you want to convert to a list."
        )

    if selected_format == "Advanced Query":
        st.subheader("Advanced Query Options")
        search_platform, model = advanced_query_options()

    if selected_format == "Social Media Download":
        social_media_download_page()

    if selected_format == "Image to Hash":
        image_search_page()

    if selected_format == "Process URLs":
        wayback_tool_page()

    # File upload (excluded for certain options)
    if selected_format not in ["Advanced Query", "Image to Hash", "Process URLs"]:
        st.subheader("Optional: Upload CSV/JSON File(s)")
        file_data = st.file_uploader(
            "Upload one or more CSV/JSON files. Their contents will be appended below.",
            accept_multiple_files=True
        )

        if file_data:
            combined_lines = []
            for uploaded_file in file_data:
                try:
                    text_str = uploaded_file.read().decode("utf-8", errors="ignore")
                except Exception as e:
                    st.error(f"Error reading file: {e}")
                    continue

                lines = text_str.split("\n")
                if remove_top_row and len(lines) > 1:
                    lines = lines[1:]  # skip header
                combined_lines.extend(lines)

            # Deduplicate
            combined_lines = list(dict.fromkeys(combined_lines))
            input_text = "\n".join(combined_lines)

        if file_data:
            st.info("Uploaded file contents appended to the text above.")
            st.text_area("Consolidated Input from Files:", value=input_text, height=150)
    else:
        # If not handling input_text, define it as empty to avoid reference errors
        input_text = ""

    # Process data
    if st.button("Process Data"):
        output = ""
        if selected_format == "Advanced Query":
            try:
                # If you’re storing the query in session_state:
                search_query = st.session_state.get("search_query", "")
                output = generate_advanced_query(search_query, search_platform, model)
            except Exception as e:
                st.error(f"Error generating advanced query: {e}")
        elif selected_format == "List to JSON":
            output = convert_input(
                input_data=input_text,
                format_type=selected_format,
                json_option=json_option,
                json_attribute=json_attribute,
                remove_quotes=remove_quotes,
                remove_hashtags=remove_hashtags,
                remove_top_row=remove_top_row,
                process_limit=process_limit
            )
        elif selected_format == "JSON to List":
            output = convert_input(
                input_data=input_text,
                format_type=selected_format
            )

        if output:
            st.subheader("Output")
            st.text_area(
                "Processed Output",
                value=output,
                height=150,
                help="Here is the result of your data processing."
            )
            st.download_button(
                "Save Output",
                data=output,
                file_name="output.txt",
                mime="text/plain"
            )

def main():
    transformers_page()

if __name__ == "__main__":
    main()