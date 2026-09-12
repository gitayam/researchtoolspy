import {test,expect} from '@playwright/test'
import {emptyTimelineJudgments,validateTimelineJudgments,timelineJudgmentBasis,timelineJudgmentNeedsReview,timelineJudgmentReviewBasis} from '../../../src/lib/timeline-judgments'
import {decodeTimelineWorkspace} from '../../../src/lib/timeline-workspace-codec'
import type {TimelineJudgment,TimelineWorkspaceEvent,TimelineEvidence,TimelineJudgments} from '../../../src/types/timeline-workspace'
const now='2026-09-11T00:00:00.000Z'
const event:TimelineWorkspaceEvent={id:'event:one',title:'Reported event',description:null,category:'event',importance:'normal',origin:'analyst',assessment:'unreviewed',analystNote:'',modified:false,eventDate:'2026-09',datePrecision:'month'}
function evidence():TimelineEvidence{return {schemaVersion:'timeline-evidence.v1',sources:[{id:'source:one',url:'https://example.test/report',title:'Report',publisher:'Publisher'}],assertions:[{id:'assertion:one',sourceId:'source:one',claimText:'Source wording',temporalClaim:'September',passage:{id:'passage:one',quote:'Exact wording',locator:'Paragraph 2'},status:'active',derivesFrom:[]}],links:[{id:'link:one',eventId:event.id,assertionId:'assertion:one',relation:'supports'}],reviews:[]}}
function judgment():TimelineJudgment {
  const value:TimelineJudgment={id:'judgment:one',claim:'Assessed meaning',scope:'This investigation',asOf:now,reasoning:'Explicit reasoning',likelihood:{vocabulary:'timeline-verbal.v1',value:'likely'},analyticConfidence:'low',confidenceBasis:'Coverage remains limited',assumptions:['Assumption'],alternatives:['Alternative'],changeIndicators:['New observation'],eventRefs:[event.id],evidenceRefs:[],contraryEvidenceRefs:[],status:'active',changeReason:'Initial assessment',updatedAt:now,basis:'{}'}
  value.basis=timelineJudgmentBasis(value,[event],evidence());return value
}
function analysis():TimelineJudgments {const value=judgment();return {schemaVersion:'timeline-judgments.v1',judgments:[value],reviews:[{id:'review:one',judgmentId:value.id,reviewerLabel:'Self-attributed analyst',position:'dissent',rationale:'Alternative explanation',alternative:'Different cause',createdAt:now,basis:timelineJudgmentReviewBasis(value)}]}}
const document=(value?:TimelineJudgments)=>({schemaVersion:'timeline-workspace.v1',exportedAt:now,source:{schemaVersion:'timeline-manual.v1',title:'Fixture'},analystWorkspace:{mode:'basic',events:[event],questions:[],hypotheses:[],evidence:evidence(),...(value?{analysis:value}:{})}})
test.describe('timeline judgments strict contract @smoke',()=>{
  test('legacy absence and full judgment/dissent snapshots survive codec without rewrites',()=>{
    expect(decodeTimelineWorkspace(JSON.stringify(document())).analystWorkspace).not.toHaveProperty('analysis')
    const value=analysis()
    expect(decodeTimelineWorkspace(JSON.stringify(document(value))).analystWorkspace.analysis).toEqual(value)
    expect(emptyTimelineJudgments()).toEqual({schemaVersion:'timeline-judgments.v1',judgments:[],reviews:[]})
    expect(timelineJudgmentNeedsReview(value.judgments[0],[event],evidence())).toBe(false)
  })
  test('input basis binds linked evidence, ancestors, reference classification and event content',()=>{
    const value=judgment(),data=evidence()
    expect(timelineJudgmentNeedsReview(value,[{...event,title:'Changed'}],data)).toBe(true)
    expect(timelineJudgmentNeedsReview(value,[{...event,assessment:'disputed',importance:'critical',narrativeRole:'response'}],data)).toBe(false)
    for(const mutate of [(v:TimelineEvidence)=>{v.assertions[0].passage.quote='Changed'},(v:TimelineEvidence)=>{v.assertions[0].status='retracted'},(v:TimelineEvidence)=>{v.sources[0].publisher='Changed'},(v:TimelineEvidence)=>{v.links[0].relation='contradicts'}]) {const changed=evidence();mutate(changed);expect(timelineJudgmentNeedsReview(value,[event],changed)).toBe(true)}
    value.evidenceRefs=['assertion:one'];value.basis=timelineJudgmentBasis(value,[event],data)
    value.evidenceRefs=[];value.contraryEvidenceRefs=['assertion:one']
    expect(timelineJudgmentNeedsReview(value,[event],data)).toBe(true)
    data.assertions.push({...data.assertions[0],id:'assertion:ancestor',passage:{id:'passage:ancestor',quote:'Ancestor',locator:'Page 1'}})
    data.assertions[0].derivesFrom=['assertion:ancestor'];value.basis=timelineJudgmentBasis(value,[event],data)
    data.assertions[1].claimText='Changed ancestor'
    expect(timelineJudgmentNeedsReview(value,[event],data)).toBe(true)
  })
  test('basis sorting is deterministic and complete historical review remains independently inspectable',()=>{
    const value=analysis(),current=value.judgments[0],prior=value.reviews[0].basis
    current.claim='Revised judgment';current.changeReason='New reasoning';current.status='withdrawn'
    expect(timelineJudgmentReviewBasis(current)).not.toBe(prior)
    expect(JSON.parse(prior).claim).toBe('Assessed meaning')
    expect(JSON.parse(prior).basis).toBe(judgment().basis)
    current.eventRefs=[];current.evidenceRefs=['assertion:one'];current.basis=timelineJudgmentBasis(current,[],evidence())
    expect(()=>validateTimelineJudgments(value,[],evidence())).not.toThrow()
    const second={...event,id:'event:two'};current.eventRefs=[second.id,event.id]
    const before=timelineJudgmentBasis(current,[event,second],evidence())
    current.eventRefs.reverse()
    expect(timelineJudgmentBasis(current,[second,event],evidence())).toBe(before)
  })
  test('strict validation rejects missing fields, bounds, unsupported vocabularies and invalid references',()=>{
    const mutations:Array<(v:any)=>void>=[v=>v.extra=true,v=>delete v.reviews,v=>v.judgments.push(v.judgments[0]),v=>v.reviews.push(v.reviews[0]),v=>delete v.judgments[0].confidenceBasis,v=>v.judgments[0].claim=' ',v=>v.judgments[0].scope='x'.repeat(1001),v=>v.judgments[0].asOf='2026-02-30T00:00:00Z',v=>v.judgments[0].likelihood.value=80,v=>v.judgments[0].likelihood.vocabulary='institutional',v=>v.judgments[0].analyticConfidence='certain',v=>v.judgments[0].eventRefs=['missing'],v=>v.judgments[0].evidenceRefs=['missing'],v=>v.judgments[0].eventRefs=[event.id,event.id],v=>{v.judgments[0].eventRefs=[]},v=>{v.judgments[0].evidenceRefs=['assertion:one'];v.judgments[0].contraryEvidenceRefs=['assertion:one']},v=>v.judgments[0].assumptions=Array(11).fill('assumption'),v=>v.judgments[0].basis='{ "a": 1 }',v=>v.judgments[0].basis='x'.repeat(262145),v=>v.reviews[0].reviewerLabel='',v=>v.reviews[0].position='approved',v=>v.reviews[0].judgmentId='missing',v=>v.reviews[0].basis='{}',v=>v.reviews[0].basis=timelineJudgmentReviewBasis({...judgment(),id:'other'})]
    for(const mutate of mutations) {const value=analysis();mutate(value);expect(()=>decodeTimelineWorkspace(JSON.stringify(document(value)))).toThrow()}
  })
})
