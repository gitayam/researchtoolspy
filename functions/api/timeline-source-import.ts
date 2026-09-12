import { requireTimelineHuman, type TimelineArtifactEnv } from './_shared/timeline-artifact-auth'
import { ArtifactError, artifactRoute, artifactResponse, boundedBody, isRecord, isWorkspaceId } from './_shared/timeline-artifact-contract'
import type { TimelineSourceImport } from '../../src/types/timeline-source-import'

const HASH=/^[a-f0-9]{64}$/
function wellFormed(value:string):boolean {
  for(let i=0;i<value.length;i++) {
    const code=value.charCodeAt(i)
    if(code>=0xd800&&code<=0xdbff) {const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff)) return false}
    else if(code>=0xdc00&&code<=0xdfff) return false
  }
  return true
}
async function hash(value:string):Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
}
interface SourceRow {id:number;url:string;title:string|null;content_hash:string|null;extracted_text:string|null;text_length:number;processing_status:string|null;expiry_valid:number|null}
export const onRequestPost:PagesFunction<TimelineArtifactEnv>=async ({request,env})=>artifactRoute(async()=>{
  const principal=await requireTimelineHuman(request,env)
  if(new URL(request.url).search) throw new ArtifactError('invalid_request',400)
  const input=await boundedBody(request)
  if(!isRecord(input)||Object.keys(input).some(key=>!['schemaVersion','workspaceId','analysisId','quote','expectedContentHash'].includes(key))||input.schemaVersion!=='timeline-source-import-request.v1'||!isWorkspaceId(input.workspaceId)||!Number.isSafeInteger(input.analysisId)||Number(input.analysisId)<=0||typeof input.quote!=='string'||!input.quote.trim()||!wellFormed(input.quote)||(input.expectedContentHash!==undefined&&(typeof input.expectedContentHash!=='string'||!HASH.test(input.expectedContentHash)))) throw new ArtifactError('invalid_request',400)
  if(input.quote.length>4000) throw new ArtifactError('limit_exceeded',413)
  const workspace=input.workspaceId,analysisId=Number(input.analysisId),quote=input.quote
  const header=request.headers.get('X-Workspace-ID')
  if(header!==null&&header!==workspace) throw new ArtifactError('not_found',404)
  // One final query selects the source only under current human, record-owner,
  // private-workspace and write-role authority. No legacy public/default fallback.
  const row=await env.DB.prepare(`SELECT c.id,c.url,c.title,c.content_hash,
    CASE WHEN length(c.extracted_text)<=102400 THEN c.extracted_text ELSE NULL END AS extracted_text,
    length(c.extracted_text) AS text_length,c.processing_status,
    ((c.is_saved=1 AND c.expires_at IS NULL) OR
      ((c.is_saved=0 OR c.is_saved IS NULL) AND c.expires_at IS NOT NULL
        AND julianday(c.expires_at)>julianday('now'))) AS expiry_valid
    FROM content_analysis c JOIN users u ON u.id=c.user_id JOIN workspaces w ON w.id=c.workspace_id
    WHERE c.id=? AND c.user_id=? AND c.workspace_id=?
      AND u.is_active=1 AND length(trim(u.role))>0 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND w.id<>'1' AND w.is_public=0 AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN ('EDITOR','ADMIN')
      ))`).bind(analysisId,principal.userId,workspace).first<SourceRow>()
  if(!row) throw new ArtifactError('not_found',404)
  if(row.text_length>102400||(typeof row.extracted_text==='string'&&row.extracted_text.length>102400)) throw new ArtifactError('limit_exceeded',413)
  if(row.processing_status!=='complete'||row.expiry_valid!==1||typeof row.extracted_text!=='string'||!row.extracted_text.trim()||!wellFormed(row.extracted_text)||row.extracted_text.includes('[Content truncated - see content_chunks table for full text]')||typeof row.content_hash!=='string'||!HASH.test(row.content_hash)) throw new ArtifactError('invalid_request',400)
  if(typeof row.url!=='string'||!wellFormed(row.url)) throw new ArtifactError('invalid_request',400)
  if(row.url.length>4096) throw new ArtifactError('limit_exceeded',413)
  let url:URL
  try {url=new URL(row.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new Error()} catch {throw new ArtifactError('invalid_request',400)}
  const title=row.title?.trim()?row.title:url.hostname
  if(typeof title!=='string'||!wellFormed(title)) throw new ArtifactError('invalid_request',400)
  if(title.length>1000) throw new ArtifactError('limit_exceeded',413)
  const contentHash=await hash(row.extracted_text)
  if(contentHash!==row.content_hash) throw new ArtifactError('invalid_request',400)
  if(input.expectedContentHash!==undefined&&input.expectedContentHash!==contentHash) throw new ArtifactError('stale_revision',412)
  const start=row.extracted_text.indexOf(quote)
  if(start<0||row.extracted_text.indexOf(quote,start+1)!==-1) throw new ArtifactError('invalid_request',400)
  const end=start+quote.length,quoteHash=await hash(quote),matchedAt=new Date().toISOString()
  const body:TimelineSourceImport={schemaVersion:'timeline-source-import.v1',workspaceId:workspace,analysisId,contentHash,quoteHash,start,end,matchedAt,
    source:{id:`content:${analysisId}:${contentHash}`,url:row.url,title,publisher:url.hostname},
    passage:{id:`passage:${analysisId}:${contentHash}:${start}:${end}`,quote,
      locator:`Recorded reference to stored analysis ${analysisId}; content SHA-256 ${contentHash}; UTF-16 [${start},${end}); quote SHA-256 ${quoteHash}; matched ${matchedAt}. Matches stored extraction, not verified source truth.`}}
  return artifactResponse(body)
})
export const onRequestOptions:PagesFunction=async()=>new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'https://researchtools.net','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-User-Hash, X-Workspace-ID','Cache-Control':'no-store','Vary':'Origin'}})
