export { default as TagChips } from './TagChips'
export type { TagChipsProps } from './TagChips'
export { default as TagPicker } from './TagPicker'
export type { TagPickerProps } from './TagPicker'
export { default as TagFilterBar } from './TagFilterBar'
export type { TagFilterBarProps } from './TagFilterBar'
export { default as BulkTagBar } from './BulkTagBar'
export type { BulkTagBarProps } from './BulkTagBar'
export { default as CopTagsProvider } from './CopTagsProvider'
export { useCopTagsContext } from './tag-context'
export {
  isValidTagName, matchesTagFilter, normalizeTagName, paletteForName, TAG_MAX_LENGTH, TAG_MAX_PER_ITEM, TAG_PALETTE,
  tagChipClasses, tagKey, tagPalette, uniqueTagNames,
} from './tag-names'
