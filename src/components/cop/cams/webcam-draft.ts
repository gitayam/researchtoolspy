/** The Add webcam form, kept by CopCamsPanel so it survives picking a point on the map. */
export interface WebcamDraft {
  url: string
  label: string
  lat: string
  lon: string
  bearing: string
  fov: string
}

export const EMPTY_WEBCAM_DRAFT: WebcamDraft = { url: '', label: '', lat: '', lon: '', bearing: '', fov: '' }
