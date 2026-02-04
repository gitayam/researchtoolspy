"""
OSINT Agent - Intelligent search collection with LLM-powered query expansion and relevance scoring.

This agent:
1. Receives collection requests from the Worker API
2. Expands queries using LLM intelligence (gpt-5 for expansion)
3. Executes searches via SearXNG
4. Scores relevance using LLM (gpt-5-mini for bulk scoring)
5. Sends results back via callback URL
"""

import asyncio
import json
import os
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from openai import OpenAI, AsyncOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("osint-agent")

# FastAPI app
app = FastAPI(
    title="OSINT Agent",
    description="Intelligent search collection with LLM-powered query expansion and relevance scoring",
    version="1.0.0"
)

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
LOCAL_LLM_BASE_URL = os.getenv("LOCAL_LLM_BASE_URL", "http://ollama:11434/v1")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "llama3.2")
DEFAULT_SEARXNG_ENDPOINT = os.getenv("SEARXNG_ENDPOINT", "http://searxng:8080")

# Model selection - use gpt-5 for expansion, gpt-5-mini for bulk scoring
EXPANSION_MODEL = os.getenv("EXPANSION_MODEL", "gpt-5")
SCORING_MODEL = os.getenv("SCORING_MODEL", "gpt-5-mini")


# ============================================================================
# LLM Client Configuration
# ============================================================================

def get_openai_client(async_client: bool = False) -> OpenAI | AsyncOpenAI:
    """Get OpenAI client for cloud LLM access."""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is required for OpenAI client")

    if async_client:
        return AsyncOpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )
    return OpenAI(
        api_key=OPENAI_API_KEY,
        base_url=OPENAI_BASE_URL
    )


def get_local_client(async_client: bool = False) -> OpenAI | AsyncOpenAI:
    """Get local LLM client (Ollama-compatible API)."""
    if async_client:
        return AsyncOpenAI(
            api_key="ollama",  # Ollama doesn't require a real key
            base_url=LOCAL_LLM_BASE_URL
        )
    return OpenAI(
        api_key="ollama",
        base_url=LOCAL_LLM_BASE_URL
    )


def get_client(use_local: bool = False, async_client: bool = False) -> OpenAI | AsyncOpenAI:
    """Get appropriate LLM client based on configuration."""
    if use_local:
        return get_local_client(async_client)
    return get_openai_client(async_client)


# ============================================================================
# Request/Response Models
# ============================================================================

class CollectionRequest(BaseModel):
    """Request model for starting a collection job."""
    jobId: str = Field(default_factory=lambda: str(uuid4()))
    query: str = Field(..., description="The research question or topic to investigate")
    categories: list[str] = Field(
        default=["general", "news"],
        description="SearXNG search categories"
    )
    maxResults: int = Field(default=50, ge=1, le=500, description="Maximum results to collect")
    timeRange: Optional[str] = Field(
        default=None,
        description="Time range filter (day, week, month, year)"
    )
    searxngEndpoint: str = Field(
        default=DEFAULT_SEARXNG_ENDPOINT,
        description="SearXNG instance endpoint"
    )
    callbackUrl: Optional[str] = Field(
        default=None,
        description="URL to POST results when collection completes"
    )
    useLocalLLM: bool = Field(
        default=False,
        description="Use local Ollama LLM instead of OpenAI"
    )


class SearchResult(BaseModel):
    """Individual search result."""
    title: str
    url: str
    snippet: str
    source: str
    publishedDate: Optional[str] = None
    relevanceScore: float = 0.0
    category: str = "general"


class CollectionResult(BaseModel):
    """Result of a collection job."""
    jobId: str
    status: str
    query: str
    expandedQueries: list[str]
    totalResults: int
    results: list[SearchResult]
    startedAt: str
    completedAt: Optional[str] = None
    error: Optional[str] = None


# ============================================================================
# Core Collection Functions
# ============================================================================

async def expand_queries(
    query: str,
    categories: list[str],
    use_local_llm: bool = False
) -> list[str]:
    """
    Use LLM to expand a research question into targeted search queries.

    Uses gpt-5 for high-quality query expansion (or local model if specified).
    """
    client = get_client(use_local=use_local_llm, async_client=True)
    model = LOCAL_LLM_MODEL if use_local_llm else EXPANSION_MODEL

    categories_str = ", ".join(categories)

    prompt = f"""You are a research assistant specializing in OSINT (Open Source Intelligence) collection.

Given the following research question, generate 5-10 targeted search queries that would help comprehensively investigate this topic. Consider:
- Different phrasings and synonyms
- Specific aspects or sub-topics
- Related entities, people, or organizations
- Time-sensitive queries if relevant
- Queries optimized for these search categories: {categories_str}

Research Question: {query}

Return ONLY a JSON array of search query strings, no explanations. Example format:
["query 1", "query 2", "query 3"]"""

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert OSINT analyst. Return only valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )

        content = response.choices[0].message.content.strip()

        # Parse JSON response
        if content.startswith("```"):
            # Handle markdown code blocks
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        queries = json.loads(content)

        # Always include original query
        if query not in queries:
            queries.insert(0, query)

        logger.info(f"Expanded '{query}' into {len(queries)} queries")
        return queries

    except Exception as e:
        logger.error(f"Query expansion failed: {e}")
        # Fallback to original query plus simple variations
        return [
            query,
            f"{query} latest news",
            f"{query} analysis",
            f"{query} overview"
        ]


async def execute_searches(
    queries: list[str],
    categories: list[str],
    max_results: int,
    time_range: Optional[str],
    searxng_endpoint: str
) -> list[SearchResult]:
    """
    Execute searches against SearXNG for all expanded queries.
    """
    results: list[SearchResult] = []
    seen_urls: set[str] = set()
    results_per_query = max(5, max_results // len(queries))

    async with httpx.AsyncClient(timeout=30.0) as client:
        for query in queries:
            for category in categories:
                if len(results) >= max_results:
                    break

                try:
                    params = {
                        "q": query,
                        "format": "json",
                        "categories": category,
                        "pageno": 1,
                    }

                    if time_range:
                        params["time_range"] = time_range

                    response = await client.get(
                        f"{searxng_endpoint}/search",
                        params=params
                    )
                    response.raise_for_status()

                    data = response.json()

                    for item in data.get("results", [])[:results_per_query]:
                        url = item.get("url", "")

                        # Deduplicate by URL
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        result = SearchResult(
                            title=item.get("title", "Untitled"),
                            url=url,
                            snippet=item.get("content", ""),
                            source=item.get("engine", "unknown"),
                            publishedDate=item.get("publishedDate"),
                            category=category
                        )
                        results.append(result)

                        if len(results) >= max_results:
                            break

                except httpx.HTTPError as e:
                    logger.warning(f"Search failed for '{query}' in {category}: {e}")
                    continue
                except Exception as e:
                    logger.error(f"Unexpected error searching '{query}': {e}")
                    continue

    logger.info(f"Collected {len(results)} unique results from {len(queries)} queries")
    return results


async def score_results(
    results: list[SearchResult],
    original_query: str,
    use_local_llm: bool = False
) -> list[SearchResult]:
    """
    Score results for relevance using LLM.

    Uses gpt-5-mini for efficient bulk scoring (or local model if specified).
    """
    if not results:
        return results

    client = get_client(use_local=use_local_llm, async_client=True)
    model = LOCAL_LLM_MODEL if use_local_llm else SCORING_MODEL

    # Process in batches of 10 for efficiency
    batch_size = 10
    scored_results: list[SearchResult] = []

    for i in range(0, len(results), batch_size):
        batch = results[i:i + batch_size]

        # Prepare batch for scoring
        batch_data = [
            {
                "index": j,
                "title": r.title,
                "snippet": r.snippet[:500]  # Truncate long snippets
            }
            for j, r in enumerate(batch)
        ]

        prompt = f"""Score the relevance of these search results to the research question.
Research Question: {original_query}

Results to score:
{json.dumps(batch_data, indent=2)}

For each result, provide a relevance score from 0.0 to 1.0 where:
- 1.0 = Highly relevant, directly addresses the research question
- 0.7 = Relevant, provides useful context or related information
- 0.4 = Somewhat relevant, tangentially related
- 0.1 = Not very relevant, minimal connection
- 0.0 = Irrelevant

Return ONLY a JSON array of scores in the same order as the input, e.g.: [0.8, 0.5, 0.9, ...]"""

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a relevance scoring system. Return only valid JSON arrays of numbers."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Lower temperature for consistent scoring
                max_tokens=200
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON response
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            scores = json.loads(content)

            # Apply scores to results
            for j, result in enumerate(batch):
                if j < len(scores):
                    result.relevanceScore = max(0.0, min(1.0, float(scores[j])))
                else:
                    result.relevanceScore = 0.5  # Default score if parsing fails
                scored_results.append(result)

        except Exception as e:
            logger.warning(f"Scoring batch failed: {e}")
            # Assign default scores on failure
            for result in batch:
                result.relevanceScore = 0.5
                scored_results.append(result)

    # Sort by relevance score descending
    scored_results.sort(key=lambda r: r.relevanceScore, reverse=True)
    logger.info(f"Scored {len(scored_results)} results")

    return scored_results


async def run_collection(request: CollectionRequest) -> CollectionResult:
    """
    Run the full collection pipeline: expand → search → score → callback.
    """
    started_at = datetime.utcnow().isoformat()

    result = CollectionResult(
        jobId=request.jobId,
        status="running",
        query=request.query,
        expandedQueries=[],
        totalResults=0,
        results=[],
        startedAt=started_at
    )

    try:
        logger.info(f"Starting collection job {request.jobId}: '{request.query}'")

        # Step 1: Expand queries using LLM
        expanded_queries = await expand_queries(
            request.query,
            request.categories,
            request.useLocalLLM
        )
        result.expandedQueries = expanded_queries

        # Step 2: Execute searches against SearXNG
        search_results = await execute_searches(
            expanded_queries,
            request.categories,
            request.maxResults,
            request.timeRange,
            request.searxngEndpoint
        )

        # Step 3: Score results for relevance
        scored_results = await score_results(
            search_results,
            request.query,
            request.useLocalLLM
        )

        result.results = scored_results
        result.totalResults = len(scored_results)
        result.status = "completed"
        result.completedAt = datetime.utcnow().isoformat()

        logger.info(f"Collection job {request.jobId} completed: {result.totalResults} results")

    except Exception as e:
        logger.error(f"Collection job {request.jobId} failed: {e}")
        result.status = "failed"
        result.error = str(e)
        result.completedAt = datetime.utcnow().isoformat()

    # Step 4: Send results to callback URL if provided
    if request.callbackUrl:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    request.callbackUrl,
                    json=result.model_dump(),
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                logger.info(f"Callback sent to {request.callbackUrl}")
        except Exception as e:
            logger.error(f"Failed to send callback to {request.callbackUrl}: {e}")

    return result


# ============================================================================
# API Endpoints
# ============================================================================

@app.post("/collect", response_model=dict)
async def collect(request: CollectionRequest, background_tasks: BackgroundTasks):
    """
    Start a collection job in the background.

    The collection process:
    1. Expands the query using LLM intelligence
    2. Executes searches via SearXNG
    3. Scores results for relevance
    4. Sends results to callback URL if provided
    """
    logger.info(f"Received collection request: {request.jobId}")

    # Start collection in background
    background_tasks.add_task(run_collection, request)

    return {
        "jobId": request.jobId,
        "status": "accepted",
        "message": "Collection job started",
        "query": request.query,
        "callbackUrl": request.callbackUrl
    }


@app.post("/collect/sync", response_model=CollectionResult)
async def collect_sync(request: CollectionRequest):
    """
    Run a collection job synchronously and return results directly.

    Use this for smaller jobs or testing. For production, use the async /collect endpoint.
    """
    return await run_collection(request)


@app.get("/health")
async def health():
    """
    Health check endpoint with LLM configuration info.
    """
    llm_status = "unknown"
    llm_info = {}

    # Check OpenAI connectivity
    if OPENAI_API_KEY:
        try:
            client = get_openai_client()
            # Quick test - just verify we can create the client
            llm_status = "configured"
            llm_info = {
                "provider": "openai",
                "baseUrl": OPENAI_BASE_URL,
                "expansionModel": EXPANSION_MODEL,
                "scoringModel": SCORING_MODEL
            }
        except Exception as e:
            llm_status = "error"
            llm_info = {"error": str(e)}
    else:
        llm_status = "not_configured"
        llm_info = {"note": "OPENAI_API_KEY not set, local LLM fallback available"}

    return {
        "status": "healthy",
        "service": "osint-agent",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "llm": {
            "status": llm_status,
            **llm_info
        },
        "localLLM": {
            "baseUrl": LOCAL_LLM_BASE_URL,
            "model": LOCAL_LLM_MODEL
        },
        "searxng": {
            "defaultEndpoint": DEFAULT_SEARXNG_ENDPOINT
        }
    }


@app.get("/")
async def root():
    """
    Root endpoint with service information.
    """
    return {
        "service": "OSINT Agent",
        "description": "Intelligent search collection with LLM-powered query expansion and relevance scoring",
        "version": "1.0.0",
        "endpoints": {
            "POST /collect": "Start async collection job (returns immediately, results via callback)",
            "POST /collect/sync": "Run synchronous collection (waits for results)",
            "GET /health": "Health check with configuration status",
            "GET /": "This info page"
        },
        "features": [
            "LLM-powered query expansion (gpt-5)",
            "Bulk relevance scoring (gpt-5-mini)",
            "SearXNG integration for meta-search",
            "Local LLM fallback via Ollama",
            "Async processing with callbacks"
        ]
    }


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
