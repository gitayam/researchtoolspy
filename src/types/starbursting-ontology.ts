// Starbursting Ontology
// Defines the structured output for 5W1H analysis
// Based on "Ontology-Driven Prompting" principles

import type { ActorType, PlaceType, EventType } from './entities'

export interface StarburstingEntity {
  name: string
  type: 'Actor' | 'Place' | 'Event'
  subtype?: ActorType | PlaceType | EventType | string // e.g. "Person", "City"
  description?: string
  confidence?: number // 0-1
}

export interface StarburstingAnswer {
  text: string
  confidence: 'High' | 'Medium' | 'Low'
  evidence_quotes?: string[]
  extracted_entities?: StarburstingEntity[]
}

export interface StarburstingQuestion {
  id: string
  category: 'who' | 'what' | 'where' | 'when' | 'why' | 'how'
  question: string
  answer: StarburstingAnswer
  reasoning: string // Why this question is important
}

export interface StarburstingAnalysisResult {
  who: StarburstingQuestion[]
  what: StarburstingQuestion[]
  where: StarburstingQuestion[]
  when: StarburstingQuestion[]
  why: StarburstingQuestion[]
  how: StarburstingQuestion[]
}
