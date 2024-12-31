# /researchtools_streamlit/pages/Home.py

import streamlit as st
import requests
from utils_openai import generate_advanced_query
from utils_conversion import convert_input
from sidebar_menu import sidebar_menu

def home_page():
    st.header("Home: CSV/JSON Conversion & Advanced Queries")
    st.write("""
    This page allows you to:
    - **Paste or upload** CSV/JSON data and convert it in various ways (Comma Separated, JSON, Social Media Download).
    - Generate **Advanced Queries** for search platforms (Google, Microsoft Portal, or Windows CMD) using an OpenAI model.
    """)
    sidebar_menu()
    # -----------------------------
    # 1) MAIN INPUT TEXT
    # -----------------------------
    input_text = st.text_area(
        "Paste your CSV/JSON here:",
        height=150,
        help="Enter the data you want to convert, or supply a social media URL if needed."
    )

    # -----------------------------
    # 2) CHOOSE FORMAT
    # -----------------------------
    st.subheader("Select Format / Action")
    format_options = ["Comma Separated", "JSON", "Social Media Download", "Advanced Query"]
    selected_format = st.selectbox(
        "Select how to process your data:",
        format_options,
        index=0
    )

    # -----------------------------
    # 3) GENERAL OPTIONS
    # -----------------------------
    st.subheader("Processing Options")

    remove_quotes = st.checkbox("Remove quotes", value=True, help="Remove all double quotes from lines.")
    remove_hashtags = st.checkbox("Remove hashtags", value=False, help="Remove # symbols.")
    remove_top_row = st.checkbox("Remove top row", value=True, help="Skip the first line if it's a header.")
    process_limit = st.number_input(
        "Number of Values to Process",
        min_value=0,
        value=0,
        step=1,
        help="If > 0, limit the output to this many rows/values."
    )

    # -----------------------------
    # 4) JSON-SPECIFIC OPTIONS
    # -----------------------------
    json_option = "Custom"
    json_attribute = ""
    if selected_format == "JSON":
        st.write("**JSON Options**")
        json_option = st.selectbox(
            "JSON Option",
            ["Custom", "Keyword", "Location", "Image"],
            help=(
                "Choose a pre-set JSON generation style, or 'Custom' to specify your own JSON attribute name."
            )
        )
        if json_option == "Custom":
            json_attribute = st.text_input("JSON attribute (if 'Custom'): ", value="")

    # -----------------------------
    # 5) ADVANCED QUERY OPTIONS
    # -----------------------------
    search_platform = None
    model = None
    if selected_format == "Advanced Query":
        st.write("**Advanced Query Options**")
        search_platform = st.selectbox(
            "Search Platform",
            ["Google", "Microsoft Portal", "Windows CMD Search"],
            help="Which platform's advanced query format to generate."
        )
        model = st.selectbox(
            "OpenAI Model",
            ["gpt-4o", "gpt-4o-mini"],
            help="Which model to use for generating the advanced query."
        )

    # -----------------------------
    # 6) FILE UPLOAD
    # -----------------------------
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

        # Deduplicate lines
        combined_lines = list(dict.fromkeys(combined_lines))
        # Combine into one text block
        input_text = "\n".join(combined_lines)

    # Show updated input_text after upload
    if file_data:
        st.info("Uploaded file contents appended to the text above.")
        st.text_area("Consolidated Input from Files:", value=input_text, height=150)

    # -----------------------------
    # 7) SOCIAL MEDIA DOWNLOAD
    # -----------------------------
    if selected_format == "Social Media Download":
        st.write("**Social Media Download**")
        st.write("If your data input is a social media URL, click below to download its content.")
        if st.button("Download Social Media"):
            try:
                # This is an example endpoint—adjust to your real server or API
                resp = requests.post("http://yourserver/download_social_media", json={"url": input_text})
                st.write(resp.json())
            except Exception as e:
                st.error(f"Error calling social media endpoint: {e}")

    # -----------------------------
    # 8) PROCESS DATA
    # -----------------------------
    output = ""
    if st.button("Process Data"):
        # If advanced query
        if selected_format == "Advanced Query":
            try:
                output = generate_advanced_query(input_text, search_platform, model)
            except Exception as e:
                st.error(f"Error generating advanced query: {e}")
        else:
            # Use the generic converter for CSV/JSON
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

    # -----------------------------
    # 9) DISPLAY OUTPUT
    # -----------------------------
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
    home_page()

if __name__ == "__main__":
    main()