export const PLATFORM_CODES = ["HEMA", "XIAOXIANG", "QIXIAN", "SAMS"] as const

export type PlatformCode = (typeof PLATFORM_CODES)[number]

export type PlatformOption = {
  code: PlatformCode
  label: string
}

export const PLATFORMS: readonly PlatformOption[] = [
  { code: "HEMA", label: "盒马" },
  { code: "XIAOXIANG", label: "小象" },
  { code: "QIXIAN", label: "七鲜" },
  { code: "SAMS", label: "山姆" }
] as const

const platformLabelMap = new Map(PLATFORMS.map((platform) => [platform.code, platform.label]))

export function getPlatformLabel(code: PlatformCode) {
  return platformLabelMap.get(code) ?? code
}

export function toPlatformOption(code: PlatformCode): PlatformOption {
  return {
    code,
    label: getPlatformLabel(code)
  }
}

export function isPlatformCode(value: string): value is PlatformCode {
  return (PLATFORM_CODES as readonly string[]).includes(value)
}
