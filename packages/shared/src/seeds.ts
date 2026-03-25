export type DictionarySeed = {
  code: string
  name: string
  sortOrder: number
}

export const DEFAULT_CATEGORIES: readonly DictionarySeed[] = [
  { code: "vegetable_fruit", name: "蔬菜水果", sortOrder: 1 },
  { code: "meat_egg", name: "肉禽蛋", sortOrder: 2 },
  { code: "seafood", name: "海鲜水产", sortOrder: 3 },
  { code: "dairy_bakery", name: "乳品烘焙", sortOrder: 4 },
  { code: "ready_to_eat", name: "熟食速食", sortOrder: 5 },
  { code: "grocery_seasoning", name: "粮油调味", sortOrder: 6 },
  { code: "drinks", name: "酒水饮料", sortOrder: 7 },
  { code: "snacks", name: "休闲零食", sortOrder: 8 },
  { code: "kitchen_supplies", name: "厨房用品", sortOrder: 9 },
  { code: "cleaning_care", name: "洗护清洁", sortOrder: 10 },
  { code: "home_essentials", name: "家居日用", sortOrder: 11 },
  { code: "other", name: "其他", sortOrder: 12 }
] as const

export const DEFAULT_TAGS: readonly DictionarySeed[] = [
  { code: "recommended", name: "推荐", sortOrder: 1 },
  { code: "repurchase", name: "回购", sortOrder: 2 },
  { code: "average", name: "一般", sortOrder: 3 },
  { code: "avoid", name: "避雷", sortOrder: 4 },
  { code: "good_value", name: "性价比高", sortOrder: 5 },
  { code: "bad_value", name: "性价比低", sortOrder: 6 }
] as const
