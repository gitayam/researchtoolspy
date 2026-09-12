import { requireTimelineHuman, type TimelineArtifactEnv } from './_shared/timeline-artifact-auth'
import { ArtifactError, artifactRoute, artifactResponse, boundedBody, isRecord, isWorkspaceId } from './_shared/timeline-artifact-contract'
import type { TimelineSourceImport } from '../../src/types/timeline-source-import'

const HASH=/^[a-f0-9]{64}$/
const TRUNCATION='\n\n[Content truncated - see content_chunks table for full text]'
const utf8Bytes=(value:string)=>new TextEncoder().encode(value).byteLength
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
interface SourceRow {id:number;url:string;title:string|null;content_hash:string|null;extracted_text:string|null;text_length:number;text_bytes:number;processing_status:string|null;expiry_valid:number|null;chunk_count:number;chunks_json:string|null;chunks_bytes:number;assembled_bytes:number}
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
  const row=await env.DB.prepare(`WITH authorized AS (SELECT c.id,c.url,c.title,c.content_hash,
    CASE WHEN length(c.extracted_text)<=102500 AND length(CAST(c.extracted_text AS BLOB))<=410000 THEN c.extracted_text ELSE NULL END AS extracted_text,
    length(c.extracted_text) AS text_length,length(CAST(c.extracted_text AS BLOB)) AS text_bytes,c.processing_status,
    ((c.is_saved=1 AND c.expires_at IS NULL) OR
      ((c.is_saved=0 OR c.is_saved IS NULL) AND c.expires_at IS NOT NULL
        AND julianday(c.expires_at)>julianday('now'))) AS expiry_valid
    FROM content_analysis c JOIN users u ON u.id=c.user_id JOIN workspaces w ON w.id=c.workspace_id
    WHERE c.id=? AND c.user_id=? AND c.workspace_id=?
      AND u.is_active=1 AND length(trim(u.role))>0 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND w.id<>'1' AND w.is_public=0 AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN ('EDITOR','ADMIN')
      ))), chunk_rows AS (
        SELECT CASE WHEN typeof(k.chunk_index)='integer' AND k.chunk_index BETWEEN 0 AND 7 THEN k.chunk_index ELSE NULL END AS chunk_index,
          CASE WHEN typeof(k.chunk_size)='integer' AND k.chunk_size BETWEEN 0 AND 51200 THEN k.chunk_size ELSE NULL END AS chunk_size,
          CASE WHEN length(k.chunk_hash)=64 THEN k.chunk_hash ELSE NULL END AS chunk_hash,
          length(k.chunk_text) AS text_length,length(CAST(k.chunk_text AS BLOB)) AS text_bytes,
          CASE WHEN length(k.chunk_text)<=51200 AND length(CAST(k.chunk_text AS BLOB))<=204800 THEN k.chunk_text ELSE NULL END AS chunk_text
        FROM content_chunks k JOIN authorized a ON k.content_analysis_id=a.id
        WHERE substr(CAST(a.extracted_text AS BLOB),-?)=CAST(? AS BLOB) ORDER BY k.chunk_index LIMIT 8
      ), chunk_budget AS (
        SELECT coalesce(sum(text_bytes),0) AS assembled_bytes,
          coalesce(sum(length(CAST(json_object('index',chunk_index,'size',chunk_size,'hash',chunk_hash,'text',chunk_text,'length',text_length,'bytes',text_bytes) AS BLOB))),0)+max(count(*)-1,0)+2 AS document_bytes
        FROM chunk_rows
      ), chunk_document AS (
        SELECT assembled_bytes,document_bytes,
          CASE WHEN assembled_bytes<=512000 AND document_bytes<=1048576 THEN
            (SELECT json_group_array(json_object('index',chunk_index,'size',chunk_size,'hash',chunk_hash,'text',chunk_text,'length',text_length,'bytes',text_bytes)) FROM chunk_rows)
          ELSE NULL END AS document FROM chunk_budget
      ) SELECT a.*,
        (SELECT count(*) FROM (SELECT 1 FROM content_chunks k WHERE k.content_analysis_id=a.id AND substr(CAST(a.extracted_text AS BLOB),-?)=CAST(? AS BLOB) LIMIT 9)) AS chunk_count,
        d.document AS chunks_json,d.document_bytes AS chunks_bytes,d.assembled_bytes
      FROM authorized a CROSS JOIN chunk_document d`).bind(analysisId,principal.userId,workspace,TRUNCATION.length,TRUNCATION,TRUNCATION.length,TRUNCATION).first<SourceRow>()
  if(!row) throw new ArtifactError('not_found',404)
  if(row.text_length>102500||row.text_bytes>410000||(typeof row.extracted_text==='string'&&row.extracted_text.length>102500)) throw new ArtifactError('limit_exceeded',413)
  if(row.processing_status!=='complete'||row.expiry_valid!==1||typeof row.extracted_text!=='string'||!row.extracted_text.trim()||!wellFormed(row.extracted_text)||typeof row.content_hash!=='string'||!HASH.test(row.content_hash)) throw new ArtifactError('invalid_request',400)
  let completeText=row.extracted_text
  if(completeText.endsWith(TRUNCATION)) {
    if(completeText.length!==102400+TRUNCATION.length) throw new ArtifactError('invalid_request',400)
    if(row.chunk_count>8||row.chunks_bytes>1048576||row.assembled_bytes>512000) throw new ArtifactError('limit_exceeded',413)
    if(row.chunk_count<3||!row.chunks_json) throw new ArtifactError('invalid_request',400)
    const chunks=JSON.parse(row.chunks_json) as Array<{index:number;size:number;hash:string|null;text:string|null;length:number;bytes:number}>
    if(chunks.length!==row.chunk_count) throw new ArtifactError('invalid_request',400)
    const parts:string[]=[]
    for(const [index,chunk] of chunks.entries()) {
      if(chunk.length>51200||chunk.bytes>204800||(typeof chunk.text==='string'&&chunk.text.length>51200)) throw new ArtifactError('limit_exceeded',413)
      if(chunk.index!==index||!Number.isSafeInteger(chunk.size)||typeof chunk.text!=='string'||!wellFormed(chunk.text)||chunk.size!==chunk.text.length||chunk.text.length<1||(index<chunks.length-1&&chunk.text.length!==51200)||typeof chunk.hash!=='string'||!HASH.test(chunk.hash)||await hash(chunk.text)!==chunk.hash) throw new ArtifactError('invalid_request',400)
      parts.push(chunk.text)
    }
    completeText=parts.join('')
    if(completeText.length>409600||utf8Bytes(completeText)>512000) throw new ArtifactError('limit_exceeded',413)
    if(!wellFormed(completeText)||completeText.slice(0,102400)!==row.extracted_text.slice(0,102400)) throw new ArtifactError('invalid_request',400)
  } else {
    if(completeText.length>102400) throw new ArtifactError('limit_exceeded',413)
    if(completeText.includes('[Content truncated - see content_chunks table for full text]')) throw new ArtifactError('invalid_request',400)
  }
  if(typeof row.url!=='string'||!wellFormed(row.url)) throw new ArtifactError('invalid_request',400)
  if(row.url.length>4096) throw new ArtifactError('limit_exceeded',413)
  let url:URL
  try {url=new URL(row.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new Error()} catch {throw new ArtifactError('invalid_request',400)}
  const title=row.title?.trim()?row.title:url.hostname
  if(typeof title!=='string'||!wellFormed(title)) throw new ArtifactError('invalid_request',400)
  if(title.length>1000) throw new ArtifactError('limit_exceeded',413)
  const contentHash=await hash(completeText)
  if(contentHash!==row.content_hash) throw new ArtifactError('invalid_request',400)
  if(input.expectedContentHash!==undefined&&input.expectedContentHash!==contentHash) throw new ArtifactError('stale_revision',412)
  const start=completeText.indexOf(quote)
  if(start<0||completeText.indexOf(quote,start+1)!==-1) throw new ArtifactError('invalid_request',400)
  const end=start+quote.length,quoteHash=await hash(quote),matchedAt=new Date().toISOString()
  const body:TimelineSourceImport={schemaVersion:'timeline-source-import.v1',workspaceId:workspace,analysisId,contentHash,quoteHash,start,end,matchedAt,
    source:{id:`content:${analysisId}:${contentHash}`,url:row.url,title,publisher:url.hostname},
    passage:{id:`passage:${analysisId}:${contentHash}:${start}:${end}`,quote,
      locator:`Recorded reference to stored analysis ${analysisId}; content SHA-256 ${contentHash}; UTF-16 [${start},${end}); quote SHA-256 ${quoteHash}; matched ${matchedAt}. Matches stored extraction, not verified source truth.`}}
  return artifactResponse(body)
})
export const onRequestOptions:PagesFunction=async()=>new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'https://researchtools.net','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-User-Hash, X-Workspace-ID','Cache-Control':'no-store','Vary':'Origin'}})
