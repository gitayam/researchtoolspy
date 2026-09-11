import { artifactRoute } from '../../_shared/timeline-artifact-contract'
import { readTimelineRevisions } from '../../_shared/timeline-artifact-store'
import type { TimelineArtifactEnv } from '../../_shared/timeline-artifact-auth'
export const onRequestGet: PagesFunction<TimelineArtifactEnv> = ({ request,env,params }) => artifactRoute(() => readTimelineRevisions(request,env,String(params.id)))
