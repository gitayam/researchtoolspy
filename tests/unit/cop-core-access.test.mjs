/**
 * COP write access and the change feed's coverage (contract Wave 0 + Wave 1).
 *
 * - Every write handler under functions/api/cop refuses a viewer collaborator and a
 *   stranger (403) and accepts the owner; editors and admin collaborators write too.
 * - Every successful write emits a cop_events row of the feed vocabulary, from the
 *   handler itself (called directly here, so the middleware's safety net can't hide
 *   a missing emit).
 * - A service credential deletes only the items it created.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { call, events, fixture, mod, SERVICE_USER, SESSION, setupCoreSuite, WS } from './cop-core-harness.mjs'

setupCoreSuite()

const T0 = '2026-10-23T00:00:00.000Z'
const SHARE_TOKEN = '11111111-1111-4111-8111-111111111111'

/** One row of each kind, with known ids, for the update and delete cases. */
function seedItems(db) {
  db.exec(`
    INSERT INTO cop_assets (id, cop_session_id, asset_type, name, status, created_by, workspace_id)
      VALUES ('ast-1', '${SESSION}', 'source', 'Gate camera', 'available', 1, '${WS}');
    INSERT INTO cop_tasks (id, cop_session_id, title, status, created_by, workspace_id, updated_at) VALUES
      ('task-1', '${SESSION}', 'Check the gate', 'todo', 1, '${WS}', '${T0}'),
      ('task-2', '${SESSION}', 'Captured by the bot', 'todo', ${SERVICE_USER}, '${WS}', '${T0}'),
      ('task-3', '${SESSION}', 'Third task', 'todo', 1, '${WS}', '${T0}');
    INSERT INTO cop_task_dependencies (id, task_id, depends_on_task_id, cop_session_id) VALUES ('dep-1', 'task-1', 'task-3', '${SESSION}');
    INSERT INTO cop_playbooks (id, cop_session_id, name, created_by, workspace_id) VALUES ('pb-1', '${SESSION}', 'Escalate', 1, '${WS}');
    INSERT INTO cop_playbook_rules (id, playbook_id, name, trigger_event) VALUES ('pbr-1', 'pb-1', 'On RFI', 'rfi.created');
    INSERT INTO cop_task_templates (id, name, created_by, workspace_id, tasks_json) VALUES ('ttpl-1', 'Recon', 1, '${WS}', '[{"title":"Look around"}]');
    INSERT INTO cop_intake_forms (id, cop_session_id, title, share_token, created_by, workspace_id) VALUES ('ifm-1', '${SESSION}', 'Tips', 'ifm-token-1', 1, '${WS}');
    INSERT INTO cop_timeline_entries (id, cop_session_id, workspace_id, event_date, title, source_type, created_by) VALUES
      ('tle-1', '${SESSION}', '${WS}', '2026-10-23', 'Kick-off', 'manual', 1),
      ('tle-bot', '${SESSION}', '${WS}', '2026-10-23', 'Decision from chat', 'manual', ${SERVICE_USER});
    INSERT INTO cop_claims (id, cop_session_id, workspace_id, claim_text, created_by, created_at, updated_at) VALUES
      ('clm-1', '${SESSION}', '${WS}', 'The gate closes at nine', '1', '${T0}', '${T0}'),
      ('clm-bot', '${SESSION}', '${WS}', 'Bot claim', '${SERVICE_USER}', '${T0}', '${T0}');
    INSERT INTO cop_hypotheses (id, cop_session_id, statement, created_by, workspace_id, updated_at) VALUES
      ('hyp-1', '${SESSION}', 'The crowd forms early', 1, '${WS}', '${T0}'),
      ('hyp-bot', '${SESSION}', 'Bot hypothesis', ${SERVICE_USER}, '${WS}', '${T0}');
    INSERT INTO cop_personas (id, cop_session_id, display_name, platform, created_by, workspace_id) VALUES
      ('per-1', '${SESSION}', '@watcher', 'twitter', 1, '${WS}'),
      ('per-bot', '${SESSION}', '@from_chat', 'other', ${SERVICE_USER}, '${WS}');
    INSERT INTO cop_poo_estimates (id, cop_session_id, workspace_id, name, impact_lat, impact_lon, created_by) VALUES
      ('poo-1', '${SESSION}', '${WS}', 'Impact', 48.9, 2.36, 1),
      ('poo-bot', '${SESSION}', '${WS}', 'Bot impact', 48.9, 2.36, ${SERVICE_USER});
    INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, created_by, workspace_id) VALUES
      ('mkr-1', '${SESSION}', 'uid-1', 48.9, 2.36, 1, '${WS}'),
      ('mkr-bot', '${SESSION}', 'uid-bot', 48.9, 2.36, ${SERVICE_USER}, '${WS}');
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by) VALUES
      (1001, 'Photo of the gate', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1),
      (1002, 'Link from chat', 'x', 'observation', 'unverified', 'unknown', '${WS}', ${SERVICE_USER});
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by, updated_at) VALUES ('rfi-bot', '${SESSION}', 'Asked in chat?', ${SERVICE_USER}, '${T0}');
    INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, created_by) VALUES ('ans-1', 'rfi-existing', 'Two guards', 1);
    INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_by) VALUES ('cops-1', '${SESSION}', '${SHARE_TOKEN}', '["map","rfi"]', 1);
    INSERT INTO cop_webcams (id, cop_session_id, provider, provider_ref, label, delivery, created_by) VALUES
      ('cam-1', '${SESSION}', 'windy', '1706619137', 'CESE', 'timelapse', 1),
      ('cam-bot', '${SESSION}', 'windy', '1706619139', 'Bot cam', 'timelapse', ${SERVICE_USER});
  `)
}

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }

/**
 * Every write handler: [name, handler, method, path, params, body, expected entity type].
 * entity null: the handler writes nothing (a dry run), so only the 403 applies.
 * ownerOnly: the handler is for the session owner (or an admin collaborator) only.
 */
const WRITES = [
  ['activity POST', 'activity', 'POST', `${P}/activity`, S, { action: 'viewed', entity_type: 'marker' }, 'activity'],
  ['alerts POST', 'alerts', 'POST', `${P}/alerts`, S, { action: 'dismiss', incident_id: 'inc-1' }, 'activity'],
  ['assets POST', 'assets', 'POST', `${P}/assets`, S, { name: 'Drone', asset_type: 'digital' }, 'asset'],
  ['assets PUT', 'assets', 'PUT', `${P}/assets`, S, { id: 'ast-1', status: 'deployed' }, 'asset'],
  ['assets DELETE', 'assets', 'DELETE', `${P}/assets?asset_id=ast-1`, S, undefined, 'asset'],
  ['asset check-in POST', 'assetCheckIn', 'POST', `${P}/assets/ast-1/check-in`, { ...S, assetId: 'ast-1' }, { status: 'degraded' }, 'asset'],
  ['claims POST', 'claims', 'POST', `${P}/claims`, S, { claims: [{ claim: 'The gate opens at eight' }], url: 'https://news.example/a' }, 'claim'],
  ['claims PUT', 'claims', 'PUT', `${P}/claims`, S, { claim_id: 'clm-1', status: 'disputed' }, 'claim'],
  ['claims DELETE', 'claims', 'DELETE', `${P}/claims?claim_id=clm-1`, S, undefined, 'claim'],
  ['collaborators POST', 'collaborators', 'POST', `${P}/collaborators`, S, { user_id: 4, role: 'viewer' }, 'session', { ownerOnly: true }],
  ['collaborators PUT', 'collaborators', 'PUT', `${P}/collaborators`, S, { collaborator_id: 'col-editor', availability: 'busy' }, 'session', { ownerOnly: true }],
  ['collaborators DELETE', 'collaborators', 'DELETE', `${P}/collaborators`, S, { collaborator_id: 'col-viewer' }, 'session', { ownerOnly: true }],
  ['evidence POST', 'evidence', 'POST', `${P}/evidence`, S, { title: 'Video of the gate', url: 'https://video.example/v1' }, 'evidence'],
  ['evidence DELETE', 'evidence', 'DELETE', `${P}/evidence?id=1001`, S, undefined, 'evidence'],
  ['evidence batch POST', 'evidenceBatch', 'POST', `${P}/evidence/batch`, S, { items: [{ title: 'A', url: 'https://a.example/1' }] }, 'evidence'],
  ['hypotheses POST', 'hypotheses', 'POST', `${P}/hypotheses`, S, { statement: 'Rain delays the opening' }, 'hypothesis'],
  ['hypotheses PUT', 'hypotheses', 'PUT', `${P}/hypotheses`, S, { id: 'hyp-1', confidence: 70 }, 'hypothesis'],
  ['hypotheses DELETE', 'hypotheses', 'DELETE', `${P}/hypotheses?id=hyp-1`, S, undefined, 'hypothesis'],
  ['intake forms POST', 'intakeForms', 'POST', `${P}/intake-forms`, S, { title: 'More tips' }, 'submission'],
  ['intake form PUT', 'intakeForm', 'PUT', `${P}/intake-forms/ifm-1`, { ...S, formId: 'ifm-1' }, { title: 'Tips, second round' }, 'submission'],
  ['marker changelog POST', 'markerChangelog', 'POST', `${P}/marker-changelog`, S, { marker_id: 'mkr-1', action: 'moved' }, 'marker'],
  ['markers POST', 'markers', 'POST', `${P}/markers`, S, { lat: 48.92, lon: 2.36, label: 'Stade de France' }, 'marker'],
  ['markers PUT', 'markers', 'PUT', `${P}/markers`, S, { id: 'mkr-1', confidence: 'PROBABLE' }, 'marker'],
  ['markers DELETE', 'markers', 'DELETE', `${P}/markers?id=mkr-1`, S, undefined, 'marker'],
  ['personas POST', 'personas', 'POST', `${P}/personas`, S, { display_name: '@spotter', platform: 'twitter' }, 'persona'],
  ['personas DELETE', 'personas', 'DELETE', `${P}/personas?id=per-1`, S, undefined, 'persona'],
  ['playbooks POST', 'playbooks', 'POST', `${P}/playbooks`, S, { name: 'Second playbook' }, 'playbook'],
  ['playbook PUT', 'playbook', 'PUT', `${P}/playbooks/pb-1`, { ...S, pbId: 'pb-1' }, { status: 'paused' }, 'playbook'],
  ['playbook DELETE', 'playbook', 'DELETE', `${P}/playbooks/pb-1`, { ...S, pbId: 'pb-1' }, undefined, 'playbook'],
  ['playbook rules POST', 'playbookRules', 'POST', `${P}/playbooks/pb-1/rules`, { ...S, pbId: 'pb-1' }, { name: 'On task', trigger_event: 'task.created' }, 'playbook'],
  ['playbook rules PUT', 'playbookRules', 'PUT', `${P}/playbooks/pb-1/rules`, { ...S, pbId: 'pb-1' }, { rule_id: 'pbr-1', enabled: false }, 'playbook'],
  ['playbook rules DELETE', 'playbookRules', 'DELETE', `${P}/playbooks/pb-1/rules?rule_id=pbr-1`, { ...S, pbId: 'pb-1' }, undefined, 'playbook'],
  ['playbook test POST', 'playbookTest', 'POST', `${P}/playbooks/pb-1/test`, { ...S, pbId: 'pb-1' }, { event_type: 'rfi.created' }, null],
  ['poo POST', 'poo', 'POST', `${P}/poo-estimates`, S, { name: 'Second impact', impact_lat: 48.9, impact_lon: 2.3 }, 'poo'],
  ['poo PUT', 'poo', 'PUT', `${P}/poo-estimates`, S, { estimate_id: 'poo-1', confidence: 'PROBABLE' }, 'poo'],
  ['poo DELETE', 'poo', 'DELETE', `${P}/poo-estimates?estimate_id=poo-1`, S, undefined, 'poo'],
  ['rfis POST', 'rfis', 'POST', `${P}/rfis`, S, { question: 'Where do the buses park?' }, 'rfi'],
  ['rfis PUT', 'rfis', 'PUT', `${P}/rfis`, S, { id: 'rfi-existing', priority: 'high' }, 'rfi'],
  ['rfi PUT', 'rfi', 'PUT', `${P}/rfis/rfi-existing`, { ...S, rfiId: 'rfi-existing' }, { status: 'closed' }, 'rfi'],
  ['rfi DELETE', 'rfi', 'DELETE', `${P}/rfis/rfi-existing`, { ...S, rfiId: 'rfi-existing' }, undefined, 'rfi'],
  ['rfi answers POST', 'rfiAnswers', 'POST', `${P}/rfis/rfi-existing/answers`, { ...S, rfiId: 'rfi-existing' }, { answer_text: 'Near the north gate' }, 'rfi'],
  ['rfi answers PUT', 'rfiAnswers', 'PUT', `${P}/rfis/rfi-existing/answers`, { ...S, rfiId: 'rfi-existing' }, { answer_id: 'ans-1', is_accepted: true }, 'rfi'],
  ['scrape POST', 'scrape', 'POST', `${P}/scrape`, S, { url: 'https://x.example/post/1' }, null],
  ['shares POST', 'shares', 'POST', `${P}/shares`, S, { visible_panels: ['map'] }, 'share'],
  ['shares PATCH', 'shares', 'PATCH', `${P}/shares?token=${SHARE_TOKEN}`, S, { allow_rfi_answers: true }, 'share'],
  ['shares DELETE', 'shares', 'DELETE', `${P}/shares?token=${SHARE_TOKEN}`, S, undefined, 'share'],
  ['task dependencies POST', 'taskDependencies', 'POST', `${P}/task-dependencies`, S, { task_id: 'task-2', depends_on_task_id: 'task-3' }, 'task'],
  ['task dependencies DELETE', 'taskDependencies', 'DELETE', `${P}/task-dependencies`, S, { id: 'dep-1' }, 'task'],
  ['task templates POST', 'taskTemplates', 'POST', `${P}/task-templates`, S, { name: 'Second template', tasks_json: [{ ref: 'step-1', title: 'Step one' }] }, 'task'],
  ['task templates PUT', 'taskTemplates', 'PUT', `${P}/task-templates`, S, { id: 'ttpl-1', name: 'Recon, revised' }, 'task'],
  ['task templates DELETE', 'taskTemplates', 'DELETE', `${P}/task-templates`, S, { id: 'ttpl-1' }, 'task'],
  ['tasks POST', 'tasks', 'POST', `${P}/tasks`, S, { title: 'Count the buses' }, 'task'],
  ['tasks PUT', 'tasks', 'PUT', `${P}/tasks`, S, { id: 'task-1', priority: 'high' }, 'task'],
  ['tasks DELETE', 'tasks', 'DELETE', `${P}/tasks?task_id=task-3`, S, undefined, 'task'],
  ['task reassign POST', 'taskReassign', 'POST', `${P}/tasks/task-1/reassign`, { ...S, taskId: 'task-1' }, { assigned_to: 'Editor' }, 'task'],
  ['task deploy-template POST', 'taskDeploy', 'POST', `${P}/tasks/deploy-template`, S, { template_id: 'ttpl-1' }, 'task'],
  ['timeline POST', 'timeline', 'POST', `${P}/timeline`, S, { title: 'Gates open', event_date: '2026-10-24' }, 'timeline'],
  ['timeline PUT', 'timeline', 'PUT', `${P}/timeline`, S, { entry_id: 'tle-1', title: 'Kick-off, moved' }, 'timeline'],
  ['timeline DELETE', 'timeline', 'DELETE', `${P}/timeline?entry_id=tle-1`, S, undefined, 'timeline'],
  ['webcams POST', 'webcams', 'POST', `${P}/webcams`, S, { url: 'windy:1706619138', label: 'Another camera' }, 'webcam'],
  ['webcam PATCH', 'webcam', 'PATCH', `${P}/webcams/cam-1`, { ...S, camId: 'cam-1' }, { label: 'CESE, west side' }, 'webcam'],
  ['webcam DELETE', 'webcam', 'DELETE', `${P}/webcams/cam-1`, { ...S, camId: 'cam-1' }, undefined, 'webcam'],
  ['session PUT', 'sessionItem', 'PUT', `/api/cop/sessions/${SESSION}`, S, { name: 'Paris overwatch, day two' }, 'session', { ownerOnly: true }],
  ['session DELETE', 'sessionItem', 'DELETE', `/api/cop/sessions/${SESSION}`, S, undefined, 'session', { ownerOnly: true }],
]

const ok = (status) => status >= 200 && status < 300

test('every write handler is in the table', () => {
  // A new write route must be added above: the table is the access contract.
  const names = new Set(WRITES.map(([, h, m]) => `${h} ${m}`))
  const expected = []
  for (const handler of ['activity', 'alerts', 'assets', 'assetCheckIn', 'claims', 'collaborators', 'evidence', 'evidenceBatch',
    'hypotheses', 'intakeForms', 'intakeForm', 'markerChangelog', 'markers', 'personas', 'playbooks', 'playbook', 'playbookRules',
    'playbookTest', 'poo', 'rfis', 'rfi', 'rfiAnswers', 'scrape', 'shares', 'taskDependencies', 'taskTemplates', 'tasks',
    'taskReassign', 'taskDeploy', 'timeline', 'webcams', 'webcam', 'sessionItem']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      if (mod(handler)[`onRequest${method[0]}${method.slice(1).toLowerCase()}`]) expected.push(`${handler} ${method}`)
    }
  }
  assert.deepEqual(expected.filter((e) => !names.has(e)), [])
})

for (const [name, handler, method, path, params, body] of WRITES) {
  test(`${name}: a viewer and a stranger are refused and nothing is written`, async () => {
    const { db, env } = await fixture({ seed: seedItems })
    const before = events(db).length
    for (const who of ['viewer', 'stranger']) {
      const res = await call(env, handler, method, path, { who, params, body })
      assert.equal(res.status, 403, `${who}: ${await res.text()}`)
    }
    assert.equal(events(db).length, before)
  })
}

for (const [name, handler, method, path, params, body, entity] of WRITES) {
  if (entity === null) continue
  test(`${name}: the owner writes and the handler emits a '${entity}' event`, async () => {
    const { db, env } = await fixture({ seed: seedItems })
    const before = events(db).length
    const res = await call(env, handler, method, path, { who: 'owner', params, body })
    assert.ok(ok(res.status), `${res.status}: ${await res.text()}`)
    const fresh = events(db).slice(before)
    assert.ok(fresh.some((e) => e.entity_type === entity), `events: ${JSON.stringify(fresh)}`)
  })
}

test('an editor and an admin collaborator write; the owner-only routes refuse an editor', async () => {
  for (const who of ['editor', 'admin']) {
    for (const [name, handler, method, path, params, body, , opts] of WRITES) {
      if (opts?.ownerOnly) continue
      if (name !== 'evidence POST' && name !== 'markers POST' && name !== 'tasks PUT' && name !== 'rfi PUT' && name !== 'shares POST') continue
      const { env } = await fixture({ seed: seedItems })
      const res = await call(env, handler, method, path, { who, params, body })
      assert.ok(ok(res.status), `${who} ${name}: ${res.status} ${await res.text()}`)
    }
  }
  const { env } = await fixture({ seed: seedItems })
  const res = await call(env, 'sessionItem', 'PUT', `/api/cop/sessions/${SESSION}`, { who: 'editor', params: S, body: { name: 'x' } })
  assert.equal(res.status, 403)
})

test('export stays readable by a viewer (it reads, it does not change the session)', async () => {
  const { env } = await fixture({ seed: seedItems })
  const res = await call(env, 'export', 'POST', `${P}/export`, { who: 'viewer', params: S, body: { format: 'json', scope: 'full' } })
  assert.notEqual(res.status, 403, await res.text())
})

// ── A service deletes only what it created ─────────────────────────

const SERVICE_DELETES = [
  ['tasks', `${P}/tasks?task_id=task-2`, `${P}/tasks?task_id=task-1`, S, S],
  ['evidence', `${P}/evidence?id=1002`, `${P}/evidence?id=1001`, S, S],
  ['markers', `${P}/markers?id=mkr-bot`, `${P}/markers?id=mkr-1`, S, S],
  ['rfi', `${P}/rfis/rfi-bot`, `${P}/rfis/rfi-existing`, { ...S, rfiId: 'rfi-bot' }, { ...S, rfiId: 'rfi-existing' }],
  ['timeline', `${P}/timeline?entry_id=tle-bot`, `${P}/timeline?entry_id=tle-1`, S, S],
  ['claims', `${P}/claims?claim_id=clm-bot`, `${P}/claims?claim_id=clm-1`, S, S],
  ['hypotheses', `${P}/hypotheses?id=hyp-bot`, `${P}/hypotheses?id=hyp-1`, S, S],
  ['personas', `${P}/personas?id=per-bot`, `${P}/personas?id=per-1`, S, S],
  ['poo', `${P}/poo-estimates?estimate_id=poo-bot`, `${P}/poo-estimates?estimate_id=poo-1`, S, S],
  ['webcam', `${P}/webcams/cam-bot`, `${P}/webcams/cam-1`, { ...S, camId: 'cam-bot' }, { ...S, camId: 'cam-1' }],
]

for (const [handler, ownPath, otherPath, ownParams, otherParams] of SERVICE_DELETES) {
  test(`a service deletes its own ${handler} items and nobody else's`, async () => {
    const { env } = await fixture({ seed: seedItems })
    const other = await call(env, handler, 'DELETE', otherPath, { who: 'service-admitted', params: otherParams })
    assert.equal(other.status, 403, await other.text())
    const own = await call(env, handler, 'DELETE', ownPath, { who: 'service-admitted', params: ownParams })
    assert.ok(ok(own.status), `${own.status} ${await own.text()}`)
    // A person with write access may delete anyone's.
    const person = await call(env, handler, 'DELETE', otherPath, { who: 'editor', params: otherParams })
    assert.ok(ok(person.status), `${person.status} ${await person.text()}`)
  })
}

// The bot's !cop confirm (marker PUT) and !cop star (RFI PUT) follow the same rule.
test('a service changes only the markers and RFIs it created', async () => {
  const { env } = await fixture({ seed: seedItems })
  const human = await call(env, 'markers', 'PUT', `${P}/markers`, { who: 'service-admitted', params: S, body: { id: 'mkr-1', confidence: 'PROBABLE' } })
  assert.equal(human.status, 403, await human.text())
  const own = await call(env, 'markers', 'PUT', `${P}/markers`, { who: 'service-admitted', params: S, body: { id: 'mkr-bot', confidence: 'PROBABLE' } })
  assert.ok(ok(own.status), `${own.status} ${await own.text()}`)
  const humanRfi = await call(env, 'rfi', 'PUT', `${P}/rfis/rfi-existing`, { who: 'service-admitted', params: { ...S, rfiId: 'rfi-existing' }, body: { priority: 'high' } })
  assert.equal(humanRfi.status, 403, await humanRfi.text())
  const ownRfi = await call(env, 'rfi', 'PUT', `${P}/rfis/rfi-bot`, { who: 'service-admitted', params: { ...S, rfiId: 'rfi-bot' }, body: { priority: 'high' } })
  assert.ok(ok(ownRfi.status), `${ownRfi.status} ${await ownRfi.text()}`)
  // A person with write access changes anyone's.
  const person = await call(env, 'markers', 'PUT', `${P}/markers`, { who: 'editor', params: S, body: { id: 'mkr-1', confidence: 'PROBABLE' } })
  assert.ok(ok(person.status), `${person.status} ${await person.text()}`)
})

test('the bot\'s delete parameter names (marker_id, evidence_id) work like id', async () => {
  const { env } = await fixture({ seed: seedItems })
  const marker = await call(env, 'markers', 'DELETE', `${P}/markers?marker_id=mkr-bot`, { who: 'service-admitted', params: S })
  assert.ok(ok(marker.status), `${marker.status} ${await marker.text()}`)
  const evidence = await call(env, 'evidence', 'DELETE', `${P}/evidence?evidence_id=1002`, { who: 'service-admitted', params: S })
  assert.ok(ok(evidence.status), `${evidence.status} ${await evidence.text()}`)
})
