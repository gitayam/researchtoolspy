import { handoffRoute } from '../../_shared/timeline-handoff-contract'
import { redeemTimelineHandoff, type TimelineHandoffEnv } from '../../_shared/timeline-handoff-store'

export const onRequestPost: PagesFunction<TimelineHandoffEnv> = ({ request, env, params }) => handoffRoute(() => redeemTimelineHandoff(request, env, params.token))
