# /researchtools_streamlit/pages/ImageSearch.py

import streamlit as st
import hashlib
import requests

def hash_image(url):
    try:
        resp = requests.get(url)
        resp.raise_for_status()
        image_bytes = resp.content
        sha256_hash = hashlib.sha256(image_bytes).hexdigest()
        return sha256_hash
    except:
        return None

def image_search_page():
    st.header("Image Search & Hashing")
    image_urls = st.text_area("Enter image URLs separated by commas")

    if st.button("Hash & Generate Queries"):
        urls = [u.strip() for u in image_urls.split(",") if u.strip()]
        hashes = []
        for u in urls:
            h = hash_image(u)
            if h:
                hashes.append(h)
        if hashes:
            # Example logic to generate a combined query
            result_query = " OR ".join([f"\"{h}\"" for h in hashes])
            st.write("Generated Query:")
            st.code(result_query)
        else:
            st.warning("No valid hashes were generated.")

def main():
    image_search_page()

if __name__ == "__main__":
    main()