const MARKETING_WORDS = [
  "官方旗舰店",
  "旗舰店",
  "官方",
  "自营",
  "新品",
  "热卖",
  "爆款",
  "秒杀",
  "特价",
  "限时",
  "精选",
  "买一送一"
] as const

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function normalizeProductName(input: string) {
  let value = input.normalize("NFKC").trim()

  value = value.replace(/[【\[][^】\]]*[】\]]/g, " ")
  value = value.replace(/\(([^)]*)\)/g, " $1 ")

  for (const word of MARKETING_WORDS) {
    value = value.replace(new RegExp(escapeRegExp(word), "gi"), " ")
  }

  value = value.replace(/(\d)\s+(g|kg|ml|l|克|千克|毫升|升|斤)/gi, "$1$2")
  value = value.replace(/\s+/g, " ").trim().toLowerCase()

  return value
}
