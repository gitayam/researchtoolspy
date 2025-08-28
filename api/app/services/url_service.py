"""
URL processing service for web content analysis and archival.
"""

import hashlib
import json
import re
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.logging import get_logger
from app.models.research_tool import ProcessedUrl
from app.models.user import User

logger = get_logger(__name__)


class UrlProcessingService:
    """Service for processing and analyzing URLs."""
    
    def __init__(self):
        """Initialize URL processing service."""
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "OmniCore Intelligence Analysis Platform/1.0 (+https://omnicore.intelligence)"
            }
        )
    
    async def process_url(
        self,
        url: str,
        db: AsyncSession,
        user: User,
        force_refresh: bool = False
    ) -> ProcessedUrl:
        """
        Process a URL and extract metadata.
        
        Args:
            url: URL to process
            db: Database session
            user: User requesting the processing
            force_refresh: Force re-processing even if cached
            
        Returns:
            ProcessedUrl: Processed URL object
        """
        logger.info(f"Processing URL: {url} for user {user.username}")
        
        # Normalize and validate URL
        normalized_url = self._normalize_url(url)
        url_hash = self._generate_url_hash(normalized_url)
        
        # Check if already processed
        if not force_refresh:
            existing = await self._get_existing_processed_url(db, url_hash)
            if existing:
                logger.info(f"Using cached URL data for {normalized_url}")
                return existing
        
        try:
            # Fetch URL content
            response = await self.client.get(normalized_url, follow_redirects=True)
            
            # Extract metadata
            metadata = await self._extract_metadata(response, normalized_url)
            
            # Assess reliability
            reliability_score = self._assess_reliability(metadata, response)
            domain_reputation = self._assess_domain_reputation(metadata["domain"])
            
            # Create or update processed URL
            processed_url = ProcessedUrl(
                url=normalized_url,
                url_hash=url_hash,
                title=metadata.get("title"),
                description=metadata.get("description"),
                author=metadata.get("author"),
                domain=metadata["domain"],
                content_type=metadata.get("content_type"),
                language=metadata.get("language"),
                word_count=metadata.get("word_count"),
                status_code=response.status_code,
                response_time=metadata.get("response_time"),
                metadata=json.dumps(metadata),
                reliability_score=reliability_score,
                domain_reputation=domain_reputation,
                processing_status="completed",
                user_id=user.id
            )
            
            db.add(processed_url)
            await db.commit()
            await db.refresh(processed_url)
            
            logger.info(f"Successfully processed URL: {normalized_url}")
            return processed_url
            
        except Exception as e:
            logger.error(f"Failed to process URL {normalized_url}: {e}")
            
            # Create failed processing record
            processed_url = ProcessedUrl(
                url=normalized_url,
                url_hash=url_hash,
                domain=urllib.parse.urlparse(normalized_url).netloc,
                processing_status="failed",
                error_message=str(e),
                user_id=user.id
            )
            
            db.add(processed_url)
            await db.commit()
            await db.refresh(processed_url)
            
            return processed_url
    
    async def batch_process_urls(
        self,
        urls: List[str],
        db: AsyncSession,
        user: User,
        force_refresh: bool = False
    ) -> List[ProcessedUrl]:
        """
        Process multiple URLs in batch.
        
        Args:
            urls: List of URLs to process
            db: Database session
            user: User requesting the processing
            force_refresh: Force re-processing even if cached
            
        Returns:
            List[ProcessedUrl]: List of processed URL objects
        """
        logger.info(f"Batch processing {len(urls)} URLs for user {user.username}")
        
        results = []
        for url in urls:
            try:
                processed_url = await self.process_url(url, db, user, force_refresh)
                results.append(processed_url)
            except Exception as e:
                logger.error(f"Failed to process URL {url} in batch: {e}")
                # Continue with other URLs
                continue
        
        logger.info(f"Batch processing completed: {len(results)}/{len(urls)} successful")
        return results
    
    async def archive_with_wayback(self, url: str) -> Optional[str]:
        """
        Archive URL with Wayback Machine.
        
        Args:
            url: URL to archive
            
        Returns:
            str: Wayback Machine URL if successful
        """
        logger.info(f"Archiving URL with Wayback Machine: {url}")
        
        try:
            # Submit to Wayback Machine
            archive_url = f"https://web.archive.org/save/{url}"
            response = await self.client.get(archive_url)
            
            if response.status_code == 200:
                # Extract wayback URL from response
                wayback_url = f"https://web.archive.org/web/{datetime.now().strftime('%Y%m%d%H%M%S')}/{url}"
                logger.info(f"Successfully archived: {wayback_url}")
                return wayback_url
            else:
                logger.warning(f"Wayback archival failed with status {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to archive with Wayback Machine: {e}")
            return None
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL for consistent processing."""
        # Add protocol if missing
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        # Parse and rebuild for normalization
        parsed = urllib.parse.urlparse(url)
        normalized = urllib.parse.urlunparse(parsed)
        
        return normalized
    
    def _generate_url_hash(self, url: str) -> str:
        """Generate SHA-256 hash for URL."""
        return hashlib.sha256(url.encode()).hexdigest()
    
    async def _get_existing_processed_url(
        self,
        db: AsyncSession,
        url_hash: str
    ) -> Optional[ProcessedUrl]:
        """Get existing processed URL from database."""
        result = await db.execute(
            select(ProcessedUrl).where(ProcessedUrl.url_hash == url_hash)
        )
        return result.scalar_one_or_none()
    
    async def _extract_metadata(self, response: httpx.Response, url: str) -> Dict:
        """Extract metadata from HTTP response."""
        start_time = datetime.now()
        
        metadata = {
            "url": url,
            "domain": urllib.parse.urlparse(url).netloc,
            "response_time": (datetime.now() - start_time).total_seconds(),
            "content_type": response.headers.get("content-type", "").split(";")[0],
            "content_length": len(response.content),
        }
        
        # Parse HTML content if available
        if "text/html" in response.headers.get("content-type", ""):
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract title
            title_tag = soup.find('title')
            if title_tag:
                metadata["title"] = title_tag.get_text().strip()
            
            # Extract description
            desc_tag = soup.find('meta', attrs={'name': 'description'})
            if not desc_tag:
                desc_tag = soup.find('meta', attrs={'property': 'og:description'})
            if desc_tag:
                metadata["description"] = desc_tag.get('content', '').strip()
            
            # Extract author
            author_tag = soup.find('meta', attrs={'name': 'author'})
            if not author_tag:
                author_tag = soup.find('meta', attrs={'property': 'article:author'})
            if author_tag:
                metadata["author"] = author_tag.get('content', '').strip()
            
            # Extract language
            html_tag = soup.find('html')
            if html_tag and html_tag.get('lang'):
                metadata["language"] = html_tag.get('lang')
            
            # Count words in text content
            text_content = soup.get_text()
            word_count = len(re.findall(r'\b\w+\b', text_content))
            metadata["word_count"] = word_count
            
            # Extract additional Open Graph metadata
            og_tags = soup.find_all('meta', attrs={'property': re.compile(r'^og:')})
            og_data = {}
            for tag in og_tags:
                property_name = tag.get('property', '').replace('og:', '')
                content = tag.get('content', '')
                if property_name and content:
                    og_data[property_name] = content
            
            if og_data:
                metadata["open_graph"] = og_data
            
            # Extract schema.org structured data
            schema_scripts = soup.find_all('script', type='application/ld+json')
            schema_data = []
            for script in schema_scripts:
                try:
                    schema_json = json.loads(script.string)
                    schema_data.append(schema_json)
                except (json.JSONDecodeError, AttributeError):
                    continue
            
            if schema_data:
                metadata["schema_org"] = schema_data
        
        return metadata
    
    def _assess_reliability(self, metadata: Dict, response: httpx.Response) -> float:
        """
        Assess reliability of the URL/content.
        
        Returns score from 0.0 to 1.0 where 1.0 is most reliable.
        """
        score = 0.5  # Base score
        
        # Check HTTPS
        if metadata["url"].startswith("https://"):
            score += 0.1
        
        # Check if title and description exist
        if metadata.get("title"):
            score += 0.1
        if metadata.get("description"):
            score += 0.1
        
        # Check response status
        if response.status_code == 200:
            score += 0.1
        elif response.status_code in [301, 302]:
            score += 0.05
        
        # Check content length (reasonable size)
        content_length = metadata.get("content_length", 0)
        if 1000 <= content_length <= 1000000:  # 1KB to 1MB
            score += 0.1
        
        # Check for structured data
        if metadata.get("schema_org") or metadata.get("open_graph"):
            score += 0.1
        
        return min(1.0, max(0.0, score))
    
    def _assess_domain_reputation(self, domain: str) -> str:
        """
        Assess domain reputation.
        
        Returns: trusted, neutral, suspicious, malicious
        """
        # Basic domain reputation assessment
        # In production, this would integrate with threat intelligence APIs
        
        trusted_domains = {
            'gov', 'edu', 'mil', 'wikipedia.org', 'arxiv.org',
            'nature.com', 'science.org', 'ieee.org', 'acm.org'
        }
        
        suspicious_tlds = {
            'tk', 'ml', 'cf', 'ga'
        }
        
        domain_lower = domain.lower()
        
        # Check for trusted domains/TLDs
        for trusted in trusted_domains:
            if domain_lower.endswith(trusted):
                return "trusted"
        
        # Check for suspicious TLDs
        for suspicious in suspicious_tlds:
            if domain_lower.endswith(f".{suspicious}"):
                return "suspicious"
        
        # Check for suspicious patterns
        if len(domain.replace('.', '')) > 50:  # Very long domain
            return "suspicious"
        
        if domain.count('-') > 3:  # Many hyphens
            return "suspicious"
        
        return "neutral"
    
    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


# Global service instance
url_service = UrlProcessingService()