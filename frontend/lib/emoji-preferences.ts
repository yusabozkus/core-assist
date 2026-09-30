export const MAX_PREFERRED_EMOJIS = 10

const EMOJI_SEQUENCE_PATTERN =
  /(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)*)/gu

export function getPreferredEmojis(value: string | null | undefined) {
  return [...new Set(value?.match(EMOJI_SEQUENCE_PATTERN) ?? [])]
}

export function parseEmojiEntry(value: string) {
  const emojis = getPreferredEmojis(value)
  const remainder = value
    .replace(EMOJI_SEQUENCE_PATTERN, "")
    .replace(/[\s,，]+/gu, "")

  return { emojis, valid: emojis.length > 0 && remainder.length === 0 }
}
