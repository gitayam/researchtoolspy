import { test,expect } from '@playwright/test'
import { ArtifactError,ARTIFACT_LIMITS,boundedBody,canonicalJson,decodeCursor,encodeCursor,expectedHead,hashContent,idempotencyKey,parseCommit,parseCreate,validCandidate } from '../../../functions/api/_shared/timeline-artifact-contract'

const candidate = { title: 'Candidate', description: null }
const put = { op: 'put', objectId: 'event:local.v1', kind: 'event-candidate.v1', payload: candidate }
test.describe('durable timeline wire contracts @smoke', () => {
  test('concrete discriminators, local stable IDs and paired calendar precision', () => {
    expect(parseCreate({ schemaVersion: 'timeline-artifact-create.v1', workspaceId: 'workspace-a', title: 'Investigation' }).title).toBe('Investigation')
    expect(parseCommit({ schemaVersion: 'timeline-artifact-commit.v1', changes: [put] }).changes[0].objectId).toBe('event:local.v1')
    for (const [eventDate,datePrecision] of [['2024','year'],['2026-09','month'],['2024-02-29','day']]) expect(validCandidate({ ...candidate,eventDate,datePrecision })).toBe(true)
    for (const value of [{ ...candidate,eventDate:'2026-02-29',datePrecision:'day' },{ ...candidate,eventDate:'2026',datePrecision:'day' },{ ...candidate,eventDate:'2026' },{ ...candidate,datePrecision:'year' },{ ...candidate,eventDate:null,datePrecision:null },{ ...candidate,title:' ' },{ ...candidate,description:undefined },{ ...candidate,corroborated:true }]) expect(validCandidate(value)).toBe(false)
    for (const changes of [[],[put,put],[{ ...put,kind:'assessed-event.v1' }],[{ op:'delete',objectId:'missing',payload:{} }],[{ ...put,objectId:'x'.repeat(201) }],Array.from({length:11},(_,i)=>({...put,objectId:`event-${i}`}))]) expect(()=>parseCommit({schemaVersion:'timeline-artifact-commit.v1',changes})).toThrow(ArtifactError)
    expect(()=>parseCreate({schemaVersion:'timeline-artifact-create.v1',workspaceId:'workspace-a',title:'A',unexpected:true})).toThrow(ArtifactError)
    expect(validCandidate({...candidate,title:'😀'.repeat(101)})).toBe(false)
    expect(validCandidate({...candidate,description:'x'.repeat(2001)})).toBe(false)
  })
  test('single strong ETag and bounded opaque idempotency key', () => {
    expect(expectedHead(new Request('https://example.test',{headers:{'If-Match':'"rev_123"'}}))).toBe('rev_123')
    for (const value of ['*','W/"rev_123"','rev_123','"rev_1", "rev_2"','""']) expect(()=>expectedHead(new Request('https://example.test',{headers:{'If-Match':value}}))).toThrow(ArtifactError)
    expect(()=>expectedHead(new Request('https://example.test'))).toThrow(expect.objectContaining({code:'precondition_required',status:428}))
    expect(idempotencyKey(new Request('https://example.test',{headers:{'Idempotency-Key':'timeline-retry-0001'}}))).toBe('timeline-retry-0001')
    for (const value of ['','short','x'.repeat(129)]) expect(()=>idempotencyKey(new Request('https://example.test',{headers:{'Idempotency-Key':value}}))).toThrow(ArtifactError)
  })
  test('canonical hash ignores object key order, preserves change order and expected head', async () => {
    expect(canonicalJson({z:1,a:{b:2,a:1}})).toBe('{"a":{"a":1,"b":2},"z":1}')
    expect(await hashContent({a:1,b:2})).toBe(await hashContent({b:2,a:1}))
    expect(await hashContent({expectedHead:'rev-a',changes:[1,2]})).not.toBe(await hashContent({expectedHead:'rev-b',changes:[1,2]}))
    expect(await hashContent([1,2])).not.toBe(await hashContent([2,1]))
    const cursor={v:1,artifactId:'timeline_a',revisionId:'rev_a',sort:'object-id-asc',after:'event:source.1'}
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
    expect(()=>decodeCursor('not+base64')).toThrow(ArtifactError)
    expect(()=>decodeCursor('a'.repeat(1025))).toThrow(ArtifactError)
  })
  test('streamed byte limits and invalid UTF-8 reject before JSON materialization', async () => {
    let canceled=false
    const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(ARTIFACT_LIMITS.requestBytes+1))},cancel(){canceled=true}})
    const streamed=new Request('https://example.test',{method:'POST',body:stream,duplex:'half'} as RequestInit)
    await expect(boundedBody(streamed)).rejects.toMatchObject({status:413})
    expect(canceled).toBe(true)
    await expect(boundedBody(new Request('https://example.test',{method:'POST',body:'{}',headers:{'Content-Length':'65537'}}))).rejects.toMatchObject({status:413})
    await expect(boundedBody(new Request('https://example.test',{method:'POST',body:new Uint8Array([255])}))).rejects.toMatchObject({status:400})
    await expect(boundedBody(new Request('https://example.test',{method:'POST',body:'{"x":true}'}))).resolves.toEqual({x:true})
  })
})
