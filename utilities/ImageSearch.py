# /utilities/ImageSearch.py

import streamlit as st
import hashlib
import requests
import imagehash
from PIL import Image
import io
from typing import Dict, Optional

def hash_image(url):
    try:
        resp = requests.get(url)
        resp.raise_for_status()
        image_bytes = resp.content
        sha256_hash = hashlib.sha256(image_bytes).hexdigest()
        return sha256_hash
    except:
        return None

def calculate_image_hash(image_path: str) -> Optional[str]:
    """
    Calculate a perceptual hash for an image.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        The image hash as a string, or None if there was an error
    """
    try:
        # Open the image
        img = Image.open(image_path)
        
        # Calculate the average hash
        hash_value = imagehash.average_hash(img)
        
        return str(hash_value)
    except Exception as e:
        st.error(f"Error calculating image hash: {e}")
        return None

def generate_search_urls(image_hash: str) -> Dict[str, str]:
    """
    Generate URLs for reverse image search engines using the image hash.
    
    Args:
        image_hash: The hash of the image
        
    Returns:
        A dictionary of search engine names and their search URLs
    """
    search_urls = {
        "google": f"https://www.google.com/search?q={image_hash}&tbm=isch",
        "yandex": f"https://yandex.com/images/search?text={image_hash}",
        "bing": f"https://www.bing.com/images/search?q={image_hash}",
        "tineye": f"https://tineye.com/search?q={image_hash}"
    }
    
    return search_urls

def image_search_page():
    st.header("Image Hashing")
    st.write("Enter image URLs or upload images to hash them.")
    
    # Image URL input
    image_urls = st.text_area("Enter image URLs separated by commas", height=100)
    
    # Image file upload
    uploaded_images = st.file_uploader(
        "Upload image files to hash",
        type=["png", "jpg", "jpeg"],
        accept_multiple_files=True
    )
    
    if st.button("Hash Images"):
        hashes = []
        
        # Hash URLs
        if image_urls:
            urls = [u.strip() for u in image_urls.split(",") if u.strip()]
            for u in urls:
                h = hash_image(u)
                if h:
                    hashes.append(h)
        
        # Hash uploaded images
        for image in uploaded_images:
            image_bytes = image.read()
            h = hashlib.sha256(image_bytes).hexdigest()
            hashes.append(h)
        
        if hashes:
            st.write("Generated Hashes:")
            for h in hashes:
                st.code(h)
        else:
            st.warning("No valid hashes were generated.")

def image_hash_page():
    st.title("Image Hash Generator")
    st.write("This tool generates perceptual hashes for images to help with similarity searches.")
    
    # File upload
    uploaded_file = st.file_uploader("Upload an image", type=["jpg", "jpeg", "png"])
    
    # Hash type selection
    hash_type = st.selectbox("Select hash type:", ["Average Hash", "Perceptual Hash", "Difference Hash", "Wavelet Hash"])
    
    if uploaded_file is not None:
        st.image(uploaded_file, caption="Uploaded Image", use_column_width=True)
        
        if st.button("Generate Hash"):
            st.success("Hash generation placeholder - functionality coming soon!")
            st.code(f"Image hash would appear here")

def main():
    image_search_page()

if __name__ == "__main__":
    main()