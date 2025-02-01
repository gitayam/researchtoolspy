import requests
from bs4 import BeautifulSoup
import json
import streamlit as st
from urllib.parse import urlparse
from utilities.utils_openai import chat_gpt  # GPT helper for fallback

def social_media_fetch_metadata(url, soup):
    """
    Tailored metadata extraction for known social media websites.
    For each platform, we try to extract metadata using platform-specific assumptions.
    
    Args:
        url (str): The URL to scrape.
        soup (BeautifulSoup): Parsed HTML content.
        
    Returns:
        tuple: (title, description, keywords, author, date_published) 
               or (None, None, None, None, None) if this method cannot extract info.
    """
    host = urlparse(url).netloc.lower()
    title = description = keywords = author = date_published = None

    # x.com / Twitter
    if "x.com" in host or "twitter.com" in host:
        og_title = soup.find("meta", property="og:title")
        title = og_title["content"].strip() if og_title and og_title.get("content") else None
        og_description = soup.find("meta", property="og:description")
        description = og_description["content"].strip() if og_description and og_description.get("content") else None
        twitter_creator = soup.find("meta", attrs={"name": "twitter:creator"})
        author = twitter_creator["content"].strip() if twitter_creator and twitter_creator.get("content") else "Twitter User"
        keywords = "No Keywords"
        date_published = "No Date Published"
    
    # Bluesky (bsky)
    elif "bsky.app" in host or "bsky" in host:
        # Bluesky might still use Open Graph tags
        og_title = soup.find("meta", property="og:title")
        title = og_title["content"].strip() if og_title and og_title.get("content") else None
        og_description = soup.find("meta", property="og:description")
        description = og_description["content"].strip() if og_description and og_description.get("content") else None
        author = "Bluesky User"
        keywords = "No Keywords"
        date_published = "No Date Published"

    # Facebook
    elif "facebook.com" in host:
        og_title = soup.find("meta", property="og:title")
        title = og_title["content"].strip() if og_title and og_title.get("content") else None
        og_description = soup.find("meta", property="og:description")
        description = og_description["content"].strip() if og_description and og_description.get("content") else None
        author = "Facebook User"
        keywords = "No Keywords"
        date_published = "No Date Published"

    # Instagram
    elif "instagram.com" in host:
        og_title = soup.find("meta", property="og:title")
        title = og_title["content"].strip() if og_title and og_title.get("content") else None
        og_description = soup.find("meta", property="og:description")
        description = og_description["content"].strip() if og_description and og_description.get("content") else None
        author = "Instagram"
        keywords = "No Keywords"
        date_published = "No Date Published"

    # TikTok
    elif "tiktok.com" in host:
        og_title = soup.find("meta", property="og:title")
        title = og_title["content"].strip() if og_title and og_title.get("content") else None
        og_description = soup.find("meta", property="og:description")
        description = og_description["content"].strip() if og_description and og_description.get("content") else None
        author = "TikTok User"
        keywords = "No Keywords"
        date_published = "No Date Published"

    # YouTube
    elif "youtube.com" in host:
        # YouTube might require using JSON-LD data
        og_title = soup.find("meta", property="og:title")
        title = og_title["content"].strip() if og_title and og_title.get("content") else None
        og_description = soup.find("meta", property="og:description")
        description = og_description["content"].strip() if og_description and og_description.get("content") else None
        author = "YouTube Channel"
        keywords = "No Keywords"
        # Check for published date in JSON-LD
        try:
            scripts = soup.find_all("script", type="application/ld+json")
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, dict) and "uploadDate" in data:
                        date_published = data["uploadDate"]
                        break
                    elif isinstance(data, list):
                        for entry in data:
                            if isinstance(entry, dict) and "uploadDate" in entry:
                                date_published = entry["uploadDate"]
                                break
                        if date_published:
                            break
                except Exception:
                    continue
        except Exception:
            date_published = "No Date Published"

    return title, description, keywords, author, date_published

def advanced_fetch_metadata(url, timeout=10, use_gpt_fallback=True):
    """
    Advanced metadata scraper that performs multiple extraction strategies:
      - If the URL is from a known social media platform, applies a tailored extraction method.
      - Else tries Open Graph, Twitter, standard meta tags, JSON-LD, and the <title> tag.
      - Optionally uses a GPT API as a last resort.
      
    Args:
        url (str): The URL to scrape for metadata.
        timeout (int): Request timeout in seconds.
        use_gpt_fallback (bool): Whether to call GPT to extract metadata if needed.
    
    Returns:
        tuple: (title, description, keywords, author, date_published)
    """
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/90.0.4430.93 Safari/537.36'
        )
    }
    try:
        response = requests.get(url, timeout=timeout, headers=headers)
        response.raise_for_status()
    except Exception as e:
        st.error(f"Error fetching URL metadata: {e}")
        return "No Title", "No Description", "No Keywords", "No Author", "No Date Published"

    soup = BeautifulSoup(response.content, "lxml")
    
    # First, try platform-specific extraction if applicable.
    host = urlparse(url).netloc.lower()
    social_media_hosts = ["x.com", "twitter.com", "bsky.app", "facebook.com", "instagram.com", "tiktok.com", "youtube.com"]
    if any(sm in host for sm in social_media_hosts):
        sm_title, sm_description, sm_keywords, sm_author, sm_date = social_media_fetch_metadata(url, soup)
        if sm_title or sm_description:
            # Use the social media extraction if at least one is found.
            title = sm_title if sm_title else "No Title"
            description = sm_description if sm_description else "No Description"
            keywords = sm_keywords if sm_keywords else "No Keywords"
            author = sm_author if sm_author else "No Author"
            date_published = sm_date if sm_date else "No Date Published"
            return title, description, keywords, author, date_published

    # If no platform-specific metadata, use generic extraction.
    title = description = keywords = author = date_published = None

    # 1. Check for Open Graph metadata.
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    og_description = soup.find("meta", property="og:description")
    if og_description and og_description.get("content"):
        description = og_description["content"].strip()
    
    # 2. Check for Twitter card tags if needed.
    if not title:
        twitter_title = soup.find("meta", attrs={"name": "twitter:title"})
        if twitter_title and twitter_title.get("content"):
            title = twitter_title["content"].strip()
    if not description:
        twitter_description = soup.find("meta", attrs={"name": "twitter:description"})
        if twitter_description and twitter_description.get("content"):
            description = twitter_description["content"].strip()
    
    # 3. Fallback to standard meta tags and <title> tag.
    if not title:
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        else:
            title = "No Title"
    if not description:
        meta_description = soup.find("meta", attrs={"name": "description"})
        if meta_description and meta_description.get("content"):
            description = meta_description["content"].strip()
        else:
            description = "No Description"
            
    meta_keywords = soup.find("meta", attrs={"name": "keywords"})
    keywords = meta_keywords["content"].strip() if meta_keywords and meta_keywords.get("content") else "No Keywords"
    
    meta_author = soup.find("meta", attrs={"name": "author"})
    author = meta_author["content"].strip() if meta_author and meta_author.get("content") else "No Author"
    
    meta_date = soup.find("meta", attrs={"name": "datePublished"})
    if meta_date and meta_date.get("content"):
        date_published = meta_date["content"].strip()
    else:
        # Also check JSON-LD structured data for published date.
        try:
            scripts = soup.find_all("script", type="application/ld+json")
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, dict) and "datePublished" in data:
                        date_published = data["datePublished"]
                        break
                    elif isinstance(data, list):
                        for entry in data:
                            if isinstance(entry, dict) and "datePublished" in entry:
                                date_published = entry["datePublished"]
                                break
                        if date_published:
                            break
                except Exception:
                    continue
        except Exception:
            pass
        
        if not date_published:
            date_published = "No Date Published"
    
    # If metadata is still missing, consider using GPT fallback.
    if use_gpt_fallback and (title == "No Title" or description == "No Description"):
        try:
            snippet = soup.get_text()[:2000]  # use only first 2000 characters to keep prompt size small
            gpt_prompt = (
                "Extract the title and meta description from the following HTML text. "
                "Return the result as JSON with two keys: 'title' and 'description'.\n\n"
                f"{snippet}\n\n"
                "If not found, return 'No Title' and 'No Description' as values."
            )
            gpt_response = chat_gpt([{"role": "user", "content": gpt_prompt}], model="gpt-4")
            if gpt_response and gpt_response.strip():
                try:
                    result = json.loads(gpt_response)
                    title = result.get("title", title)
                    description = result.get("description", description)
                except Exception as parse_error:
                    st.warning(
                        f"GPT fallback response parsing failure: {parse_error}. "
                        f"GPT response was: {gpt_response}"
                    )
            else:
                # This warning will be shown if GPT returns an empty or whitespace response.
                st.warning(f"GPT fallback returned an empty response: {repr(gpt_response)}")
        except Exception as e:
            st.warning(f"GPT fallback failed or returned invalid response: {e}")
    return title, description, keywords, author, date_published 