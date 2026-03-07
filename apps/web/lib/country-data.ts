/**
 * country-data.ts — 195개국 데이터 (v14 Phase 1: S08)
 *
 * ISO3 코드, ISO2 코드 (국기 이모지 변환용), 영문명, 한글명 포함
 * 국기 이모지: ISO2 코드를 Regional Indicator Symbol로 변환
 */

export interface CountryEntry {
  iso3: string;   // ISO 3166-1 alpha-3
  iso2: string;   // ISO 3166-1 alpha-2 (국기 이모지용)
  name: string;   // 영문 국가명
  nameKo: string; // 한글 국가명
}

/**
 * ISO2 코드 → 국기 이모지 변환
 * Regional Indicator Symbol 쌍으로 변환 (예: "US" → flag emoji)
 */
export function iso2ToFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '';
  const codePoints = [...iso2.toUpperCase()].map(
    c => 0x1F1E6 + c.charCodeAt(0) - 65,
  );
  return String.fromCodePoint(...codePoints);
}

/**
 * ISO3 코드로 국가 데이터 검색
 */
export function getCountryByISO3(iso3: string): CountryEntry | undefined {
  return COUNTRIES.find(c => c.iso3 === iso3);
}

/**
 * 검색어로 국가 필터링 (영문 + 한글)
 */
export function searchCountries(query: string): readonly CountryEntry[] {
  if (!query.trim()) return COUNTRIES;
  const q = query.trim().toLowerCase();
  return COUNTRIES.filter(
    c => c.name.toLowerCase().includes(q) ||
         c.nameKo.includes(q) ||
         c.iso3.toLowerCase().includes(q) ||
         c.iso2.toLowerCase().includes(q),
  );
}

// ─── 195개국 데이터 ───

export const COUNTRIES: readonly CountryEntry[] = [
  { iso3: 'AFG', iso2: 'AF', name: 'Afghanistan', nameKo: '아프가니스탄' },
  { iso3: 'ALB', iso2: 'AL', name: 'Albania', nameKo: '알바니아' },
  { iso3: 'DZA', iso2: 'DZ', name: 'Algeria', nameKo: '알제리' },
  { iso3: 'AND', iso2: 'AD', name: 'Andorra', nameKo: '안도라' },
  { iso3: 'AGO', iso2: 'AO', name: 'Angola', nameKo: '앙골라' },
  { iso3: 'ATG', iso2: 'AG', name: 'Antigua and Barbuda', nameKo: '앤티가 바부다' },
  { iso3: 'ARG', iso2: 'AR', name: 'Argentina', nameKo: '아르헨티나' },
  { iso3: 'ARM', iso2: 'AM', name: 'Armenia', nameKo: '아르메니아' },
  { iso3: 'AUS', iso2: 'AU', name: 'Australia', nameKo: '호주' },
  { iso3: 'AUT', iso2: 'AT', name: 'Austria', nameKo: '오스트리아' },
  { iso3: 'AZE', iso2: 'AZ', name: 'Azerbaijan', nameKo: '아제르바이잔' },
  { iso3: 'BHS', iso2: 'BS', name: 'Bahamas', nameKo: '바하마' },
  { iso3: 'BHR', iso2: 'BH', name: 'Bahrain', nameKo: '바레인' },
  { iso3: 'BGD', iso2: 'BD', name: 'Bangladesh', nameKo: '방글라데시' },
  { iso3: 'BRB', iso2: 'BB', name: 'Barbados', nameKo: '바베이도스' },
  { iso3: 'BLR', iso2: 'BY', name: 'Belarus', nameKo: '벨라루스' },
  { iso3: 'BEL', iso2: 'BE', name: 'Belgium', nameKo: '벨기에' },
  { iso3: 'BLZ', iso2: 'BZ', name: 'Belize', nameKo: '벨리즈' },
  { iso3: 'BEN', iso2: 'BJ', name: 'Benin', nameKo: '베냉' },
  { iso3: 'BTN', iso2: 'BT', name: 'Bhutan', nameKo: '부탄' },
  { iso3: 'BOL', iso2: 'BO', name: 'Bolivia', nameKo: '볼리비아' },
  { iso3: 'BIH', iso2: 'BA', name: 'Bosnia and Herzegovina', nameKo: '보스니아 헤르체고비나' },
  { iso3: 'BWA', iso2: 'BW', name: 'Botswana', nameKo: '보츠와나' },
  { iso3: 'BRA', iso2: 'BR', name: 'Brazil', nameKo: '브라질' },
  { iso3: 'BRN', iso2: 'BN', name: 'Brunei', nameKo: '브루나이' },
  { iso3: 'BGR', iso2: 'BG', name: 'Bulgaria', nameKo: '불가리아' },
  { iso3: 'BFA', iso2: 'BF', name: 'Burkina Faso', nameKo: '부르키나파소' },
  { iso3: 'BDI', iso2: 'BI', name: 'Burundi', nameKo: '부룬디' },
  { iso3: 'CPV', iso2: 'CV', name: 'Cabo Verde', nameKo: '카보베르데' },
  { iso3: 'KHM', iso2: 'KH', name: 'Cambodia', nameKo: '캄보디아' },
  { iso3: 'CMR', iso2: 'CM', name: 'Cameroon', nameKo: '카메룬' },
  { iso3: 'CAN', iso2: 'CA', name: 'Canada', nameKo: '캐나다' },
  { iso3: 'CAF', iso2: 'CF', name: 'Central African Republic', nameKo: '중앙아프리카공화국' },
  { iso3: 'TCD', iso2: 'TD', name: 'Chad', nameKo: '차드' },
  { iso3: 'CHL', iso2: 'CL', name: 'Chile', nameKo: '칠레' },
  { iso3: 'CHN', iso2: 'CN', name: 'China', nameKo: '중국' },
  { iso3: 'COL', iso2: 'CO', name: 'Colombia', nameKo: '콜롬비아' },
  { iso3: 'COM', iso2: 'KM', name: 'Comoros', nameKo: '코모로' },
  { iso3: 'COG', iso2: 'CG', name: 'Congo', nameKo: '콩고' },
  { iso3: 'COD', iso2: 'CD', name: 'Congo (DRC)', nameKo: '콩고민주공화국' },
  { iso3: 'CRI', iso2: 'CR', name: 'Costa Rica', nameKo: '코스타리카' },
  { iso3: 'CIV', iso2: 'CI', name: "Cote d'Ivoire", nameKo: '코트디부아르' },
  { iso3: 'HRV', iso2: 'HR', name: 'Croatia', nameKo: '크로아티아' },
  { iso3: 'CUB', iso2: 'CU', name: 'Cuba', nameKo: '쿠바' },
  { iso3: 'CYP', iso2: 'CY', name: 'Cyprus', nameKo: '키프로스' },
  { iso3: 'CZE', iso2: 'CZ', name: 'Czech Republic', nameKo: '체코' },
  { iso3: 'DNK', iso2: 'DK', name: 'Denmark', nameKo: '덴마크' },
  { iso3: 'DJI', iso2: 'DJ', name: 'Djibouti', nameKo: '지부티' },
  { iso3: 'DMA', iso2: 'DM', name: 'Dominica', nameKo: '도미니카' },
  { iso3: 'DOM', iso2: 'DO', name: 'Dominican Republic', nameKo: '도미니카공화국' },
  { iso3: 'ECU', iso2: 'EC', name: 'Ecuador', nameKo: '에콰도르' },
  { iso3: 'EGY', iso2: 'EG', name: 'Egypt', nameKo: '이집트' },
  { iso3: 'SLV', iso2: 'SV', name: 'El Salvador', nameKo: '엘살바도르' },
  { iso3: 'GNQ', iso2: 'GQ', name: 'Equatorial Guinea', nameKo: '적도기니' },
  { iso3: 'ERI', iso2: 'ER', name: 'Eritrea', nameKo: '에리트레아' },
  { iso3: 'EST', iso2: 'EE', name: 'Estonia', nameKo: '에스토니아' },
  { iso3: 'SWZ', iso2: 'SZ', name: 'Eswatini', nameKo: '에스와티니' },
  { iso3: 'ETH', iso2: 'ET', name: 'Ethiopia', nameKo: '에티오피아' },
  { iso3: 'FJI', iso2: 'FJ', name: 'Fiji', nameKo: '피지' },
  { iso3: 'FIN', iso2: 'FI', name: 'Finland', nameKo: '핀란드' },
  { iso3: 'FRA', iso2: 'FR', name: 'France', nameKo: '프랑스' },
  { iso3: 'GAB', iso2: 'GA', name: 'Gabon', nameKo: '가봉' },
  { iso3: 'GMB', iso2: 'GM', name: 'Gambia', nameKo: '감비아' },
  { iso3: 'GEO', iso2: 'GE', name: 'Georgia', nameKo: '조지아' },
  { iso3: 'DEU', iso2: 'DE', name: 'Germany', nameKo: '독일' },
  { iso3: 'GHA', iso2: 'GH', name: 'Ghana', nameKo: '가나' },
  { iso3: 'GRC', iso2: 'GR', name: 'Greece', nameKo: '그리스' },
  { iso3: 'GRD', iso2: 'GD', name: 'Grenada', nameKo: '그레나다' },
  { iso3: 'GTM', iso2: 'GT', name: 'Guatemala', nameKo: '과테말라' },
  { iso3: 'GIN', iso2: 'GN', name: 'Guinea', nameKo: '기니' },
  { iso3: 'GNB', iso2: 'GW', name: 'Guinea-Bissau', nameKo: '기니비사우' },
  { iso3: 'GUY', iso2: 'GY', name: 'Guyana', nameKo: '가이아나' },
  { iso3: 'HTI', iso2: 'HT', name: 'Haiti', nameKo: '아이티' },
  { iso3: 'HND', iso2: 'HN', name: 'Honduras', nameKo: '온두라스' },
  { iso3: 'HUN', iso2: 'HU', name: 'Hungary', nameKo: '헝가리' },
  { iso3: 'ISL', iso2: 'IS', name: 'Iceland', nameKo: '아이슬란드' },
  { iso3: 'IND', iso2: 'IN', name: 'India', nameKo: '인도' },
  { iso3: 'IDN', iso2: 'ID', name: 'Indonesia', nameKo: '인도네시아' },
  { iso3: 'IRN', iso2: 'IR', name: 'Iran', nameKo: '이란' },
  { iso3: 'IRQ', iso2: 'IQ', name: 'Iraq', nameKo: '이라크' },
  { iso3: 'IRL', iso2: 'IE', name: 'Ireland', nameKo: '아일랜드' },
  { iso3: 'ISR', iso2: 'IL', name: 'Israel', nameKo: '이스라엘' },
  { iso3: 'ITA', iso2: 'IT', name: 'Italy', nameKo: '이탈리아' },
  { iso3: 'JAM', iso2: 'JM', name: 'Jamaica', nameKo: '자메이카' },
  { iso3: 'JPN', iso2: 'JP', name: 'Japan', nameKo: '일본' },
  { iso3: 'JOR', iso2: 'JO', name: 'Jordan', nameKo: '요르단' },
  { iso3: 'KAZ', iso2: 'KZ', name: 'Kazakhstan', nameKo: '카자흐스탄' },
  { iso3: 'KEN', iso2: 'KE', name: 'Kenya', nameKo: '케냐' },
  { iso3: 'KIR', iso2: 'KI', name: 'Kiribati', nameKo: '키리바시' },
  { iso3: 'PRK', iso2: 'KP', name: 'North Korea', nameKo: '북한' },
  { iso3: 'KOR', iso2: 'KR', name: 'South Korea', nameKo: '대한민국' },
  { iso3: 'KWT', iso2: 'KW', name: 'Kuwait', nameKo: '쿠웨이트' },
  { iso3: 'KGZ', iso2: 'KG', name: 'Kyrgyzstan', nameKo: '키르기스스탄' },
  { iso3: 'LAO', iso2: 'LA', name: 'Laos', nameKo: '라오스' },
  { iso3: 'LVA', iso2: 'LV', name: 'Latvia', nameKo: '라트비아' },
  { iso3: 'LBN', iso2: 'LB', name: 'Lebanon', nameKo: '레바논' },
  { iso3: 'LSO', iso2: 'LS', name: 'Lesotho', nameKo: '레소토' },
  { iso3: 'LBR', iso2: 'LR', name: 'Liberia', nameKo: '라이베리아' },
  { iso3: 'LBY', iso2: 'LY', name: 'Libya', nameKo: '리비아' },
  { iso3: 'LIE', iso2: 'LI', name: 'Liechtenstein', nameKo: '리히텐슈타인' },
  { iso3: 'LTU', iso2: 'LT', name: 'Lithuania', nameKo: '리투아니아' },
  { iso3: 'LUX', iso2: 'LU', name: 'Luxembourg', nameKo: '룩셈부르크' },
  { iso3: 'MDG', iso2: 'MG', name: 'Madagascar', nameKo: '마다가스카르' },
  { iso3: 'MWI', iso2: 'MW', name: 'Malawi', nameKo: '말라위' },
  { iso3: 'MYS', iso2: 'MY', name: 'Malaysia', nameKo: '말레이시아' },
  { iso3: 'MDV', iso2: 'MV', name: 'Maldives', nameKo: '몰디브' },
  { iso3: 'MLI', iso2: 'ML', name: 'Mali', nameKo: '말리' },
  { iso3: 'MLT', iso2: 'MT', name: 'Malta', nameKo: '몰타' },
  { iso3: 'MHL', iso2: 'MH', name: 'Marshall Islands', nameKo: '마셜제도' },
  { iso3: 'MRT', iso2: 'MR', name: 'Mauritania', nameKo: '모리타니' },
  { iso3: 'MUS', iso2: 'MU', name: 'Mauritius', nameKo: '모리셔스' },
  { iso3: 'MEX', iso2: 'MX', name: 'Mexico', nameKo: '멕시코' },
  { iso3: 'FSM', iso2: 'FM', name: 'Micronesia', nameKo: '미크로네시아' },
  { iso3: 'MDA', iso2: 'MD', name: 'Moldova', nameKo: '몰도바' },
  { iso3: 'MCO', iso2: 'MC', name: 'Monaco', nameKo: '모나코' },
  { iso3: 'MNG', iso2: 'MN', name: 'Mongolia', nameKo: '몽골' },
  { iso3: 'MNE', iso2: 'ME', name: 'Montenegro', nameKo: '몬테네그로' },
  { iso3: 'MAR', iso2: 'MA', name: 'Morocco', nameKo: '모로코' },
  { iso3: 'MOZ', iso2: 'MZ', name: 'Mozambique', nameKo: '모잠비크' },
  { iso3: 'MMR', iso2: 'MM', name: 'Myanmar', nameKo: '미얀마' },
  { iso3: 'NAM', iso2: 'NA', name: 'Namibia', nameKo: '나미비아' },
  { iso3: 'NRU', iso2: 'NR', name: 'Nauru', nameKo: '나우루' },
  { iso3: 'NPL', iso2: 'NP', name: 'Nepal', nameKo: '네팔' },
  { iso3: 'NLD', iso2: 'NL', name: 'Netherlands', nameKo: '네덜란드' },
  { iso3: 'NZL', iso2: 'NZ', name: 'New Zealand', nameKo: '뉴질랜드' },
  { iso3: 'NIC', iso2: 'NI', name: 'Nicaragua', nameKo: '니카라과' },
  { iso3: 'NER', iso2: 'NE', name: 'Niger', nameKo: '니제르' },
  { iso3: 'NGA', iso2: 'NG', name: 'Nigeria', nameKo: '나이지리아' },
  { iso3: 'MKD', iso2: 'MK', name: 'North Macedonia', nameKo: '북마케도니아' },
  { iso3: 'NOR', iso2: 'NO', name: 'Norway', nameKo: '노르웨이' },
  { iso3: 'OMN', iso2: 'OM', name: 'Oman', nameKo: '오만' },
  { iso3: 'PAK', iso2: 'PK', name: 'Pakistan', nameKo: '파키스탄' },
  { iso3: 'PLW', iso2: 'PW', name: 'Palau', nameKo: '팔라우' },
  { iso3: 'PAN', iso2: 'PA', name: 'Panama', nameKo: '파나마' },
  { iso3: 'PNG', iso2: 'PG', name: 'Papua New Guinea', nameKo: '파푸아뉴기니' },
  { iso3: 'PRY', iso2: 'PY', name: 'Paraguay', nameKo: '파라과이' },
  { iso3: 'PER', iso2: 'PE', name: 'Peru', nameKo: '페루' },
  { iso3: 'PHL', iso2: 'PH', name: 'Philippines', nameKo: '필리핀' },
  { iso3: 'POL', iso2: 'PL', name: 'Poland', nameKo: '폴란드' },
  { iso3: 'PRT', iso2: 'PT', name: 'Portugal', nameKo: '포르투갈' },
  { iso3: 'QAT', iso2: 'QA', name: 'Qatar', nameKo: '카타르' },
  { iso3: 'ROU', iso2: 'RO', name: 'Romania', nameKo: '루마니아' },
  { iso3: 'RUS', iso2: 'RU', name: 'Russia', nameKo: '러시아' },
  { iso3: 'RWA', iso2: 'RW', name: 'Rwanda', nameKo: '르완다' },
  { iso3: 'KNA', iso2: 'KN', name: 'Saint Kitts and Nevis', nameKo: '세인트키츠 네비스' },
  { iso3: 'LCA', iso2: 'LC', name: 'Saint Lucia', nameKo: '세인트루시아' },
  { iso3: 'VCT', iso2: 'VC', name: 'Saint Vincent', nameKo: '세인트빈센트' },
  { iso3: 'WSM', iso2: 'WS', name: 'Samoa', nameKo: '사모아' },
  { iso3: 'SMR', iso2: 'SM', name: 'San Marino', nameKo: '산마리노' },
  { iso3: 'STP', iso2: 'ST', name: 'Sao Tome and Principe', nameKo: '상투메프린시페' },
  { iso3: 'SAU', iso2: 'SA', name: 'Saudi Arabia', nameKo: '사우디아라비아' },
  { iso3: 'SEN', iso2: 'SN', name: 'Senegal', nameKo: '세네갈' },
  { iso3: 'SRB', iso2: 'RS', name: 'Serbia', nameKo: '세르비아' },
  { iso3: 'SYC', iso2: 'SC', name: 'Seychelles', nameKo: '세이셸' },
  { iso3: 'SLE', iso2: 'SL', name: 'Sierra Leone', nameKo: '시에라리온' },
  { iso3: 'SGP', iso2: 'SG', name: 'Singapore', nameKo: '싱가포르' },
  { iso3: 'SVK', iso2: 'SK', name: 'Slovakia', nameKo: '슬로바키아' },
  { iso3: 'SVN', iso2: 'SI', name: 'Slovenia', nameKo: '슬로베니아' },
  { iso3: 'SLB', iso2: 'SB', name: 'Solomon Islands', nameKo: '솔로몬제도' },
  { iso3: 'SOM', iso2: 'SO', name: 'Somalia', nameKo: '소말리아' },
  { iso3: 'ZAF', iso2: 'ZA', name: 'South Africa', nameKo: '남아프리카공화국' },
  { iso3: 'SSD', iso2: 'SS', name: 'South Sudan', nameKo: '남수단' },
  { iso3: 'ESP', iso2: 'ES', name: 'Spain', nameKo: '스페인' },
  { iso3: 'LKA', iso2: 'LK', name: 'Sri Lanka', nameKo: '스리랑카' },
  { iso3: 'SDN', iso2: 'SD', name: 'Sudan', nameKo: '수단' },
  { iso3: 'SUR', iso2: 'SR', name: 'Suriname', nameKo: '수리남' },
  { iso3: 'SWE', iso2: 'SE', name: 'Sweden', nameKo: '스웨덴' },
  { iso3: 'CHE', iso2: 'CH', name: 'Switzerland', nameKo: '스위스' },
  { iso3: 'SYR', iso2: 'SY', name: 'Syria', nameKo: '시리아' },
  { iso3: 'TWN', iso2: 'TW', name: 'Taiwan', nameKo: '대만' },
  { iso3: 'TJK', iso2: 'TJ', name: 'Tajikistan', nameKo: '타지키스탄' },
  { iso3: 'TZA', iso2: 'TZ', name: 'Tanzania', nameKo: '탄자니아' },
  { iso3: 'THA', iso2: 'TH', name: 'Thailand', nameKo: '태국' },
  { iso3: 'TLS', iso2: 'TL', name: 'Timor-Leste', nameKo: '동티모르' },
  { iso3: 'TGO', iso2: 'TG', name: 'Togo', nameKo: '토고' },
  { iso3: 'TON', iso2: 'TO', name: 'Tonga', nameKo: '통가' },
  { iso3: 'TTO', iso2: 'TT', name: 'Trinidad and Tobago', nameKo: '트리니다드토바고' },
  { iso3: 'TUN', iso2: 'TN', name: 'Tunisia', nameKo: '튀니지' },
  { iso3: 'TUR', iso2: 'TR', name: 'Turkey', nameKo: '튀르키예' },
  { iso3: 'TKM', iso2: 'TM', name: 'Turkmenistan', nameKo: '투르크메니스탄' },
  { iso3: 'TUV', iso2: 'TV', name: 'Tuvalu', nameKo: '투발루' },
  { iso3: 'UGA', iso2: 'UG', name: 'Uganda', nameKo: '우간다' },
  { iso3: 'UKR', iso2: 'UA', name: 'Ukraine', nameKo: '우크라이나' },
  { iso3: 'ARE', iso2: 'AE', name: 'United Arab Emirates', nameKo: '아랍에미리트' },
  { iso3: 'GBR', iso2: 'GB', name: 'United Kingdom', nameKo: '영국' },
  { iso3: 'USA', iso2: 'US', name: 'United States', nameKo: '미국' },
  { iso3: 'URY', iso2: 'UY', name: 'Uruguay', nameKo: '우루과이' },
  { iso3: 'UZB', iso2: 'UZ', name: 'Uzbekistan', nameKo: '우즈베키스탄' },
  { iso3: 'VUT', iso2: 'VU', name: 'Vanuatu', nameKo: '바누아투' },
  { iso3: 'VAT', iso2: 'VA', name: 'Vatican City', nameKo: '바티칸' },
  { iso3: 'VEN', iso2: 'VE', name: 'Venezuela', nameKo: '베네수엘라' },
  { iso3: 'VNM', iso2: 'VN', name: 'Vietnam', nameKo: '베트남' },
  { iso3: 'YEM', iso2: 'YE', name: 'Yemen', nameKo: '예멘' },
  { iso3: 'ZMB', iso2: 'ZM', name: 'Zambia', nameKo: '잠비아' },
  { iso3: 'ZWE', iso2: 'ZW', name: 'Zimbabwe', nameKo: '짐바브웨' },
  { iso3: 'PSE', iso2: 'PS', name: 'Palestine', nameKo: '팔레스타인' },
  { iso3: 'XKX', iso2: 'XK', name: 'Kosovo', nameKo: '코소보' },
] as const;
