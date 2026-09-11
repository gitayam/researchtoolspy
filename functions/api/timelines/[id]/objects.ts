import { artifactRoute } from '../../_shared/timeline-artifact-contract'
import { readTimelineObjects } from '../../_shared/timeline-artifact-store'
import type { TimelineArtifactEnv } from '../../_shared/timeline-artifact-auth'
export const onRequestGet: PagesFunction<TimelineArtifactEnv> = ({ request,env,params }) => artifactRoute(() => readTimelineObjects(request,env,String(params.id)))
