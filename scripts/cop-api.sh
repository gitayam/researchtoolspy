#!/bin/bash
# =============================================================================
# COP API Helper Functions
# =============================================================================
# Source this file to get reusable functions for COP session management.
#
#   source scripts/cop-api.sh
#   cop_session cop-cb5c1f72-966          # view session
#   cop_add_rfi cop-cb5c1f72-966 "What happened?" critical true
#   cop_add_actor cop-cb5c1f72-966 "John Doe" PERSON
#
# Reads RESEARCHTOOLS_USER_HASH and RESEARCHTOOLS_API_BASE from .env
# =============================================================================

# ── Load config from .env ────────────────────────────────────────
_cop_load_env() {
  local envfile="${COP_ENV_FILE:-.env}"
  if [[ -f "$envfile" ]]; then
    COP_HASH="${COP_HASH:-$(grep '^RESEARCHTOOLS_USER_HASH=' "$envfile" | cut -d= -f2)}"
    COP_API="${COP_API:-$(grep '^RESEARCHTOOLS_API_BASE=' "$envfile" | cut -d= -f2)}"
  fi
  COP_API="${COP_API:-https://researchtools.net}"
  if [[ -z "$COP_HASH" ]]; then
    echo "ERROR: No user hash. Set COP_HASH or RESEARCHTOOLS_USER_HASH in .env" >&2
    return 1
  fi
}

_cop_headers() {
  echo -H "Content-Type: application/json" -H "X-User-Hash: $COP_HASH"
}

_cop_get() {
  _cop_load_env || return 1
  curl -s "$COP_API$1" -H "X-User-Hash: $COP_HASH"
}

_cop_post() {
  _cop_load_env || return 1
  curl -s -X POST "$COP_API$1" \
    -H "Content-Type: application/json" -H "X-User-Hash: $COP_HASH" \
    -d "$2"
}

_cop_put() {
  _cop_load_env || return 1
  curl -s -X PUT "$COP_API$1" \
    -H "Content-Type: application/json" -H "X-User-Hash: $COP_HASH" \
    -d "$2"
}

_cop_delete() {
  _cop_load_env || return 1
  curl -s -X DELETE "$COP_API$1" \
    -H "Content-Type: application/json" -H "X-User-Hash: $COP_HASH"
}

# ── Sessions ─────────────────────────────────────────────────────

# Get session details
# Usage: cop_session <session_id>
cop_session() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_session <session_id>" >&2; return 1; }
  _cop_get "/api/cop/sessions/$id" | python3 -m json.tool
}

# List all sessions
cop_sessions() {
  _cop_get "/api/cop/sessions" | python3 -m json.tool
}

# Create a new session
# Usage: cop_create_session "Session Name" ["description"] ["template_type"]
cop_create_session() {
  local name="$1" desc="${2:-}" template="${3:-custom}"
  [[ -z "$name" ]] && { echo "Usage: cop_create_session <name> [description] [template]" >&2; return 1; }
  _cop_post "/api/cop/sessions" \
    "$(jq -n --arg n "$name" --arg d "$desc" --arg t "$template" \
      '{name:$n, description:$d, template_type:$t}')" | python3 -m json.tool
}

# Update session fields (pass raw JSON)
# Usage: cop_update_session <session_id> '{"mission_brief":"..."}'
cop_update_session() {
  local id="$1" body="$2"
  [[ -z "$id" || -z "$body" ]] && { echo "Usage: cop_update_session <session_id> '<json>'" >&2; return 1; }
  _cop_put "/api/cop/sessions/$id" "$body" | python3 -m json.tool
}

# Set mission brief
# Usage: cop_set_brief <session_id> "brief text"
cop_set_brief() {
  local id="$1" brief="$2"
  [[ -z "$id" || -z "$brief" ]] && { echo "Usage: cop_set_brief <session_id> <brief>" >&2; return 1; }
  cop_update_session "$id" "$(jq -n --arg b "$brief" '{mission_brief:$b}')"
}

# Link frameworks to session
# Usage: cop_link_frameworks <session_id> framework1 framework2 ...
cop_link_frameworks() {
  local id="$1"; shift
  [[ -z "$id" || $# -eq 0 ]] && { echo "Usage: cop_link_frameworks <session_id> fw1 fw2 ..." >&2; return 1; }
  local json
  json=$(printf '%s\n' "$@" | jq -R . | jq -s '{linked_frameworks:.}')
  cop_update_session "$id" "$json"
}

# ── RFIs ─────────────────────────────────────────────────────────

# List RFIs for session
# Usage: cop_rfis <session_id>
cop_rfis() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_rfis <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/rfis" | python3 -m json.tool
}

# Create RFI
# Usage: cop_add_rfi <session_id> "question" [priority] [is_blocker]
#   priority: critical|high|medium|low (default: medium)
#   is_blocker: true|false (default: false)
cop_add_rfi() {
  local id="$1" question="$2" priority="${3:-medium}" blocker="${4:-false}"
  [[ -z "$id" || -z "$question" ]] && { echo "Usage: cop_add_rfi <session_id> <question> [priority] [is_blocker]" >&2; return 1; }
  local is_blocker=false
  [[ "$blocker" == "true" || "$blocker" == "1" ]] && is_blocker=true
  _cop_post "/api/cop/$id/rfis" \
    "$(jq -n --arg q "$question" --arg p "$priority" --argjson b "$is_blocker" \
      '{question:$q, priority:$p, is_blocker:$b}')" | python3 -m json.tool
}

# Answer an RFI
# Usage: cop_answer_rfi <session_id> <rfi_id> "answer text"
cop_answer_rfi() {
  local sid="$1" rfi_id="$2" answer="$3"
  [[ -z "$sid" || -z "$rfi_id" || -z "$answer" ]] && { echo "Usage: cop_answer_rfi <session_id> <rfi_id> <answer>" >&2; return 1; }
  _cop_put "/api/cop/$sid/rfis" \
    "$(jq -n --arg id "$rfi_id" --arg a "$answer" \
      '{id:$id, status:"answered", answer:$a}')" | python3 -m json.tool
}

# Close an RFI
# Usage: cop_close_rfi <session_id> <rfi_id>
cop_close_rfi() {
  local sid="$1" rfi_id="$2"
  [[ -z "$sid" || -z "$rfi_id" ]] && { echo "Usage: cop_close_rfi <session_id> <rfi_id>" >&2; return 1; }
  _cop_put "/api/cop/$sid/rfis" \
    "$(jq -n --arg id "$rfi_id" '{id:$id, status:"closed"}')" | python3 -m json.tool
}

# ── Entities ─────────────────────────────────────────────────────

# Get workspace_id for a session (needed for entity operations)
cop_workspace_id() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_workspace_id <session_id>" >&2; return 1; }
  _cop_get "/api/cop/sessions/$id" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['workspace_id'])"
}

# List entities of a type for a session
# Usage: cop_entities <session_id> <type>
#   type: actors|events|sources|places|behaviors
cop_entities() {
  local id="$1" type="$2"
  [[ -z "$id" || -z "$type" ]] && { echo "Usage: cop_entities <session_id> <type>" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_get "/api/$type?workspace_id=$ws" | python3 -m json.tool
}

# Add actor
# Usage: cop_add_actor <session_id> "name" <type> ["description"]
#   type: PERSON|ORGANIZATION|UNIT|GOVERNMENT (must be uppercase)
cop_add_actor() {
  local id="$1" name="$2" type="$3" desc="${4:-}"
  [[ -z "$id" || -z "$name" || -z "$type" ]] && { echo "Usage: cop_add_actor <session_id> <name> <PERSON|ORGANIZATION|UNIT|GOVERNMENT> [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/actors" \
    "$(jq -n --arg n "$name" --arg t "$type" --arg d "$desc" --arg w "$ws" \
      '{name:$n, type:$t, description:$d, workspace_id:$w}')" | python3 -m json.tool
}

# Add event
# Usage: cop_add_event <session_id> "name" <type> ["description"] ["date_start"]
#   type: OPERATION|INCIDENT|MEETING|ACTIVITY
cop_add_event() {
  local id="$1" name="$2" type="$3" desc="${4:-}" date="${5:-}"
  [[ -z "$id" || -z "$name" || -z "$type" ]] && { echo "Usage: cop_add_event <session_id> <name> <OPERATION|INCIDENT|MEETING|ACTIVITY> [description] [date]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/events" \
    "$(jq -n --arg n "$name" --arg t "$type" --arg d "$desc" --arg dt "$date" --arg w "$ws" \
      '{name:$n, event_type:$t, description:$d, date_start:$dt, workspace_id:$w}')" | python3 -m json.tool
}

# Add source
# Usage: cop_add_source <session_id> "name" <type> ["description"]
#   type: HUMINT|SIGINT|IMINT|OSINT|TECHINT|MASINT
cop_add_source() {
  local id="$1" name="$2" type="$3" desc="${4:-}"
  [[ -z "$id" || -z "$name" || -z "$type" ]] && { echo "Usage: cop_add_source <session_id> <name> <type> [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/sources" \
    "$(jq -n --arg n "$name" --arg t "$type" --arg d "$desc" --arg w "$ws" \
      '{name:$n, type:$t, description:$d, workspace_id:$w}')" | python3 -m json.tool
}

# Add place
# Usage: cop_add_place <session_id> "name" <type> [lat] [lon] ["description"]
#   type: FACILITY|CITY|REGION|INSTALLATION|ROUTE|AREA
cop_add_place() {
  local id="$1" name="$2" type="$3" lat="${4:-}" lon="${5:-}" desc="${6:-}"
  [[ -z "$id" || -z "$name" || -z "$type" ]] && { echo "Usage: cop_add_place <session_id> <name> <type> [lat] [lon] [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  local json
  json=$(jq -n --arg n "$name" --arg t "$type" --arg d "$desc" --arg w "$ws" \
    '{name:$n, place_type:$t, description:$d, workspace_id:$w}')
  [[ -n "$lat" ]] && json=$(echo "$json" | jq --arg la "$lat" '. + {latitude:($la|tonumber)}')
  [[ -n "$lon" ]] && json=$(echo "$json" | jq --arg lo "$lon" '. + {longitude:($lo|tonumber)}')
  _cop_post "/api/places" "$json" | python3 -m json.tool
}

# ── Hypotheses ───────────────────────────────────────────────────

# List hypotheses
# Usage: cop_hypotheses <session_id>
cop_hypotheses() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_hypotheses <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/hypotheses" | python3 -m json.tool
}

# Add hypothesis
# Usage: cop_add_hypothesis <session_id> "statement" [confidence 0-100]
cop_add_hypothesis() {
  local id="$1" stmt="$2" conf="${3:-50}"
  [[ -z "$id" || -z "$stmt" ]] && { echo "Usage: cop_add_hypothesis <session_id> <statement> [confidence 0-100]" >&2; return 1; }
  _cop_post "/api/cop/$id/hypotheses" \
    "$(jq -n --arg s "$stmt" --argjson c "$conf" \
      '{statement:$s, confidence:$c}')" | python3 -m json.tool
}

# ── Tasks ────────────────────────────────────────────────────────

# List tasks
cop_tasks() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_tasks <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/tasks" | python3 -m json.tool
}

# Add task
# Usage: cop_add_task <session_id> "title" ["priority"] ["assigned_to"]
#   priority: critical|high|medium|low (default: medium)
cop_add_task() {
  local id="$1" title="$2" priority="${3:-medium}" assigned="${4:-}"
  [[ -z "$id" || -z "$title" ]] && { echo "Usage: cop_add_task <session_id> <title> [priority] [assigned_to]" >&2; return 1; }
  _cop_post "/api/cop/$id/tasks" \
    "$(jq -n --arg t "$title" --arg p "$priority" --arg a "$assigned" \
      '{title:$t, priority:$p, assigned_to:$a}')" | python3 -m json.tool
}

# ── Evidence ─────────────────────────────────────────────────────

# List evidence
cop_evidence() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_evidence <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/evidence" | python3 -m json.tool
}

# Add evidence item
# Usage: cop_add_evidence <session_id> "title" "description" ["type"] ["credibility"]
#   type: document|image|video|audio|testimony|signal|rfi_answer (default: document)
#   credibility: confirmed|probable|possible|doubtful|unverified (default: unverified)
cop_add_evidence() {
  local id="$1" title="$2" desc="$3" type="${4:-document}" cred="${5:-unverified}"
  [[ -z "$id" || -z "$title" || -z "$desc" ]] && { echo "Usage: cop_add_evidence <session_id> <title> <description> [type] [credibility]" >&2; return 1; }
  _cop_post "/api/cop/$id/evidence" \
    "$(jq -n --arg t "$title" --arg d "$desc" --arg ty "$type" --arg c "$cred" \
      '{title:$t, description:$d, evidence_type:$ty, credibility:$c}')" | python3 -m json.tool
}

# ── Stats & Activity ─────────────────────────────────────────────

# Get session stats
cop_stats() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_stats <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/stats" | python3 -m json.tool
}

# Get activity feed
cop_activity() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_activity <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/activity" | python3 -m json.tool
}

# ── Timeline ─────────────────────────────────────────────────────

# List timeline entries
cop_timeline() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_timeline <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/timeline" | python3 -m json.tool
}

# Add timeline entry
# Usage: cop_add_timeline <session_id> "title" "timestamp" ["description"] ["category"]
cop_add_timeline() {
  local id="$1" title="$2" ts="$3" desc="${4:-}" category="${5:-event}"
  [[ -z "$id" || -z "$title" || -z "$ts" ]] && { echo "Usage: cop_add_timeline <session_id> <title> <timestamp> [description] [category]" >&2; return 1; }
  _cop_post "/api/cop/$id/timeline" \
    "$(jq -n --arg t "$title" --arg ts "$ts" --arg d "$desc" --arg c "$category" \
      '{title:$t, timestamp:$ts, description:$d, category:$c}')" | python3 -m json.tool
}

# ── Markers ──────────────────────────────────────────────────────

# List map markers
cop_markers() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_markers <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/markers" | python3 -m json.tool
}

# Add map marker
# Usage: cop_add_marker <session_id> "label" <lat> <lon> ["type"] ["description"]
#   type: point|hostile|friendly|neutral|unknown (default: point)
cop_add_marker() {
  local id="$1" label="$2" lat="$3" lon="$4" type="${5:-point}" desc="${6:-}"
  [[ -z "$id" || -z "$label" || -z "$lat" || -z "$lon" ]] && { echo "Usage: cop_add_marker <session_id> <label> <lat> <lon> [type] [description]" >&2; return 1; }
  _cop_post "/api/cop/$id/markers" \
    "$(jq -n --arg l "$label" --arg la "$lat" --arg lo "$lon" --arg t "$type" --arg d "$desc" \
      '{label:$l, lat:($la|tonumber), lon:($lo|tonumber), marker_type:$t, description:$d}')" | python3 -m json.tool
}

# ── Help ─────────────────────────────────────────────────────────

cop_help() {
  cat <<'HELP'
COP API Functions — source scripts/cop-api.sh

  SESSIONS
    cop_sessions                                  List all sessions
    cop_session <id>                              Get session details
    cop_create_session <name> [desc] [template]   Create new session
    cop_update_session <id> '<json>'              Update session (raw JSON)
    cop_set_brief <id> "brief"                    Set mission brief
    cop_link_frameworks <id> fw1 fw2 ...          Link frameworks
    cop_workspace_id <id>                         Get workspace ID

  RFIs
    cop_rfis <id>                                 List RFIs
    cop_add_rfi <id> "question" [priority] [blocker]
    cop_answer_rfi <id> <rfi_id> "answer"
    cop_close_rfi <id> <rfi_id>

  ENTITIES (actors, events, sources, places)
    cop_entities <id> <type>                      List entities
    cop_add_actor <id> "name" TYPE [desc]
    cop_add_event <id> "name" TYPE [desc] [date]
    cop_add_source <id> "name" TYPE [desc]
    cop_add_place <id> "name" TYPE [lat] [lon] [desc]

  ANALYSIS
    cop_hypotheses <id>                           List hypotheses
    cop_add_hypothesis <id> "statement" [confidence]
    cop_tasks <id>                                List tasks
    cop_add_task <id> "title" [priority] [assigned]
    cop_evidence <id>                             List evidence
    cop_add_evidence <id> "title" "desc" [type] [cred]

  MAP & TIMELINE
    cop_markers <id>                              List markers
    cop_add_marker <id> "label" lat lon [type] [desc]
    cop_timeline <id>                             List timeline
    cop_add_timeline <id> "title" "timestamp" [desc] [category]

  OTHER
    cop_stats <id>                                Session statistics
    cop_activity <id>                             Activity feed
    cop_help                                      This help

  Priority: critical|high|medium|low
  Actor types: PERSON|ORGANIZATION|UNIT|GOVERNMENT (uppercase!)
  Event types: OPERATION|INCIDENT|MEETING|ACTIVITY
  Source types: HUMINT|SIGINT|IMINT|OSINT|TECHINT|MASINT
  Place types: FACILITY|CITY|REGION|INSTALLATION|ROUTE|AREA
HELP
}

echo "COP API functions loaded. Run 'cop_help' for usage."
