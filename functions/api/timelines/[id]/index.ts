import { artifactRoute } from '../../_shared/timeline-artifact-contract'
import { readTimelineArtifact,commitTimelineArtifact } from '../../_shared/timeline-artifact-store'
import type { TimelineArtifactEnv } from '../../_shared/timeline-artifact-auth'
export const onRequestGet: PagesFunction<TimelineArtifactEnv> = ({ request,env,params }) => artifactRoute(() => readTimelineArtifact(request,env,String(params.id)))
export const onRequestPatch: PagesFunction<TimelineArtifactEnv> = ({ request,env,params }) => artifactRoute(() => commitTimelineArtifact(request,env,String(params.id)))
