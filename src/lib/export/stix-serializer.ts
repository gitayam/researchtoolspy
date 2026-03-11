/**
 * STIX 2.1 Bundle Serializer
 *
 * Maps COP entities to STIX Cyber Threat Intelligence objects:
 *   - Actors -> threat-actor (or identity for organizations)
 *   - Events -> incident
 *   - Places -> location
 *   - Evidence -> observed-data
 *   - Relationships -> relationship
 *   - Hypotheses -> opinion
 *
 * Spec: https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html
 *
 * Pure function: takes data objects, returns a JSON string. No D1 access.
 */

interface StixObject {
  type: string
  spec_version: '2.1'
  id: string
  created: string
  modified: string
  [key: string]: unknown
}

interface StixBundle {
  type: 'bundle'
  id: string
  objects: StixObject[]
}

function toStixId(type: string, copId: string): string {
  // STIX IDs use the format type--UUID
  // We deterministically derive from our COP IDs
  return `${type}--${copId}`
}

/**
 * Map COP entity type strings to STIX object types.
 */
function mapEntityTypeToStix(copType: string): string {
  const map: Record<string, string> = {
    ACTOR: 'threat-actor',
    PERSON: 'threat-actor',
    ORGANIZATION: 'identity',
    EVENT: 'incident',
    PLACE: 'location',
    EVIDENCE: 'observed-data',
  }
  return map[copType?.toUpperCase()] || 'identity'
}

/**
 * Map confidence (0-100) to STIX opinion enum.
 * STIX 2.1 opinion values: strongly-disagree, disagree, neutral, agree, strongly-agree
 */
function mapConfidenceToOpinion(confidence: number): string {
  if (confidence >= 80) return 'strongly-agree'
  if (confidence >= 60) return 'agree'
  if (confidence >= 40) return 'neutral'
  if (confidence >= 20) return 'disagree'
  return 'strongly-disagree'
}

export interface StixSessionInput {
  id: string
  name: string
  created_at: string
  updated_at?: string | null
}

export interface StixEntitiesInput {
  actors?: Array<{
    id: string
    name: string
    type?: string
    category?: string
    description?: string | null
    created_at?: string
    updated_at?: string | null
  }>
  events?: Array<{
    id: string
    name?: string
    title?: string
    event_type?: string
    description?: string | null
    created_at?: string
    updated_at?: string | null
  }>
  places?: Array<{
    id: string
    name: string
    description?: string | null
    coordinates?: string | { lat: number; lng: number } | null
    created_at?: string
    updated_at?: string | null
  }>
  evidence?: Array<{
    id: string
    title?: string
    type?: string
    source_url?: string | null
    created_at?: string
    updated_at?: string | null
  }>
  relationships?: Array<{
    id: string
    relationship_type?: string
    source_entity_type?: string
    source_entity_id?: string
    target_entity_type?: string
    target_entity_id?: string
    created_at?: string
    updated_at?: string | null
  }>
  hypotheses?: Array<{
    id: string
    statement?: string
    confidence?: number
    created_at?: string
    updated_at?: string | null
  }>
}

export function serializeStixBundle(
  session: StixSessionInput,
  entities: StixEntitiesInput
): string {
  const objects: StixObject[] = []
  const now = new Date().toISOString()

  // Identity for the COP session itself (source of analysis)
  objects.push({
    type: 'identity',
    spec_version: '2.1',
    id: toStixId('identity', session.id),
    created: session.created_at || now,
    modified: session.updated_at || now,
    name: session.name,
    identity_class: 'organization',
    description: `COP Session: ${session.name}`,
  })

  // Actors -> threat-actor or identity
  for (const actor of entities.actors || []) {
    const isOrg = actor.type?.toUpperCase() === 'ORGANIZATION'
    const stixType = isOrg ? 'identity' : 'threat-actor'
    objects.push({
      type: stixType,
      spec_version: '2.1',
      id: toStixId(stixType, actor.id),
      created: actor.created_at || now,
      modified: actor.updated_at || now,
      name: actor.name,
      description: actor.description || '',
      ...(isOrg
        ? { identity_class: 'organization' }
        : { threat_actor_types: [actor.category || 'unknown'] }),
    })
  }

  // Events -> incident
  for (const event of entities.events || []) {
    objects.push({
      type: 'incident',
      spec_version: '2.1',
      id: toStixId('incident', event.id),
      created: event.created_at || now,
      modified: event.updated_at || now,
      name: event.name || event.title || 'Unnamed event',
      description: event.description || '',
    })
  }

  // Places -> location
  for (const place of entities.places || []) {
    let lat: number | undefined
    let lng: number | undefined
    if (place.coordinates) {
      try {
        const coords =
          typeof place.coordinates === 'string'
            ? JSON.parse(place.coordinates)
            : place.coordinates
        lat = coords?.lat
        lng = coords?.lng
      } catch {
        // Skip invalid coordinates
      }
    }
    objects.push({
      type: 'location',
      spec_version: '2.1',
      id: toStixId('location', place.id),
      created: place.created_at || now,
      modified: place.updated_at || now,
      name: place.name,
      description: place.description || '',
      ...(lat != null && lng != null ? { latitude: lat, longitude: lng } : {}),
    })
  }

  // Evidence -> observed-data
  for (const ev of entities.evidence || []) {
    objects.push({
      type: 'observed-data',
      spec_version: '2.1',
      id: toStixId('observed-data', ev.id),
      created: ev.created_at || now,
      modified: ev.updated_at || now,
      first_observed: ev.created_at || now,
      last_observed: ev.updated_at || ev.created_at || now,
      number_observed: 1,
      object_refs: [],
    })
  }

  // Relationships -> relationship
  for (const rel of entities.relationships || []) {
    const relType = (rel.relationship_type || 'related-to')
      .toLowerCase()
      .replace(/_/g, '-')
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: toStixId('relationship', rel.id),
      created: rel.created_at || now,
      modified: rel.updated_at || now,
      relationship_type: relType,
      source_ref: toStixId(
        mapEntityTypeToStix(rel.source_entity_type || ''),
        rel.source_entity_id || ''
      ),
      target_ref: toStixId(
        mapEntityTypeToStix(rel.target_entity_type || ''),
        rel.target_entity_id || ''
      ),
    })
  }

  // Hypotheses -> opinion
  for (const hyp of entities.hypotheses || []) {
    objects.push({
      type: 'opinion',
      spec_version: '2.1',
      id: toStixId('opinion', hyp.id),
      created: hyp.created_at || now,
      modified: hyp.updated_at || now,
      explanation: hyp.statement || '',
      opinion: mapConfidenceToOpinion(hyp.confidence ?? 50),
      object_refs: [],
    })
  }

  const bundle: StixBundle = {
    type: 'bundle',
    id: `bundle--${session.id}`,
    objects,
  }

  return JSON.stringify(bundle, null, 2)
}
