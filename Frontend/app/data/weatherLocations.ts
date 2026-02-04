// 気象庁の地点コードとヒューマンリーダブルな地点名のマッピング

export interface WeatherLocation {
  code: string;
  name: string;
  region: string;
}

export const WEATHER_LOCATIONS: WeatherLocation[] = [
  // 北海道
  { code: "016000", name: "札幌", region: "北海道" },
  { code: "012000", name: "旭川", region: "北海道" },
  { code: "014030", name: "函館", region: "北海道" },

  // 東北
  { code: "020000", name: "青森", region: "東北" },
  { code: "030000", name: "岩手", region: "東北" },
  { code: "040000", name: "仙台", region: "東北" },
  { code: "050000", name: "秋田", region: "東北" },
  { code: "060000", name: "山形", region: "東北" },
  { code: "070000", name: "福島", region: "東北" },

  // 関東甲信
  { code: "080000", name: "茨城", region: "関東甲信" },
  { code: "090000", name: "栃木", region: "関東甲信" },
  { code: "100000", name: "群馬", region: "関東甲信" },
  { code: "110000", name: "埼玉", region: "関東甲信" },
  { code: "120000", name: "千葉", region: "関東甲信" },
  { code: "130000", name: "東京", region: "関東甲信" },
  { code: "140000", name: "横浜", region: "関東甲信" },
  { code: "190000", name: "山梨", region: "関東甲信" },
  { code: "200000", name: "長野", region: "関東甲信" },

  // 北陸
  { code: "150000", name: "新潟", region: "北陸" },
  { code: "160000", name: "富山", region: "北陸" },
  { code: "170000", name: "金沢", region: "北陸" },
  { code: "180000", name: "福井", region: "北陸" },

  // 東海
  { code: "210000", name: "岐阜", region: "東海" },
  { code: "220000", name: "静岡", region: "東海" },
  { code: "230000", name: "名古屋", region: "東海" },
  { code: "240000", name: "三重", region: "東海" },

  // 近畿
  { code: "250000", name: "滋賀", region: "近畿" },
  { code: "260000", name: "京都", region: "近畿" },
  { code: "270000", name: "大阪", region: "近畿" },
  { code: "280000", name: "神戸", region: "近畿" },
  { code: "290000", name: "奈良", region: "近畿" },
  { code: "300000", name: "和歌山", region: "近畿" },

  // 中国
  { code: "310000", name: "鳥取", region: "中国" },
  { code: "320000", name: "松江", region: "中国" },
  { code: "330000", name: "岡山", region: "中国" },
  { code: "340000", name: "広島", region: "中国" },
  { code: "350000", name: "山口", region: "中国" },

  // 四国
  { code: "360000", name: "徳島", region: "四国" },
  { code: "370000", name: "高松", region: "四国" },
  { code: "380000", name: "松山", region: "四国" },
  { code: "390000", name: "高知", region: "四国" },

  // 九州・沖縄
  { code: "400000", name: "福岡", region: "九州・沖縄" },
  { code: "410000", name: "佐賀", region: "九州・沖縄" },
  { code: "420000", name: "長崎", region: "九州・沖縄" },
  { code: "430000", name: "熊本", region: "九州・沖縄" },
  { code: "440000", name: "大分", region: "九州・沖縄" },
  { code: "450000", name: "宮崎", region: "九州・沖縄" },
  { code: "460100", name: "鹿児島", region: "九州・沖縄" },
  { code: "471000", name: "那覇", region: "九州・沖縄" },
];

// 地域でグループ化
export const WEATHER_LOCATIONS_BY_REGION = WEATHER_LOCATIONS.reduce(
  (acc, location) => {
    if (!acc[location.region]) {
      acc[location.region] = [];
    }
    acc[location.region].push(location);
    return acc;
  },
  {} as Record<string, WeatherLocation[]>,
);

// 地域の順序
export const REGION_ORDER = ["北海道", "東北", "関東甲信", "北陸", "東海", "近畿", "中国", "四国", "九州・沖縄"];
