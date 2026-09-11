import { test,expect } from '@playwright/test'
import { requireTimelineHuman } from '../../../functions/api/_shared/timeline-artifact-auth'
import { generateToken } from '../../../functions/utils/jwt'

function fixture(role='researcher',active=1) {
  const statements:string[]=[]
  const env={
    JWT_SECRET:'synthetic-auth-test-secret-not-a-real-credential',
    SESSIONS:{get:async(token:string)=>token==='session-fixture'?JSON.stringify({user_id:7}):null},
    DB:{prepare(sql:string){statements.push(sql);return{bind(value:unknown){return{first:async()=>{
      if(sql.includes('WHERE user_hash='))return value==='known-human-hash-0007'?{id:7}:null
      return value===7?{id:7,role,is_active:active}:null
    }}}}}},
  }
  return {env:env as never,statements}
}
test.describe('durable timeline existing human auth @smoke',()=>{
  test('accepts known hash/session/JWT and never auto-provisions an unknown hash',async()=>{
    const {env,statements}=fixture()
    for(const headers of [{'X-User-Hash':'known-human-hash-0007'},{Authorization:'Bearer session-fixture'},{Authorization:'Bearer known-human-hash-0007'}]) expect(await requireTimelineHuman(new Request('https://example.test',{headers}),env)).toEqual({userId:7})
    const jwt=await generateToken({sub:7,role:'researcher'},'synthetic-auth-test-secret-not-a-real-credential')
    expect(await requireTimelineHuman(new Request('https://example.test',{headers:{Authorization:`Bearer ${jwt}`}}),env)).toEqual({userId:7})
    await expect(requireTimelineHuman(new Request('https://example.test',{headers:{'X-User-Hash':'unknown-human-hash-000'}}),env)).rejects.toMatchObject({status:401})
    expect(statements.every(sql=>sql.startsWith('SELECT'))).toBe(true)
  })
  test('reserved service/guest identity cannot fall through to a human header',async()=>{
    for(const headers of [{Authorization:'Bearer rt_svc_invalid','X-User-Hash':'known-human-hash-0007'},{'X-Guest-Session':'guest_aaaaaaaaaaaaaaaa','X-User-Hash':'known-human-hash-0007'}]){
      const {env,statements}=fixture()
      await expect(requireTimelineHuman(new Request('https://example.test',{headers}),env)).rejects.toMatchObject({code:'human_identity_required',status:403})
      expect(statements).toEqual([])
    }
  })
  test('fresh database state rejects inactive, guest, service and empty role even with valid sessions/JWT',async()=>{
    for(const [role,active] of [['guest',1],['service',1],[' SERVICE ',1],['',1],[' ',1],['researcher',0]] as const){
      const {env}=fixture(role,active)
      await expect(requireTimelineHuman(new Request('https://example.test',{headers:{Authorization:'Bearer session-fixture'}}),env)).rejects.toMatchObject({status:403})
      const jwt=await generateToken({sub:7,role:'researcher'},'synthetic-auth-test-secret-not-a-real-credential')
      await expect(requireTimelineHuman(new Request('https://example.test',{headers:{Authorization:`Bearer ${jwt}`}}),env)).rejects.toMatchObject({status:403})
    }
  })
})
