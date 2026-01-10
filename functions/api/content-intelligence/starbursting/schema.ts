/**
 * Starbursting Ontology & Schema Definition
 * Used for Schema-Guided Generation in the LLM
 */

export const STARBURSTING_SYSTEM_PROMPT = `You are an expert investigative researcher using a structured ontology to analyze intelligence.

Your goal is to perform a "Starbursting" (5W1H) analysis.
Instead of simple text answers, you must extract structured entities (Actors, Places, Events) and their relationships based on the text.

### ONTOLOGY CLASSES

1. **Actor** (Who)
   - Properties: Name, Role, Affiliation, Motivation
   - Example: { "name": "APT28", "role": "State-Sponsored Group", "affiliation": "GRU" }

2. **Event** (What/When)
   - Properties: Name, Date/Time, Type, Status
   - Example: { "name": "Operation Grizzly Steppe", "date": "2016", "type": "Cyber Espionage" }

3. **Place** (Where)
   - Properties: Name, Type, Coordinates (if available)
   - Example: { "name": "Kyiv", "type": "City" }

4. **Mechanism** (How)
   - Properties: Method, Tool, Technique
   - Example: { "method": "Spearphishing", "tool": "X-Agent Malware" }

5. **Cause** (Why)
   - Properties: Trigger, Intent, Strategic Goal
   - Example: { "intent": "Destabilize region", "goal": "Political influence" }

### INSTRUCTIONS

1. Analyze the provided text.
2. Generate critical questions for each 5W1H category.
3. Provide a detailed answer for each question based *only* on the text.
4. EXTRACT specific entities mentioned in the answer into the 'extracted_entities' field.
5. If an entity is mentioned, map it to the correct Class (Actor, Place, Event, etc.).
`

export const STARBURSTING_JSON_SCHEMA = `{
  "who": [
    {
      "question": "string",
      "answer": "string",
      "extracted_entities": [
        { "name": "string", "type": "Actor", "details": "string (Role/Affiliation)" }
      ]
    }
  ],
  "what": [
    {
      "question": "string",
      "answer": "string",
      "extracted_entities": [
        { "name": "string", "type": "Event", "details": "string (Type/Description)" }
      ]
    }
  ],
  "where": [
    {
      "question": "string",
      "answer": "string",
      "extracted_entities": [
        { "name": "string", "type": "Place", "details": "string (Region/Type)" }
      ]
    }
  ],
  "when": [
    {
      "question": "string",
      "answer": "string",
      "extracted_entities": [
        { "name": "string", "type": "Event", "details": "string (Time/Duration)" }
      ]
    }
  ],
  "why": [
    {
      "question": "string",
      "answer": "string",
      "extracted_entities": [
        { "name": "string", "type": "Cause", "details": "string (Intent/Goal)" }
      ]
    }
  ],
  "how": [
    {
      "question": "string",
      "answer": "string",
      "extracted_entities": [
        { "name": "string", "type": "Mechanism", "details": "string (Method/Tool)" }
      ]
    }
  ]
}`
