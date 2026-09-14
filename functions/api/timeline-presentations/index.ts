import { createTimelinePresentation, listTimelinePresentations, presentationRoute, type TimelinePresentationEnv } from '../_shared/timeline-presentation-store'
export const onRequestPost: PagesFunction<TimelinePresentationEnv> = ({ request, env }) => presentationRoute(() => createTimelinePresentation(request, env))
export const onRequestGet: PagesFunction<TimelinePresentationEnv> = ({ request, env }) => presentationRoute(() => listTimelinePresentations(request, env))
