/**
 * Cloudflare Containers Worker - SearXNG + OSINT Agent
 *
 * This Worker manages two containers:
 * 1. SearXNG - Metasearch engine (port 8080)
 * 2. OSINT Agent - Intelligent search collection with LLM (port 8000)
 */

import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

// ============================================================================
// Environment Types
// ============================================================================

interface Env {
  SEARXNG: DurableObjectNamespace;
  OSINT_AGENT: DurableObjectNamespace;
  OPENAI_API_KEY?: string;
  ENVIRONMENT?: string;
}

// ============================================================================
// Container Classes
// ============================================================================

/**
 * SearXNG Container - Privacy-respecting metasearch engine
 * Provides unified search across 34+ search engines
 */
export class SearXNGContainer extends Container<Env> {
  // SearXNG listens on port 8080
  defaultPort = 8080;

  // Keep alive for 5 minutes after last request
  sleepAfter = "5m";

  // Environment variables for the container
  envVars = {
    SEARXNG_SECRET: crypto.randomUUID(),
  };

  override onStart(): void {
    console.log("[SearXNGContainer] Container started");
  }

  override onStop(): void {
    console.log("[SearXNGContainer] Container stopped");
  }

  override onError(error: unknown): void {
    console.error("[SearXNGContainer] Error:", error);
  }
}

/**
 * OSINT Agent Container - Intelligent search collection
 * Uses LLM for query expansion and relevance scoring
 */
export class OSINTAgentContainer extends Container<Env> {
  // FastAPI uvicorn server on port 8000
  defaultPort = 8000;

  // Keep alive for 10 minutes (longer processing tasks)
  sleepAfter = "10m";

  // Environment variables passed from Worker secrets using module-level env import
  envVars = {
    OPENAI_API_KEY: env.OPENAI_API_KEY || "",
    OPENAI_BASE_URL: "https://api.openai.com/v1",
    EXPANSION_MODEL: "gpt-4o-mini",
    SCORING_MODEL: "gpt-4o-mini",
    SEARXNG_ENDPOINT: "https://search.irregularchat.com",  // Self-hosted SearXNG via Cloudflare Tunnel
    LOCAL_LLM_BASE_URL: "http://ollama:11434/v1",
    LOCAL_LLM_MODEL: "llama3.2",
  };

  override onStart(): void {
    console.log("[OSINTAgentContainer] Container started");
  }

  override onStop(): void {
    console.log("[OSINTAgentContainer] Container stopped");
  }

  override onError(error: unknown): void {
    console.error("[OSINTAgentContainer] Error:", error);
  }
}

// ============================================================================
// Worker Request Handler
// ============================================================================

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (path === "/" || path === "/health") {
      return Response.json({
        status: "healthy",
        service: "researchtoolspy-containers",
        containers: {
          searxng: { available: true, port: 8080 },
          osint_agent: { available: true, port: 8000 },
        },
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders });
    }

    // Route to SearXNG container
    if (path.startsWith("/searxng") || path.startsWith("/search")) {
      try {
        const container = getContainer(env.SEARXNG);

        // Rewrite the path for SearXNG
        const targetUrl = new URL(request.url);
        targetUrl.pathname = path.replace(/^\/(searxng|search)/, "");
        if (targetUrl.pathname === "") targetUrl.pathname = "/";

        const containerRequest = new Request(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        return await container.fetch(containerRequest);
      } catch (error) {
        console.error("[SearXNG] Request failed:", error);
        return Response.json({
          error: "SearXNG container error",
          details: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500, headers: corsHeaders });
      }
    }

    // Route to OSINT Agent container
    if (path.startsWith("/osint") || path.startsWith("/collect")) {
      try {
        const container = getContainer(env.OSINT_AGENT);

        // Rewrite the path for OSINT Agent
        const targetUrl = new URL(request.url);
        targetUrl.pathname = path.replace(/^\/osint/, "");
        if (targetUrl.pathname === "") targetUrl.pathname = "/";

        const containerRequest = new Request(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        return await container.fetch(containerRequest);
      } catch (error) {
        console.error("[OSINTAgent] Request failed:", error);
        return Response.json({
          error: "OSINT Agent container error",
          details: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500, headers: corsHeaders });
      }
    }

    // 404 for unknown routes
    return Response.json({
      error: "Not found",
      availableRoutes: [
        "GET /health - Health check",
        "ANY /searxng/* - SearXNG metasearch",
        "ANY /search/* - SearXNG search (alias)",
        "ANY /osint/* - OSINT Agent",
        "ANY /collect/* - OSINT Agent collection (alias)",
      ],
    }, { status: 404, headers: corsHeaders });
  },
};
