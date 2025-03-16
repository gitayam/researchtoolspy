# /utilities/ImageSearch.py

import streamlit as st
import hashlib
import requests
import os
import io
from PIL import Image
import importlib.util
from typing import Dict, Optional

# Check if imagehash is installed
imagehash_installed = importlib.util.find_spec("imagehash") is not None

if imagehash_installed:
    import imagehash
else:
    # Create a placeholder for the imagehash module
    class DummyImagehash:
        def average_hash(self, *args, **kwargs):
            return "imagehash_not_installed"
    
    imagehash = DummyImagehash()

def hash_image(url):
    try:
        resp = requests.get(url)
        resp.raise_for_status()
        image_bytes = resp.content
        sha256_hash = hashlib.sha256(image_bytes).hexdigest()
        return sha256_hash
    except:
        return None

def calculate_image_hash(image_path):
    """Calculate the average hash of an image."""
    if not imagehash_installed:
        st.error("The 'imagehash' module is not installed. Please run 'pip install imagehash' to use this feature.")
        return None
    
    try:
        img = Image.open(image_path)
        hash_value = imagehash.average_hash(img)
        return hash_value
    except Exception as e:
        st.error(f"Error calculating image hash: {e}")
        return None

def generate_search_urls(hash_value):
    """Generate search URLs for reverse image search."""
    if not hash_value:
        return {}
    
    hash_str = str(hash_value)
    
    # Generate search URLs for different search engines
    search_urls = {
        "Google": f"https://www.google.com/search?q={hash_str}",
        "Bing": f"https://www.bing.com/search?q={hash_str}",
        "Yandex": f"https://yandex.com/search/?text={hash_str}",
        "TinEye": f"https://tineye.com/search?url={hash_str}"
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
    """Streamlit page for image hashing."""
    st.subheader("Image Hash Generator")
    
    if not imagehash_installed:
        st.error("The 'imagehash' module is not installed. Please run 'pip install imagehash' to use this feature.")
        st.info("You can install it by running: `pip install imagehash`")
        return
    
    uploaded_file = st.file_uploader("Upload an image", type=["jpg", "jpeg", "png"])
    
    if uploaded_file is not None:
        # Display the uploaded image
        image = Image.open(uploaded_file)
        st.image(image, caption="Uploaded Image", use_column_width=True)
        
        # Save the uploaded file to a temporary location
        temp_path = "temp_image.jpg"
        with open(temp_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        
        # Calculate the image hash
        hash_value = calculate_image_hash(temp_path)
        
        if hash_value:
            st.success(f"Image hash calculated: {hash_value}")
            
            # Generate search URLs
            search_urls = generate_search_urls(hash_value)
            
            # Display search URLs
            st.subheader("Search URLs")
            for engine, url in search_urls.items():
                st.markdown(f"[{engine}]({url})")
            
            # Clean up the temporary file
            os.remove(temp_path)

def main():
    image_search_page()

if __name__ == "__main__":
    main()