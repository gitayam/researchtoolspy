import { test, expect } from '@playwright/test'
import { emptyTimelineEvidence, validateTimelineEvidence, timelineEvidenceBasis, timelineCorroboration, timelineAssessmentLabel } from '../../../src/lib/timeline-evidence'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import type { TimelineEvidence, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const event:TimelineWorkspaceEvent={id:'event:one',title:'Event wording',description:null,eventDate:'2026-09',datePrecision:'month',category:'event',importance:'normal',origin:'analyst',assessment:'corroborated',analystNote:'',modified:false}
const now='2026-09-11T00:00:00.000Z'
function fixture():TimelineEvidence {
  return {schemaVersion:'timeline-evidence.v1',sources:[
    {id:'source:a',url:'https://a.example/report',title:'Report A',publisher:'A',publishedAt:now,retrievedAt:now},
    {id:'source:b',url:'https://b.example/report',title:'Report B',publisher:'B'},
  ],assertions:[
    {id:'assertion:a',sourceId:'source:a',claimText:'Source A exact wording',temporalClaim:'In September',passage:{id:'passage:a',quote:'A quoted passage',locator:'Paragraph 2'},status:'active',derivesFrom:[],reportedAt:now},
    {id:'assertion:b',sourceId:'source:b',claimText:'Source B exact wording',temporalClaim:'During September',passage:{id:'passage:b',quote:'B quoted passage',locator:'Page 1'},status:'active',derivesFrom:[]},
  ],links:[{id:'link:a',eventId:event.id,assertionId:'assertion:a',relation:'supports'},{id:'link:b',eventId:event.id,assertionId:'assertion:b',relation:'supports'}],reviews:[]}
}
function reviewed(evidence=fixture()):TimelineEvidence {
  evidence.reviews=[{eventId:event.id,independence:'independent',compatibility:'compatible',rationale:'Separate primary accounts with compatible temporal claims.',reviewedAt:now,basis:timelineEvidenceBasis(evidence,event)}]
  return evidence
}
const exported=(evidence?:TimelineEvidence)=>({schemaVersion:'timeline-workspace.v1',exportedAt:now,source:{schemaVersion:'timeline-manual.v1',title:'Fixture'},analystWorkspace:{mode:'basic',events:[event],questions:[],hypotheses:[],...(evidence?{evidence}:{})}})

test.describe('timeline evidence bounded contract @smoke',()=>{
  test('legacy absence and raw assessment remain readable without a false corroboration label',()=>{
    const legacy=decodeTimelineWorkspace(JSON.stringify(exported()))
    expect(legacy.analystWorkspace).not.toHaveProperty('evidence')
    expect(legacy.analystWorkspace.events[0].assessment).toBe('corroborated')
    expect(timelineAssessmentLabel(undefined,event)).toBe('Corroboration needs review')
    expect(timelineCorroboration(undefined,event).eligible).toBe(false)
    const evidence=reviewed()
    expect(decodeTimelineWorkspace(JSON.stringify(exported(evidence))).analystWorkspace.evidence).toEqual(evidence)
    expect(timelineAssessmentLabel(evidence,event)).toBe('Corroborated')
    expect(emptyTimelineEvidence()).toEqual({schemaVersion:'timeline-evidence.v1',sources:[],assertions:[],links:[],reviews:[]})
  })
  test('corroboration requires independent compatible current analyst review and no active contradiction',()=>{
    expect(timelineCorroboration(fixture(),event).eligible).toBe(false)
    expect(timelineCorroboration(reviewed(),event).eligible).toBe(true)
    for(const field of ['independence','compatibility'] as const) {
      const evidence=reviewed();evidence.reviews[0][field]='unresolved'
      expect(timelineCorroboration(evidence,event).eligible).toBe(false)
    }
    const contradicted=fixture();contradicted.links[1].relation='contradicts'
    expect(timelineCorroboration(reviewed(contradicted),event).eligible).toBe(false)
    const retracted=fixture();retracted.assertions[1].status='retracted'
    expect(timelineCorroboration(reviewed(retracted),event).eligible).toBe(false)
    const one=fixture();one.links.pop()
    expect(timelineCorroboration(reviewed(one),event).eligible).toBe(false)
  })
  test('common URL, shared transitive roots and cycles never manufacture independence',()=>{
    const same=fixture();same.sources[1].url='https://A.example:443/report#different-passage'
    expect(timelineCorroboration(reviewed(same),event).eligible).toBe(false)
    const derivative=fixture();derivative.assertions[1].derivesFrom=['assertion:a']
    expect(timelineCorroboration(reviewed(derivative),event).eligible).toBe(false)
    const common=fixture()
    common.sources.push({id:'source:root',url:'https://wire.example/',title:'Wire',publisher:'Wire'})
    common.assertions.push({...common.assertions[0],id:'assertion:root',sourceId:'source:root',passage:{id:'passage:root',quote:'Wire report',locator:'Paragraph 1'},status:'retracted',derivesFrom:[]})
    common.assertions[0].derivesFrom=['assertion:root'];common.assertions[1].derivesFrom=['assertion:root']
    expect(timelineCorroboration(reviewed(common),event).eligible).toBe(false)
    const cycle=fixture();cycle.assertions[0].derivesFrom=['assertion:b'];cycle.assertions[1].derivesFrom=['assertion:a']
    expect(()=>validateTimelineEvidence(cycle,[event.id])).toThrow()
    expect(timelineCorroboration(cycle,event).eligible).toBe(false)
  })
  test('shared intermediate source URLs cannot be overridden by a fresh independence review',()=>{
    const evidence=fixture()
    for(const [suffix,url] of [
      ['middle-a','https://shared.example/report#first'],
      ['middle-b','https://SHARED.example:443/report#second'],
      ['root-a','https://root-a.example/'],['root-b','https://root-b.example/'],
    ]) {
      evidence.sources.push({id:`source:${suffix}`,url,title:suffix,publisher:suffix})
      evidence.assertions.push({...evidence.assertions[0],id:`assertion:${suffix}`,sourceId:`source:${suffix}`,passage:{id:`passage:${suffix}`,quote:suffix,locator:'Paragraph 1'},derivesFrom:[]})
    }
    evidence.assertions[0].derivesFrom=['assertion:middle-a']
    evidence.assertions[1].derivesFrom=['assertion:middle-b']
    evidence.assertions[2].derivesFrom=['assertion:root-a']
    evidence.assertions[3].derivesFrom=['assertion:root-b']
    reviewed(evidence)
    expect(()=>validateTimelineEvidence(evidence,[event.id])).not.toThrow()
    expect(timelineCorroboration(evidence,event).eligible).toBe(false)
    expect(timelineAssessmentLabel(evidence,event)).toBe('Corroboration needs review')
    // Also reject an observed source that appears only as the other support's intermediary.
    evidence.assertions[1].sourceId='source:middle-a'
    evidence.assertions[1].derivesFrom=['assertion:root-b']
    reviewed(evidence)
    expect(timelineCorroboration(evidence,event).eligible).toBe(false)
  })

  test('canonical review basis binds claim, links, passages, clocks and ancestors but not display',()=>{
    const original=reviewed(),basis=original.reviews[0].basis
    const shuffled=structuredClone(original);shuffled.sources.reverse();shuffled.assertions.reverse();shuffled.links.reverse()
    expect(timelineEvidenceBasis(shuffled,event)).toBe(basis)
    expect(timelineEvidenceBasis(original,{...event,assessment:'unreviewed',importance:'critical',analystNote:'Display note',narrativeRole:'response',narrativeOrder:3})).toBe(basis)
    for(const changed of [{...event,title:'Changed'},{...event,description:'Changed'},{...event,eventDate:'2026'},{...event,eventTime:'12:00'}]) expect(timelineCorroboration(original,changed).eligible).toBe(false)
    for(const mutate of [
      (v:TimelineEvidence)=>{v.assertions[0].claimText='Changed'},
      (v:TimelineEvidence)=>{v.assertions[0].passage.quote='Changed'},
      (v:TimelineEvidence)=>{v.assertions[0].passage.locator='Page 3'},
      (v:TimelineEvidence)=>{v.sources[0].publisher='Changed'},
      (v:TimelineEvidence)=>{v.sources[0].retrievedAt='2026-09-12T00:00:00Z'},
      (v:TimelineEvidence)=>{v.links[0].relation='context'},
    ]) {const changed=structuredClone(original);mutate(changed);expect(timelineCorroboration(changed,event).eligible).toBe(false)}
    const ancestor=fixture()
    ancestor.sources.push({id:'source:c',url:'https://c.example/',title:'C',publisher:'C'})
    ancestor.assertions.push({...ancestor.assertions[0],id:'assertion:c',sourceId:'source:c',passage:{id:'passage:c',quote:'Ancestor wording',locator:'Page 1'},derivesFrom:[]})
    ancestor.assertions[0].derivesFrom=['assertion:c'];reviewed(ancestor)
    expect(timelineCorroboration(ancestor,event).eligible).toBe(true)
    ancestor.assertions[2].passage.quote='Changed ancestor'
    expect(timelineCorroboration(ancestor,event).eligible).toBe(false)
    ancestor.assertions[2].status='retracted';reviewed(ancestor)
    expect(timelineCorroboration(ancestor,event).eligible).toBe(false)
  })
  test('strict codec rejects unknown keys, duplicates, invalid locators, URLs, dates and dangling references',()=>{
    const mutations:Array<(v:any)=>void>=[
      v=>v.extra=true,v=>v.sources.push(v.sources[0]),v=>v.assertions.push(v.assertions[0]),
      v=>v.sources[0].id='bad/id',v=>v.sources[0].url='https://user:password@example.test/',v=>v.sources[0].url='javascript:alert(1)',
      v=>v.sources[0].publishedAt='2026-02-30T00:00:00Z',v=>v.assertions[0].reportedAt='yesterday',
      v=>v.assertions[0].sourceId='missing',v=>v.assertions[0].claimText=' ',v=>v.assertions[0].passage.locator='',
      v=>v.assertions[1].passage.id=v.assertions[0].passage.id,v=>v.assertions[0].passage.extra=true,
      v=>v.assertions[0].derivesFrom=['missing'],v=>v.assertions[0].derivesFrom=['assertion:a'],
      v=>v.links[0].eventId='missing',v=>v.links[0].assertionId='missing',v=>v.links[0].relation='corroborates',
      v=>v.links.push({...v.links[0],id:'duplicate-pair'}),v=>v.reviews.push({...v.reviews[0]}),
      v=>v.reviews[0].rationale='',v=>v.reviews[0].basis='not-json',v=>v.reviews[0].basis='{ "a": 1 }',
      v=>v.assertions[0].claimText='x'.repeat(4001),v=>v.sources[0].url='https://example.test/'+ 'x'.repeat(4096),
      v=>v.reviews[0].basis='x'.repeat(262145),
    ]
    for(const mutate of mutations) {const evidence=reviewed();mutate(evidence);expect(()=>decodeTimelineWorkspace(JSON.stringify(exported(evidence)))).toThrow()}
  })
})
