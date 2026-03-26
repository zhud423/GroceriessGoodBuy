import { z } from "zod"

import { decimalQuantityStringSchema } from "@life-assistant/contracts"
import { normalizeProductName } from "@life-assistant/domain"
import { DEFAULT_CATEGORIES, PLATFORM_CODES, type PlatformCode } from "@life-assistant/shared"

import { RouteError } from "../route-error"

const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
const NON_PRODUCT_LINE_PATTERN =
  /(运费|配送费|打包费|包装费|服务费|优惠券|红包|立减|优惠|折扣|满减|返现|返券|实付|应付|小计|合计|总计|商品总价|配送服务|会员优惠)/i
const SPEC_PATTERN =
  /((?:约)?\d+(?:\.\d+)?\s*(?:kg|g|千克|克|斤|ml|mL|l|L|毫升|升)(?:\s*[x×*]\s*\d+(?:\.\d+)?)?|(?:\d+\s*(?:枚|只|袋|盒|包|瓶|支|个|根|片|块)))/i

const CATEGORY_RULES = [
  {
    code: "vegetable_fruit",
    pattern: /(韭菜|菠菜|白菜|青菜|生菜|西兰花|花菜|松花菜|土豆|番茄|西红柿|黄瓜|螺丝椒|辣椒|茄子|瓜|萝卜|洋葱|水果|苹果|香蕉|橙|橘|桃|梨|葡萄)/i
  },
  {
    code: "meat_egg",
    pattern: /(牛肉|猪肉|鸡肉|鸡翅|鸡腿|鸡胸|羊肉|排骨|肉丸|牛丸|鱼丸|蛋|鸡蛋|鸭蛋|鹌鹑蛋|香肠|火腿|午餐肉)/i
  },
  {
    code: "seafood",
    pattern: /(鱼|虾|蟹|贝|蛤|扇贝|鱿鱼|三文鱼|鳕鱼|带鱼|海鲜|鱼籽|虾滑)/i
  },
  {
    code: "dairy_bakery",
    pattern: /(牛奶|酸奶|奶酪|黄油|奶油|吐司|面包|蛋糕|可颂|贝果|欧包|饼胚)/i
  },
  {
    code: "ready_to_eat",
    pattern: /(熟食|卤味|便当|盖饭|三明治|寿司|沙拉|包子|馄饨|水饺|火锅|预制|半成品)/i
  },
  {
    code: "grocery_seasoning",
    pattern: /(大米|面粉|挂面|食用油|酱油|醋|蚝油|调味|盐|糖|米|面|杂粮|豆腐|豆制品)/i
  },
  {
    code: "drinks",
    pattern: /(饮料|可乐|雪碧|苏打水|果汁|咖啡|茶饮|矿泉水|纯净水|气泡水|啤酒|白酒|红酒)/i
  },
  {
    code: "snacks",
    pattern: /(薯片|饼干|坚果|零食|糖果|巧克力|果脯|辣条|膨化|海苔)/i
  },
  {
    code: "cleaning_care",
    pattern: /(洗洁精|洗衣液|洗发水|沐浴露|牙膏|纸巾|抽纸|湿巾|清洁|消毒|护理)/i
  },
  {
    code: "home_essentials",
    pattern: /(垃圾袋|保鲜袋|保鲜膜|厨房纸|一次性|牙刷|拖鞋|电池|家居|日用)/i
  }
] as const

const providerItemSchema = z.object({
  pageIndex: z.number().int().nonnegative().nullable().optional(),
  rawName: z.string().trim().min(1),
  guessedCategoryCode: z.string().trim().min(1).nullable().optional(),
  priceAmount: z.number().int().nonnegative().nullable().optional(),
  quantity: decimalQuantityStringSchema.nullable().optional(),
  specText: z.string().trim().min(1).nullable().optional(),
  weightGrams: z.number().int().positive().nullable().optional()
})

const providerResponseSchema = z.object({
  platformGuess: z.enum(PLATFORM_CODES).nullable().optional(),
  orderedAtGuess: z.string().trim().min(1).nullable().optional(),
  itemDrafts: z.array(providerItemSchema).default([])
})

function normalizeText(value: string | null | undefined) {
  const normalized = value?.normalize("NFKC").replace(/\s+/g, " ").trim()

  return normalized ? normalized : null
}

function isLikelyNonProductLine(rawName: string) {
  return NON_PRODUCT_LINE_PATTERN.test(rawName)
}

function inferSpecText(rawName: string, specText: string | null) {
  if (specText) {
    return specText
  }

  const match = rawName.match(SPEC_PATTERN)

  return match?.[1] ? normalizeText(match[1]) : null
}

function inferWeightGrams(rawName: string, specText: string | null, weightGrams: number | null) {
  if (weightGrams != null && weightGrams > 0) {
    return weightGrams
  }

  const source = `${specText ?? ""} ${rawName}`
  const match = source.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|千克|克|斤)(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?/i
  )

  if (!match) {
    return null
  }

  const value = Number.parseFloat(match[1] ?? "")
  const unit = match[2]?.toLowerCase()
  const multiplier = Number.parseFloat(match[3] ?? "1")

  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) {
    return null
  }

  let grams = value

  switch (unit) {
    case "kg":
    case "千克":
      grams = value * 1000
      break
    case "斤":
      grams = value * 500
      break
    case "g":
    case "克":
      grams = value
      break
    default:
      return null
  }

  return Math.round(grams * multiplier)
}

function inferCategoryCode(rawName: string, guessedCategoryCode: string | null, specText: string | null) {
  if (guessedCategoryCode && DEFAULT_CATEGORIES.some((category) => category.code === guessedCategoryCode)) {
    return guessedCategoryCode
  }

  const source = `${rawName} ${specText ?? ""}`

  return CATEGORY_RULES.find((rule) => rule.pattern.test(source))?.code ?? null
}

function toFallbackPageIndex(
  pageIndex: number | null | undefined,
  images: AnalyzeOrderImagesInput["images"]
) {
  if (pageIndex != null && Number.isInteger(pageIndex) && pageIndex >= 0) {
    return pageIndex
  }

  return images.length === 1 ? images[0]?.pageIndex ?? null : null
}

function mergeSanitizedItems(
  current: VisionDraftItem,
  next: VisionDraftItem
): VisionDraftItem {
  return {
    pageIndex: current.pageIndex ?? next.pageIndex,
    rawName: current.rawName.length >= next.rawName.length ? current.rawName : next.rawName,
    guessedCategoryCode: current.guessedCategoryCode ?? next.guessedCategoryCode,
    priceAmount: current.priceAmount ?? next.priceAmount,
    quantity: current.quantity ?? next.quantity,
    specText: current.specText ?? next.specText,
    weightGrams: current.weightGrams ?? next.weightGrams
  }
}

function sanitizeVisionDraftItems(
  input: AnalyzeOrderImagesInput,
  items: VisionDraftItem[]
): VisionDraftItem[] {
  const deduped = new Map<string, VisionDraftItem>()

  for (const item of items) {
    const rawName = normalizeText(item.rawName)

    if (!rawName || isLikelyNonProductLine(rawName)) {
      continue
    }

    const specText = inferSpecText(rawName, normalizeText(item.specText))
    const sanitized: VisionDraftItem = {
      pageIndex: toFallbackPageIndex(item.pageIndex, input.images),
      rawName,
      guessedCategoryCode: inferCategoryCode(rawName, item.guessedCategoryCode ?? null, specText),
      priceAmount: item.priceAmount ?? null,
      quantity: normalizeText(item.quantity)?.replace(/\s+/g, "") ?? null,
      specText,
      weightGrams: inferWeightGrams(rawName, specText, item.weightGrams ?? null)
    }
    const dedupeKey = [
      sanitized.pageIndex ?? "na",
      normalizeProductName(sanitized.rawName),
      sanitized.priceAmount ?? "na",
      sanitized.quantity ?? "na"
    ].join("::")
    const existing = deduped.get(dedupeKey)

    deduped.set(dedupeKey, existing ? mergeSanitizedItems(existing, sanitized) : sanitized)
  }

  return [...deduped.values()]
}

export type VisionDraftItem = {
  pageIndex: number | null
  rawName: string
  guessedCategoryCode: string | null
  priceAmount: number | null
  quantity: string | null
  specText: string | null
  weightGrams: number | null
}

export type AnalyzeOrderImagesInput = {
  images: Array<{
    pageIndex: number
    imageUrl?: string
  }>
  initialPlatform: PlatformCode | null
}

export type AnalyzeOrderImagesResult = {
  platformGuess: PlatformCode | null
  orderedAtGuess: string | null
  rawModelResponse: unknown
  itemDrafts: VisionDraftItem[]
}

type VisionProvider = {
  mode: "manual" | "remote"
  analyzeOrderImages(input: AnalyzeOrderImagesInput): Promise<AnalyzeOrderImagesResult>
}

class ManualReviewVisionProvider implements VisionProvider {
  mode = "manual" as const

  constructor(private readonly reason: string) {}

  async analyzeOrderImages(input: AnalyzeOrderImagesInput) {
    return {
      platformGuess: input.initialPlatform,
      orderedAtGuess: null,
      rawModelResponse: {
        provider: "manual-review-fallback",
        reason: this.reason
      },
      itemDrafts: input.images.map((image) => ({
        pageIndex: image.pageIndex,
        rawName: `截图第 ${image.pageIndex + 1} 页待人工补录商品`,
        guessedCategoryCode: null,
        priceAmount: null,
        quantity: null,
        specText: null,
        weightGrams: null
      }))
    }
  }
}

class OpenAICompatibleVisionProvider implements VisionProvider {
  mode = "remote" as const

  constructor(
    private readonly name: "ark" | "qwen",
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async analyzeOrderImages(input: AnalyzeOrderImagesInput) {
    const images = input.images.map((image, index) => {
      if (!image.imageUrl) {
        throw new RouteError(
          "INTERNAL_ERROR",
          `Image URL is required for remote vision analysis (image index ${index}).`,
          500
        )
      }

      return image
    })

    const requestBody: Record<string, unknown> = {
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You extract Chinese grocery order screenshots into structured JSON. Infer platform and order time conservatively. Only output valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "请识别这些中国线上买菜/超市订单截图，并输出 JSON：",
                JSON.stringify({
                  platformGuess: "HEMA | XIAOXIANG | QIXIAN | SAMS | null",
                  orderedAtGuess: "ISO datetime string | null",
                  itemDrafts: [
                    {
                      pageIndex: "number | null",
                      rawName: "string",
                      guessedCategoryCode:
                        DEFAULT_CATEGORIES.map((item) => item.code).join(" | ") + " | null",
                      priceAmount: "integer in fen | null",
                      quantity: "decimal string | null",
                      specText: "string | null",
                      weightGrams: "integer grams | null"
                    }
                  ]
                }),
                "规则：",
                "1. 价格统一转成分的整数。",
                "2. quantity 输出商品购买数量，不是重量。",
                "3. weightGrams 只在能可靠识别为单件重量时填写。",
                "4. 如果无法确定字段就填 null，不要编造。",
                "5. 每个商品项必须带 rawName。",
                "6. 平台映射规则：盒马/盒马鲜生/盒马日日鲜/盒马奥莱 -> HEMA；小象/小象超市/美团买菜 -> XIAOXIANG；七鲜/京东七鲜 -> QIXIAN；山姆/Sam's Club -> SAMS。",
                "7. 如果页面出现门店名、订单标题、客服/品牌标识等能明确指向平台，也要输出 platformGuess。",
                "8. orderedAtGuess 优先使用明确的下单时间、支付时间、订单创建时间。",
                "9. 如果没有严格匹配的下单时间，但能看到预计送达时间、预约送达时间或送达时间段，就使用其中最晚的那个时间作为 orderedAtGuess。",
                "10. 不要把手机状态栏时间直接当成下单时间，除非页面明确说明那就是下单/支付时间。",
                "11. orderedAtGuess 必须输出 ISO 8601 datetime，优先使用中国时区 +08:00。",
                input.initialPlatform
                  ? `12. 当前已知平台优先参考为 ${input.initialPlatform}。`
                  : "12. 如果平台不确定，platformGuess 设为 null。"
              ].join("\n")
            },
            ...images.map((image) => ({
              type: "image_url",
              image_url: {
                url: image.imageUrl
              }
            }))
          ]
        }
      ]
    }

    if (this.name === "qwen") {
      requestBody.response_format = {
        type: "json_object"
      }
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const body = await response.text()

      throw new RouteError(
        "INTERNAL_ERROR",
        `${this.name} vision provider request failed: ${response.status} ${body}`,
        500
      )
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>
        }
      }>
    }
    const content = payload.choices?.[0]?.message?.content
    const rawText = Array.isArray(content)
      ? content
          .map((item) => (typeof item?.text === "string" ? item.text : ""))
          .join("\n")
      : typeof content === "string"
        ? content
        : ""

    if (!rawText) {
      throw new RouteError(
        "INTERNAL_ERROR",
        `${this.name} vision provider returned empty content.`,
        500
      )
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(rawText)
    } catch {
      throw new RouteError(
        "INTERNAL_ERROR",
        `${this.name} vision provider returned invalid JSON.`,
        500
      )
    }

    const result = providerResponseSchema.safeParse(parsed)

    if (!result.success) {
      throw new RouteError(
        "INTERNAL_ERROR",
        `${this.name} vision provider returned schema-invalid JSON.`,
        500
      )
    }

    const sanitizedItems = sanitizeVisionDraftItems(
      input,
      result.data.itemDrafts.map((item) => ({
        pageIndex: item.pageIndex ?? null,
        rawName: item.rawName,
        guessedCategoryCode: item.guessedCategoryCode ?? null,
        priceAmount: item.priceAmount ?? null,
        quantity: item.quantity ?? null,
        specText: item.specText ?? null,
        weightGrams: item.weightGrams ?? null
      }))
    )

    return {
      platformGuess: result.data.platformGuess ?? input.initialPlatform,
      orderedAtGuess: result.data.orderedAtGuess ?? null,
      rawModelResponse: parsed,
      itemDrafts: sanitizedItems
    }
  }
}

let cachedProvider: VisionProvider | null = null

function getConfiguredProvider() {
  if (!cachedProvider) {
    cachedProvider = buildConfiguredProvider()
  }

  return cachedProvider
}

function buildConfiguredProvider() {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase()

  if (provider === "ark") {
    const apiKey = process.env.ARK_API_KEY?.trim()
    const baseUrl = process.env.ARK_BASE_URL?.trim() || DEFAULT_ARK_BASE_URL
    const model = process.env.ARK_VISION_MODEL?.trim()

    if (apiKey && model) {
      return new OpenAICompatibleVisionProvider("ark", apiKey, baseUrl, model)
    }

    return new ManualReviewVisionProvider(
      "ARK provider is selected but ARK_API_KEY / ARK_VISION_MODEL are incomplete."
    )
  }

  if (provider === "qwen") {
    const apiKey = process.env.QWEN_API_KEY?.trim()
    const baseUrl = process.env.QWEN_BASE_URL?.trim()
    const model = process.env.QWEN_VISION_MODEL?.trim()

    if (apiKey && baseUrl && model) {
      return new OpenAICompatibleVisionProvider("qwen", apiKey, baseUrl, model)
    }

    return new ManualReviewVisionProvider(
      "QWEN provider is selected but QWEN_API_KEY / QWEN_BASE_URL / QWEN_VISION_MODEL are incomplete."
    )
  }

  return new ManualReviewVisionProvider(
    "No usable vision provider is configured, switched to manual review fallback."
  )
}

export function getVisionExecutionMode() {
  return getConfiguredProvider().mode
}

export async function analyzeOrderImages(input: AnalyzeOrderImagesInput) {
  return getConfiguredProvider().analyzeOrderImages(input)
}
