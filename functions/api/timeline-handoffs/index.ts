import { handoffRoute } from '../_shared/timeline-handoff-contract'
import { mintTimelineHandoff, type TimelineHandoffEnv } from '../_shared/timeline-handoff-store'

export const onRequestPost: PagesFunction<TimelineHandoffEnv> = ({ request, env }) => handoffRoute(() => mintTimelineHandoff(request, env))
