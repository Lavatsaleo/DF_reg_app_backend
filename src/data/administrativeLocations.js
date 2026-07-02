// Auto-generated from the approved Digital Futures country administrative level workbooks.
// Keep this file backend-only. The registration form API exposes only the option lists needed by applicants.

const COUNTRIES = ["Kenya", "Nigeria", "Ghana", "Zambia"];

const COUNTRY_DIAL_CODES = {
  Kenya: "+254",
  Nigeria: "+234",
  Ghana: "+233",
  Zambia: "+260",
};

const LOCATION_HIERARCHY = {
  "Kenya": {
    "adminLevel1": {
      "questionCode": "COUNTY",
      "label": "County"
    },
    "adminLevel2": {
      "questionCode": "SUB_COUNTY",
      "label": "Sub-county"
    },
    "children": {
      "Mombasa": [
        "Changamwe",
        "Jomvu",
        "Kisauni",
        "Nyali",
        "Likoni",
        "Mvita"
      ],
      "Kwale": [
        "Msambweni",
        "Lunga Lunga",
        "Matuga",
        "Kinango"
      ],
      "Kilifi": [
        "Kilifi North",
        "Kilifi South",
        "Kaloleni",
        "Rabai",
        "Ganze",
        "Malindi",
        "Magarini"
      ],
      "Tana River": [
        "Garsen",
        "Galole",
        "Bura"
      ],
      "Lamu": [
        "Lamu East",
        "Lamu West"
      ],
      "Taita Taveta": [
        "Taveta",
        "Wundanyi",
        "Mwatate",
        "Voi"
      ],
      "Garissa": [
        "Garissa Township",
        "Balambala",
        "Lagdera",
        "Dadaab",
        "Fafi",
        "Ijara"
      ],
      "Wajir": [
        "Wajir North",
        "Wajir East",
        "Tarbaj",
        "Wajir West",
        "Eldas",
        "Wajir South"
      ],
      "Mandera": [
        "Mandera West",
        "Banissa",
        "Mandera North",
        "Mandera South",
        "Mandera East",
        "Lafey"
      ],
      "Marsabit": [
        "Moyale",
        "North Horr",
        "Saku",
        "Laisamis"
      ],
      "Isiolo": [
        "Isiolo North",
        "Isiolo South"
      ],
      "Meru": [
        "Igembe South",
        "Igembe Central",
        "Igembe North",
        "Tigania West",
        "Tigania East",
        "North Imenti",
        "Buuri",
        "Central Imenti",
        "South Imenti"
      ],
      "Tharaka Nithi": [
        "Maara",
        "Chuka/Igambang’ombe",
        "Tharaka"
      ],
      "Embu": [
        "Manyatta",
        "Runyenjes",
        "Mbeere South",
        "Mbeere North"
      ],
      "Kitui": [
        "Mwingi North",
        "Mwingi West",
        "Mwingi Central",
        "Kitui West",
        "Kitui Rural",
        "Kitui Central",
        "Kitui East",
        "Kitui South"
      ],
      "Machakos": [
        "Masinga",
        "Yatta",
        "Kangundo",
        "Matungulu",
        "Kathiani",
        "Mavoko",
        "Machakos Town",
        "Mwala"
      ],
      "Makueni": [
        "Mbooni",
        "Kilome",
        "Kaiti",
        "Makueni",
        "Kibwezi West",
        "Kibwezi East"
      ],
      "Nyandarua": [
        "Kinangop",
        "Kipipiri",
        "Ol Kalou",
        "Ol Jorok",
        "Ndaragwa"
      ],
      "Nyeri": [
        "Tetu",
        "Kieni",
        "Mathira",
        "Othaya",
        "Mukurweini",
        "Nyeri Town"
      ],
      "Kirinyaga": [
        "Mwea",
        "Gichugu",
        "Ndia",
        "Kirinyaga Central"
      ],
      "Murang’a": [
        "Kangema",
        "Mathioya",
        "Kiharu",
        "Kigumo",
        "Maragua",
        "Kandara",
        "Gatanga"
      ],
      "Kiambu": [
        "Gatundu South",
        "Gatundu North",
        "Juja",
        "Thika Town",
        "Ruiru",
        "Githunguri",
        "Kiambu",
        "Kiambaa",
        "Kabete",
        "Kikuyu",
        "Limuru",
        "Lari"
      ],
      "Turkana": [
        "Turkana North",
        "Turkana West",
        "Turkana Central",
        "Loima",
        "Turkana South",
        "Turkana East"
      ],
      "West Pokot": [
        "Kapenguria",
        "Sigor",
        "Kacheliba",
        "Pokot South"
      ],
      "Samburu": [
        "Samburu West",
        "Samburu North",
        "Samburu East"
      ],
      "Trans Nzoia": [
        "Kwanza",
        "Endebess",
        "Saboti",
        "Kiminini",
        "Cherangany"
      ],
      "Uasin Gishu": [
        "Soy",
        "Turbo",
        "Moiben",
        "Ainabkoi",
        "Kapseret",
        "Kesses"
      ],
      "Elgeyo Marakwet": [
        "Marakwet East",
        "Marakwet West",
        "Keiyo North",
        "Keiyo South"
      ],
      "Nandi": [
        "Tinderet",
        "Aldai",
        "Nandi Hills",
        "Chesumei",
        "Emgwen",
        "Mosop"
      ],
      "Baringo": [
        "Tiaty",
        "Baringo North",
        "Baringo Central",
        "Baringo South",
        "Mogotio",
        "Eldama Ravine"
      ],
      "Laikipia": [
        "Laikipia West",
        "Laikipia East",
        "Laikipia North"
      ],
      "Nakuru": [
        "Molo",
        "Njoro",
        "Naivasha",
        "Gilgil",
        "Kuresoi South",
        "Kuresoi North",
        "Subukia",
        "Rongai",
        "Bahati",
        "Nakuru Town West",
        "Nakuru Town East"
      ],
      "Narok": [
        "Kilgoris",
        "Emurua Dikirr",
        "Narok North",
        "Narok East",
        "Narok South",
        "Narok West"
      ],
      "Kajiado": [
        "Kajiado North",
        "Kajiado Central",
        "Kajiado East",
        "Kajiado West",
        "Kajiado South"
      ],
      "Kericho": [
        "Kipkelion East",
        "Kipkelion West",
        "Ainamoi",
        "Bureti",
        "Belgut",
        "Sigowet/Soin"
      ],
      "Bomet": [
        "Sotik",
        "Chepalungu",
        "Bomet East",
        "Bomet Central",
        "Konoin"
      ],
      "Kakamega": [
        "Lugari",
        "Likuyani",
        "Malava",
        "Lurambi",
        "Navakholo",
        "Mumias West",
        "Mumias East",
        "Matungu",
        "Butere",
        "Khwisero",
        "Shinyalu",
        "Ikolomani"
      ],
      "Vihiga": [
        "Vihiga",
        "Sabatia",
        "Hamisi",
        "Luanda",
        "Emuhaya"
      ],
      "Bungoma": [
        "Mt. Elgon",
        "Sirisia",
        "Kabuchai",
        "Bumula",
        "Kanduyi",
        "Webuye East",
        "Webuye West",
        "Kimilili",
        "Tongaren"
      ],
      "Busia": [
        "Teso North",
        "Teso South",
        "Nambale",
        "Matayos",
        "Butula",
        "Funyula",
        "Budalangi"
      ],
      "Siaya": [
        "Ugenya",
        "Ugunja",
        "Alego Usonga",
        "Gem",
        "Bondo",
        "Rarieda"
      ],
      "Kisumu": [
        "Kisumu East",
        "Kisumu West",
        "Kisumu Central",
        "Seme",
        "Nyando",
        "Muhoroni",
        "Nyakach"
      ],
      "Homa Bay": [
        "Kasipul",
        "Kabondo Kasipul",
        "Karachuonyo",
        "Rangwe",
        "Homa Bay Town",
        "Ndhiwa",
        "Suba North",
        "Suba South"
      ],
      "Migori": [
        "Rongo",
        "Awendo",
        "Suna East",
        "Suna West",
        "Uriri",
        "Nyatike",
        "Kuria West",
        "Kuria East"
      ],
      "Kisii": [
        "Bonchari",
        "South Mugirango",
        "Bomachoge Borabu",
        "Bobasi",
        "Bomachoge Chache",
        "Nyaribari Masaba",
        "Nyaribari Chache",
        "Kitutu Chache North",
        "Kitutu Chache South"
      ],
      "Nyamira": [
        "Kitutu Masaba",
        "West Mugirango",
        "North Mugirango",
        "Borabu"
      ],
      "Nairobi": [
        "Westlands",
        "Dagoretti North",
        "Dagoretti South",
        "Lang’ata",
        "Kibra",
        "Roysambu",
        "Kasarani",
        "Ruaraka",
        "Embakasi South",
        "Embakasi North",
        "Embakasi Central",
        "Embakasi East",
        "Embakasi West",
        "Makadara",
        "Kamukunji",
        "Starehe",
        "Mathare"
      ]
    }
  },
  "Nigeria": {
    "adminLevel1": {
      "questionCode": "STATE",
      "label": "State"
    },
    "children": {
      "Abuja Federal Capital Territory": [],
      "Abia": [],
      "Adamawa": [],
      "Akwa Ibom": [],
      "Anambra": [],
      "Bauchi": [],
      "Bayelsa": [],
      "Benue": [],
      "Borno": [],
      "Cross River": [],
      "Delta": [],
      "Ebonyi": [],
      "Edo": [],
      "Ekiti": [],
      "Enugu": [],
      "Gombe": [],
      "Imo": [],
      "Jigawa": [],
      "Kaduna": [],
      "Kano": [],
      "Katsina": [],
      "Kebbi": [],
      "Kogi": [],
      "Kwara": [],
      "Lagos": [],
      "Nasarawa": [],
      "Niger": [],
      "Ogun": [],
      "Ondo": [],
      "Osun": [],
      "Oyo": [],
      "Plateau": [],
      "Rivers": [],
      "Sokoto": [],
      "Taraba": [],
      "Yobe": [],
      "Zamfara": []
    }
  },
  "Ghana": {
    "adminLevel1": {
      "questionCode": "REGION",
      "label": "Region"
    },
    "adminLevel2": {
      "questionCode": "DISTRICT",
      "label": "District"
    },
    "children": {
      "Ahafo": [
        "Asunafo North",
        "Asunafo South",
        "Asutifi North",
        "Asutifi South",
        "Tano North",
        "Tano South"
      ],
      "Ashanti": [
        "Adansi Asokwa",
        "Adansi North",
        "Adansi South",
        "Afigya Kwabre North",
        "Afigya-Kwabre South",
        "Ahafo Ano North",
        "Ahafo Ano South East",
        "Ahafo Ano South West",
        "Akrofuom",
        "Amansie Central",
        "Amansie South",
        "Amansie West",
        "Asante Akim Central",
        "Asante Akim North",
        "Asante Akim South",
        "Asokore Mampong",
        "Asokwa",
        "Atwima Kwanwoma",
        "Atwima Mponua",
        "Atwima Nwabiagya North",
        "Atwima Nwabiagya South",
        "Bekwai",
        "Bosome Freho",
        "Bosomtwe",
        "Ejisu",
        "Ejura Sekyedumase",
        "Juaben",
        "Kumasi Metropolitan Area",
        "Kwabre East",
        "Kwadaso",
        "Mampong",
        "Obuasi",
        "Obuasi East",
        "Offinso",
        "Offinso North",
        "Oforikrom",
        "Old Tafo",
        "Sekyere Afram Plains",
        "Sekyere Central",
        "Sekyere East",
        "Sekyere Kumawu",
        "Sekyere South",
        "Suame"
      ],
      "Bono": [
        "Banda",
        "Berekum East",
        "Berekum West",
        "Dormaa Central",
        "Dormaa East",
        "Dormaa West",
        "Jaman North",
        "Jaman South",
        "Sunyani",
        "Sunyani West",
        "Tain",
        "Wenchi"
      ],
      "Bono East": [
        "Atebubu Amantin",
        "Kintampo North",
        "Kintampo South",
        "Nkoranza North",
        "Nkoranza South",
        "Pru",
        "Pru West",
        "Sene East",
        "Sene West",
        "Techiman",
        "Techiman North"
      ],
      "Central": [
        "Abura/Asebu/Kwamankese",
        "Agona East",
        "Agona West",
        "Ajumako/Enyan/Essiam",
        "Asikuma/Odoben/Brakwa",
        "Assin Central",
        "Assin North",
        "Assin South",
        "Awutu Senya",
        "Awutu Senya East",
        "Cape Coast Metropolitan Area",
        "Effutu",
        "Ekumfi",
        "Gomoa Central",
        "Gomoa East",
        "Gomoa West",
        "Komenda/Edina/Eguafo/Abirem",
        "Mfantseman",
        "Twifo/Heman/Lower Denkyira",
        "Twifo/Stti-Morkwa",
        "Upper Denkyira East",
        "Upper Denkyira West"
      ],
      "Eastern": [
        "Abuakwa North",
        "Abuakwa South",
        "Achiase",
        "Akuapim North",
        "Akwapim South",
        "Akyemansa",
        "Asene Manso Akroso",
        "Asuogyaman",
        "Atiwa East",
        "Atiwa West",
        "Ayensuano",
        "Birim Central",
        "Birim North",
        "Birim South",
        "Denkyembour",
        "Fanteakwa North",
        "Fanteakwa South",
        "Kwaebibirem",
        "Kwahu Afram Plains North",
        "Kwahu Afram Plains South",
        "Kwahu East",
        "Kwahu South",
        "Kwahu West",
        "Lower Manya Krobo",
        "New Juaben North",
        "New Juaben South",
        "Nsawam Adoagyire",
        "Okere",
        "Suhum",
        "Upper Manya Krobo",
        "Upper West Akim",
        "West Akim",
        "Yilo Krobo"
      ],
      "Greater Accra": [
        "Ablekuma Central",
        "Ablekuma North",
        "Ablekuma West",
        "Accra Metropolitan Area",
        "Ada East",
        "Ada West",
        "Adenta",
        "Ashaiman",
        "Ayawaso Central",
        "Ayawaso East",
        "Ayawaso North",
        "Ayawaso West",
        "Ga Central",
        "Ga East",
        "Ga North",
        "Ga South",
        "Ga West",
        "Korle Klottey",
        "Kpone Katamanso",
        "Krowor",
        "La Dade-Kotopon",
        "La Nkwantanang-Madina",
        "Ledzokuku",
        "Ningo-Prampram",
        "Okaikwei North",
        "Shai Osudoku",
        "Tema Metropolitan Area",
        "Tema West",
        "Weija Gbawe"
      ],
      "North East": [
        "Bunkpurugu Nakpanduri",
        "Chereponi",
        "East Mamprusi",
        "Mamprugu Moagduri",
        "West Mamprusi",
        "Yunyoo-Nasuan"
      ],
      "Northern": [
        "Gushiegu",
        "Karaga",
        "Kpandai",
        "Kumbungu",
        "Mion",
        "Nanton",
        "Nanumba North",
        "Nanumba South",
        "Saboba",
        "Sagnarigu",
        "Savelugu",
        "Tamale Metropolitan Area",
        "Tatale-Sanguli",
        "Tolon",
        "Yendi",
        "Zabzugu"
      ],
      "Oti": [
        "Biakoye",
        "Guan",
        "Jasikan",
        "Kadjebi",
        "Krachi East",
        "Krachi Nchumuru",
        "Krachi West",
        "Nkwanta North",
        "Nkwanta South"
      ],
      "Savannah": [
        "Bole",
        "Central Gonja",
        "East Gonja",
        "North East Gonja",
        "North Gonja",
        "Sawla-Tuna-Kalba",
        "West Gonja"
      ],
      "Upper East": [
        "Bawku",
        "Bawku West",
        "Binduri",
        "Bolgatanga",
        "Bolgatanga East",
        "Bongo",
        "Builsa North",
        "Builsa South",
        "Garu",
        "Kassena Nankana East",
        "Kassena Nankana West",
        "Nabdam",
        "Pusiga",
        "Talensi",
        "Tempane"
      ],
      "Upper West": [
        "Daffiama Bussie Issa",
        "Jirapa",
        "Lambussie Karni",
        "Lawra",
        "Nadowli Kaleo",
        "Nandom",
        "Sissala East",
        "Sissala West",
        "Wa",
        "Wa East",
        "Wa West"
      ],
      "Volta": [
        "Adaklu",
        "Afadzato South",
        "Agotime-Ziope",
        "Akatsi North",
        "Akatsi South",
        "Anloga",
        "Central Tongu",
        "Ho",
        "Ho West",
        "Hohoe",
        "Keta",
        "Ketu North",
        "Ketu South",
        "Kpando",
        "North Dayi",
        "North Tongu",
        "South Dayi",
        "South Tongu"
      ],
      "Western": [
        "Ahanta West",
        "Effia Kwesimintsim",
        "Ellembelle",
        "Jomoro",
        "Mpohor",
        "Nzema East",
        "Prestea Huni Valley",
        "Sekondi Takoradi Metropolitan Area",
        "Shama",
        "Tarkwa Nsuaem Municipal",
        "Wassa Amenfi Central",
        "Wassa Amenfi East",
        "Wassa Amenfi West",
        "Wassa East"
      ],
      "Western North": [
        "Aowin",
        "Bia East",
        "Bia West",
        "Bibiani-Anhwiaso-Bekwai",
        "Bodi",
        "Juaboso",
        "Sefwi Akontombra",
        "Sefwi Wiawso",
        "Suaman"
      ]
    }
  },
  "Zambia": {
    "adminLevel1": {
      "questionCode": "STATE",
      "label": "State"
    },
    "adminLevel2": {
      "questionCode": "DISTRICT",
      "label": "District"
    },
    "children": {
      "Central Province": [
        "Chibombo District",
        "Chisamba District",
        "Chitambo District",
        "Itezhi-tezhi District",
        "Kabwe District",
        "Kapiri Mposhi District",
        "Luano District",
        "Mkushi District",
        "Mumbwa District",
        "Ngabwe District",
        "Serenje District"
      ],
      "Copperbelt Province": [
        "Chililabombwe District",
        "Chingola District",
        "Kalulushi District",
        "Kitwe District",
        "Luanshya District",
        "Lufwanyama District",
        "Masaiti District",
        "Mpongwe District",
        "Mufulira District",
        "Ndola District"
      ],
      "Eastern Province": [
        "Chadiza District",
        "Chipata District",
        "Katete District",
        "Lumezi District",
        "Lundazi District",
        "Mambwe District",
        "Nyimba District",
        "Petauke District",
        "Sinda District",
        "Vubwi District"
      ],
      "Luapula Province": [
        "Chembe District",
        "Chiengi District",
        "Chipili District",
        "Kawambwa District",
        "Lunga District",
        "Mansa District",
        "Milengi District",
        "Mwansabombwe District",
        "Mwense District",
        "Nchelenge District",
        "Samfya District"
      ],
      "Lusaka Province": [
        "Chilanga District",
        "Chirundu District",
        "Chongwe District",
        "Kafue District",
        "Luangwa District",
        "Lusaka District",
        "Rufunsa District",
        "Shibuyunji District"
      ],
      "Muchiga Province": [
        "Chama District",
        "Chinsali District",
        "Isoka District",
        "Lavushimanda District",
        "Mafinga District",
        "Mpika District",
        "Nakonde District",
        "Shiwamg'andu District"
      ],
      "North-Western Province": [
        "Chavuma District",
        "Ikelenge District",
        "Kabompo District",
        "Kasempa District",
        "Manyinga District",
        "Mufumbwe District",
        "Mwinilunga District",
        "Solwezi District",
        "Zambezi District"
      ],
      "Northern Province": [
        "Chilubi District",
        "Kanchibiya District",
        "Kaputa District",
        "Kasama District",
        "Luwingu District",
        "Mbala District",
        "Mporokoso District",
        "Mpulungu District",
        "Mungwi District",
        "Nsama District"
      ],
      "Southern Province": [
        "Chikankata District",
        "Choma District",
        "Gwembe District",
        "Kalomo District",
        "Kazungula District",
        "Livingstone District",
        "Mazabuka District",
        "Monze District",
        "Namwala District",
        "Pemba District",
        "Siavonga District",
        "Sinazongwe District",
        "Zimba District"
      ],
      "Western Province": [
        "Kalabo District",
        "Kaoma District",
        "Limulunga District",
        "Luampa District",
        "Lukulu District",
        "Mitete District",
        "Mongu District",
        "Mulobezi District",
        "Mwandi District",
        "Nalolo District",
        "Nkeyema District",
        "Senanga District",
        "Sesheke District",
        "Shangombo District",
        "Sikongo District",
        "Sioma District"
      ]
    }
  }
};

const KENYA_COUNTIES = Object.keys(LOCATION_HIERARCHY.Kenya.children);
const GHANA_REGIONS = Object.keys(LOCATION_HIERARCHY.Ghana.children);

const STATE_OPTIONS_BY_COUNTRY = {
  Nigeria: Object.keys(LOCATION_HIERARCHY.Nigeria.children),
  Zambia: Object.keys(LOCATION_HIERARCHY.Zambia.children),
};

const DISTRICT_OPTIONS_BY_COUNTRY_AND_PARENT = {
  Ghana: {
    parentQuestionCode: "REGION",
    optionsByParent: LOCATION_HIERARCHY.Ghana.children,
  },
  Zambia: {
    parentQuestionCode: "STATE",
    optionsByParent: LOCATION_HIERARCHY.Zambia.children,
  },
};

module.exports = {
  COUNTRIES,
  COUNTRY_DIAL_CODES,
  LOCATION_HIERARCHY,
  KENYA_COUNTIES,
  GHANA_REGIONS,
  STATE_OPTIONS_BY_COUNTRY,
  DISTRICT_OPTIONS_BY_COUNTRY_AND_PARENT,
};
