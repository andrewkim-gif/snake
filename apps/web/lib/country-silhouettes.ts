/**
 * country-silhouettes.ts — 주요 국가 간소화 SVG 윤곽 데이터
 *
 * 각 국가의 대략적인 실루엣을 SVG path로 저장.
 * viewBox 기준: 0 0 200 200 (정규화된 좌표)
 * 지역 seed 좌표: Voronoi subdivision의 시드 포인트
 *
 * 주요 20개국 수동 정의, 나머지는 자동 fallback (원형).
 */

export interface CountrySilhouette {
  /** SVG path d attribute — 국가 윤곽 */
  path: string;
  /** viewBox (default: 0 0 200 200) */
  viewBox?: string;
  /** 지역 시드 좌표 — regionId slug → [x, y] */
  seeds?: Record<string, [number, number]>;
}

/**
 * 주요 국가 실루엣 데이터
 * path: 간소화된 SVG path (200x200 좌표계)
 * seeds: 지역별 대략적 중심점 (Voronoi seed)
 */
export const COUNTRY_SILHOUETTES: Record<string, CountrySilhouette> = {
  // ── S 티어 (8개국) ──

  USA: {
    path: 'M10,80 L25,65 L40,60 L55,55 L70,50 L90,48 L110,50 L125,55 L140,52 L155,58 L170,65 L185,70 L190,80 L188,95 L180,105 L165,115 L150,118 L135,120 L120,118 L105,120 L90,125 L75,122 L60,118 L45,115 L30,110 L18,100 L12,90 Z',
    seeds: {
      ny: [160, 65], la: [30, 95], chicago: [120, 68], texas: [90, 110],
      dc: [165, 80], florida: [155, 115], alaska: [20, 55], hawaii: [40, 120],
    },
  },

  CHN: {
    path: 'M40,30 L70,25 L100,20 L130,25 L155,35 L170,50 L180,70 L175,90 L165,110 L150,125 L130,135 L110,140 L90,138 L70,130 L50,120 L35,105 L25,85 L20,65 L25,45 Z',
    seeds: {
      beijing: [110, 45], shanghai: [150, 80], guangdong: [130, 120],
      sichuan: [70, 90], xinjiang: [40, 50], dongbei: [140, 35],
      yunnan: [75, 125], inner_mongolia: [100, 35],
    },
  },

  RUS: {
    path: 'M5,60 L30,40 L60,30 L90,25 L120,22 L150,25 L175,30 L195,40 L195,65 L190,80 L180,90 L160,95 L140,100 L120,98 L100,95 L80,100 L60,105 L40,100 L20,90 L8,75 Z',
    seeds: {
      moscow: [45, 65], spb: [35, 48], siberia: [120, 55],
      ural: [80, 60], far_east: [170, 50], caucasus: [50, 90],
      volga: [65, 70], arctic: [100, 30],
    },
  },

  IND: {
    path: 'M60,20 L90,15 L120,20 L145,35 L155,55 L150,80 L140,100 L125,120 L110,140 L100,155 L90,160 L80,155 L70,140 L60,120 L50,100 L45,80 L40,60 L45,40 Z',
    seeds: {
      delhi: [90, 35], mumbai: [60, 85], bengaluru: [90, 130],
      kolkata: [125, 70], chennai: [110, 120], hyderabad: [95, 100],
      kashmir: [75, 20], rajasthan: [60, 55],
    },
  },

  JPN: {
    path: 'M80,15 L95,20 L110,30 L120,50 L125,70 L128,90 L130,110 L125,130 L118,145 L108,155 L95,165 L85,170 L78,160 L72,145 L68,125 L65,105 L62,85 L60,65 L65,45 L72,28 Z',
    seeds: {
      tokyo: [105, 85], osaka: [95, 110], hokkaido: [90, 25],
      kyushu: [82, 150], tohoku: [100, 50], chubu: [100, 75],
      okinawa: [70, 170], chugoku: [88, 125],
    },
  },

  DEU: {
    path: 'M65,20 L100,15 L130,20 L150,35 L160,55 L158,80 L150,100 L140,115 L125,130 L105,140 L85,138 L65,130 L50,115 L40,95 L38,75 L42,55 L50,38 Z',
    seeds: {
      berlin: [120, 45], munich: [110, 115], hamburg: [90, 25],
      frankfurt: [80, 75], cologne: [65, 65], dresden: [130, 60],
      stuttgart: [90, 105],
    },
  },

  GBR: {
    path: 'M70,15 L95,12 L115,18 L128,30 L135,50 L132,70 L128,88 L122,105 L115,118 L105,130 L95,140 L85,145 L78,140 L72,128 L68,110 L65,90 L62,70 L60,50 L63,32 Z',
    seeds: {
      london: [110, 110], manchester: [90, 70], scotland: [85, 25],
      wales: [72, 100], birmingham: [100, 85], newcastle: [95, 50],
      cornwall: [78, 135],
    },
  },

  FRA: {
    path: 'M55,25 L85,15 L115,18 L140,30 L155,50 L160,75 L155,100 L145,120 L130,135 L110,145 L90,148 L70,142 L52,130 L40,112 L35,90 L38,68 L42,48 Z',
    seeds: {
      paris: [100, 50], lyon: [115, 95], marseille: [120, 130],
      bordeaux: [60, 110], strasbourg: [140, 50], nantes: [55, 80],
      toulouse: [80, 130],
    },
  },

  // ── A 티어 (주요 12개국) ──

  KOR: {
    path: 'M65,10 L95,8 L120,15 L140,30 L152,50 L158,72 L155,95 L148,115 L135,132 L120,145 L105,155 L92,160 L80,155 L70,142 L60,125 L52,105 L48,82 L50,60 L55,38 Z',
    seeds: {
      seoul: [100, 35], gyeonggi: [85, 52], busan: [130, 135],
      jeju: [85, 158], dmz: [100, 15],
    },
  },

  BRA: {
    path: 'M50,20 L80,15 L110,18 L140,25 L160,40 L172,60 L178,85 L175,110 L168,130 L155,148 L138,160 L118,168 L95,170 L72,165 L52,155 L38,138 L28,118 L22,95 L25,70 L32,48 Z',
    seeds: {
      sao_paulo: [120, 125], rio: [140, 110], brasilia: [100, 80],
      amazon: [65, 40], bahia: [140, 75],
    },
  },

  CAN: {
    path: 'M5,70 L25,50 L50,35 L80,25 L110,20 L140,22 L165,30 L185,45 L195,65 L192,85 L185,100 L170,110 L150,115 L130,112 L110,115 L90,118 L70,115 L50,108 L30,100 L15,88 Z',
    seeds: {
      ontario: [130, 80], quebec: [155, 65], bc: [25, 65],
      alberta: [55, 60], prairies: [85, 65],
    },
  },

  AUS: {
    path: 'M20,55 L50,35 L85,25 L120,22 L155,28 L180,40 L192,60 L195,82 L188,105 L175,125 L155,138 L130,145 L105,148 L80,145 L55,135 L35,120 L20,100 L12,78 Z',
    seeds: {
      sydney: [160, 100], melbourne: [140, 125], brisbane: [170, 70],
      perth: [25, 85], adelaide: [115, 115],
    },
  },

  ITA: {
    path: 'M60,10 L100,8 L130,15 L142,30 L140,50 L132,68 L128,85 L125,100 L118,115 L110,130 L100,145 L92,158 L85,165 L78,158 L72,145 L68,128 L65,110 L62,92 L58,72 L55,50 L55,30 Z',
    seeds: {
      rome: [100, 90], milan: [85, 25], naples: [110, 120],
      sicily: [95, 158], venice: [108, 35],
    },
  },

  TUR: {
    path: 'M10,65 L35,45 L65,35 L95,30 L125,28 L155,32 L178,42 L192,58 L190,78 L182,95 L168,108 L148,115 L125,118 L100,120 L75,118 L50,112 L30,100 L15,85 Z',
    seeds: {
      istanbul: [35, 55], ankara: [105, 65], antalya: [110, 108],
      izmir: [55, 85], eastern: [165, 60],
    },
  },

  SAU: {
    path: 'M30,40 L65,25 L100,20 L135,25 L160,40 L175,60 L180,85 L170,108 L152,125 L130,135 L105,140 L80,138 L55,128 L38,112 L25,90 L22,65 Z',
    seeds: {
      riyadh: [100, 75], jeddah: [55, 95], eastern: [155, 65],
      mecca: [60, 110], medina: [70, 60],
    },
  },

  MEX: {
    path: 'M10,55 L30,35 L55,25 L85,20 L115,22 L140,30 L160,45 L170,65 L172,85 L165,105 L150,120 L130,130 L105,135 L80,132 L55,125 L35,112 L18,95 L10,75 Z',
    seeds: {
      mexico_city: [100, 75], guadalajara: [65, 70], monterrey: [110, 35],
      cancun: [155, 65], tijuana: [20, 40],
    },
  },

  IDN: {
    path: 'M5,80 L30,65 L60,55 L90,50 L120,48 L150,52 L175,60 L195,72 L195,90 L188,105 L170,115 L145,120 L120,122 L95,120 L70,118 L45,115 L25,108 L10,95 Z',
    seeds: {
      java: [90, 95], sumatra: [35, 75], kalimantan: [120, 70],
      sulawesi: [150, 75], papua: [185, 80],
    },
  },

  ESP: {
    path: 'M25,45 L55,30 L90,22 L125,25 L155,35 L172,52 L178,72 L172,95 L158,112 L138,125 L112,132 L85,130 L60,122 L40,108 L28,90 L22,68 Z',
    seeds: {
      madrid: [100, 70], barcelona: [148, 45], seville: [60, 110],
      valencia: [135, 85], bilbao: [85, 35],
    },
  },

  NLD: {
    path: 'M55,25 L85,15 L115,18 L140,30 L155,50 L158,75 L150,98 L138,115 L118,128 L95,135 L75,130 L58,118 L45,100 L38,78 L40,55 Z',
    seeds: {
      amsterdam: [90, 40], rotterdam: [85, 75], hague: [70, 58],
      utrecht: [100, 60], eindhoven: [105, 100],
    },
  },

  POL: {
    path: 'M40,25 L75,15 L110,18 L140,28 L160,45 L168,68 L162,92 L148,112 L128,125 L105,132 L80,130 L58,120 L42,105 L32,85 L30,62 L33,42 Z',
    seeds: {
      warsaw: [110, 55], krakow: [115, 105], gdansk: [105, 22],
      wroclaw: [72, 82], poznan: [70, 50],
    },
  },
};

/**
 * fallback 원형 실루엣 — 미정의 국가용
 * 지역 수에 따라 원 내부를 균등 분할
 */
export function generateCircleSilhouette(regionCount: number): CountrySilhouette {
  const cx = 100, cy = 100, r = 85;
  // 원형 path
  const path = `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`;

  // 원 내부에 seed 배치 — 원의 중심 주위로 균등 분배
  const seeds: Record<string, [number, number]> = {};
  for (let i = 0; i < regionCount; i++) {
    const angle = (2 * Math.PI * i) / regionCount - Math.PI / 2;
    const seedR = regionCount <= 3 ? 40 : 50;
    seeds[`r${i}`] = [
      cx + Math.cos(angle) * seedR,
      cy + Math.sin(angle) * seedR,
    ];
  }
  return { path, seeds };
}

/**
 * 국가 코드로 실루엣 조회.
 * 수동 정의 없으면 자동 원형 fallback.
 */
export function getCountrySilhouette(
  iso3: string,
  regionCount: number,
): CountrySilhouette {
  return COUNTRY_SILHOUETTES[iso3] ?? generateCircleSilhouette(regionCount);
}
