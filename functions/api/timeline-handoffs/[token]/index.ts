import { handoffRoute } from '../../_shared/timeline-handoff-contract'
import { revokeTimelineHandoff, type TimelineHandoffEnv } from '../../_shared/timeline-handoff-store'

export const onRequestDelete: PagesFunction<TimelineHandoffEnv> = ({ request, env, params }) => handoffRoute(() => revokeTimelineHandoff(request, env, params.token))
