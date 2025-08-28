import requests
from bs4 import BeautifulSoup
import json
import streamlit as st
from urllib.parse import urlparse
import logging
import time
import concurrent.futures
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import wikipedia
import os
from selenium.common.exceptions import WebDriverException
import re

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

def generate_google_results(suggestions_text):
    """
    Extracts advanced search queries from AI-generated suggestions
    and then performs a Google search for each query.
    Returns a concatenated string of each query's search result summary.
    """
    if not suggestions_text:
        return "No suggestions provided."
        
    results_text = ""
    items = suggestions_text.split(";")
    # Match either "Search:" or "Advanced Google Search Query:" (case insensitive)
    pattern = re.compile(r"(?:Search:|Advanced Google Search Query:)\s*(.+)", re.IGNORECASE)
    
    queries_found = False
    for item in items:
        if not item.strip():
            continue
            
        m = pattern.search(item)
        if m:
            query = m.group(1).strip()
            if query:
                queries_found = True
                try:
                    result = google_search_summary(query)
                    results_text += f"Query: {query}\n{result}\n\n"
                except Exception as e:
                    logging.error(f"Error searching for query '{query}': {e}")
                    results_text += f"Query: {query}\nError performing search: {str(e)}\n\n"
    
    if not queries_found:
        # If no queries were found with the pattern, try using the raw text
        logging.info("No queries found with pattern, using raw suggestions")
        for item in items:
            item = item.strip()
            if item:
                try:
                    result = google_search_summary(item)
                    results_text += f"Query: {item}\n{result}\n\n"
                except Exception as e:
                    logging.error(f"Error searching for raw query '{item}': {e}")
                    results_text += f"Query: {item}\nError performing search: {str(e)}\n\n"
    
    if not results_text:
        results_text = "No valid advanced search queries found or all searches failed."
    
    return results_text


def find_chromium_binary():
    """
    Searches for the Chromium browser binary in common installation paths.
    Returns the path if found, otherwise raises an exception.
    """
    chromium_paths = [
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable"
    ]
    for path in chromium_paths:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Chromium browser binary not found in common paths.")


def google_search_summary(query):
    """
    Performs a Google search for the given query using Selenium
    and returns a summary (title and snippet) of the first result.
    """

    chrome_options = webdriver.ChromeOptions()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    try:
        chrome_options.binary_location = find_chromium_binary()
    except FileNotFoundError as e:
        logging.error(str(e))
        return f"Error: {str(e)}"
    
    # Set up the Service with the ChromeDriver path obtained by webdriver_manager
    try:
        service = Service(ChromeDriverManager().install())
    except WebDriverException as e:
        logging.error(f"Selenium WebDriver error during service setup: {e}")
        return f"Error setting up ChromeDriver service: {e}"
    except Exception as e:
        logging.error(f"Unexpected error installing ChromeDriver: {e}")
        return f"Unexpected error: {e}"
    
    try:
        driver = webdriver.Chrome(service=service, options=chrome_options)
    except WebDriverException as e:
        logging.error(f"Selenium WebDriver initialization error: {e}")
        return f"Error initializing Chrome WebDriver: {e}"
    except Exception as e:
        logging.error(f"Unexpected WebDriver error: {e}")
        return f"Unexpected WebDriver error: {e}"
    
    try:
        query_url = "https://www.google.com/search?q=" + query.replace(" ", "+")
        driver.get(query_url)
        time.sleep(2)  # Wait for the page to load

        soup = BeautifulSoup(driver.page_source, "html.parser")
        # Look for the common result container "g" in Google search results.
        results = soup.find_all("div", class_="g")
        if results:
            block = results[0]
            title_tag = block.find("h3")
            title = title_tag.get_text() if title_tag else "No title"
            snippet_tag = block.find("div", class_="IsZvec")
            snippet = snippet_tag.get_text(separator=" ", strip=True) if snippet_tag else ""
            if not snippet:
                snippet = block.get_text(separator=" ", strip=True)
            summary = f"Title: {title}\nSnippet: {snippet}"
        else:
            summary = "No results found."

        driver.quit()
        return summary
    except Exception as e:
        return f"Error during Google search: {e}"


def generate_wikipedia_results(scenario):
    """
    Uses GPT-4o-mini to turn the summary of the scenario (or the raw scenario text) 
    into 1 or 2 queries focused on places, people, or events and then returns Wikipedia search results.
    For each query, the first matching article and its summary (2 sentences) are displayed.
    """
    try:
        prompt = (
            "Based on the following summarized scenario, generate 1 to 2 search queries "
            "that would be appropriate for looking up related places, people, or events on Wikipedia. "
            "Output the queries as a semicolon-separated list.\n\n"
            f"Summary: {scenario}"
        )
        queries_output = chat_gpt(
            [
                {"role": "system", "content": "You are an assistant that generates Wikipedia search queries that are focused on a single place, person, or event."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4o-mini"
        )
        queries = [q.strip() for q in queries_output.split(";") if q.strip()]
        if not queries:
            return "No Wikipedia queries generated."

        results_text = ""
        for query in queries:
            results = wikipedia.search(query)
            if results:
                try:
                    summary = wikipedia.summary(results[0], sentences=2)
                    results_text += f"Query: {query}\nTitle: {results[0]}\nSummary: {summary}\n\n"
                except Exception as e:
                    results_text += f"Query: {query}\nError retrieving summary: {e}\n\n"
            else:
                results_text += f"Query: {query}\nNo Wikipedia results found.\n\n"
        return results_text
    except Exception as e:
        return f"Error generating Wikipedia results: {e}"


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
    if not url:
        raise ValueError("URL cannot be empty")
        
    # Ensure URL has a scheme
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
        
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/90.0.4430.93 Safari/537.36'
        ),
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    
    try:
        logging.info(f"Fetching URL with requests: {url}")
        response = requests.get(url, timeout=timeout, headers=headers)
        response.raise_for_status()
        return response.content
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching URL with requests: {e}")
        
        if use_playwright and PLAYWRIGHT_AVAILABLE:
            try:
                logging.info(f"Attempting to fetch URL with Playwright: {url}")
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page(user_agent=headers['User-Agent'])
                    
                    try:
                        page.goto(url, wait_until="networkidle", timeout=timeout * 1000)
                        content = page.content()
                        browser.close()
                        return content
                    except Exception as pe:
                        logging.error(f"Playwright navigation error: {pe}")
                        browser.close()
                        raise
            except Exception as pe:
                logging.error(f"Error fetching URL with Playwright: {pe}")
        
        # Re-raise the original exception if Playwright is not available or also fails
        raise


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
            # Create a proper prompt for GPT
            prompt = f"""
            Extract metadata from this URL: {url}
            
            Return the results as a JSON object with the following fields:
            - title: The title of the page
            - description: A brief description of the content
            - keywords: Keywords related to the content
            - author: The author of the content
            - date_published: When the content was published
            - editor: The editor of the content
            """
            
            gpt_response = chat_gpt(
                [{"role": "system", "content": "You are a metadata extraction assistant."},
                 {"role": "user", "content": prompt}],
                model="gpt-4o-mini"
            )
            
            try:
                # Try to parse the response as JSON
                gpt_data = json.loads(gpt_response)
                if isinstance(gpt_data, dict):
                    title = gpt_data.get("title", title)
                    description = gpt_data.get("description", description)
                    keywords = gpt_data.get("keywords", keywords)
                    author = gpt_data.get("author", author)
                    date_published = gpt_data.get("date_published", date_published)
                    editor = gpt_data.get("editor", editor)
            except json.JSONDecodeError:
                # If not valid JSON, try to extract information from the text response
                logging.warning("GPT response was not valid JSON, attempting to extract data from text")
                if "title:" in gpt_response.lower():
                    title_match = re.search(r"title:(.+?)(?:\n|$)", gpt_response, re.IGNORECASE)
                    if title_match and title == "No Title":
                        title = title_match.group(1).strip()
                if "description:" in gpt_response.lower():
                    desc_match = re.search(r"description:(.+?)(?:\n|$)", gpt_response, re.IGNORECASE)
                    if desc_match and description == "No Description":
                        description = desc_match.group(1).strip()
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
    
    wikipedia.set_lang("en")
    try:
        summary = wikipedia.summary(query, sentences=sentences)
        return summary
    except Exception as e:
        return f"Error retrieving Wikipedia data: {e}"


def scrape_body_content(url, timeout=10, use_playwright=PLAYWRIGHT_AVAILABLE):
    """
    Scrapes the main textual content (body text) from the given URL.
    This function is designed to work with news articles and social media pages (e.g., x.com, facebook.com, bsky.net).

    Returns:
        str: The scraped textual content from the main content body of the page.
    """
    try:
        content = fetch_page_content(url, timeout=timeout, use_playwright=use_playwright)
    except Exception as e:
        logging.error(f"Error fetching URL content for body extraction: {e}")
        return "No body content"

    soup = BeautifulSoup(content, "lxml")

    # Try to extract from an <article> tag first (common in news articles)
    article = soup.find("article")
    if article:
        body_text = article.get_text(separator="\n", strip=True)
        if body_text:
            return body_text

    # Fallback: search common content containers for news or social media pages
    for class_name in ["main-content", "content-body", "post-content", "entry-content", "story-content"]:
        container = soup.find("div", class_=class_name)
        if container:
            body_text = container.get_text(separator="\n", strip=True)
            if body_text:
                return body_text

    # If no specific container is found, fallback to extracting all <body> text.
    body_tag = soup.find("body")
    if body_tag:
        body_text = body_tag.get_text(separator="\n", strip=True)
        if body_text:
            return body_text

    return "No body content"