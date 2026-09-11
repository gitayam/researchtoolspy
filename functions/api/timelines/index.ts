import { artifactRoute } from '../_shared/timeline-artifact-contract'
import { createTimelineArtifact } from '../_shared/timeline-artifact-store'
import type { TimelineArtifactEnv } from '../_shared/timeline-artifact-auth'
export const onRequestPost: PagesFunction<TimelineArtifactEnv> = ({ request,env }) => artifactRoute(() => createTimelineArtifact(request,env))
