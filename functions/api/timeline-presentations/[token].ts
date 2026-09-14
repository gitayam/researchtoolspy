import { readTimelinePresentation, revokeTimelinePresentation, presentationRoute, type TimelinePresentationEnv } from '../_shared/timeline-presentation-store'
export const onRequestGet: PagesFunction<TimelinePresentationEnv> = ({ request, env, params }) => presentationRoute(() => readTimelinePresentation(request, env, params.token))
export const onRequestDelete: PagesFunction<TimelinePresentationEnv> = ({ request, env, params }) => presentationRoute(() => revokeTimelinePresentation(request, env, params.token))
