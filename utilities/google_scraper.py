# /utilities/google_scraper.py
"""
This module contains functions for scraping Google search results using Selenium.
It provides functionality to scrape search results, extract metadata, and save the data to an Excel file.

Original source: https://github.com/agile-enigma/google_scraper/blob/main/src/google_scraper/google_scraper.py

"""

import datetime
import re
import time
import logging
from typing import Optional, List

import pandas as pd
import pytz
from bs4 import BeautifulSoup
from langdetect import detect
from selenium import webdriver
import chromedriver_binary  # ensures chromedriver is available

from dateutil.relativedelta import relativedelta  # for subtracting months accurately

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_date_published(block: BeautifulSoup) -> Optional[datetime.datetime]:
    """
    Extracts and converts the published date from a search result block to a datetime object.
    """
    date_text: Optional[str] = None
    if block.find("span", class_="LEwnzc"):
        date_text = block.find("span", class_="LEwnzc").text
    elif block.find("div", class_="gqF9jc"):
        date_text = block.find("div", class_="gqF9jc").text
    elif block.find("cite", class_="qLRx3b") and re.search(r", \d{4}|ago", block.find("cite", class_="qLRx3b").text):
        date_text = block.find("cite", class_="qLRx3b").text

    if date_text:
        return to_datetime(date_text)
    else:
        return None


def to_datetime(date_str: str) -> Optional[datetime.datetime]:
    """
    Converts a date string (which can be relative like '2 days ago' or an absolute date)
    to a datetime object.
    """
    tz = pytz.timezone("US/Eastern")
    now = datetime.datetime.now(tz)
    date_str = date_str.strip()

    # Check for relative dates (e.g., "2 days ago", "3 weeks ago", "10 minutes ago")
    relative_match = re.search(
        r"(\d+)\s*(month|months|week|weeks|day|days|hour|hours|minute|minutes)\s*ago",
        date_str,
        flags=re.IGNORECASE
    )
    if relative_match:
        quantity = int(relative_match.group(1))
        unit = relative_match.group(2).lower()
        if unit.startswith("month"):
            dt = now - relativedelta(months=quantity)
        elif unit.startswith("week"):
            dt = now - datetime.timedelta(weeks=quantity)
        elif unit.startswith("day"):
            dt = now - datetime.timedelta(days=quantity)
        elif unit.startswith("hour"):
            dt = now - datetime.timedelta(hours=quantity)
        elif unit.startswith("minute"):
            dt = now - datetime.timedelta(minutes=quantity)
        else:
            dt = None

        if dt:
            # Return date with zeroed time for consistency
            return dt.replace(hour=0, minute=0, second=0, microsecond=0)

    # If not a relative date, attempt to parse as an absolute date.
    # Remove any trailing text starting with an em-dash.
    cleaned_date_str = re.sub(r" — .*", "", date_str)
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            dt = datetime.datetime.strptime(cleaned_date_str, fmt)
            return dt
        except ValueError:
            continue
    logger.warning(f"Failed to parse date: {date_str}")
    return None


def get_content_snippet(block: BeautifulSoup) -> str:
    """
    Extracts the content snippet from a search result block.
    """
    snippet = ""
    vwi_elem = block.find("div", class_="VwiC3b")
    if vwi_elem and vwi_elem.text:
        snippet = vwi_elem.text.strip()
        if "— " in snippet:
            snippet = snippet.split("— ", 1)[-1].strip()
    elif block.find("div", class_="ITZIwc"):
        snippet = block.find("div", class_="ITZIwc").text.strip()

    return snippet


def df_to_excel(
    urls: List[str],
    domains: List[str],
    dates_published: List[Optional[datetime.datetime]],
    dates_scraped: List[datetime.datetime],
    languages: List[str],
    titles: List[str],
    content_snippets: List[str],
    query: str,
    date_scraped: str
):
    """
    Converts lists of scraped data to a pandas DataFrame and exports it to an Excel file.
    """
    df = pd.DataFrame({
        "url": urls,
        "domain": domains,
        "date_published": dates_published,
        "date_scraped": dates_scraped,
        "language": languages,
        "title": titles,
        "content_snippet": content_snippets,
    })
    df.sort_values(by=["date_published"], inplace=True, ascending=False)
    file_name = f"{query}_{date_scraped}.xlsx"
    df.to_excel(file_name, index=False)
    logger.info(f"Excel file saved as {file_name}")


def scrape(start_date: str, end_date: str, query: str):
    """
    Scrapes Google search results for a specific query and date range.
    
    Args:
        start_date (str): Start date in the format "mm/dd/YYYY".
        end_date (str): End date in the format "mm/dd/YYYY".
        query (str): Search query.
    """
    chrome_options = webdriver.ChromeOptions()
    # Uncomment the next line to run Chrome in headless mode
    # chrome_options.add_argument("--headless")
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        tz = pytz.timezone("US/Eastern")
        start_date_obj = datetime.datetime.strptime(start_date, "%m/%d/%Y")
        end_date_obj = datetime.datetime.strptime(end_date, "%m/%d/%Y")
    
        urls: List[str] = []
        titles: List[str] = []
        dates_published: List[Optional[datetime.datetime]] = []
        content_snippets: List[str] = []
        dates_scraped: List[datetime.datetime] = []
        languages: List[str] = []
        domains: List[str] = []
    
        logger.info("Scraping in progress...")
        results_page = 0
        done = False
        while not done:
            query_url = (
                "https://www.google.com/search?&tbs=cdr:1,cd_min:"
                + start_date_obj.strftime("%m/%d/%Y")
                + ",cd_max:"
                + end_date_obj.strftime("%m/%d/%Y")
                + "&q="
                + query
                + "&start="
                + str(results_page)
            )
            driver.get(query_url)
            soup = BeautifulSoup(driver.page_source, "html.parser")
    
            rso_section = soup.find("div", {"id": "rso", "class": "dURPMd"})
            if not rso_section or not list(rso_section.children):
                done = True
                continue
    
            for block in rso_section.children:
                # Skip blocks that are not relevant search results.
                if block.get("class") and block.get("class")[0] == "ULSxyf":
                    continue
                if block.find("span", {"id": "fld_1"}):
                    continue
                if not block.contents:
                    continue
    
                try:
                    anchor = block.find("a", {"jsname": "UWckNb"})
                    if not anchor:
                        continue
                    url = anchor.get("href")
                    domain = re.sub(r"https?://(www\.)?|(?<!/)/.*", "", url)
                    title_elem = block.find("h3", class_="LC20lb")
                    if not title_elem:
                        continue
                    title = title_elem.text.strip()
                    language = detect(title)
                    published_date = get_date_published(block)
                    date_scraped = datetime.datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
                    snippet = get_content_snippet(block)
    
                    domains.append(domain)
                    urls.append(url)
                    titles.append(title)
                    dates_published.append(published_date)
                    languages.append(language)
                    dates_scraped.append(date_scraped)
                    content_snippets.append(snippet)
                except Exception as e:
                    logger.error(f"Error processing a result block: {e}")
                    continue
    
            results_page += 10
            time.sleep(1)
    
        scraped_date = datetime.datetime.now(tz).strftime("%m-%d-%Y")
        df_to_excel(
            urls,
            domains,
            dates_published,
            dates_scraped,
            languages,
            titles,
            content_snippets,
            query,
            scraped_date,
        )
    finally:
        driver.quit()
        logger.info("Driver closed.")