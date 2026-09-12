import { requireTimelineHuman, type TimelineArtifactEnv } from './_shared/timeline-artifact-auth'
import { ArtifactError, artifactRoute, artifactResponse, isWorkspaceId } from './_shared/timeline-artifact-contract'

interface CandidateRow {workspace_id:string;analysis_id:number|null;title:string|null}
function wellFormed(value:string):boolean {
  for(let i=0;i<value.length;i++) {
    const code=value.charCodeAt(i)
    if(code>=0xd800&&code<=0xdbff) {const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff)) return false}
    else if(code>=0xdc00&&code<=0xdfff) return false
  }
  return true
}
export const onRequestGet:PagesFunction<TimelineArtifactEnv>=async({request,env})=>artifactRoute(async()=>{
  const user=await requireTimelineHuman(request,env)
  const query=new URL(request.url).searchParams,workspaceId=query.get('workspaceId')
  if([...query.keys()].some(key=>key!=='workspaceId')||query.getAll('workspaceId').length!==1||!isWorkspaceId(workspaceId)) throw new ArtifactError('invalid_request',400)
  const header=request.headers.get('X-Workspace-ID')
  if(header!==null&&header!==workspaceId) throw new ArtifactError('not_found',404)
  // Keep an authorized empty workspace distinct from an inaccessible workspace
  // within the same final snapshot. No extraction text or chunk rows are loaded.
  const result=await env.DB.prepare(`WITH authorized AS (
    SELECT w.id FROM users u JOIN workspaces w ON w.id=?
    WHERE u.id=? AND u.is_active=1 AND length(trim(u.role))>0 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND w.id<>'1' AND w.is_public=0 AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN ('EDITOR','ADMIN')
      ))
    ), candidates AS (
      SELECT c.id,substr(c.title,1,200) AS title FROM content_analysis c JOIN authorized a ON a.id=c.workspace_id
      WHERE c.user_id=? AND typeof(c.id)='integer' AND c.id BETWEEN 1 AND 9007199254740991
        AND c.processing_status='complete' AND ((c.is_saved=1 AND c.expires_at IS NULL) OR
          ((c.is_saved=0 OR c.is_saved IS NULL) AND c.expires_at IS NOT NULL AND julianday(c.expires_at)>julianday('now')))
      ORDER BY c.id DESC LIMIT 20
    ) SELECT a.id AS workspace_id,c.id AS analysis_id,c.title FROM authorized a LEFT JOIN candidates c ON 1=1 ORDER BY c.id DESC`)
    .bind(workspaceId,user.userId,user.userId).all<CandidateRow>()
  if(!result.results.length) throw new ArtifactError('not_found',404)
  if(result.results.length>20) throw new ArtifactError('datastore_unavailable',503)
  const items:Array<{analysisId:number;title:string}>=[]
  for(const row of result.results) {
    if(row.workspace_id!==workspaceId) throw new ArtifactError('datastore_unavailable',503)
    if(row.analysis_id===null) {
      if(result.results.length!==1||row.title!==null) throw new ArtifactError('datastore_unavailable',503)
      continue
    }
    if(!Number.isSafeInteger(row.analysis_id)||row.analysis_id<=0||(items.length&&items[items.length-1].analysisId<=row.analysis_id)) throw new ArtifactError('datastore_unavailable',503)
    if(row.title!==null&&(typeof row.title!=='string'||!wellFormed(row.title)||row.title.length>400)) throw new ArtifactError('datastore_unavailable',503)
    const cleaned=(row.title??'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim()
    items.push({analysisId:row.analysis_id,title:cleaned||`Stored analysis ${row.analysis_id}`})
  }
  const body=JSON.stringify({schemaVersion:'timeline-source-candidates.v1',workspaceId,items})
  if(new TextEncoder().encode(body).byteLength>65536) throw new ArtifactError('datastore_unavailable',503)
  return artifactResponse(body)
})
export const onRequestOptions:PagesFunction=async()=>new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'https://researchtools.net','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-User-Hash, X-Workspace-ID','Cache-Control':'no-store','Vary':'Origin'}})
