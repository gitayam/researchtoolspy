#!/bin/bash
# =============================================================================
# Populate COP session for DEF CON Persona Farm Investigation
# =============================================================================
# Populates the COP session with personas, RFIs, evidence, key questions,
# and map markers extracted from the live breakout chat log.
# =============================================================================

set -e

BASE_URL="${1:-https://researchtools.net}"
SESSION_ID="cop-b0f96023-cdf"

echo "🔧 Populating COP session: $SESSION_ID"
echo "   Base URL: $BASE_URL"
echo ""

# ── Common headers ──────────────────────────────────────────────
H=(-H "Content-Type: application/json" -H "X-User-Hash: setup-script")

# =============================================================================
# 1. Update session metadata (description, key_questions, event_facts)
# =============================================================================
echo "━━━ Step 1: Updating session metadata..."

curl -s -X PUT "$BASE_URL/api/cop/sessions/$SESSION_ID" \
  "${H[@]}" \
  -d '{
    "description": "Breaking the Horny Bot: Offensive Prompt Injection Against a Telegram Persona Farm. Geolocating a distributed Reddit → Telegram → OnlyFans scam/persona farm. Multiple personas funnel victims through automated Telegram bots to centralized OF monetization. Visual clues (outlets, architecture, vehicles, brands) suggest Argentina (Bariloche area). DEF CON talk research by John \"2PAC\".",
    "event_description": "Active engagement against a Reddit > Telegram > OnlyFans scammer group operating a distributed persona farm. Suspected single localized group operating multiple personas across platforms.",
    "event_facts": [
      "OnlyFans requires real ID verification — someone real is behind accounts",
      "Multiple personas share same Type I power outlets (Australia/NZ/Argentina/China)",
      "Type C outlets also observed in some images",
      "Jenny Grok analysis: Gira Standard 55 light switches = Germany/Austria/Switzerland (Schuko Type F)",
      "Van visible with text TRANSFER + LIMITADA (Spanish for Ltd.) + train icon",
      "Multiple shuttle services named Transfer operate from Bariloche airport (Cerro Catedral ski resort)",
      "Argentine luxury purse brand visible (brand only sells via .ar website)",
      "ALO Yoga brand present in Argentina",
      "IKEA table identified in one image (IKEA not yet in Argentina — contradicts)",
      "Soviet-era building architecture visible in skyline photos",
      "Hotel/Airbnb shooting locations for many photos (high quality beds, microwaves)",
      "Wide license plate visible on vehicle in Instagram post (European/South American format)",
      "NYC photo in Instagram story but NO proof of life for persona in image",
      "Tattoos match across multiple persona images — same person, different accounts",
      "Original Instagram @ufqsoo shows candid content — first non-curated social media found",
      "Reddit bots exhibit deterministic pacing, scripted escalation, centralized monetization convergence",
      "Prompt injection (say aardvark) forced bots to break persona",
      "Bot behavior predates known SaaS platforms offering similar automation"
    ],
    "key_questions": [
      "What is the physical location of the persona farm operators?",
      "Are all personas operated by a single localized group?",
      "Is the location Argentina (Bariloche), Eastern Europe, or Germany/DACH?",
      "What is the relationship between the Reddit acquisition bots and the OF accounts?",
      "Are the women in photos real, AI-generated, or stolen from other sources?",
      "Can the van/bus company be identified to confirm Bariloche?",
      "What is the significance of Type I vs Type C outlets appearing in different shots?",
      "Can Airbnb/hotel room reverse image search identify specific properties?",
      "Who is the real person behind the OF identity verification?",
      "Is this connected to the Ukrainian hackyourmom article about OF bot armies?"
    ]
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ Session updated')" 2>/dev/null || echo "  ⚠️  Session update (may need auth)"

echo ""

# =============================================================================
# 2. Create Personas
# =============================================================================
echo "━━━ Step 2: Creating personas..."

create_persona() {
  local name="$1" platform="$2" handle="$3" status="$4" notes="$5"
  local result=$(curl -s -X POST "$BASE_URL/api/cop/$SESSION_ID/personas" \
    "${H[@]}" \
    -d "{
      \"display_name\": \"$name\",
      \"platform\": \"$platform\",
      \"handle\": \"$handle\",
      \"status\": \"$status\",
      \"notes\": \"$notes\"
    }")
  echo "  ✅ $name (@$handle) on $platform"
}

create_persona "Rubia Sophia"     "instagram" "ufqsoo"           "active"    "ORIGINAL persona. Instagram has candid content + wide license plate vehicle. OF refers to her as Sophia. Also known as @rubiasophiee. First non-curated social media found."
create_persona "Rubia Sophia"     "other"     "rubiasophiee"     "active"    "OnlyFans persona. 53 leaked photos on Fapello. fapello.com/feed/1661867/"
create_persona "Lana Rae"         "twitter"   "lanaraae"         "active"    "X/Twitter + OF persona. Bio: 19, college girl, anime fan. Images show skyline + router on table (unusual). OF persona matches X account. Apartment shows Soviet-era buildings in background."
create_persona "Sophie Cupcake"   "other"     "sophiecupcake"    "active"    "RedGifs persona. 21 porn GIFs. redgifs.com/users/sophiecupcake"
create_persona "Your Babe Emma"   "other"     "yourbabeemma"     "active"    "OnlyFans persona. OF header image from public.onlyfans.com. thefap.net/yourbabeemma-359114/"
create_persona "Kristina Moon"    "other"     "kristinamoon"     "suspended" "OnlyFans persona. Account frozen. No known active social media. Nude leaks on fapopedia.net. Type I outlet visible in images."
create_persona "Zoe Plays Naughty" "other"    "zoeplaysnaughty"  "active"    "OnlyFans persona. Also znaughalty. Mix of hotel and home locations visible. fapello.com/zoeplaysnaughty/"
create_persona "Mira"             "other"     "mira"             "active"    "Unknown persona. Unclear outlet type in images. Blackout arm tattoo is distinctive — potential for tattoo artist identification."
create_persona "Annie019"         "other"     "annie019"         "active"    "OnlyFans persona. Found via jodic-forum.org siterip thread."
create_persona "Kaly Miranda"     "other"     "kaly-miranda"     "active"    "Cam persona on camirada.com. en.camirada.com/cam/kaly-miranda/photos"

echo ""

# =============================================================================
# 3. Create RFIs (Requests for Information)
# =============================================================================
echo "━━━ Step 3: Creating RFIs..."

create_rfi() {
  local question="$1" priority="$2" blocker="$3"
  curl -s -X POST "$BASE_URL/api/cop/$SESSION_ID/rfis" \
    "${H[@]}" \
    -d "{
      \"question\": \"$question\",
      \"priority\": \"$priority\",
      \"is_blocker\": $blocker
    }" > /dev/null 2>&1
  local flag=""
  [ "$blocker" = "1" ] && flag=" [BLOCKER]"
  echo "  ✅ ($priority)$flag $question"
}

create_rfi "Identify the van/bus company from ski resort photo — text reads TRANSFER + LIMITADA + train icon. Check Transfer Patagonia and other Bariloche airport shuttles." "high" 1
create_rfi "Identify the tattoo artist for Mira persona's chest tattoo — distinctive design, unlikely stock flash. Cross-reference Argentine/European tattoo artists." "medium" 0
create_rfi "Run AI authenticity detection on persona images — are they real photos, AI-generated (StableDiffusion), or augmented? John says they combat as likely genuine." "high" 1
create_rfi "Reverse image search hotel/Airbnb rooms with persona scrubbed — match against property listings in Bariloche area." "medium" 0
create_rfi "Identify the Argentine luxury purse brand visible in @rubiasophiee images — brand only sells via .ar website." "medium" 0
create_rfi "Confirm outlet type: Is the disputed outlet Type I (Argentina/Australia) or Type C (Europe)? Multiple outlet types across images suggest multiple shooting locations." "high" 0
create_rfi "Cross-reference @lanaraae skyline photo against Buenos Aires, Bariloche, and European city skylines." "high" 1
create_rfi "Check if IKEA has any presence (pop-up, reseller) in Argentina — IKEA table identified but IKEA reportedly not in Argentina." "low" 0
create_rfi "Investigate connection to hackyourmom.com article about Ukrainian OF bot armies — is this the same operation or a copycat?" "medium" 0
create_rfi "Find the bus from the ski resort photo — compare against Cerro Catedral (Bariloche) shuttle buses and Villa La Angostura transfers." "high" 1

echo ""

# =============================================================================
# 4. Create Map Markers
# =============================================================================
echo "━━━ Step 4: Creating map markers..."

create_marker() {
  local lat="$1" lon="$2" label="$3" callsign="$4" desc="$5" color="$6" cot_type="$7"
  curl -s -X POST "$BASE_URL/api/cop/$SESSION_ID/markers" \
    "${H[@]}" \
    -d "{
      \"lat\": $lat,
      \"lon\": $lon,
      \"label\": \"$label\",
      \"callsign\": \"$callsign\",
      \"description\": \"$desc\",
      \"color\": \"$color\",
      \"cot_type\": \"$cot_type\",
      \"source_type\": \"MANUAL\"
    }" > /dev/null 2>&1
  echo "  📍 $label ($lat, $lon)"
}

# Primary hypothesis: Bariloche, Argentina
create_marker "-41.1335" "-71.3103" "Cerro Catedral Ski Resort" "SKI-CATEDRAL" "Primary lead: Ski resort bus photo matches this area. Multiple transfer services (Transfer Patagonia etc.) operate from nearby airport. Type I outlets match Argentina." "red" "a-u-G"
create_marker "-41.1509" "-71.3481" "Bariloche Airport (Aeropuerto Teniente Luis Candelaria)" "APT-BARILOCHE" "Shuttle/transfer companies operate from here. Van with TRANSFER + LIMITADA text matches local operators." "orange" "a-f-G-I-H-T"
create_marker "-41.1335" "-71.3103" "San Carlos de Bariloche" "BARILOCHE" "Main city near ski resort. Argentine luxury brands, Type I outlets, ski access." "yellow" "a-u-G"

# Alternative hypotheses
create_marker "-34.6037" "-58.3816" "Buenos Aires" "BA" "Alternative: ChatGPT/GPT5.4 suggested skyline could match parts of Buenos Aires. Four Seasons area gives similar architecture vibes. ALO Yoga has presence." "blue" "a-u-G"
create_marker "41.7151" "44.8271" "Tbilisi, Georgia" "TBILISI" "Alternative hypothesis (Ryan): Soviet-era architecture matches. Handle-opening windows common. But outlet types don't match well." "blue" "a-u-G"
create_marker "52.5200" "13.4050" "Berlin, Germany" "BERLIN" "Alternative hypothesis (Jenny/Grok): Gira Standard 55 switches, Schuko Type F outlets, IKEA aesthetic, ductless mini-split AC. Strong match for some images." "blue" "a-u-G"
create_marker "48.2082" "16.3738" "Vienna, Austria" "VIENNA" "Alternative: DACH region (Germany/Austria/Switzerland). Same Schuko outlets as Germany." "blue" "a-u-G"

echo ""

# =============================================================================
# 5. Log activity entries for the investigation timeline
# =============================================================================
echo "━━━ Step 5: Creating activity log..."

create_activity() {
  local action="$1" details="$2" actor="$3"
  curl -s -X POST "$BASE_URL/api/cop/$SESSION_ID/activity" \
    "${H[@]}" \
    -d "{
      \"action\": \"$action\",
      \"details\": \"$details\",
      \"actor_name\": \"$actor\"
    }" > /dev/null 2>&1
  echo "  📋 [$actor] $action"
}

create_activity "investigation_started" "DEF CON talk research: Breaking the Horny Bot — Offensive Prompt Injection Against a Telegram Persona Farm. Investigating Reddit > Telegram > OnlyFans scammer group." "John 2PAC"
create_activity "evidence_submitted" "Original Instagram account discovered: @ufqsoo — first candid social media for persona farm. NSFW content warning." "John 2PAC"
create_activity "evidence_submitted" "fapello.com/feed/1661867/ — 53 leaked photos of @rubiasophiee persona" "John 2PAC"
create_activity "evidence_submitted" "redgifs.com/users/sophiecupcake — 21 GIFs linked to persona network" "John 2PAC"
create_activity "clue_identified" "Type I wall outlet identified in @rubiasophiee images — narrows to Australia/NZ/Argentina/China" "Luke Shirely"
create_activity "clue_identified" "Gira Standard 55 light switches + Schuko Type F outlets identified — points to Germany/Austria/Switzerland (DACH)" "Jenny Sowienski"
create_activity "hypothesis_created" "Initial hypothesis: Eastern Europe based on building materials, power switches, outlets" "John 2PAC"
create_activity "hypothesis_updated" "Ryan: Soviet-era buildings visible, sticking with Georgia guess" "Ryan O'Leary"
create_activity "evidence_submitted" "Van photo with TRANSFER + LIMITADA text + train icon visible near ski resort" "John 2PAC"
create_activity "clue_identified" "Argentine luxury purse brand identified — only sells via .ar website" "Sac"
create_activity "clue_identified" "ALO Yoga brand in image — has presence in Argentina" "JR"
create_activity "hypothesis_updated" "PIVOT: Multiple indicators now point to Argentina — Type I outlets + Argentine brands + Spanish text (Limitada) + ski resort" "John 2PAC"
create_activity "evidence_submitted" "Transfer Patagonia shuttle service operates from Bariloche airport near Cerro Catedral ski resort" "John 2PAC"
create_activity "clue_identified" "IKEA table identified in image but IKEA reportedly not in Argentina — contradictory evidence" "John 2PAC"
create_activity "evidence_submitted" "hackyourmom.com article: OF bot armies originating from Ukraine — possible connection to this operation" "John 2PAC"
create_activity "clue_identified" "Hotel microwave visible in image — 1000%% a hotel shooting location (Graves)" "Graves"
create_activity "clue_identified" "Tattoo match across multiple persona images — same person used across different accounts" "John 2PAC"

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ COP session populated!"
echo ""
echo "  Session:  $BASE_URL/dashboard/cop/$SESSION_ID"
echo ""
echo "  Created:"
echo "    • 10 personas (scam accounts across platforms)"
echo "    • 10 RFIs (4 blockers)"
echo "    •  7 map markers (primary + alternative hypotheses)"
echo "    • 17 activity log entries"
echo "    • 18 event facts"
echo "    • 10 key questions"
echo ""
echo "  Next steps:"
echo "    • Open Entities drawer (Cmd+E) to create Actors for confirmed personas"
echo "    • Use +actor in Quick Capture to promote key personas"
echo "    • Add evidence tags (infrastructure/outlets, logos/brands) via Gallery view"
echo "    • Pin additional clues to map as they're identified"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
