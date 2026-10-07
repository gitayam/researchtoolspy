# Remarks Planner (BRIEF Map for spoken comment) — placement and design

**Date:** 2026-10-07 · **Status:** researchtools side implemented (endpoint, contract, framework type, discovery, tests); DTA client in that repo · **Origin:** DTA's
first City Council public forum appearance (2026-10-05) ran out of its three
minutes before reaching the ask. The retrospective and the method are in
`~/Git/dta/docs/public-comment-guide.md`. This note answers one question: where
does a *planning* tool for spoken remarks fit in a platform built for
*research*, so that DTA and other projects can call it over the API.

## The short answer

Three thin pieces, each in a place the codebase already has, and no new table:

| Piece | Where | Why there |
|---|---|---|
| A `brief-map` framework type | `src/config/framework-configs.ts` + a system row in `framework_templates` | The BRIEF Map *is* a sectioned analytic template. The generic form/view, share tokens, templates, and exports come for free. One config entry, zero new components. |
| A deterministic planning contract | `functions/api/_shared/remarks-contract.ts` (mirrored for the client like the other contracts) | Word budgets, clock marks, the "ask is in the first two sentences and the last" check, and a post-model fact guard are arithmetic, not AI. Testable without a model. |
| `POST /api/research/plan-remarks` | sibling of `research/generate-question.ts` and `research/generate-plan.ts` | Same two-caller shape: users persist if they choose; scoped `rt_svc_` callers are non-persistent and bounded. That pattern shipped on 2026-10-04 (`9e30aa230`) and is exactly what DTA needs to call from its own Pages Functions. |

DTA keeps its brand voice, its records, and the finished script on its side.
ResearchTools provides the method and the discipline, org-neutral.

## Why not somewhere else

- **Not a new "Tools" page or a standalone speech app.** The roadmap's stated
  direction since 2026-09-04 is to compose existing capabilities, not add
  disconnected surface area, and the 2026-06-19 capability plan already ruled
  out a pure writing checklist (AIMS) as "at most a session-header widget". A
  BRIEF Map is more than a checklist only because it is a *structured* artifact
  with a service endpoint behind it; the UI should stay the generic framework
  form.
- **Not inside `generate-plan.ts`.** That endpoint produces a research
  methodology (sampling, literature review, dissemination). A remarks plan
  shares none of that schema; bolting it on would widen a prompt that is
  already large.
- **Not as an Answer Packet.** Packets are evidence-grounded and
  passage-linked by contract. A speech is derived from evidence but is not
  itself evidence. The right link is the other direction: a `brief-map`
  session may *cite* a packet or investigation in its Information branch.
- **Not in `functions/api/ai/generate.ts`.** That route requires recorded user
  consent for arbitrary generation and has no service path; a cross-project
  caller cannot use it, and should not be handed free-text generation.

## Piece 1 — the framework type

Add to `frameworkConfigs` with `itemType: 'text'` and six sections. The
`promptQuestions` carry the method so the form teaches it:

| key | label | promptQuestions (abridged) |
|---|---|---|
| `headline` | Headline | What would you say if stopped at ten seconds? A verb, a date. |
| `background` | Background | What does this audience already know? One sentence. |
| `relevance` | Relevance | Why now, and why them? What changed, what is pending, what was promised? |
| `information` | Information | Two or three facts. Each with a date and a place. Each with a source you can produce. |
| `ending` | Ending | The ask again, the deadline, what success looks like. |
| `follow_up` | Follow-up | What will they ask afterward? In a statement-only venue this is the written submission. In any venue with questions it is your prepared answers: one question, a two-sentence answer, each. |

Also:

- The session's `config` column holds the venue (`format`, `secondsTotal`,
  `secondsHard`, `questionReserveSeconds`, `pace`). The generic form shows
  it as a header block above the branches with the live budget table and
  warnings, so the container is visible while the branches fill.
- Three `framework_templates` system rows rather than one, because the
  format is what people get wrong: **"Public comment (3 min, no
  questions)"** (`statement`, 180 s, hard, podium pace), **"Testimony with
  questions (5 min + Q&A)"** (`statement_with_questions`, 300 s, 100 s
  reserve), and **"Interview or panel (answers only)"** (`qa_only`). Each
  seeds the Follow-up branch in the shape that format needs.
- A `DISCOVERY_ENTRIES` row in the **Frameworks** group, acronym `BRIEF`,
  keywords `public comment, testimony, remarks, speech, three minutes,
  talking points, briefing`.
- `framework-descriptions.ts` entry crediting The BRIEF Lab (Joseph
  McCormack) for the method, as the ACH and COM-B entries credit theirs.

The BRIEF Lab's Narrative Map (challenge, opportunity, approach, payoff) is
**not** a second framework type; it is a note in the Information branch's
prompt questions for the single-incident case.

## Time, pace, and format — the venue model

The October 5 failure was not a writing failure. The outline was never
converted into seconds. So the venue is a first-class input, declared before
a word is drafted, and every budget, warning, and allocation derives from it.

### How much time, and what kind of time

`venue.format` decides what the clock is for:

| format | What happens | What the plan budgets |
|---|---|---|
| `statement` | You speak; nobody answers (Fayetteville's public forum, most public comment periods) | The whole allotment is script. The Follow-up branch goes to the written submission only. |
| `statement_with_questions` | You speak, then the body or panel may ask (committee testimony, a work-session presentation, a board you were invited to) | Script gets `seconds − questionReserveSeconds`; the Follow-up branch becomes **prepared answers**, each a two-sentence card. Default reserve is one third of the allotment. |
| `qa_only` | You are asked and answer (interview, panel, a council member's follow-up visit) | No script. The headline becomes the one-sentence answer you return to; each Follow-up item is a question-and-answer pair with its own 30-second budget, using the BRIEF Lab's TALC shape: let them talk, listen, then converse briefly. |
| `open_discussion` | A roundtable or community meeting with no fixed slot | A 60-second opening and the Q&A cards; the tool warns that there is no floor to hold and the ask must be said in the first contribution. |

`venue.secondsTotal` is the posted allotment. `venue.secondsHard` says whether
it is enforced by a chair with a clock (public forum: yes) or a courtesy
(partner meeting: no). A hard clock sets the script target at **92% of the
allotment**; a soft one at 100%. For `statement_with_questions` the tool also
asks `questionsLikelyFrom` (chair, members, staff, press) so the prepared
answers can be ranked.

### Speaking rate presets, and the warnings that go with them

`venue.wpm` is never silently defaulted. The user picks a preset or enters a
measured rate, and the response always returns the rate it used.

| preset | wpm | When it applies |
|---|---|---|
| `measured` | user's own | From a timed read of any 200-word passage; the preferred input after the first rehearsal |
| `deliberate` | 120 | Reading to a recording, an audience that skews older, a room with a poor microphone, or a non-native listener |
| `podium` (default) | 135 | A prepared statement read aloud at a lectern |
| `conversational` | 150 | Unscripted answers, Q&A cards |
| `fast` | 165 | Returned only as a warning threshold; never offered as a target |

Warnings the contract emits, each as a code plus a plain sentence for the
user:

- `over_budget` — the script's word count exceeds the target. States the
  overrun in seconds at the chosen rate, not just in words.
- `pace_assumes_fast` — the chosen or measured rate is above 150. Nervous
  speakers speed up another 10 to 20 percent at the podium, so a plan that
  only fits at 160 will not fit on the day.
- `pace_assumes_slow` — below 110. Fine for a recording; warns that a hard
  clock at this rate holds fewer than 330 words.
- `no_measured_rate` — the plan was built on a preset. Says to time one read
  and resubmit with `measured`.
- `ask_lost_if_cut` — the ask does not appear before the first clock mark
  (60 seconds), so being stopped early loses it.
- `no_question_reserve` — format is `statement_with_questions` and the
  reserve is zero.
- `answers_unbudgeted` — Q&A format and a Follow-up item has no answer or an
  answer over its 30-second card.
- `sentence_too_long` — any sentence over 30 words; those are the ones a
  speaker rushes or restarts.
- `audience_will_not_respond` — format is `statement` and the script
  contains a question mark outside a quotation.

Warnings are advisory and returned together; the tool never rewrites to
clear one.

### The budget table the user sees

For `statement`, 180 seconds, hard clock, 135 wpm: target **372 words**,
marks at 0:60 / 135 words, 2:00 / 270, and 2:45 / 372. For
`statement_with_questions`, 300 seconds with a 100-second reserve: script
target 414 words, plus up to six prepared answers of 60 to 75 words each.
These are presented before drafting, so the writer knows the size of the
container before filling it.

## Piece 2 — the contract (no model)

`functions/api/_shared/remarks-contract.ts`, versioned `remarks-plan.v1`,
pure functions with unit tests:

```ts
resolveVenue(venue)                // → applies format rules, hard/soft factor,
                                   //   question reserve, chosen wpm, and the
                                   //   pace warnings above
budgetFor(resolvedVenue)           // → { words, marks: [{at: 60, words: 135}, ...],
                                   //   answerCards: n, answerWords: 68 }
allocate(sections, budget)         // → per-section word targets from the ratios
                                   //   below; headline counted twice
checkAskPlacement(script, headline)// → first-two-sentences, last-sentence, and
                                   //   before-first-mark flags
countWords(script)                 // → the one definition both sides use
sentenceLengths(script)            // → for the sentence_too_long warning
factGuard(map, script)             // → numbers, dates, years, dollar figures and
                                   //   capitalised runs in the script that do not
                                   //   appear anywhere in the map; never auto-fixed
timeFor(words, wpm)                // → seconds; the inverse used by the overrun
                                   //   warning and the rehearsal comparison
```

Default allocation for a `statement` budget: who 12%, ask 8%, evidence 48%,
what-we-are-doing 17%, ask-again 12%, thanks 3%. For
`statement_with_questions` the evidence share drops to 40% and the released
8% moves to a one-sentence invitation for questions, since the detail now has
a second chance to be heard. The venue preset owns these numbers; nothing
else restates them.

`factGuard` is the load-bearing function. DTA's rule for every AI writing path
is that a model never invents a date, amount, or name; its email composer
enforces an equivalent guard (`email-format-guard.ts`) by refusing a pass that
changed the words. Here the check is one-directional: anything specific in the
output must have been in the input. A flagged item is returned, not removed,
so the writer decides.

## Piece 3 — the endpoint

`POST /api/research/plan-remarks`, modelled line-for-line on
`generate-question.ts`:

- **Callers.** `requireAuth` users (may pass `saveToFramework: true`, which
  writes a `framework_sessions` row of type `brief-map` and returns its id),
  or a scoped `rt_svc_` principal holding `community.research.execute`, gated
  by `COMMUNITY_INTEGRATIONS_ENABLED` and a new `REMARKS_SERVICE_ENABLED`
  var. Service calls never persist; `saveToFramework` is a `400`. Reusing the
  existing scope avoids a scope migration for v1; a dedicated
  `community.remarks.execute` can be split out later if a client should have
  one without the other.
- **Request** (bounded to 16 KiB like its sibling):

  ```json
  {
    "schemaVersion": "remarks-plan.v1",
    "map": { "headline": "...", "background": [...], "relevance": [...],
             "information": [...], "ending": "...",
             "follow_up": [{ "question": "...", "answer": "..." }] },
    "venue": {
      "format": "statement | statement_with_questions | qa_only | open_discussion",
      "secondsTotal": 180,
      "secondsHard": true,
      "questionReserveSeconds": 0,
      "questionsLikelyFrom": ["chair", "members"],
      "pace": { "preset": "podium" },
      "audience": "city council"
    },
    "voice": "optional caller-supplied system preamble, max 2,000 chars",
    "mode": "budget | script | trim | check"
  }
  ```

  `pace` is either `{ "preset": "deliberate | podium | conversational" }` or
  `{ "measured": { "words": 200, "seconds": 92 } }`; the server computes the
  rate and never accepts a bare number it did not derive. A missing `venue`
  is a `400`, not a default: the whole point is that the clock is declared.
  `voice` is how DTA injects `buildBrandSystemPrompt()` without ResearchTools
  ever storing an organisation's identity. `mode: 'budget'` returns only the
  resolved venue, budget table, and pace warnings, for display **before**
  drafting; `mode: 'check'` runs only Piece 2 on a caller-supplied `script`.
  Neither calls a model.
- **Response.** `venueResolved` (the format rules applied, the rate used and
  where it came from), `budget` and `marks`, `warnings` (the coded list
  above), `script` or `answerCards` depending on format, `wordCount` and
  `estimatedSeconds`, `askPlacement`, `factGuard` (array of flagged
  specifics), `writtenSubmission` (the Follow-up branch rendered as a
  one-page memo skeleton), and `id: null` for service callers.
  `Cache-Control: no-store`. Failures are `integration-error.v1`.
- **Model call.** `callOpenAIViaGateway` at the cheap tier with
  `ANALYST_SYSTEM_PREFIX`, the map wrapped with `wrapUntrustedContent`, and
  the venue rules in the system prompt: ask in sentence two and in the last
  sentence; no question the body will not answer; no characterisation of
  people; placeholders in brackets for anything not in the map. Metered as
  `service:<clientId>` by the gateway's limiter, as research questions are.
- **Docs.** Written ahead of the code so a client can be built from them:
  [`../api/REMARKS-PLANNING-API.md`](../api/REMARKS-PLANNING-API.md) (the
  contract, every field, warning codes, errors, a faydta.com client, a curl
  smoke check), [`../api/schemas/remarks-plan.v1.schema.json`](../api/schemas/remarks-plan.v1.schema.json)
  (draft-07, strict request, additive response), and
  [`../api/openapi/remarks-plan.v1.json`](../api/openapi/remarks-plan.v1.json).
  Plus a `remarksPlanning` flag and the four `remarks*` limits in capability
  discovery, and the pointer already added to `COMMUNITY-INTEGRATIONS-API.md`.
  The implementation must validate against the published schema in its
  tests, as the timeline route does with Ajv, so the doc cannot drift from
  the code.

## The DTA side (for the record, built in that repo)

- `apps/admin` gets a `RESEARCHTOOLS_SERVICE_TOKEN` Pages secret and a small
  `functions/lib/researchtools.ts` client that sends the bearer, a correlation
  id, and the brand preamble.
- First surface: a **"Prepare remarks"** action on a meeting whose `dta_role`
  is `attendee` (the October 5 forum is already such a record). It opens the
  six-branch form, calls `plan-remarks`, shows the script beside the clock
  marks, the warnings, and the fact-guard flags, and saves the map, the
  script, and the written submission as meeting attachments. The page asks
  for the venue first and shows the budget table before the branches, so
  nobody writes six sections into a three-minute slot again.
- The rehearsal timer is a browser control, not an API, but it feeds the
  API: a timed read produces `pace.measured`, the page resubmits in `check`
  mode, and the overrun warning is now in the speaker's own seconds. Two
  reads are the minimum before the script is marked ready.
- Ask DTA gets a tool only after that page exists. The August 5 lesson in
  DTA's CLAUDE.md applies: a tool-surface change there is duplicated across
  two repos and two languages.

## Gates before calling it done

- A board member goes from a blank map to a timed script in under fifteen
  minutes, using the October 5 material as the fixture.
- The script is within budget on the first timed read at least nine times in
  ten across the test set, at the speaker's **measured** rate, not the
  preset.
- Every venue format produces the right artifact: a `statement` plan has no
  answer cards, a `qa_only` plan has no script, and a
  `statement_with_questions` plan whose reserve is zero returns the
  `no_question_reserve` warning. A plan submitted without a venue is
  refused.
- The October 5 material spoken in full, with the ask last as the outline
  ordered it, checked against the real venue, returns `over_budget` with an
  overrun of at least five minutes at podium pace and `ask_lost_if_cut`.
  Pinned in `tests/e2e/smoke/remarks-planning.spec.ts` as a `check`-mode
  case, because a model's draft from the outline would test the model, not
  the warnings.
- On a labelled set, `factGuard` flags every specific not present in the map
  and the model's draft contains none that survive to a sent script.
- The service path is proven non-persistent the way research questions were:
  a `saveToFramework` attempt returns `400`, and the only write is
  `last_used_at`.

## Order of work

1. Piece 1 (config, template row, discovery entry). Pure configuration; ship
   alone.
2. Piece 2 with tests, then the endpoint for user callers only.
3. The service path, discovery flag, and API doc.
4. DTA client and the meeting-page action, with October 5 as the worked
   example.

## Open decisions

- Whether the venue presets (forum formats, allotments, hard or soft clock)
  for specific bodies should live in ResearchTools as shared public data,
  such as "Fayetteville City Council public forum: statement, 180 s, hard,
  no response", or stay caller-side. Shared data helps every project in the
  area; it also goes stale when a body changes its rules, which Fayetteville
  did twice in 2026.
- Resolved for v1: reuse `community.research.execute`. No scope migration.
  Split it out later if a client should have one capability without the
  others.
- Resolved for v1: service callers never persist. DTA stores its own copy.
- Resolved: `brief-map` sits in the Frameworks discovery group, and in the
  sidebar's existing (previously empty) Planning & Resource Allocation
  category.
