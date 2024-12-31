# /researchtools_streamlit/pages/Home.py

import streamlit as st
import requests
from utils_openai import generate_advanced_query
from utils_conversion import convert_input

def home_page():
    st.header("Home: CSV/JSON Conversion & Advanced Queries")

    # The main text input for CSV/JSON
    input_text = st.text_area("Paste your CSV/JSON here", height=150)

    # Format selection
    selected_format = st.selectbox("Select Format", ["Comma Separated", "JSON", "Social Media Download", "Advanced Query"], index=0)

    # Options
    remove_quotes = st.checkbox("Remove quotes", value=True)
    remove_hashtags = st.checkbox("Remove hashtags", value=False)
    remove_top_row = st.checkbox("Remove top row", value=True)
    process_limit = st.number_input("Number of Values to Process", min_value=0, value=0, step=1)

    # JSON-specific
    json_option = st.selectbox("JSON Option", ["Custom", "Keyword", "Location", "Image"], index=0 if selected_format == "JSON" else 0)
    json_attribute = ""
    if selected_format == "JSON" and json_option == "Custom":
        json_attribute = st.text_input("JSON attribute (if Custom)", value="")

    # Advanced Query-specific
    search_platform = None
    model = None
    if selected_format == "Advanced Query":
        search_platform = st.selectbox("Search Platform", ["Google", "Microsoft Portal", "Windows CMD Search"], index=0)
        model = st.selectbox("OpenAI Model", ["gpt-3.5-turbo", "gpt-4"], index=0)

    # File upload
    file_data = st.file_uploader("Upload CSV/JSON file(s)", accept_multiple_files=True)
    if file_data:
        combined_lines = []
        for uploaded_file in file_data:
            text_str = uploaded_file.read().decode("utf-8", errors="ignore")
            lines = text_str.split("\n")
            if remove_top_row and len(lines) > 1:
                lines = lines[1:]
            combined_lines.extend(lines)
        combined_lines = list(dict.fromkeys(combined_lines))  # deduplicate
        input_text = "\n".join(combined_lines)

    # Social Media Download example
    if selected_format == "Social Media Download":
        st.write("Enter a social media URL in the text area above.")
        if st.button("Download Social Media"):
            try:
                # Example request; you'd adapt to your real endpoint
                resp = requests.post("http://yourserver/download_social_media", json={"url": input_text})
                st.write(resp.json())
            except Exception as e:
                st.error(f"Error: {e}")

    output = ""
    if st.button("Process Data"):
        if selected_format == "Advanced Query":
            try:
                output = generate_advanced_query(input_text, search_platform, model)
            except Exception as e:
                output = f"Error generating advanced query: {e}"
        else:
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

    # Display output
    if output:
        st.subheader("Output")
        st.text_area("Processed Output", value=output, height=150)
        st.download_button("Save Output", data=output, file_name="output.txt")

def main():
    home_page()

if __name__ == "__main__":
    main()