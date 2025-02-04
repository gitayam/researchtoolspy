import requests
from bs4 import BeautifulSoup
import json
import streamlit as st
from urllib.parse import urlparse
import logging
import time
import concurrent.futures

# Optionally use Playwright for dynamic pages
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

from utilities.gpt import chat_gpt  # GPT helper for fallback

logging.basicConfig(level=logging.INFO)


def get_meta_content(soup, attr, value):
    """
    Helper to extract and clean meta tag content.
    """
    try:
        tag = soup.find("meta", {attr: value})
        if tag and tag.get("content"):
            return tag.get("content").strip()
    except Exception as e:
        logging.error(f"Error in get_meta_content for {attr}={value}: {e}")
    return None


def extract_author_from_json_ld(soup):
    """
    Attempts to extract the author (or creator) from JSON-LD data.
    Searches for keys "author" or "creator" and returns the first available "name".
    """
    try:
        scripts = soup.find_all("script", type="application/ld+json")
        for script in scripts:
            if not script.string:
                continue
            try:
                data = json.loads(script.string)
            except json.JSONDecodeError as e:
                logging.debug(f"JSON decode error: {e}")
                continue

            def parse_author(value):
                if isinstance(value, dict) and "name" in value:
                    return value["name"].strip()
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and "name" in item:
                            return item["name"].strip()
                return None

            if isinstance(data, dict):
                for key in ["author", "creator"]:
                    if key in data:
                        name = parse_author(data[key])
                        if name:
                            return name
            elif isinstance(data, list):
                for entry in data:
                    for key in ["author", "creator"]:
                        if key in entry:
                            name = parse_author(entry[key])
                            if name:
                                return name
    except Exception as e:
        logging.debug(f"Error in extract_author_from_json_ld: {e}")
    return None


def social_media_fetch_metadata(url, soup):
    """
    Platform-specific metadata extraction for known social media websites.
    Returns a tuple: (title, description, keywords, author, date_published)
    """
    host = urlparse(url).netloc.lower()
    title = description = keywords = author = date_published = None

    try:
        if "x.com" in host or "twitter.com" in host:
            title = get_meta_content(soup, "property", "og:title")
            description = get_meta_content(soup, "property", "og:description")
            author = get_meta_content(soup, "name", "twitter:creator")
            date_published = get_meta_content(soup, "name", "date")
            keywords = "No Keywords"
        elif "bsky.app" in host or "bsky" in host:
            title = get_meta_content(soup, "property", "og:title")
            description = get_meta_content(soup, "property", "og:description")
            author = get_meta_content(soup, "name", "author")
            date_published = get_meta_content(soup, "name", "date")
            keywords = "No Keywords"
        elif "facebook.com" in host:
            title = get_meta_content(soup, "property", "og:title")
            description = get_meta_content(soup, "property", "og:description")
            author = get_meta_content(soup, "name", "author")
            date_published = get_meta_content(soup, "name", "date")
            keywords = "No Keywords"
        elif "instagram.com" in host:
            title = get_meta_content(soup, "property", "og:title")
            description = get_meta_content(soup, "property", "og:description")
            author = get_meta_content(soup, "name", "author")
            date_published = get_meta_content(soup, "name", "date")
            keywords = "No Keywords"
        elif "tiktok.com" in host:
            title = get_meta_content(soup, "property", "og:title")
            description = get_meta_content(soup, "property", "og:description")
            author = get_meta_content(soup, "name", "author")
            date_published = get_meta_content(soup, "name", "date")
            keywords = "No Keywords"
        elif "youtube.com" in host:
            title = get_meta_content(soup, "property", "og:title")
            description = get_meta_content(soup, "property", "og:description")
            author = get_meta_content(soup, "name", "author")
            # Extract published date from JSON-LD
            scripts = soup.find_all("script", type="application/ld+json")
            for script in scripts:
                try:
                    if script.string:
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
                except Exception as ex:
                    logging.debug(f"JSON-LD parsing error in YouTube extraction: {ex}")
            keywords = "No Keywords"
    except Exception as e:
        logging.error(f"Error during social media extraction for {url}: {e}")

    # Fallback: if author is still missing, try JSON-LD extraction.
    if not author:
        json_ld_author = extract_author_from_json_ld(soup)
        if json_ld_author:
            author = json_ld_author

    return title, description, keywords, author, date_published


def fetch_page_content(url, timeout=10, use_playwright=False):
    """
    Fetch page content using requests. If use_playwright is True and requests fails,
    fallback to using Playwright (if available).
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
        return response.content
    except Exception as e:
        logging.error(f"Error fetching URL with requests: {e}")
        if use_playwright and PLAYWRIGHT_AVAILABLE:
            try:
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page()
                    page.goto(url, wait_until="networkidle")
                    content = page.content()
                    browser.close()
                    return content
            except Exception as pe:
                logging.error(f"Error fetching URL with Playwright: {pe}")
        raise e


def extract_links_from_content(soup, url):
    # Focus on links within main content areas
    main_content = soup.find('article') or soup.find('div', class_='main-content') or soup.find('section')

    if main_content:
        # Extract links from the main content area only
        referenced_links = [
            a['href'] for a in main_content.find_all('a', href=True)
            if a['href'].startswith('http') and a['href'] != url
            and not any(keyword in a['href'].lower() for keyword in ["login", "subscribe", "subscription"])
        ]
    else:
        referenced_links = []

    return referenced_links


def advanced_fetch_metadata(url, timeout=10, use_gpt_fallback=True):
    """
    Advanced metadata scraper using multiple strategies:
      - Uses platform-specific extraction for known social media URLs.
      - Otherwise uses Open Graph, Twitter cards, standard meta tags, JSON-LD,
        and content from <article>.
      - Optionally calls a GPT API as a fallback.
    
    Returns:
        tuple: (title, description, keywords, author, date_published, editor, referenced_links)
    """
    try:
        content = fetch_page_content(url, timeout=timeout, use_playwright=True)
    except Exception as e:
        st.error(f"Error fetching URL content: {e}")
        logging.error(f"Error fetching URL content {url}: {e}")
        return "No Title", "No Description", "No Keywords", "No Author", "No Date Published", "No Editor", []

    soup = BeautifulSoup(content, "lxml")
    host = urlparse(url).netloc.lower()
    social_media_hosts = [
        "x.com", "twitter.com", "bsky.app",
        "facebook.com", "instagram.com", "tiktok.com", "youtube.com"
    ]

    # Use social media extraction if applicable.
    if any(sm in host for sm in social_media_hosts):
        sm_title, sm_description, sm_keywords, sm_author, sm_date = social_media_fetch_metadata(url, soup)
        if sm_title or sm_description:
            return (
                sm_title if sm_title else "No Title",
                sm_description if sm_description else "No Description",
                sm_keywords if sm_keywords else "No Keywords",
                sm_author if sm_author else "No Author",
                sm_date if sm_date else "No Date Published",
                "No Editor",
                []  # No referenced links for social media
            )

    # --- Generic extraction ---
    title = get_meta_content(soup, "property", "og:title")
    description = get_meta_content(soup, "property", "og:description")

    # Try Twitter card fallback if OG tags are missing.
    if not title:
        title = get_meta_content(soup, "name", "twitter:title")
    if not description:
        description = get_meta_content(soup, "name", "twitter:description")

    # Fallback to the <title> tag or <h1> in an <article>.
    if not title:
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        else:
            article = soup.find("article")
            if article:
                h1 = article.find("h1")
                if h1:
                    title = h1.get_text().strip()
        title = title if title else "No Title"

    # Fallback for description: use standard meta or first <p> in <article>.
    if not description:
        description = get_meta_content(soup, "name", "description")
        if not description:
            article = soup.find("article")
            if article:
                p = article.find("p")
                if p:
                    description = p.get_text().strip()[:200]
        description = description if description else "No Description"

    # Keywords extraction.
    meta_keywords = get_meta_content(soup, "name", "keywords")
    keywords = meta_keywords if meta_keywords else "No Keywords"

    # --- Improved author extraction ---
    author = get_meta_content(soup, "name", "author")
    if not author:
        author_tag = soup.find(attrs={"itemprop": "author"})
        if author_tag:
            author = author_tag.get_text().strip()
        else:
            byline = soup.find(class_="byline")
            author = byline.get_text().strip() if byline else None

    if not author or not author.strip():
        json_ld_author = extract_author_from_json_ld(soup)
        if json_ld_author:
            author = json_ld_author
        else:
            author = "No Author"

    # --- Editor extraction ---
    editor = get_meta_content(soup, "name", "editor")
    if not editor:
        editor_tag = soup.find(attrs={"itemprop": "editor"})
        editor = editor_tag.get_text().strip() if editor_tag else "No Editor"

    # --- Date published extraction ---
    date_published = get_meta_content(soup, "name", "datePublished")
    if not date_published:
        scripts = soup.find_all("script", type="application/ld+json")
        for script in scripts:
            try:
                if script.string:
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
            except Exception as ex:
                logging.debug(f"JSON-LD datePublished parsing error: {ex}")
        date_published = date_published if date_published else "No Date Published"

    # --- Extract referenced links ---
    # Focus on links within main content areas
    main_content = soup.find('article') or soup.find('div', class_='main-content') or soup.find('section')

    if main_content:
        # Extract links from the main content area only
        referenced_links = [
            a['href'] for a in main_content.find_all('a', href=True)
            if a['href'].startswith('http') and a['href'] != url
            and not any(keyword in a['href'].lower() for keyword in ["login", "subscribe", "subscription"])
        ]
    else:
        referenced_links = []

    # --- GPT Fallback ---
    if use_gpt_fallback and (title in [None, "No Title"] or description in [None, "No Description"]):
        try:
            gpt_data = chat_gpt(url)
            if gpt_data and isinstance(gpt_data, dict):
                title = gpt_data.get("title", title)
                description = gpt_data.get("description", description)
                keywords = gpt_data.get("keywords", keywords)
                author = gpt_data.get("author", author)
                date_published = gpt_data.get("date_published", date_published)
                editor = gpt_data.get("editor", editor)
        except Exception as e:
            logging.error(f"Error in GPT fallback extraction for {url}: {e}")

    return title, description, keywords, author, date_published, editor, referenced_links


def search_wikipedia(query, sentences=5):
    """
    Searches Wikipedia for the given query and returns a concise summary.
    
    Parameters:
      query (str): The search term.
      sentences (int): Number of sentences for the summary.
      
    Returns:
      str: The Wikipedia summary or an error message.
    """
    import wikipedia
    wikipedia.set_lang("en")
    try:
        summary = wikipedia.summary(query, sentences=sentences)
        return summary
    except Exception as e:
        return f"Error retrieving Wikipedia data: {e}"