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

# JSON pretty-print helper
_jpp() { python3 -m json.tool 2>/dev/null || cat; }

# ═════════════════════════════════════════════════════════════════
# SESSIONS
# ═════════════════════════════════════════════════════════════════

cop_session() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_session <session_id>" >&2; return 1; }
  _cop_get "/api/cop/sessions/$id" | _jpp
}

cop_sessions() {
  _cop_get "/api/cop/sessions" | _jpp
}

# Usage: cop_create_session "Name" ["description"] ["template_type"]
cop_create_session() {
  local name="$1" desc="${2:-}" template="${3:-custom}"
  [[ -z "$name" ]] && { echo "Usage: cop_create_session <name> [description] [template]" >&2; return 1; }
  _cop_post "/api/cop/sessions" \
    "$(jq -n --arg n "$name" --arg d "$desc" --arg t "$template" \
      '{name:$n, description:$d, template_type:$t}')" | _jpp
}

# Usage: cop_update_session <session_id> '{"mission_brief":"..."}'
cop_update_session() {
  local id="$1" body="$2"
  [[ -z "$id" || -z "$body" ]] && { echo "Usage: cop_update_session <session_id> '<json>'" >&2; return 1; }
  _cop_put "/api/cop/sessions/$id" "$body" | _jpp
}

cop_set_brief() {
  local id="$1" brief="$2"
  [[ -z "$id" || -z "$brief" ]] && { echo "Usage: cop_set_brief <session_id> <brief>" >&2; return 1; }
  cop_update_session "$id" "$(jq -n --arg b "$brief" '{mission_brief:$b}')"
}

# Usage: cop_link_frameworks <session_id> framework1 framework2 ...
cop_link_frameworks() {
  local id="$1"; shift
  [[ -z "$id" || $# -eq 0 ]] && { echo "Usage: cop_link_frameworks <session_id> fw1 fw2 ..." >&2; return 1; }
  local json
  json=$(printf '%s\n' "$@" | jq -R . | jq -s '{linked_frameworks:.}')
  cop_update_session "$id" "$json"
}

# Usage: cop_set_questions <session_id> "Q1" "Q2" ...
cop_set_questions() {
  local id="$1"; shift
  [[ -z "$id" || $# -eq 0 ]] && { echo "Usage: cop_set_questions <session_id> q1 q2 ..." >&2; return 1; }
  local json
  json=$(printf '%s\n' "$@" | jq -R . | jq -s '{key_questions:.}')
  cop_update_session "$id" "$json"
}

# Usage: cop_set_facts <session_id> "fact1" "fact2" ...
cop_set_facts() {
  local id="$1"; shift
  [[ -z "$id" || $# -eq 0 ]] && { echo "Usage: cop_set_facts <session_id> fact1 fact2 ..." >&2; return 1; }
  local json
  json=$(printf '%s\n' "$@" | jq -R . | jq -s '{event_facts:.}')
  cop_update_session "$id" "$json"
}

cop_delete_session() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_delete_session <session_id>" >&2; return 1; }
  _cop_delete "/api/cop/sessions/$id" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# RFIs
# ═════════════════════════════════════════════════════════════════

cop_rfis() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_rfis <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/rfis" | _jpp
}

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
      '{question:$q, priority:$p, is_blocker:$b}')" | _jpp
}

# Usage: cop_answer_rfi <session_id> <rfi_id> "answer" ["source_description"]
cop_answer_rfi() {
  local sid="$1" rfi_id="$2" answer="$3" src="${4:-}"
  [[ -z "$sid" || -z "$rfi_id" || -z "$answer" ]] && { echo "Usage: cop_answer_rfi <session_id> <rfi_id> <answer> [source_desc]" >&2; return 1; }
  _cop_put "/api/cop/$sid/rfis" \
    "$(jq -n --arg id "$rfi_id" --arg a "$answer" --arg s "$src" \
      '{id:$id, status:"answered", answer:$a, source_description:$s}')" | _jpp
}

# Usage: cop_update_rfi <session_id> <rfi_id> '{"status":"closed","priority":"low"}'
cop_update_rfi() {
  local sid="$1" rfi_id="$2" body="$3"
  [[ -z "$sid" || -z "$rfi_id" || -z "$body" ]] && { echo "Usage: cop_update_rfi <session_id> <rfi_id> '<json>'" >&2; return 1; }
  local merged
  merged=$(echo "$body" | jq --arg id "$rfi_id" '. + {id:$id}')
  _cop_put "/api/cop/$sid/rfis" "$merged" | _jpp
}

cop_close_rfi() {
  local sid="$1" rfi_id="$2"
  [[ -z "$sid" || -z "$rfi_id" ]] && { echo "Usage: cop_close_rfi <session_id> <rfi_id>" >&2; return 1; }
  _cop_put "/api/cop/$sid/rfis" \
    "$(jq -n --arg id "$rfi_id" '{id:$id, status:"closed"}')" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# ENTITIES (actors, events, sources, places, behaviors)
# ═════════════════════════════════════════════════════════════════

cop_workspace_id() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_workspace_id <session_id>" >&2; return 1; }
  _cop_get "/api/cop/sessions/$id" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['workspace_id'])"
}

# Usage: cop_entities <session_id> actors|events|sources|places|behaviors
cop_entities() {
  local id="$1" etype="$2"
  [[ -z "$id" || -z "$etype" ]] && { echo "Usage: cop_entities <session_id> <actors|events|sources|places|behaviors>" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_get "/api/$etype?workspace_id=$ws" | _jpp
}

# Usage: cop_add_actor <session_id> "name" PERSON|ORGANIZATION|UNIT|GOVERNMENT ["description"]
cop_add_actor() {
  local id="$1" name="$2" atype="$3" desc="${4:-}"
  [[ -z "$id" || -z "$name" || -z "$atype" ]] && { echo "Usage: cop_add_actor <session_id> <name> <PERSON|ORGANIZATION|UNIT|GOVERNMENT> [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/actors" \
    "$(jq -n --arg n "$name" --arg t "$atype" --arg d "$desc" --arg w "$ws" \
      '{name:$n, type:$t, description:$d, workspace_id:$w}')" | _jpp
}

# Usage: cop_add_event <session_id> "name" OPERATION|INCIDENT|MEETING|ACTIVITY ["description"] ["date_start"]
cop_add_event() {
  local id="$1" name="$2" etype="$3" desc="${4:-}" edate="${5:-}"
  [[ -z "$id" || -z "$name" || -z "$etype" ]] && { echo "Usage: cop_add_event <session_id> <name> <type> [description] [date_start]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/events" \
    "$(jq -n --arg n "$name" --arg t "$etype" --arg d "$desc" --arg dt "$edate" --arg w "$ws" \
      '{name:$n, event_type:$t, description:$d, date_start:$dt, workspace_id:$w}')" | _jpp
}

# Usage: cop_add_source <session_id> "name" HUMINT|SIGINT|IMINT|OSINT|TECHINT|MASINT ["description"]
cop_add_source() {
  local id="$1" name="$2" stype="$3" desc="${4:-}"
  [[ -z "$id" || -z "$name" || -z "$stype" ]] && { echo "Usage: cop_add_source <session_id> <name> <type> [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/sources" \
    "$(jq -n --arg n "$name" --arg t "$stype" --arg d "$desc" --arg w "$ws" \
      '{name:$n, type:$t, description:$d, workspace_id:$w}')" | _jpp
}

# Usage: cop_add_place <session_id> "name" FACILITY|CITY|REGION|INSTALLATION <lat> <lng> ["description"]
#   Note: coordinates uses {lat, lng} — both required by API
cop_add_place() {
  local id="$1" name="$2" ptype="$3" lat="$4" lng="$5" desc="${6:-}"
  [[ -z "$id" || -z "$name" || -z "$ptype" || -z "$lat" || -z "$lng" ]] && {
    echo "Usage: cop_add_place <session_id> <name> <type> <lat> <lng> [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/places" \
    "$(jq -n --arg n "$name" --arg t "$ptype" --arg d "$desc" --arg w "$ws" \
      --argjson la "$lat" --argjson lo "$lng" \
      '{name:$n, place_type:$t, description:$d, workspace_id:$w, coordinates:{lat:$la, lng:$lo}}')" | _jpp
}

# Usage: cop_add_behavior <session_id> "name" TTP|TACTIC|TECHNIQUE|PROCEDURE ["description"]
cop_add_behavior() {
  local id="$1" name="$2" btype="$3" desc="${4:-}"
  [[ -z "$id" || -z "$name" || -z "$btype" ]] && { echo "Usage: cop_add_behavior <session_id> <name> <type> [description]" >&2; return 1; }
  local ws
  ws=$(cop_workspace_id "$id") || return 1
  _cop_post "/api/behaviors" \
    "$(jq -n --arg n "$name" --arg t "$btype" --arg d "$desc" --arg w "$ws" \
      '{name:$n, behavior_type:$t, description:$d, workspace_id:$w}')" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# HYPOTHESES (ACH)
# ═════════════════════════════════════════════════════════════════

cop_hypotheses() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_hypotheses <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/hypotheses" | _jpp
}

# Usage: cop_add_hypothesis <session_id> "statement" [confidence 0-100]
cop_add_hypothesis() {
  local id="$1" stmt="$2" conf="${3:-50}"
  [[ -z "$id" || -z "$stmt" ]] && { echo "Usage: cop_add_hypothesis <session_id> <statement> [confidence]" >&2; return 1; }
  _cop_post "/api/cop/$id/hypotheses" \
    "$(jq -n --arg s "$stmt" --argjson c "$conf" \
      '{statement:$s, confidence:$c}')" | _jpp
}

# Usage: cop_update_hypothesis <session_id> <hyp_id> '{"status":"proven","confidence":90}'
#   status: active|proven|disproven|archived
cop_update_hypothesis() {
  local sid="$1" hyp_id="$2" body="$3"
  [[ -z "$sid" || -z "$hyp_id" || -z "$body" ]] && { echo "Usage: cop_update_hypothesis <session_id> <hyp_id> '<json>'" >&2; return 1; }
  local merged
  merged=$(echo "$body" | jq --arg id "$hyp_id" '. + {id:$id}')
  _cop_put "/api/cop/$sid/hypotheses" "$merged" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# TASKS
# ═════════════════════════════════════════════════════════════════

cop_tasks() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_tasks <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/tasks" | _jpp
}

# Usage: cop_add_task <session_id> "title" [priority] [task_type] [assigned_to]
#   priority: critical|high|medium|low
#   task_type: general|pimeyes|geoguessr|forensic|osint|reverse_image|social_media
cop_add_task() {
  local id="$1" title="$2" priority="${3:-medium}" ttype="${4:-general}" assigned="${5:-}"
  [[ -z "$id" || -z "$title" ]] && { echo "Usage: cop_add_task <session_id> <title> [priority] [task_type] [assigned_to]" >&2; return 1; }
  _cop_post "/api/cop/$id/tasks" \
    "$(jq -n --arg t "$title" --arg p "$priority" --arg tt "$ttype" --arg a "$assigned" \
      '{title:$t, priority:$p, task_type:$tt, assigned_to:$a}')" | _jpp
}

# Usage: cop_update_task <session_id> <task_id> '{"status":"done"}'
#   status: todo|in_progress|done|blocked
cop_update_task() {
  local sid="$1" task_id="$2" body="$3"
  [[ -z "$sid" || -z "$task_id" || -z "$body" ]] && { echo "Usage: cop_update_task <session_id> <task_id> '<json>'" >&2; return 1; }
  local merged
  merged=$(echo "$body" | jq --arg id "$task_id" '. + {id:$id}')
  _cop_put "/api/cop/$sid/tasks" "$merged" | _jpp
}

cop_delete_task() {
  local sid="$1" task_id="$2"
  [[ -z "$sid" || -z "$task_id" ]] && { echo "Usage: cop_delete_task <session_id> <task_id>" >&2; return 1; }
  _cop_delete "/api/cop/$sid/tasks?task_id=$task_id" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# EVIDENCE
# ═════════════════════════════════════════════════════════════════

cop_evidence() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_evidence <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/evidence" | _jpp
}

# Usage: cop_add_evidence <session_id> "title" ["content"] ["url"] ["source_type"] ["credibility"]
#   source_type: observation|document|image|video|testimony|signal (default: observation)
#   credibility: confirmed|probable|possible|doubtful|unverified (default: unverified)
cop_add_evidence() {
  local id="$1" title="$2" content="${3:-}" url="${4:-}" stype="${5:-observation}" cred="${6:-unverified}"
  [[ -z "$id" || -z "$title" ]] && { echo "Usage: cop_add_evidence <session_id> <title> [content] [url] [source_type] [credibility]" >&2; return 1; }
  _cop_post "/api/cop/$id/evidence" \
    "$(jq -n --arg t "$title" --arg c "$content" --arg u "$url" --arg st "$stype" --arg cr "$cred" \
      '{title:$t, content:$c, url:$u, source_type:$st, credibility:$cr}')" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# TIMELINE
# ═════════════════════════════════════════════════════════════════

cop_timeline() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_timeline <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/timeline" | _jpp
}

# Usage: cop_add_timeline <session_id> "title" ["event_date"] ["description"] ["category"] ["importance"]
#   event_date: YYYY-MM-DD (default: today)
#   category: event|meeting|communication|financial|legal|travel|publication|military|political
#   importance: normal|high|critical
cop_add_timeline() {
  local id="$1" title="$2" edate="${3:-}" desc="${4:-}" category="${5:-event}" importance="${6:-normal}"
  [[ -z "$id" || -z "$title" ]] && { echo "Usage: cop_add_timeline <session_id> <title> [event_date] [description] [category] [importance]" >&2; return 1; }
  [[ -z "$edate" ]] && edate=$(date +%Y-%m-%d)
  _cop_post "/api/cop/$id/timeline" \
    "$(jq -n --arg t "$title" --arg d "$edate" --arg desc "$desc" --arg c "$category" --arg i "$importance" \
      '{title:$t, event_date:$d, description:$desc, category:$c, importance:$i}')" | _jpp
}

# Usage: cop_update_timeline <session_id> <entry_id> '{"title":"...","category":"military"}'
cop_update_timeline() {
  local sid="$1" entry_id="$2" body="$3"
  [[ -z "$sid" || -z "$entry_id" || -z "$body" ]] && { echo "Usage: cop_update_timeline <session_id> <entry_id> '<json>'" >&2; return 1; }
  local merged
  merged=$(echo "$body" | jq --arg id "$entry_id" '. + {entry_id:$id}')
  _cop_put "/api/cop/$sid/timeline" "$merged" | _jpp
}

cop_delete_timeline() {
  local sid="$1" entry_id="$2"
  [[ -z "$sid" || -z "$entry_id" ]] && { echo "Usage: cop_delete_timeline <session_id> <entry_id>" >&2; return 1; }
  _cop_delete "/api/cop/$sid/timeline?entry_id=$entry_id" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# MARKERS (map pins)
# ═════════════════════════════════════════════════════════════════

cop_markers() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_markers <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/markers" | _jpp
}

# Usage: cop_add_marker <session_id> <lat> <lon> ["label"] ["cot_type"] ["confidence"] ["description"]
#   cot_type: CoT type code (default: a-u-G for unknown ground)
#   confidence: CONFIRMED|PROBABLE|POSSIBLE|SUSPECTED|DOUBTFUL (default: POSSIBLE)
cop_add_marker() {
  local id="$1" lat="$2" lon="$3" label="${4:-}" cot="${5:-a-u-G}" conf="${6:-POSSIBLE}" desc="${7:-}"
  [[ -z "$id" || -z "$lat" || -z "$lon" ]] && { echo "Usage: cop_add_marker <session_id> <lat> <lon> [label] [cot_type] [confidence] [description]" >&2; return 1; }
  _cop_post "/api/cop/$id/markers" \
    "$(jq -n --argjson la "$lat" --argjson lo "$lon" --arg l "$label" --arg c "$cot" --arg co "$conf" --arg d "$desc" \
      '{lat:$la, lon:$lo, label:$l, cot_type:$c, confidence:$co, description:$d}')" | _jpp
}

# Usage: cop_update_marker <session_id> <marker_id> '{"label":"...","confidence":"CONFIRMED"}'
cop_update_marker() {
  local sid="$1" mkr_id="$2" body="$3"
  [[ -z "$sid" || -z "$mkr_id" || -z "$body" ]] && { echo "Usage: cop_update_marker <session_id> <marker_id> '<json>'" >&2; return 1; }
  local merged
  merged=$(echo "$body" | jq --arg id "$mkr_id" '. + {id:$id}')
  _cop_put "/api/cop/$sid/markers" "$merged" | _jpp
}

cop_delete_marker() {
  local sid="$1" mkr_id="$2"
  [[ -z "$sid" || -z "$mkr_id" ]] && { echo "Usage: cop_delete_marker <session_id> <marker_id>" >&2; return 1; }
  _cop_delete "/api/cop/$sid/markers?marker_id=$mkr_id" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# CLAIMS
# ═════════════════════════════════════════════════════════════════

cop_claims() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_claims <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/claims" | _jpp
}

# Usage: cop_add_claims <session_id> '{"claims":[{"claim":"..."}],"url":"...","title":"..."}'
#   Each claim: {claim:"text", category:"optional", confidence:0-100}
#   Top-level: url, title, domain, summary
cop_add_claims() {
  local id="$1" body="$2"
  [[ -z "$id" || -z "$body" ]] && { echo "Usage: cop_add_claims <session_id> '<json>'" >&2; return 1; }
  _cop_post "/api/cop/$id/claims" "$body" | _jpp
}

# Usage: cop_verify_claim <session_id> <claim_id> verified|disputed|false [promote_to_evidence]
cop_verify_claim() {
  local sid="$1" claim_id="$2" vstatus="$3" promote="${4:-false}"
  [[ -z "$sid" || -z "$claim_id" || -z "$vstatus" ]] && { echo "Usage: cop_verify_claim <session_id> <claim_id> <verified|disputed|false> [promote_to_evidence]" >&2; return 1; }
  local promo=false
  [[ "$promote" == "true" || "$promote" == "1" ]] && promo=true
  _cop_put "/api/cop/$sid/claims" \
    "$(jq -n --arg id "$claim_id" --arg s "$vstatus" --argjson p "$promo" \
      '{claim_id:$id, status:$s, promote_to_evidence:$p}')" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# PERSONAS
# ═════════════════════════════════════════════════════════════════

cop_personas() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_personas <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/personas" | _jpp
}

# Usage: cop_add_persona <session_id> "display_name" <platform> ["handle"] ["profile_url"] ["notes"]
#   platform: twitter|telegram|reddit|onlyfans|instagram|tiktok|other
cop_add_persona() {
  local id="$1" name="$2" platform="$3" handle="${4:-}" url="${5:-}" notes="${6:-}"
  [[ -z "$id" || -z "$name" || -z "$platform" ]] && { echo "Usage: cop_add_persona <session_id> <display_name> <platform> [handle] [profile_url] [notes]" >&2; return 1; }
  _cop_post "/api/cop/$id/personas" \
    "$(jq -n --arg n "$name" --arg p "$platform" --arg h "$handle" --arg u "$url" --arg no "$notes" \
      '{display_name:$n, platform:$p, handle:$h, profile_url:$u, notes:$no}')" | _jpp
}

# Usage: cop_link_personas <session_id> <persona_a_id> <persona_b_id> [link_type] [confidence]
#   link_type: alias|operator|affiliated|unknown (default: alias)
cop_link_personas() {
  local sid="$1" a_id="$2" b_id="$3" ltype="${4:-alias}" conf="${5:-50}"
  [[ -z "$sid" || -z "$a_id" || -z "$b_id" ]] && { echo "Usage: cop_link_personas <session_id> <persona_a_id> <persona_b_id> [link_type] [confidence]" >&2; return 1; }
  _cop_post "/api/cop/$sid/personas?action=link" \
    "$(jq -n --arg a "$a_id" --arg b "$b_id" --arg t "$ltype" --argjson c "$conf" \
      '{persona_a_id:$a, persona_b_id:$b, link_type:$t, confidence:$c}')" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# SHARES (public links)
# ═════════════════════════════════════════════════════════════════

cop_shares() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_shares <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/shares" | _jpp
}

# Usage: cop_add_share <session_id> [allow_rfi_answers] [panels...]
#   panels: map|event|claims|rfi|questions|network (map always included)
cop_add_share() {
  local id="$1" allow_rfi="${2:-false}"; shift 2 2>/dev/null
  [[ -z "$id" ]] && { echo "Usage: cop_add_share <session_id> [allow_rfi_answers] [panels...]" >&2; return 1; }
  local rfi_bool=false
  [[ "$allow_rfi" == "true" || "$allow_rfi" == "1" ]] && rfi_bool=true
  local panels='["map"]'
  if [[ $# -gt 0 ]]; then
    panels=$(printf '%s\n' "$@" | jq -R . | jq -s .)
  fi
  _cop_post "/api/cop/$id/shares" \
    "$(jq -n --argjson rfi "$rfi_bool" --argjson p "$panels" \
      '{allow_rfi_answers:$rfi, visible_panels:$p}')" | _jpp
}

cop_delete_share() {
  local sid="$1" token="$2"
  [[ -z "$sid" || -z "$token" ]] && { echo "Usage: cop_delete_share <session_id> <share_token>" >&2; return 1; }
  _cop_delete "/api/cop/$sid/shares?token=$token" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# STATS & ACTIVITY
# ═════════════════════════════════════════════════════════════════

cop_stats() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_stats <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/stats" | _jpp
}

cop_activity() {
  local id="$1"
  [[ -z "$id" ]] && { echo "Usage: cop_activity <session_id>" >&2; return 1; }
  _cop_get "/api/cop/$id/activity" | _jpp
}

# ═════════════════════════════════════════════════════════════════
# HELP
# ═════════════════════════════════════════════════════════════════

cop_help() {
  cat <<'HELP'
COP API Functions — source scripts/cop-api.sh

  SESSIONS
    cop_sessions                                       List all sessions
    cop_session <id>                                   Get session details
    cop_create_session <name> [desc] [template]        Create new session
    cop_update_session <id> '<json>'                   Update session (raw JSON)
    cop_set_brief <id> "brief"                         Set mission brief
    cop_set_questions <id> "Q1" "Q2" ...               Set key questions
    cop_set_facts <id> "fact1" "fact2" ...             Set event facts
    cop_link_frameworks <id> fw1 fw2 ...               Link frameworks
    cop_workspace_id <id>                              Get workspace ID
    cop_delete_session <id>                            Archive session

  RFIs
    cop_rfis <id>                                      List RFIs
    cop_add_rfi <id> "question" [priority] [blocker]   Create RFI
    cop_answer_rfi <id> <rfi_id> "answer" [source]     Answer RFI
    cop_update_rfi <id> <rfi_id> '<json>'              Update RFI fields
    cop_close_rfi <id> <rfi_id>                        Close RFI

  ENTITIES
    cop_entities <id> <type>                           List (actors|events|sources|places|behaviors)
    cop_add_actor <id> "name" TYPE [desc]              PERSON|ORGANIZATION|UNIT|GOVERNMENT
    cop_add_event <id> "name" TYPE [desc] [date]       OPERATION|INCIDENT|MEETING|ACTIVITY
    cop_add_source <id> "name" TYPE [desc]             HUMINT|SIGINT|IMINT|OSINT|TECHINT|MASINT
    cop_add_place <id> "name" TYPE lat lng [desc]      FACILITY|CITY|REGION|INSTALLATION
    cop_add_behavior <id> "name" TYPE [desc]           TTP|TACTIC|TECHNIQUE|PROCEDURE

  HYPOTHESES (ACH)
    cop_hypotheses <id>                                List hypotheses
    cop_add_hypothesis <id> "statement" [confidence]   Create (confidence 0-100)
    cop_update_hypothesis <id> <hyp_id> '<json>'       Update status/confidence

  TASKS
    cop_tasks <id>                                     List tasks
    cop_add_task <id> "title" [priority] [type] [assigned]
    cop_update_task <id> <task_id> '<json>'            Update status/fields
    cop_delete_task <id> <task_id>                     Delete task

  EVIDENCE
    cop_evidence <id>                                  List evidence
    cop_add_evidence <id> "title" [content] [url] [source_type] [credibility]

  TIMELINE
    cop_timeline <id>                                  List entries
    cop_add_timeline <id> "title" [date] [desc] [category] [importance]
    cop_update_timeline <id> <entry_id> '<json>'       Update entry
    cop_delete_timeline <id> <entry_id>                Delete entry

  MARKERS (map pins)
    cop_markers <id>                                   List markers
    cop_add_marker <id> lat lon [label] [cot_type] [confidence] [desc]
    cop_update_marker <id> <mkr_id> '<json>'           Update marker
    cop_delete_marker <id> <mkr_id>                    Delete marker

  CLAIMS
    cop_claims <id>                                    List claims
    cop_add_claims <id> '<json>'                       Bulk add claims
    cop_verify_claim <id> <claim_id> <status> [promote]

  PERSONAS
    cop_personas <id>                                  List personas
    cop_add_persona <id> "name" <platform> [handle] [url] [notes]
    cop_link_personas <id> <a_id> <b_id> [type] [confidence]

  SHARES (public links)
    cop_shares <id>                                    List shares
    cop_add_share <id> [allow_rfi] [panels...]         Create share link
    cop_delete_share <id> <token>                      Revoke share

  OTHER
    cop_stats <id>                                     Session statistics
    cop_activity <id>                                  Activity feed
    cop_help                                           This help

  TYPES REFERENCE
    Priority:    critical|high|medium|low
    Task status: todo|in_progress|done|blocked
    Hyp status:  active|proven|disproven|archived
    RFI status:  open|answered|closed|blocked
    Claim:       unverified|verified|disputed|false
    Confidence:  CONFIRMED|PROBABLE|POSSIBLE|SUSPECTED|DOUBTFUL (markers)
    Platforms:   twitter|telegram|reddit|onlyfans|instagram|tiktok|other
    Timeline:    event|meeting|communication|financial|legal|travel|publication|military|political
    Evidence:    observation|document|image|video|testimony|signal
    Credibility: confirmed|probable|possible|doubtful|unverified
HELP
}

echo "COP API functions loaded. Run 'cop_help' for usage."
