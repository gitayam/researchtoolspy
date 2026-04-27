# COM-B Analysis Public API

Three read-only endpoints expose the canonical Behaviour Change Wheel reference
data and recommendation logic. Useful for CLI tools, AI agents, integrations
(Signal bot, MCP servers, etc.), and third-party apps that want canon-backed
behaviour-change suggestions without re-implementing the BCW.

All endpoints return JSON. CORS-enabled. No authentication required (this is
public reference data; the underlying canon is published in Michie/Atkins/West
2014 and Michie 2013).

**Base URL:** `https://researchtools.net/api/frameworks/comb-analysis`

**Wiki summary:** <https://irregularpedia.org/general/behavior-analysis/>

---

## `GET /canon`

Returns the full Behaviour Change Wheel canon as a single JSON document:

- 6 COM-B sub-components
- 9 intervention functions (with definitions, examples, mapping)
- 7 policy categories (with definitions, examples, mapping)
- 16 BCT groupings (BCTTv1)
- COM-B → intervention function matrix (Table 2.3)
- intervention function → policy category matrix (Table 2.9)
- intervention function → BCT mapping (Table 3.3)
- Citations to Michie/Atkins/West 2014, Michie/van Stralen/West 2011, Michie/Richardson 2013

Cached for 1 hour at the edge.

```bash
curl -s https://researchtools.net/api/frameworks/comb-analysis/canon | jq '.intervention_functions[0]'
```

```json
{
  "id": "education",
  "definition": "Increasing knowledge or understanding",
  "example": "Providing information to promote healthy eating",
  "applicable_to_comb": [
    "psychological_capability",
    "reflective_motivation"
  ],
  "deliverable_via_policies": [
    "communication_marketing",
    "guidelines",
    "regulation",
    "legislation",
    "service_provision"
  ]
}
```

---

## `POST /recommend`

Given a map of COM-B deficits, returns canon-backed intervention function
recommendations grouped by COM-B component, sorted by severity.

**Request:**

```json
{
  "deficits": {
    "psychological_capability": "major_barrier",
    "physical_opportunity": "deficit",
    "reflective_motivation": "adequate"
  }
}
```

Valid component keys: `physical_capability`, `psychological_capability`,
`physical_opportunity`, `social_opportunity`, `reflective_motivation`,
`automatic_motivation`.

Valid deficit levels: `adequate`, `deficit`, `major_barrier`.

`adequate` components are skipped (no intervention needed).

**Example:**

```bash
curl -s -X POST https://researchtools.net/api/frameworks/comb-analysis/recommend \
  -H 'content-type: application/json' \
  -d '{"deficits":{"psychological_capability":"major_barrier","physical_opportunity":"deficit"}}' \
  | jq
```

**Response (truncated):**

```json
{
  "recommendations": [
    {
      "component": "psychological_capability",
      "severity": "major_barrier",
      "interventions": [
        {
          "function": "education",
          "priority": "high",
          "definition": "Increasing knowledge or understanding",
          "example": "Providing information to promote healthy eating",
          "applicable_policies": [
            "communication_marketing",
            "guidelines",
            "regulation",
            "legislation",
            "service_provision"
          ]
        },
        {
          "function": "training",
          "priority": "high",
          "definition": "Imparting skills",
          "example": "Advanced driver training to increase safe driving",
          "applicable_policies": [...]
        },
        {
          "function": "enablement",
          "priority": "high",
          "definition": "Increasing means / reducing barriers...",
          "applicable_policies": [...]
        }
      ]
    },
    {
      "component": "physical_opportunity",
      "severity": "deficit",
      "interventions": [...]
    }
  ],
  "citation": "Michie, Atkins & West (2014). The Behaviour Change Wheel: A Guide to Designing Interventions. Silverback Publishing. Tables 2.1, 2.3, 2.7, 2.9.",
  "wiki": "https://irregularpedia.org/general/behavior-analysis/"
}
```

---

## `POST /recommend-bcts`

Given a list of selected intervention functions, returns the recommended
Behaviour Change Techniques per BCW Guide Table 3.3 and BCTTv1.

**Request:**

```json
{ "functions": ["education", "training"] }
```

**Example:**

```bash
curl -s -X POST https://researchtools.net/api/frameworks/comb-analysis/recommend-bcts \
  -H 'content-type: application/json' \
  -d '{"functions":["education","training"]}' \
  | jq '.all_recommended[0:3]'
```

**Response (truncated):**

```json
{
  "by_function": {
    "education": {
      "mostFrequent": ["5.3", "5.1", "2.2", "2.7", "7.1", "2.3"],
      "lessFrequent": ["2.6", "2.4", "7.2", "7.6", "4.2", "4.3", "4.4", "5.6", "6.3"]
    },
    "training": {
      "mostFrequent": ["6.1", "4.1", "2.2", "2.7", "2.3", "8.1"],
      "lessFrequent": ["2.6", "2.4", "8.3", "8.4", "8.7", "4.4", "15.2", "15.4", "10.9"]
    }
  },
  "all_recommended": [
    {
      "id": "5.3",
      "group": 5,
      "group_name": "Natural consequences",
      "from_functions": ["education"],
      "priority": "most_frequent"
    },
    {
      "id": "2.2",
      "group": 2,
      "group_name": "Feedback and monitoring",
      "from_functions": ["education", "training"],
      "priority": "most_frequent"
    }
  ],
  "citations": [
    "Michie, Atkins & West (2014). The Behaviour Change Wheel: A Guide to Designing Interventions, Table 3.3.",
    "Michie, Richardson, Johnston, et al. (2013). Annals of Behavioral Medicine 46(1):81–95."
  ],
  "wiki": "https://irregularpedia.org/general/behavior-analysis/",
  "taxonomy": "https://www.ucl.ac.uk/health-psychology/BCTtaxonomy/"
}
```

---

## End-to-End Example: Diagnose → Functions → BCTs

Pipe the recommend output into recommend-bcts to get a full chain:

```bash
# 1. Diagnose: psychological capability is a major barrier
DEFICITS='{"deficits":{"psychological_capability":"major_barrier"}}'

# 2. Recommend intervention functions
FUNCTIONS=$(curl -s -X POST https://researchtools.net/api/frameworks/comb-analysis/recommend \
  -H 'content-type: application/json' -d "$DEFICITS" \
  | jq -c '{ functions: [.recommendations[].interventions[].function] | unique }')

echo "Recommended functions: $FUNCTIONS"

# 3. Recommend BCTs for those functions
curl -s -X POST https://researchtools.net/api/frameworks/comb-analysis/recommend-bcts \
  -H 'content-type: application/json' -d "$FUNCTIONS" \
  | jq '.all_recommended | map(select(.priority == "most_frequent"))'
```

---

## Use Cases

| Consumer | What this enables |
|---|---|
| Signal moderation bot | Suggest BCW-grounded interventions when handling member-behaviour conversations |
| MCP servers / AI agents | Ground LLM behaviour-change advice in the canonical taxonomy instead of hallucinated guidance |
| CLI scripts | Generate APEASE-ready intervention candidate lists for a behaviour analysis |
| Third-party tools | Re-implement the COM-B Analysis flow without re-encoding 93 BCTs and 5 reference tables |

---

## Source Maps

The endpoint logic lives in:

- `functions/api/frameworks/comb-analysis/_canon.ts` — server-side reference data + recommendation engine
- `functions/api/frameworks/comb-analysis/canon.ts` — `GET /canon` handler
- `functions/api/frameworks/comb-analysis/recommend.ts` — `POST /recommend` handler
- `functions/api/frameworks/comb-analysis/recommend-bcts.ts` — `POST /recommend-bcts` handler

The same logic also runs client-side in:

- `src/utils/behaviour-change-wheel.ts` (`generateInterventionRecommendations`,
  `COM_B_INTERVENTION_MAP`, `INTERVENTION_POLICY_MAP`)
- `src/utils/bct-taxonomy.ts` (`BCT_BY_FUNCTION`, `BCT_TAXONOMY`)

When updating the canon, both the server-side `_canon.ts` and the client-side
files must be kept in sync. (TODO: extract to a shared package.)

---

## Citations

- Michie, S., van Stralen, M.M., West, R. (2011). The behaviour change wheel:
  A new method for characterising and designing behaviour change interventions.
  *Implementation Science* 6:42.
- Michie, S., Atkins, L., West, R. (2014). *The Behaviour Change Wheel: A Guide
  to Designing Interventions.* Silverback Publishing. ISBN 978-1-912141-08-1.
- Michie, S., Richardson, M., Johnston, M., et al. (2013). The Behavior Change
  Technique Taxonomy (v1) of 93 hierarchically clustered techniques: building
  an international consensus for the reporting of behavior change interventions.
  *Annals of Behavioral Medicine* 46(1):81–95.

Wiki summary with worked examples: <https://irregularpedia.org/general/behavior-analysis/>
