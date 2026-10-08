declare module 'write-good' {
  interface WriteGoodSuggestion { index: number; offset: number; reason: string }
  interface WriteGoodOptions {
    passive?: boolean; illusion?: boolean; so?: boolean; thereIs?: boolean; weasel?: boolean
    adverb?: boolean; tooWordy?: boolean; cliches?: boolean; eprime?: boolean
    whitelist?: string[]
  }
  function writeGood(text: string, options?: WriteGoodOptions): WriteGoodSuggestion[]
  export default writeGood
}
