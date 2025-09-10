"""
Modern Web Scraping Service - Playwright-first architecture with advanced content extraction.
Implements 2024-2025 best practices for web scraping with anti-detection and multi-layer extraction.
"""

import asyncio
import json
import random
import time
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urljoin, urlparse

from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from playwright_stealth import stealth_async

from app.core.logging import get_logger

logger = get_logger(__name__)


class ModernScrapingService:
    """Advanced web scraping service using Playwright-first architecture."""
    
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self._semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
        
    async def _init_browser(self) -> Browser:
        """Initialize Playwright browser with stealth configuration."""
        if self.browser:
            return self.browser
            
        playwright = await async_playwright().start()
        
        # Browser launch options with stealth
        launch_options = {
            "headless": True,
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox", 
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
                "--disable-extensions",
                "--disable-default-apps"
            ]
        }
        
        self.browser = await playwright.chromium.launch(**launch_options)
        return self.browser
    
    async def _create_stealth_context(self, user_agent: Optional[str] = None) -> BrowserContext:
        """Create a stealth browser context with randomized fingerprints."""
        browser = await self._init_browser()
        
        # Randomize viewport sizes
        viewports = [
            {"width": 1920, "height": 1080},
            {"width": 1366, "height": 768},
            {"width": 1536, "height": 864},
            {"width": 1440, "height": 900},
            {"width": 1280, "height": 720}
        ]
        viewport = random.choice(viewports)
        
        # Random user agents if not provided
        if not user_agent:
            user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0"
            ]
            user_agent = random.choice(user_agents)
        
        # Create context with stealth settings
        context = await browser.new_context(
            viewport=viewport,
            user_agent=user_agent,
            locale="en-US",
            timezone_id="America/New_York",
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Cache-Control": "max-age=0"
            },
            java_script_enabled=True,
            permissions=[]  # No permissions by default
        )
        
        return context
    
    async def _extract_content_trafilatura(self, html: str, url: str) -> Dict[str, Any]:
        """Extract content using Trafilatura - primary extraction method."""
        try:
            import trafilatura
            from trafilatura.settings import use_config
            
            # Configure Trafilatura for better extraction
            config = use_config()
            config.set("DEFAULT", "EXTRACTION_TIMEOUT", "30")
            config.set("DEFAULT", "MIN_EXTRACTED_SIZE", "25")
            config.set("DEFAULT", "MIN_OUTPUT_SIZE", "10")
            
            # Extract main content
            extracted = trafilatura.extract(
                html,
                url=url,
                include_comments=False,
                include_tables=True,
                include_images=True,
                include_links=True,
                with_metadata=True,
                config=config
            )
            
            if not extracted:
                return {"success": False, "method": "trafilatura"}
            
            # Extract metadata
            metadata = trafilatura.extract_metadata(html)
            
            return {
                "success": True,
                "method": "trafilatura",
                "content": extracted,
                "title": metadata.title if metadata else None,
                "author": metadata.author if metadata else None,
                "date": metadata.date if metadata else None,
                "description": metadata.description if metadata else None,
                "sitename": metadata.sitename if metadata else None,
                "url": metadata.url if metadata else url
            }
            
        except Exception as e:
            logger.warning(f"Trafilatura extraction failed for {url}: {e}")
            return {"success": False, "method": "trafilatura", "error": str(e)}
    
    async def _extract_content_readability(self, html: str, url: str) -> Dict[str, Any]:
        """Extract content using Readability - secondary extraction method."""
        try:
            from readability import Document
            
            doc = Document(html)
            title = doc.title()
            content = doc.summary()
            
            # Clean up content
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                element.decompose()
            
            clean_content = soup.get_text(separator='\n', strip=True)
            
            if len(clean_content.strip()) < 50:
                return {"success": False, "method": "readability", "error": "Content too short"}
            
            return {
                "success": True,
                "method": "readability",
                "content": clean_content,
                "title": title,
                "url": url
            }
            
        except Exception as e:
            logger.warning(f"Readability extraction failed for {url}: {e}")
            return {"success": False, "method": "readability", "error": str(e)}
    
    async def _extract_content_newspaper(self, html: str, url: str) -> Dict[str, Any]:
        """Extract content using Newspaper3k - tertiary extraction method."""
        try:
            from newspaper import Article
            
            article = Article(url)
            article.set_html(html)
            article.parse()
            
            if not article.text or len(article.text.strip()) < 50:
                return {"success": False, "method": "newspaper3k", "error": "Content too short"}
            
            return {
                "success": True,
                "method": "newspaper3k", 
                "content": article.text,
                "title": article.title,
                "authors": article.authors,
                "publish_date": article.publish_date.isoformat() if article.publish_date else None,
                "summary": article.summary if hasattr(article, 'summary') else None,
                "url": url
            }
            
        except Exception as e:
            logger.warning(f"Newspaper3k extraction failed for {url}: {e}")
            return {"success": False, "method": "newspaper3k", "error": str(e)}
    
    async def _extract_content_fallback(self, html: str, url: str) -> Dict[str, Any]:
        """Fallback content extraction using BeautifulSoup."""
        try:
            from bs4 import BeautifulSoup
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
                element.decompose()
            
            # Extract title
            title = None
            title_elem = soup.find('title')
            if title_elem:
                title = title_elem.get_text().strip()
            
            # Try to find main content areas
            content_selectors = [
                'article', 'main', '[role="main"]', 
                '.content', '#content', '.post-content',
                '.article-content', '.entry-content'
            ]
            
            content = ""
            for selector in content_selectors:
                elements = soup.select(selector)
                if elements:
                    content = '\n'.join(elem.get_text(separator='\n', strip=True) for elem in elements)
                    break
            
            # If no specific content area found, get body text
            if not content or len(content.strip()) < 100:
                body = soup.find('body')
                if body:
                    content = body.get_text(separator='\n', strip=True)
            
            # Clean up whitespace
            lines = [line.strip() for line in content.splitlines() if line.strip()]
            clean_content = '\n'.join(lines)
            
            if len(clean_content.strip()) < 50:
                return {"success": False, "method": "fallback", "error": "Content too short"}
            
            return {
                "success": True,
                "method": "fallback",
                "content": clean_content,
                "title": title,
                "url": url
            }
            
        except Exception as e:
            logger.error(f"Fallback extraction failed for {url}: {e}")
            return {"success": False, "method": "fallback", "error": str(e)}
    
    async def _human_like_delay(self, min_delay: float = 0.5, max_delay: float = 2.0):
        """Add human-like delay between actions."""
        delay = random.uniform(min_delay, max_delay)
        await asyncio.sleep(delay)
    
    async def scrape_url_modern(
        self,
        url: str,
        options: Optional[Dict[str, Any]] = None,
        extract_images: bool = False,
        extract_links: bool = False,
        user_agent: Optional[str] = None,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Modern web scraping with Playwright and multi-layer content extraction.
        
        Args:
            url: URL to scrape
            options: Additional scraping options
            extract_images: Whether to extract image URLs
            extract_links: Whether to extract links
            user_agent: Custom user agent string
            timeout: Request timeout in seconds
            
        Returns:
            Dictionary with extraction results
        """
        async with self._semaphore:
            start_time = time.time()
            
            try:
                # Create stealth context
                context = await self._create_stealth_context(user_agent)
                page = await context.new_page()
                
                # Apply stealth to page
                await stealth_async(page)
                
                # Set additional stealth properties
                await page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    
                    window.chrome = {
                        runtime: {},
                    };
                """)
                
                # Navigate to URL with timeout
                logger.info(f"Navigating to {url}")
                response = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=timeout * 1000
                )
                
                if not response:
                    raise Exception("Failed to load page")
                
                # Wait for content to load
                await self._human_like_delay(1.0, 2.0)
                
                # Try to wait for main content
                try:
                    await page.wait_for_selector("body", timeout=5000)
                except:
                    pass  # Continue if selector not found
                
                # Get page content and metadata
                html = await page.content()
                title = await page.title()
                final_url = page.url
                
                result = {
                    "url": url,
                    "final_url": final_url,
                    "title": title,
                    "status_code": response.status,
                    "content_type": response.headers.get("content-type", ""),
                    "scraped_at": time.time(),
                    "scraping_time": time.time() - start_time,
                    "method": "playwright",
                    "success": True
                }
                
                # Multi-layer content extraction
                extraction_results = []
                
                # 1. Try Trafilatura (primary)
                trafilatura_result = await self._extract_content_trafilatura(html, final_url)
                extraction_results.append(trafilatura_result)
                
                if trafilatura_result["success"]:
                    result.update({
                        "content": trafilatura_result["content"],
                        "extraction_method": "trafilatura",
                        "metadata": {
                            "author": trafilatura_result.get("author"),
                            "date": trafilatura_result.get("date"),
                            "description": trafilatura_result.get("description"),
                            "sitename": trafilatura_result.get("sitename")
                        }
                    })
                else:
                    # 2. Try Readability (secondary)
                    readability_result = await self._extract_content_readability(html, final_url)
                    extraction_results.append(readability_result)
                    
                    if readability_result["success"]:
                        result.update({
                            "content": readability_result["content"],
                            "extraction_method": "readability"
                        })
                    else:
                        # 3. Try Newspaper3k (tertiary)
                        newspaper_result = await self._extract_content_newspaper(html, final_url)
                        extraction_results.append(newspaper_result)
                        
                        if newspaper_result["success"]:
                            result.update({
                                "content": newspaper_result["content"],
                                "extraction_method": "newspaper3k",
                                "metadata": {
                                    "authors": newspaper_result.get("authors"),
                                    "publish_date": newspaper_result.get("publish_date"),
                                    "summary": newspaper_result.get("summary")
                                }
                            })
                        else:
                            # 4. Fallback extraction
                            fallback_result = await self._extract_content_fallback(html, final_url)
                            extraction_results.append(fallback_result)
                            
                            if fallback_result["success"]:
                                result.update({
                                    "content": fallback_result["content"],
                                    "extraction_method": "fallback"
                                })
                            else:
                                result.update({
                                    "content": None,
                                    "extraction_method": "failed",
                                    "error": "All extraction methods failed"
                                })
                
                # Extract additional data if requested
                if extract_images:
                    try:
                        images = await page.eval_on_selector_all(
                            "img[src]",
                            "elements => elements.map(img => ({url: img.src, alt: img.alt, title: img.title}))"
                        )
                        # Convert relative URLs to absolute
                        for img in images:
                            img['url'] = urljoin(final_url, img['url'])
                        result["images"] = images[:100]  # Limit to 100 images
                    except Exception as e:
                        logger.warning(f"Failed to extract images from {url}: {e}")
                        result["images"] = []
                
                if extract_links:
                    try:
                        links = await page.eval_on_selector_all(
                            "a[href]",
                            "elements => elements.map(a => ({url: a.href, text: a.textContent.trim(), title: a.title}))"
                        )
                        # Convert relative URLs to absolute
                        for link in links:
                            link['url'] = urljoin(final_url, link['url'])
                        result["links"] = links[:200]  # Limit to 200 links
                    except Exception as e:
                        logger.warning(f"Failed to extract links from {url}: {e}")
                        result["links"] = []
                
                # Add extraction debug info
                result["extraction_attempts"] = extraction_results
                
                await context.close()
                
                logger.info(f"Successfully scraped {url} using {result.get('extraction_method')} in {result['scraping_time']:.2f}s")
                return result
                
            except Exception as e:
                logger.error(f"Failed to scrape {url} with modern method: {e}")
                
                # Try to close context if it exists
                try:
                    if 'context' in locals():
                        await context.close()
                except:
                    pass
                
                return {
                    "url": url,
                    "success": False,
                    "error": str(e),
                    "method": "playwright",
                    "scraping_time": time.time() - start_time
                }
    
    async def batch_scrape_modern(
        self,
        urls: List[str],
        options: Optional[Dict[str, Any]] = None,
        max_concurrent: int = 3,
        delay_between_requests: float = 1.0
    ) -> List[Dict[str, Any]]:
        """
        Batch scrape multiple URLs with concurrency control.
        
        Args:
            urls: List of URLs to scrape
            options: Scraping options
            max_concurrent: Maximum concurrent requests
            delay_between_requests: Delay between batches
            
        Returns:
            List of scraping results
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        results = []
        
        async def scrape_with_semaphore(url: str) -> Dict[str, Any]:
            async with semaphore:
                result = await self.scrape_url_modern(url, options)
                await asyncio.sleep(delay_between_requests)
                return result
        
        # Execute requests in batches
        tasks = [scrape_with_semaphore(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "url": urls[i],
                    "success": False,
                    "error": str(result),
                    "method": "playwright"
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def close(self):
        """Close browser and cleanup resources."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()