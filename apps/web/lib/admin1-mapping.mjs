/**
 * admin1-mapping.mjs — 20개 주요국 Natural Earth admin1 → game region 매핑
 *
 * 빌드 스크립트(build-admin1.mjs)에서 사용.
 * Key: ISO3 코드
 * Value: { regionSlug: [admin1 name, ...] }
 *
 * admin1 이름은 Natural Earth의 'name' 필드 기준.
 * 부분 문자열 매칭이므로 정확한 전체 이름이 아니어도 됨.
 */

export const ADMIN1_REGION_MAPPING = {
  // ── S 티어 (8개국, 7지역) ──

  USA: {
    dc: ['District of Columbia', 'Maryland', 'Virginia', 'West Virginia', 'Delaware'],
    ny: ['New York', 'New Jersey', 'Connecticut', 'Massachusetts', 'Rhode Island', 'Pennsylvania', 'Vermont', 'New Hampshire', 'Maine'],
    texas: ['Texas', 'Oklahoma', 'Arkansas', 'Louisiana', 'Mississippi', 'Alabama'],
    california: ['California', 'Oregon', 'Washington', 'Nevada', 'Arizona', 'New Mexico', 'Utah', 'Colorado', 'Hawaii'],
    midwest: ['Iowa', 'Illinois', 'Indiana', 'Ohio', 'Michigan', 'Wisconsin', 'Minnesota', 'Missouri', 'Kansas', 'Nebraska', 'South Dakota', 'North Dakota'],
    virginia: ['Tennessee', 'Kentucky', 'North Carolina', 'South Carolina', 'Georgia', 'Florida'],
    hawaii: ['Alaska', 'Montana', 'Idaho', 'Wyoming'],
  },

  CHN: {
    beijing: ['Beijing', 'Tianjin', 'Hebei'],
    shanghai: ['Shanghai', 'Zhejiang', 'Jiangsu', 'Anhui'],
    shenzhen: ['Guangdong', 'Fujian', 'Hainan', 'Hong Kong', 'Macau'],
    xinjiang: ['Xinjiang', 'Tibet', 'Qinghai', 'Gansu', 'Ningxia'],
    sichuan: ['Sichuan', 'Chongqing', 'Yunnan', 'Guizhou', 'Guangxi'],
    inner_mongolia: ['Inner Mongol', 'Shaanxi', 'Shanxi', 'Henan', 'Shandong'],
    xian: ['Heilongjiang', 'Jilin', 'Liaoning', 'Hubei', 'Hunan', 'Jiangxi'],
  },

  RUS: {
    moscow: ['Moscow', 'Moskovskaya', 'Tula', 'Kaluga', 'Ryazan', 'Vladimir', 'Smolensk', 'Bryansk', 'Orel', 'Kursk', 'Belgorod', 'Lipetsk', 'Tambov', 'Tver', 'Yaroslavl', 'Kostroma', 'Ivanovo'],
    st_petersburg: ['City of St. Petersburg', 'Leningrad', 'Novgorod', 'Pskov', 'Kaliningrad', 'Murmansk', 'Karelia', 'Arkhangel', 'Vologda', 'Komi'],
    siberia: ['Novosibirsk', 'Omsk', 'Tomsk', 'Kemerovo', 'Altay', 'Krasnoyarsk', 'Khakass', 'Tuva'],
    ural: ['Sverdlovsk', 'Chelyabinsk', 'Tyumen', 'Kurgan', 'Khanty-Mansiy', 'Yamalo-Nenets', 'Perm', 'Orenburg'],
    vladivostok: ['Primor', 'Khabarovsk', 'Amur', 'Sakhalin', 'Kamchatka', 'Magadan', 'Chukot', 'Sakha', 'Yevrey'],
    kuban: ['Krasnodar', 'Rostov', 'Volgograd', 'Astrakhan', 'Stavropol', 'Dagestan', 'Chechnya', 'Ingush', 'North Ossetia', 'Kabardino', 'Karachay', 'Adygey', 'Kalmyk'],
    kaliningrad: ['Nizhny Novgorod', 'Samara', 'Saratov', 'Penza', 'Ul', 'Mordovia', 'Chuvash', 'Mariy-El', 'Tatarstan', 'Bashkortostan', 'Udmurt', 'Kirov', 'Voronezh', 'Nenets'],
  },

  IND: {
    delhi: ['Delhi', 'Haryana', 'Uttaranchal', 'Uttar Pradesh', 'Himachal'],
    mumbai: ['Maharashtra', 'Goa', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Gujarat'],
    bangalore: ['Karnataka', 'Kerala', 'Lakshadweep', 'Puducherry'],
    kolkata: ['West Bengal', 'Odisha', 'Jharkhand', 'Bihar', 'Sikkim'],
    kashmir: ['Jammu and Kashmir', 'Punjab', 'Chandigarh', 'Ladakh'],
    rajasthan: ['Rajasthan', 'Madhya Pradesh', 'Chhattisgarh'],
    varanasi: ['Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Andaman and Nicobar', 'Meghalaya', 'Assam', 'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura'],
  },

  JPN: {
    tokyo: ['Tokyo', 'Kanagawa', 'Saitama', 'Chiba', 'Ibaraki', 'Tochigi', 'Gunma'],
    osaka: ['Osaka', 'Kyoto', 'Hyogo', 'Nara', 'Wakayama', 'Shiga', 'Mie'],
    nagoya: ['Aichi', 'Shizuoka', 'Gifu', 'Nagano', 'Fukui', 'Ishikawa', 'Toyama', 'Yamanashi', 'Niigata'],
    hokkaido: ['Hokkaido'],
    kyushu: ['Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima'],
    okinawa: ['Okinawa'],
    kyoto: ['Hiroshima', 'Okayama', 'Shimane', 'Tottori', 'Yamaguchi', 'Kagawa', 'Tokushima', 'Ehime', 'Kochi', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima'],
  },

  DEU: {
    berlin: ['Berlin', 'Brandenburg'],
    hamburg: ['Hamburg', 'Schleswig-Holstein', 'Bremen', 'Niedersachsen'],
    bavaria: ['Bayern'],
    ruhr: ['Nordrhein-Westfalen'],
    rhineland: ['Rheinland-Pfalz', 'Saarland', 'Hessen'],
    ramstein: ['Mecklenburg-Vorpommern', 'Sachsen-Anhalt'],
    dresden: ['Sachsen', 'Thüringen', 'Baden-Württemberg'],
  },

  GBR: {
    london: ['Greater London', 'Surrey', 'Kent', 'Essex', 'Hertfordshire', 'Buckinghamshire', 'Berkshire', 'Sussex', 'Hampshire'],
    liverpool: ['Merseyside', 'Lancashire', 'Cheshire', 'Greater Manchester', 'Cumbria'],
    manchester: ['West Midlands', 'West Yorkshire', 'South Yorkshire', 'Derbyshire', 'Nottinghamshire', 'Staffordshire', 'Warwickshire', 'Leicestershire'],
    scotland: ['Scotland', 'Highland', 'Aberdeen', 'Dundee', 'Edinburgh', 'Glasgow', 'Fife', 'Perth'],
    wales: ['Wales', 'Gwynedd', 'Powys', 'Dyfed', 'Cardiff', 'Swansea', 'Newport'],
    portsmouth: ['Devon', 'Cornwall', 'Somerset', 'Dorset', 'Wiltshire', 'Gloucestershire', 'Avon', 'Bristol'],
    oxford: ['Oxfordshire', 'Cambridgeshire', 'Norfolk', 'Suffolk', 'Northamptonshire', 'Bedfordshire', 'East Yorkshire', 'North Yorkshire', 'Lincolnshire', 'Northumberland', 'Durham', 'Tyne and Wear', 'Humberside', 'Cleveland'],
  },

  FRA: {
    paris: ['Île-de-France', 'Ile-de-France', 'Paris'],
    marseille: ["Provence-Alpes-Côte d'Azur", 'Provence', 'Corse', 'Corsica'],
    lyon: ['Auvergne-Rhône-Alpes', 'Rhône-Alpes', 'Auvergne'],
    champagne: ['Grand Est', 'Alsace', 'Champagne', 'Lorraine', 'Hauts-de-France', 'Nord-Pas-de-Calais', 'Picardy'],
    lorraine: ['Bourgogne-Franche-Comté', 'Bourgogne', 'Franche-Comté', 'Centre-Val de Loire', 'Centre'],
    toulon: ['Occitanie', 'Languedoc', 'Midi-Pyrénées', 'Nouvelle-Aquitaine', 'Aquitaine', 'Limousin', 'Poitou'],
    versailles: ['Normandie', 'Normandy', 'Bretagne', 'Brittany', 'Pays de la Loire'],
  },

  // ── A 티어 (12개국, 5지역) ──

  KOR: {
    seoul: ['Seoul', 'Incheon'],
    gyeonggi: ['Gyeonggi-do', 'Gangwon-do', 'Chungcheongbuk-do'],
    busan: ['Busan', 'Ulsan', 'Gyeongsangnam-do', 'Gyeongsangbuk-do', 'Daegu'],
    jeju: ['Jeju'],
    dmz: ['Chungcheongnam-do', 'Sejong', 'Daejeon', 'Jeollabuk-do', 'Jeollanam-do', 'Gwangju'],
  },

  BRA: {
    brasilia: ['Distrito Federal', 'Goiás', 'Mato Grosso', 'Mato Grosso do Sul', 'Tocantins'],
    sao_paulo: ['São Paulo', 'Sao Paulo', 'Minas Gerais', 'Espírito Santo', 'Paraná', 'Santa Catarina', 'Rio Grande do Sul'],
    rio: ['Rio de Janeiro'],
    amazon: ['Amazonas', 'Pará', 'Acre', 'Rondônia', 'Roraima', 'Amapá'],
    minas: ['Bahia', 'Sergipe', 'Alagoas', 'Pernambuco', 'Paraíba', 'Rio Grande do Norte', 'Ceará', 'Piauí', 'Maranhão'],
  },

  CAN: {
    ottawa: ['Ontario'],
    toronto: ['Manitoba', 'Saskatchewan', 'Nunavut', 'Northwest Territories'],
    vancouver: ['British Columbia', 'Yukon'],
    alberta: ['Alberta'],
    quebec: ['Quebec', 'Québec', 'New Brunswick', 'Nova Scotia', 'Prince Edward Island', 'Newfoundland and Labrador'],
  },

  AUS: {
    canberra: ['Australian Capital Territory', 'New South Wales'],
    sydney: ['Victoria', 'Tasmania'],
    perth: ['Western Australia'],
    melbourne: ['South Australia'],
    queensland: ['Queensland', 'Northern Territory'],
  },

  ITA: {
    rome: ['Lazio', 'Abruzzo', 'Molise', 'Umbria'],
    milan: ['Lombardia', 'Lombardy', 'Piemonte', 'Piedmont', "Valle d'Aosta", 'Liguria', 'Emilia-Romagna'],
    naples: ['Campania', 'Puglia', 'Apulia', 'Basilicata', 'Calabria'],
    tuscany: ['Toscana', 'Tuscany', 'Marche'],
    venice: ['Veneto', 'Friuli-Venezia Giulia', 'Trentino-Alto Adige', 'Sardegna', 'Sardinia', 'Sicilia', 'Sicily'],
  },

  TUR: {
    ankara: ['Ankara', 'Konya', 'Eskişehir', 'Kayseri', 'Sivas', 'Yozgat', 'Kırıkkale', 'Kırşehir', 'Aksaray', 'Nevşehir', 'Niğde', 'Karaman', 'Çankırı'],
    istanbul: ['Istanbul', 'İstanbul', 'Kocaeli', 'Bursa', 'Edirne', 'Tekirdağ', 'Kırklareli', 'Sakarya', 'Bolu', 'Düzce', 'Bilecik', 'Yalova', 'Çanakkale', 'Balıkesir'],
    izmir: ['İzmir', 'Izmir', 'Aydın', 'Muğla', 'Denizli', 'Manisa', 'Kütahya', 'Afyon', 'Uşak', 'Burdur', 'Isparta', 'Antalya', 'Mersin'],
    anatolia: ['Adana', 'Hatay', 'Gaziantep', 'Şanlıurfa', 'Diyarbakır', 'Mardin', 'Batman', 'Siirt', 'Şırnak', 'Hakkari', 'Van', 'Bitlis', 'Muş', 'Ağrı', 'Iğdır', 'Kars', 'Ardahan'],
    cappadocia: ['Trabzon', 'Rize', 'Artvin', 'Giresun', 'Ordu', 'Samsun', 'Amasya', 'Tokat', 'Kastamonu', 'Sinop', 'Bartın', 'Karabük', 'Zonguldak', 'Çorum', 'Erzurum', 'Erzincan', 'Bayburt', 'Gümüşhane', 'Tunceli', 'Bingöl', 'Elazığ', 'Malatya', 'Adıyaman', 'Kahramanmaraş', 'Osmaniye', 'Kilis'],
  },

  SAU: {
    riyadh: ['Riyadh', 'Ar Riyad', 'Riyad'],
    jeddah: ['Makkah', 'Mecca', 'Al Madinah', 'Medina'],
    dammam: ['Eastern', 'Ash Sharqiyah', 'Sharqiyah'],
    neom: ['Tabuk', 'Ha\'il', 'Hail', 'Al Jawf', 'Northern Border'],
    mecca: ['Asir', '\'Asir', 'Jizan', 'Jazan', 'Najran', 'Al Bahah', 'Bahah', 'Qassim', 'Al Qassim'],
  },

  MEX: {
    cdmx: ['Distrito Federal', 'México', 'Mexico', 'Morelos', 'Puebla', 'Tlaxcala', 'Hidalgo', 'Querétaro'],
    monterrey: ['Nuevo León', 'Tamaulipas', 'Coahuila', 'Chihuahua', 'Durango', 'San Luis Potosí', 'Zacatecas', 'Aguascalientes'],
    veracruz: ['Veracruz', 'Tabasco', 'Oaxaca', 'Chiapas', 'Guerrero'],
    chiapas: ['Jalisco', 'Guanajuato', 'Michoacán', 'Colima', 'Nayarit', 'Sinaloa', 'Sonora'],
    cancun: ['Yucatán', 'Quintana Roo', 'Campeche', 'Baja California', 'Baja California Sur'],
  },

  IDN: {
    jakarta: ['Jakarta', 'Banten', 'Jawa Barat', 'West Java'],
    surabaya: ['Jawa Timur', 'East Java', 'Jawa Tengah', 'Central Java', 'Yogyakarta'],
    kalimantan: ['Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara'],
    java: ['Sumatera', 'Sumatra', 'Aceh', 'Riau', 'Jambi', 'Lampung', 'Bengkulu', 'Bangka'],
    bali: ['Bali', 'Nusa Tenggara', 'Sulawesi', 'Maluku', 'Papua'],
  },

  ESP: {
    madrid: ['Madrid', 'Castilla y León', 'Castilla-La Mancha', 'Extremadura'],
    barcelona: ['Cataluña', 'Catalunya', 'Catalonia', 'Aragón', 'Navarra', 'La Rioja', 'País Vasco', 'Basque', 'Cantabria'],
    valencia: ['Comunidad Valenciana', 'Valencia', 'Murcia', 'Baleares', 'Balearic'],
    andalusia: ['Andalucía', 'Andalusia', 'Ceuta', 'Melilla'],
    granada: ['Galicia', 'Asturias', 'Canarias', 'Canary'],
  },

  NLD: {
    amsterdam: ['Noord-Holland', 'North Holland'],
    rotterdam: ['Zuid-Holland', 'South Holland', 'Zeeland'],
    eindhoven: ['Noord-Brabant', 'North Brabant', 'Limburg'],
    friesland: ['Friesland', 'Fryslân', 'Groningen', 'Drenthe', 'Overijssel', 'Flevoland'],
    hague: ['Utrecht', 'Gelderland'],
  },

  POL: {
    warsaw: ['Mazowieckie', 'Mazovia', 'Łódzkie', 'Łódź'],
    gdansk: ['Pomorskie', 'Pomerania', 'Warmińsko-Mazurskie', 'Warmia'],
    katowice: ['Śląskie', 'Silesia', 'Opolskie', 'Małopolskie', 'Lesser Poland', 'Świętokrzyskie'],
    masuria: ['Wielkopolskie', 'Greater Poland', 'Kujawsko-Pomorskie', 'Lubuskie', 'Zachodniopomorskie'],
    krakow: ['Podkarpackie', 'Subcarpathia', 'Lubelskie', 'Lublin', 'Podlaskie'],
  },

  // ── A 티어 추가 8개국 (수동 매핑 없음 → 자동 merge) ──
  // ARG, ZAF, EGY, PAK, NGA, IRN, ISR, UKR는 agglomerative merge 사용
};
