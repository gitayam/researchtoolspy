# /researchtools_streamlit/pages/WaybackTool.py

import streamlit as st
import requests

def wayback_tool_page():
    st.header("Wayback Machine Archive Tool")
    url = st.text_input("Enter URL to archive", "")
    if st.button("Archive URL"):
        try:
            resp = requests.post(f"https://web.archive.org/save/{url}")
            if resp.status_code == 200:
                st.write("Archived URL (request URL):")
                st.write(resp.url)
            else:
                st.write("Failed to archive the URL")
        except Exception as e:
            st.write(f"Error occurred: {e}")

def main():
    wayback_tool_page()

if __name__ == "__main__":
    main()