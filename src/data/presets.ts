import { PlatformConfig, ProductItem, SceneStyle, BadgeTemplate, DetailPageModule, ChannelStore } from '../types';

export const PLATFORMS_DATA: PlatformConfig[] = [
  {
    id: 'taobao',
    name: '淘宝 / 天猫',
    enName: 'Taobao / Tmall',
    icon: '🛍️',
    primaryRatio: '1:1',
    supportedRatios: ['1:1', '3:4'],
    recommendedSize: '800 x 800 / 1200 x 1200 px',
    tagline: '爆款主图 + 营销腰封 + 3:4服饰竖图',
    themeColor: '#FF5000',
    bgAccent: 'from-orange-500/10 to-amber-500/10',
    rules: {
      maxTextRatio: 0.20,
      requiresPureWhiteBgFirst: true,
      bannerStyle: 'bold_promo',
      complianceNotes: [
        '第1张主图突出卖点，第5张需上传无文字纯白底图',
        '文字覆盖面积不得超过主图总面积的 20%',
        '严禁使用“全网第一”、“顶级”等广告法极限词'
      ]
    }
  },
  {
    id: 'jd',
    name: '京东商城',
    enName: 'JD.com',
    icon: '📦',
    primaryRatio: '1:1',
    supportedRatios: ['1:1'],
    recommendedSize: '800 x 800 px (单张 ≤ 1MB)',
    tagline: '3C质感纯底 + 京东红促销标 + 正品防伪',
    themeColor: '#E1251B',
    bgAccent: 'from-red-600/10 to-rose-600/10',
    rules: {
      maxTextRatio: 0.15,
      requiresPureWhiteBgFirst: true,
      bannerStyle: 'minimal_luxury',
      complianceNotes: [
        '数码3C及家电品类首图必须为纯白背景',
        '角标建议放置于左上或右上方，尺寸不超1/6',
        '支持京东红促销腰封与自营正品保障标'
      ]
    }
  },
  {
    id: 'pinduoduo',
    name: '拼多多',
    enName: 'Pinduoduo',
    icon: '⚡',
    primaryRatio: '1:1',
    supportedRatios: ['1:1'],
    recommendedSize: '800 x 800 / 750 x 750 px',
    tagline: '高点击率视觉 + 百亿补贴 + 爆款秒杀标',
    themeColor: '#E02E24',
    bgAccent: 'from-red-500/10 to-orange-500/10',
    rules: {
      maxTextRatio: 0.25,
      requiresPureWhiteBgFirst: false,
      bannerStyle: 'high_contrast',
      complianceNotes: [
        '高反差视觉与对比度，提升信息流点击转化',
        '突出“券后价/直降/拼团”强吸引力价格标签',
        '建议使用双色渐变腰封与亮黄行动呼唤标'
      ]
    }
  },
  {
    id: '1688',
    name: '1688 (阿里批发/源头工厂)',
    enName: '1688.com Wholesale',
    icon: '🏭',
    primaryRatio: '1:1',
    supportedRatios: ['1:1', '3:4'],
    recommendedSize: '800 x 800 / 750 x 750 px',
    tagline: '源头实力工厂 + 阶梯批发价 + 免费拿样 + 一件代发',
    themeColor: '#FF6600',
    bgAccent: 'from-orange-600/15 to-amber-600/15',
    rules: {
      maxTextRatio: 0.20,
      requiresPureWhiteBgFirst: true,
      bannerStyle: 'bold_promo',
      complianceNotes: [
        '第1张高点击首图突出“厂家直销/起订量/支持拿样/一件代发”等B2B买家核心诉求',
        '第2张细节图展现原料做工与质检认证；第3张尺寸图明确箱规与规格参数',
        '第4张展示厂房产线/商用场景；第5张需纯白底图以便入选超级买家与大市场推荐'
      ]
    }
  },
  {
    id: 'douyin',
    name: '抖音电商',
    enName: 'Douyin Shop',
    icon: '🎵',
    primaryRatio: '3:4',
    supportedRatios: ['3:4', '1:1', '9:16'],
    recommendedSize: '800 x 1067 / 1080 x 1440 px',
    tagline: '3:4竖屏沉浸 + 直播间爆款 + 达人实测风',
    themeColor: '#161823',
    bgAccent: 'from-slate-900/10 to-cyan-500/10',
    rules: {
      maxTextRatio: 0.20,
      requiresPureWhiteBgFirst: false,
      bannerStyle: 'live_stream',
      complianceNotes: [
        '建议优先使用 3:4 比例，占据更大屏幕视线空间',
        '避开底部20%与右侧15%的UI遮挡区域',
        '适合搭配主播推荐、真实测评与痛点对比视觉'
      ]
    }
  },
  {
    id: 'xiaohongshu',
    name: '小红书电商',
    enName: 'RED Mall',
    icon: '📕',
    primaryRatio: '3:4',
    supportedRatios: ['3:4', '1:1'],
    recommendedSize: '1080 x 1440 px',
    tagline: '生活方式氛围感 + 真实痛点对比 + 清新排版',
    themeColor: '#FF2442',
    bgAccent: 'from-pink-500/10 to-rose-400/10',
    rules: {
      maxTextRatio: 0.18,
      requiresPureWhiteBgFirst: false,
      bannerStyle: 'lifestyle',
      complianceNotes: [
        '强调“种草感”与“日常美学”，拒绝硬广牛皮癣',
        '标题字号适中，搭配便签纸、手绘箭头等自然元素',
        '突出使用前后对比与情绪价值'
      ]
    }
  },
  {
    id: 'amazon',
    name: '亚马逊 (跨境)',
    enName: 'Amazon Global',
    icon: '🌍',
    primaryRatio: '1:1',
    supportedRatios: ['1:1'],
    recommendedSize: '1600 x 1600 / 2000 x 2000 px',
    tagline: '纯白RGB 255/255/255 + 英文信息图 + 严苛合规',
    themeColor: '#FF9900',
    bgAccent: 'from-amber-600/10 to-yellow-500/10',
    rules: {
      maxTextRatio: 0.05,
      requiresPureWhiteBgFirst: true,
      bannerStyle: 'pure_spec',
      complianceNotes: [
        '首图必须为RGB (255,255,255) 100%纯白背景，不可有任何文字、水印或边框',
        '产品主体需占图片整体面积 85% 以上',
        '副图支持英文信息图 (Infographics)、尺寸标注与使用场景'
      ]
    }
  }
];

export const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    id: 'prod_headphone_01',
    name: '极简空间音频主动降噪无线耳机',
    category: '3C数码 / 影音娱乐',
    price: '399',
    originalPrice: '699',
    discountTag: '立省300元',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80'
    ],
    cutoutImageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    sellingPoints: [
      '45dB 深度混合主动降噪，嘈杂秒变私人影院',
      '自研空间音频声场算法，身临其境环绕声效',
      '60小时超长续航，闪充10分钟畅听5小时',
      '航天级蛋白皮无压耳罩，全天候舒适佩戴'
    ],
    heroTitles: [
      '静界初开 · 沉浸声浪 旗舰降噪首选',
      '戴上即入静界 45dB旗舰级真降噪',
      '【官方首发】60H超长续航 空间音频声场'
    ],
    badges: ['百亿补贴', '官方旗舰', '顺丰包邮', '30天免费试听', '1年质保换新'],
    painPoints: [
      '普通耳机降噪闷耳夹头？微气孔自适应泄压设计',
      '经常忘充电出门没电？60小时电力告别焦虑',
      '游戏开黑音画不同步？40ms低延迟无感衔接'
    ],
    specs: [
      { key: '降噪深度', value: '45dB 智能动态混合降噪' },
      { key: '发声单元', value: '40mm 镀钛复合振膜' },
      { key: '蓝牙版本', value: 'Bluetooth 5.4 旗舰双核' },
      { key: '续航时间', value: '开启降噪40小时 / 综合60小时' },
      { key: '重量', value: '约 230g 极轻量人体工学' }
    ],
    targetAudience: '18-35岁通勤白领、游戏玩家及音乐发烧友'
  },
  {
    id: 'prod_skincare_02',
    name: '多重玻尿酸时光焕颜奢宠精华液',
    category: '美妆护肤 / 精华原液',
    price: '198',
    originalPrice: '388',
    discountTag: '限时买一赠一',
    imageUrl: 'https://images.unsplash.com/photo-1608248597359-57e3f847240c?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1608248597359-57e3f847240c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80'
    ],
    sellingPoints: [
      '5D立体玻尿酸分子群，深层渗透锁水润透',
      '纯净植萃修护配方，7天退红强韧屏障',
      '0酒精0香精0重金属，敏感肌安心专研',
      '清透水感一抹吸收，妆前打底水光不搓泥'
    ],
    heroTitles: [
      '水润光感 · 彻夜赋活 7天焕现透亮肌',
      '【爆款断货王】敏感肌安心修护 5D深层补水',
      '抹出水光嘭弹肌 专研高浓度玻尿酸'
    ],
    badges: ['热销TOP1', '买1送1正装', '敏感肌专研', '破损包赔', '顺丰速递'],
    painPoints: [
      '换季脸部泛红干痒脱皮？高活修护肽快速舒缓',
      '普通精华质地黏腻闷痘？水漾质地3秒即刻吸收',
      '补水不锁水一吹风就干？双向锁水膜长效滋养'
    ],
    specs: [
      { key: '净含量', value: '50ml / 瓶' },
      { key: '适用肤质', value: '全肤质（特别适合干敏及受损屏障）' },
      { key: '核心成分', value: '5D玻尿酸、依克多因、积雪草精萃' },
      { key: '质地形态', value: '透明水凝露质地' },
      { key: '保质期', value: '未开封36个月 / 开封后6个月' }
    ],
    targetAudience: '20-40岁换季敏感、缺水暗沉及追求水光感的护肤人群'
  },
  {
    id: 'prod_backpack_03',
    name: '防泼水多功能都市通勤多隔层双肩包',
    category: '箱包皮具 / 都市出行',
    price: '169',
    originalPrice: '299',
    discountTag: '领券减60',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?w=800&auto=format&fit=crop&q=80'
    ],
    sellingPoints: [
      '900D高密度纳米防泼水面料，暴雨不湿舱内物品',
      '科学分区18仓大容量收纳，独立16寸防震电脑仓',
      '蜂窝透气S型减负背带，有效卸力减轻负重感40%',
      '隐藏式防盗拉链暗袋与行李箱固定织带设计'
    ],
    heroTitles: [
      '轻盈出型 · 容纳无限 都市通勤先锋背包',
      '【防泼水升级】18仓科学收纳 16寸电脑随行',
      '出差通勤一包搞定 减负护脊久背不累'
    ],
    badges: ['爆款热荐', '终身保修', '运费险赠送', '极速发货', '好评率99%'],
    painPoints: [
      '东西杂乱找钥匙电脑费劲？精细独立多功能分区',
      '雨天外出背包淋湿文件电脑？防泼水荷叶自洁涂层',
      '上下班背重物肩膀酸痛？人体工学倒梯形立体导流'
    ],
    specs: [
      { key: '产品尺寸', value: '45 x 31 x 15 cm' },
      { key: '面料材质', value: '定制防撕裂900D涤纶牛津布' },
      { key: '容量空间', value: '约 24L (可装16英寸笔记本电脑)' },
      { key: '净重', value: '仅 0.78kg 极轻量' },
      { key: '闭合方式', value: 'YKK定制静音防水拉链' }
    ],
    targetAudience: '都市白领、大学生、短途出差及数码EDC携带者'
  },
  {
    id: 'prod_coffee_04',
    name: '复古意式半自动泵压家用咖啡机',
    category: '家用电器 / 厨房小电',
    price: '699',
    originalPrice: '1299',
    discountTag: '直降600元',
    imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80'
    ],
    sellingPoints: [
      '20Bar 意大利进口高压电磁泵，黄金油脂丰盈醇厚',
      'PID精准恒温控温系统，92°C黄金水温稳定萃取',
      '强劲干燥高压蒸汽棒，轻松打出丝滑细腻拉花奶泡',
      '复古机械指针温度表与高颜值温润金属漆机身'
    ],
    heroTitles: [
      '居家私享 · 醇香即现 复古意式咖啡馆在身边',
      '【20Bar黄金油脂】小白也能做出大师级拉花',
      '一键即享香浓意式 颜值与实力并存'
    ],
    badges: ['大促爆款', '送拉花缸+压粉器', '全国联保3年', '晒单返现', '免息分期'],
    painPoints: [
      '萃取油脂浅薄没有咖啡馆风味？20Bar恒压深层萃取',
      '打奶泡粗糙水汽重无法拉花？微孔旋涡干燥强劲蒸汽',
      '预热慢等半天？30秒极速预热即开即享'
    ],
    specs: [
      { key: '额定功率', value: '1350W' },
      { key: '泵压压力', value: '20Bar 意大利ULKA泵' },
      { key: '水箱容量', value: '1.2L 可拆卸式透明水箱' },
      { key: '机身材质', value: '食品级不锈钢 + 复古防烫把手' },
      { key: '配件赠品', value: '专业51mm手柄、单双杯粉碗、压粉勺' }
    ],
    targetAudience: '咖啡爱好者、精致独居青年、办公室品质生活追求者'
  },
  {
    id: 'prod_lamp_05',
    name: '现代极简磁吸悬浮智能护眼台灯',
    category: '家居家装 / 氛围照明',
    price: '239',
    originalPrice: '459',
    discountTag: '新人立减30',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80'
    ],
    sellingPoints: [
      '国AA级无频闪防蓝光护眼光源，Ra98超高显色还原真实色彩',
      '磁吸无极悬浮旋转调节，任意角度自由定格光影',
      '触控无级调光调色温，3000K-6000K冷暖随心变换',
      '内置大容量锂电无线可用，停电也能持续照明8小时'
    ],
    heroTitles: [
      '柔光护眼 · 悬浮光影 点亮极简书房美学',
      '【国AA级护眼认证】Ra98显色 磁吸随心调光',
      '无蓝光无可视频闪 陪伴每个专注深夜'
    ],
    badges: ['国AA级认证', 'Ra98超高显色', '无线充电底座', '2年质保', '破损免费补发'],
    painPoints: [
      '长期看书看屏幕眼睛干涩疲劳？侧发光柔光板不刺眼',
      '台灯占桌面空间且电线杂乱？极窄底座+磁吸无线设计',
      '灯光偏黄或偏蓝失真？高显色全光谱芯片贴近自然光'
    ],
    specs: [
      { key: '照度等级', value: '国家AA级护眼标准' },
      { key: '显色指数', value: 'Ra ≥ 98 超高还原' },
      { key: '色温范围', value: '3000K - 6000K 5档及无极调节' },
      { key: '电池容量', value: '4000mAh 锂电池 (支持Type-C充插两用)' },
      { key: '调光方式', value: '高灵敏触控滑动调光' }
    ],
    targetAudience: '学生儿童、熬夜工作者、设计师及家居美学爱好者'
  }
];

export const SCENE_STYLES: SceneStyle[] = [
  {
    id: 'scene_studio_minimal',
    name: '商业纯白极简光影',
    category: '通用大牌',
    prompt: 'Commercial product photography, pure minimalist solid light grey-white studio backdrop, architectural concrete podium, dramatic soft ray tracing lighting, crisp contact shadows, clean high-end luxury advertisement aesthetic.',
    previewBg: 'from-slate-100 to-slate-200 text-slate-800',
    lightingType: '柔和双主灯 + 侧逆光轮廓',
    description: '通用于所有品类，突出产品原貌质感与立体边缘轮廓',
    suitableCategories: ['3C数码', '美妆护肤', '箱包配件', '家用小电']
  },
  {
    id: 'scene_nordic_wood',
    name: '北欧自然温润原木',
    category: '生活美学',
    prompt: 'Scandinavian minimal aesthetic, warm natural oak wood surface, soft morning sunlight casting gentle organic shadows of olive branches, cozy serene atmosphere, earthy pastel neutral background.',
    previewBg: 'from-amber-50 to-stone-200 text-stone-800',
    lightingType: '侧面自然晨光 + 斑驳树影',
    description: '赋予产品亲和力、环保质感与居家温馨氛围',
    suitableCategories: ['家居日用', '食品饮料', '母婴用品', '文创好物']
  },
  {
    id: 'scene_cyber_tech',
    name: '赛博科技悬浮光效',
    category: '数码硬核',
    prompt: 'Futuristic sci-fi tech environment, glowing dark carbon fiber matte platform, subtle electric blue and magenta ambient neon rim lights, levitating particle dust, ultra high tech presentation.',
    previewBg: 'from-slate-950 via-slate-900 to-cyan-950 text-cyan-200',
    lightingType: '深色暗调 + 冰蓝电竞轮廓光',
    description: '强调黑科技、高性能、硬核参数与未来先锋感',
    suitableCategories: ['3C数码', '电竞外设', '汽车配件', '智能穿戴']
  },
  {
    id: 'scene_luxury_marble',
    name: '大理石水波微光',
    category: '高奢美妆',
    prompt: 'Ultra luxury cosmetic product shoot, white Carrara marble pedestal with gentle ripples of clear water reflections, golden accent morning glow, delicate mist, elegant high fashion magazine cover.',
    previewBg: 'from-slate-100 via-rose-50 to-stone-200 text-rose-950',
    lightingType: '水光透镜焦散 + 柔金补光',
    description: '水润透亮、高定尊贵感，极度适合水乳精华与珠宝首饰',
    suitableCategories: ['美妆护肤', '珠宝首饰', '香氛香水', '高端礼盒']
  },
  {
    id: 'scene_pure_white_compliance',
    name: '100% 纯白底 (亚马逊/京东合规)',
    category: '合规标准',
    prompt: 'Isolated product on 100% pure flat white background RGB (255, 255, 255), commercial catalog studio lighting, pristine clean edges, perfectly exposed, Amazon compliant main hero image.',
    previewBg: 'from-white to-gray-50 text-gray-900 border border-gray-300',
    lightingType: '环形无影灯 + 标准白平衡',
    description: '严格符合 Amazon, JD 纯白底图规范，无任何背景杂质与违规元素',
    suitableCategories: ['全部跨境品类', '京东3C', '天猫第五张白底图']
  },
  {
    id: 'scene_outdoor_sunlight',
    name: '户外阳光绿植微风',
    category: '户外出行',
    prompt: 'Crisp outdoor bright sunny day, lush botanical garden background blurred with beautiful bokeh, sun flare lighting, refreshing organic outdoor lifestyle photography.',
    previewBg: 'from-emerald-50 to-teal-100 text-teal-900',
    lightingType: '正午微暖日光 + 浅景深虚化',
    description: '充满生命力与户外探索感，突出防泼水/耐用特性',
    suitableCategories: ['户外运动', '箱包服饰', '露营装备', '健康个护']
  }
];

export const BADGE_PRESETS: BadgeTemplate[] = [
  {
    id: 'badge_billion_subsidy',
    name: '百亿补贴金标',
    type: 'ribbon',
    text: '百亿补贴',
    subText: '官方大额直降',
    color: 'bg-gradient-to-r from-red-600 to-amber-500',
    textColor: 'text-white',
    position: 'top-left'
  },
  {
    id: 'badge_limited_discount',
    name: '限时狂欢腰封',
    type: 'waist_band',
    text: '限时特惠 · 领券立减',
    subText: '抢完即止',
    color: 'bg-gradient-to-r from-red-600 via-rose-600 to-orange-500',
    textColor: 'text-white',
    position: 'bottom-bar'
  },
  {
    id: 'badge_official_auth',
    name: '官方正品认证章',
    type: 'official_seal',
    text: '官方正品',
    subText: '假一赔十',
    color: 'bg-amber-500 border-2 border-amber-300',
    textColor: 'text-amber-950',
    position: 'top-right'
  },
  {
    id: 'badge_top_seller',
    name: '热销爆款榜首',
    type: 'pill',
    text: '🔥 行业热销 TOP 1',
    color: 'bg-slate-900/90 backdrop-blur-md border border-amber-400/50',
    textColor: 'text-amber-300',
    position: 'top-left'
  },
  {
    id: 'badge_1688_source_factory',
    name: '1688 源头实力工厂标',
    type: 'ribbon',
    text: '🏭 源头实力工厂',
    subText: '支持免费拿样 · 1件起批',
    color: 'bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500',
    textColor: 'text-white',
    position: 'top-left'
  },
  {
    id: 'badge_1688_dropshipping',
    name: '一件代发/定制腰封',
    type: 'waist_band',
    text: '支持一件代发 · 专属贴牌OEM定制',
    subText: '48H急速发货',
    color: 'bg-gradient-to-r from-orange-600 via-red-600 to-amber-500',
    textColor: 'text-white',
    position: 'bottom-bar'
  },
  {
    id: 'badge_1688_sample',
    name: '批发样品专区',
    type: 'pill',
    text: '📦 支持样品检测 · 假一赔百',
    color: 'bg-orange-950/90 text-orange-200 border border-orange-500/60',
    textColor: 'text-orange-200',
    position: 'bottom-left'
  },
  {
    id: 'badge_sf_express',
    name: '顺丰次日达',
    type: 'pill',
    text: '⚡ 顺丰次日达 · 包邮退',
    color: 'bg-black text-white border border-gray-700',
    textColor: 'text-white',
    position: 'bottom-left'
  }
];

export const DEFAULT_DETAIL_MODULES: DetailPageModule[] = [
  {
    id: 'mod_hero',
    type: 'hero',
    title: '极简设计 · 旗舰实力',
    subtitle: '重塑日常感知，探索质感生活新边界',
    tag: '2026 年度旗舰首发',
    accentColor: '#E02424',
    bgStyle: 'luxury-dark',
    content: {
      highlight: '设计大师联名巨献，每一个微弧度皆经过千次光学打磨',
      bulletPoints: ['顶级精工用料', '严苛质检工序', '全链路专属质保服务']
    },
    enabled: true
  },
  {
    id: 'mod_pain',
    type: 'comparison',
    title: '传统体验 vs 旗舰革新',
    subtitle: '为什么超98%的用户换新都毫不犹豫选择我们？',
    accentColor: '#2563EB',
    bgStyle: 'clean-light',
    content: {
      traditional: [
        '普通材质易氧化磨损，使用半年即显旧',
        '核心功能虚标，关键时刻频繁掉链子',
        '按键繁琐难上手，缺乏人性化交互考虑'
      ],
      ours: [
        '航天级耐磨耐腐蚀工艺，历久弥新',
        '自研强悍核心芯片，全天候稳定高能输出',
        '一键直达智能交互，老人小孩即学即会'
      ]
    },
    enabled: true
  },
  {
    id: 'mod_features',
    type: 'features',
    title: '4重黑科技 澎湃实力',
    subtitle: '每一处硬核参数，皆为极致体验而生',
    accentColor: '#059669',
    bgStyle: 'tech-mesh',
    content: {
      featuresList: [
        { name: '超导高能架构', desc: '综合响应速度大幅跃升，能耗优化超40%' },
        { name: '双轴微悬浮抗震', desc: '毫秒级动态平衡，剧烈晃动依然稳如泰山' },
        { name: '疏水疏油纳米涂层', desc: '指纹水渍一抹即净，长久保持晶莹通透' },
        { name: 'AI自适应温控算法', desc: '每秒百次智能温控巡检，温润安全绝不发烫' }
      ]
    },
    enabled: true
  },
  {
    id: 'mod_scenes',
    type: 'scenarios',
    title: '多场景全天候 自由随行',
    subtitle: '无论是工作、出行还是居家，都能完美融入生活',
    accentColor: '#D97706',
    bgStyle: 'warm-lifestyle',
    content: {
      scenes: [
        { title: '商务通勤', desc: '内敛低调，彰显佩戴者的专业与干练格调' },
        { title: '户外探索', desc: '强悍防尘防水，无惧严苛环境，随时随地随心出发' },
        { title: '居家休闲', desc: '细腻温润手感，成为生活空间的一抹点睛之笔' }
      ]
    },
    enabled: true
  },
  {
    id: 'mod_specs',
    type: 'specs',
    title: '严谨规格与参数清单',
    subtitle: '真实严苛数据，见证硬核精工品质',
    accentColor: '#4B5563',
    bgStyle: 'clean-light',
    content: {
      specsList: [
        { key: '产品型号', value: 'ULTRA-PRO-2026' },
        { key: '主体材质', value: '航空级轻量合金 + 复合高分子' },
        { key: '执行标准', value: 'GB 4943.1 国际权威认证' },
        { key: '质保服务', value: '3年官方免费联保 / 终身技术支持' },
        { key: '包装清单', value: '主机*1、尊享配件包*1、说明书与保修卡*1' }
      ]
    },
    enabled: true
  },
  {
    id: 'mod_guarantee',
    type: 'guarantee',
    title: '官方严选 售后无忧',
    subtitle: '全方位购物保障，让每一次信任都倍感安心',
    accentColor: '#DC2626',
    bgStyle: 'luxury-dark',
    content: {
      badges: [
        { label: '7天无理由退换', sub: '免费赠送退货运费险' },
        { label: '3年全国联保', sub: '全国500+授权服务网点' },
        { label: '顺丰极速空运', sub: '极速发货 次日即达' },
        { label: '100%正品验真', sub: '一物一码 官方溯源认证' }
      ]
    },
    enabled: true
  }
];

export const INITIAL_CHANNELS: ChannelStore[] = [
  {
    id: 'taobao',
    name: '淘宝 / 天猫',
    storeName: '极简智造官方天猫旗舰店',
    connected: true,
    status: 'active',
    lastSyncTime: '10分钟前',
    productCount: 148,
    salesVolume: '¥ 428,500',
    authExpiry: '2027-12-31'
  },
  {
    id: 'jd',
    name: '京东开放平台',
    storeName: '极简智造京东自营旗舰店',
    connected: true,
    status: 'active',
    lastSyncTime: '25分钟前',
    productCount: 96,
    salesVolume: '¥ 682,000',
    authExpiry: '2027-10-15'
  },
  {
    id: 'pinduoduo',
    name: '拼多多商家版',
    storeName: '极简智选品牌专卖店',
    connected: true,
    status: 'active',
    lastSyncTime: '1小时前',
    productCount: 210,
    salesVolume: '¥ 315,900',
    authExpiry: '2027-08-20'
  },
  {
    id: 'douyin',
    name: '抖音电商 (抖店)',
    storeName: '极简官方直播间精选店',
    connected: true,
    status: 'active',
    lastSyncTime: '5分钟前',
    productCount: 64,
    salesVolume: '¥ 892,100',
    authExpiry: '2027-11-05'
  },
  {
    id: 'xiaohongshu',
    name: '小红书电商',
    storeName: 'MINIMAL LIFE 品牌小店',
    connected: true,
    status: 'active',
    lastSyncTime: '2小时前',
    productCount: 52,
    salesVolume: '¥ 194,200',
    authExpiry: '2027-09-30'
  },
  {
    id: 'amazon',
    name: 'Amazon US / EU',
    storeName: 'MinimalCraft Direct Store',
    connected: true,
    status: 'active',
    lastSyncTime: '30分钟前',
    productCount: 38,
    salesVolume: '$ 58,400',
    authExpiry: '2028-01-01'
  },
  {
    id: '1688',
    name: '1688 阿里批发工贸店',
    storeName: '源头实力智造工厂店 (1688官方认证)',
    connected: true,
    status: 'active',
    lastSyncTime: '刚刚',
    productCount: 312,
    salesVolume: '¥ 1,860,000',
    authExpiry: '2028-06-30'
  },
  {
    id: 'shopify',
    name: 'Shopify Global',
    storeName: 'minimalcraft-official.com',
    connected: false,
    status: 'active',
    productCount: 0,
    salesVolume: '$ 0',
    authExpiry: '-'
  }
];

/**
 * Only models this build can actually call are listed. The Google entries run
 * through the server-side Gemini SDK and therefore need GEMINI_API_KEY; any other
 * vendor is reached through the custom OpenAI-compatible endpoint, so listing it
 * as a built-in preset would misrepresent which provider serves the request.
 */
export const PROMPT_MODELS_DATA = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'Google',
    tag: '需服务端 GEMINI_API_KEY',
    description: '多模态模型，识别实拍图材质与结构并结合平台规范生成商业提示词。走服务端 Gemini SDK，需先配置 GEMINI_API_KEY',
    supportsVision: true,
    requiresGeminiKey: true
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'Google',
    tag: '需服务端 GEMINI_API_KEY',
    description: '推理更强的多模态模型，适合复杂材质反光与光影场景拆解。走服务端 Gemini SDK，需先配置 GEMINI_API_KEY',
    supportsVision: true,
    requiresGeminiKey: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    tag: '需服务端 GEMINI_API_KEY',
    description: '轻量多模态模型，适合快速批量解析商品实拍图。走服务端 Gemini SDK，需先配置 GEMINI_API_KEY',
    supportsVision: true,
    requiresGeminiKey: true
  },
  {
    id: 'custom-prompt-model',
    name: '自定义分析模型 (OpenAI 兼容端点)',
    provider: 'Custom',
    tag: '通用 · 可接任意兼容端点',
    description: '接入任意 OpenAI 兼容的 /chat/completions 端点，如 DashScope Qwen-VL、DeepSeek、OpenAI、Claude 中继、智谱 GLM-4V、Ollama',
    supportsVision: true,
    isCustom: true
  }
];

/**
 * Same rule as the prompt models: every entry maps to a provider this build
 * actually calls. Flux, SDXL, DALL-E and similar engines are reachable through
 * the custom endpoint, which is where their real model name belongs.
 */
export const IMAGE_MODELS_DATA = [
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image',
    provider: 'Google GenAI',
    tag: '需服务端 GEMINI_API_KEY',
    description: '图生图引擎，将实拍图主体与生成背景融合。走服务端 Gemini SDK，需先配置 GEMINI_API_KEY',
    supportsImg2Img: true,
    requiresGeminiKey: true
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Gemini 3.1 Flash Lite Image',
    provider: 'Google GenAI',
    tag: '需服务端 GEMINI_API_KEY',
    description: '更快的轻量图生图引擎，适合草稿与多方案比对。走服务端 Gemini SDK，需先配置 GEMINI_API_KEY',
    supportsImg2Img: true,
    requiresGeminiKey: true
  },
  {
    id: 'imagen-3.0-generate-002',
    name: 'Google Imagen 3 (文生图)',
    provider: 'Google DeepMind',
    tag: '需服务端 GEMINI_API_KEY · 不吃参考图',
    description: '纯文生图模型，不接收实拍参考图，主体一致性需靠提示词约束。走服务端 Gemini SDK，需先配置 GEMINI_API_KEY',
    supportsImg2Img: false,
    requiresGeminiKey: true
  },
  {
    id: 'custom-image-engine',
    name: '自定义生图接口 (OpenAI 兼容 / ComfyUI / SD API)',
    provider: 'Custom Engine',
    tag: '通用 · 可接任意兼容端点',
    description: '接入任意 /images/generations 兼容端点或自建 ComfyUI / SD WebUI，如硅基流动 Flux、DALL-E 3、SDXL',
    supportsImg2Img: true,
    isCustom: true
  }
];

import { generatePlatformProductPrompt } from '../utils/promptGenerator';

export function createDefaultHeroSuite(product: ProductItem, platformId: string = 'taobao'): import('../types').HeroSuiteItem[] {
  const is1688 = platformId === '1688';
  const pId = (platformId || 'taobao') as import('../types').PlatformId;

  const slot1 = generatePlatformProductPrompt(product, pId, 'slot_1_ctr');
  const slot2 = generatePlatformProductPrompt(product, pId, 'slot_2_detail');
  const slot3 = generatePlatformProductPrompt(product, pId, 'slot_3_dimension');
  const slot4 = generatePlatformProductPrompt(product, pId, 'slot_4_scene');
  const slot5 = generatePlatformProductPrompt(product, pId, 'slot_5_whitebg');

  return [
    {
      id: 'suite_slot_1',
      slot: 'slot_1_ctr',
      slotIndex: 1,
      slotTitle: '第1张：高点击首图 (爆款吸睛/利益点大字报)',
      slotShortName: '首图 (点击率)',
      slotPurpose: is1688 ? '突出“源头实力工厂/支持拿样/一件代发”等B2B核心采购痛点，抢夺采购商点击' : '突出核心卖点与强视觉冲击力，高反差大字报利益点，极大提升信息流点击率 (CTR)',
      headline: product.heroTitles?.[0] || (is1688 ? '源头直供 · 严控成本' : '爆款热卖 · 品质首选'),
      subheadline: product.sellingPoints?.[0] || (is1688 ? '支持免费拿样 / 现货48H发出' : '狂欢大促进行中 / 领券立减'),
      badgeText: is1688 ? '🏭 实力工厂' : (product.badges?.[0] || '🔥 镇店爆款'),
      prompt: slot1.promptEn,
      promptCn: slot1.promptCn,
      isGenerated: false,
      status: 'idle',
      customStyleName: is1688 ? '1688实力工厂展台' : '爆款吸睛展台'
    },
    {
      id: 'suite_slot_2',
      slot: 'slot_2_detail',
      slotIndex: 2,
      slotTitle: '第2张：细节质感图 (微距工艺/核心材质特写)',
      slotShortName: '第2张 (细节图)',
      slotPurpose: is1688 ? '微距特写原材料、做工工艺与质检标准，让B2B买家买得放心' : '微距特写展示商品做工、物理材质光泽、精密缝线/金属倒角与扎实用料，消除买家品质疑虑',
      headline: is1688 ? '匠心做工 · 严苛质检' : '精湛工艺 · 考究细节',
      subheadline: product.sellingPoints?.[1] || '微米级精工打磨，触感细腻非凡',
      badgeText: '🔍 微距特写',
      prompt: slot2.promptEn,
      promptCn: slot2.promptCn,
      isGenerated: false,
      status: 'idle',
      customStyleName: '微距细节特写'
    },
    {
      id: 'suite_slot_3',
      slot: 'slot_3_dimension',
      slotIndex: 3,
      slotTitle: '第3张：尺寸规格图 (标线比例/空间参考)',
      slotShortName: '第3张 (尺寸图)',
      slotPurpose: is1688 ? '明确包装规格、整箱装箱数与产品工学尺寸，助力B2B批量采购核算' : '直观呈现商品真实尺寸、长宽高标注线、掌心/空间真实参照物与包装规格，避免买家尺寸认知偏差与退换货',
      headline: is1688 ? '箱规规格 · 精准备货' : '真实尺寸 · 精准适配',
      subheadline: is1688 ? '标准工业箱规，支持批量装箱定制' : '科学工学比例，握持/摆放恰到好处',
      badgeText: '📐 尺寸标线',
      dimensionsOverlay: {
        width: '185 mm',
        height: '210 mm',
        depth: '78 mm',
        unit: 'mm',
        label: '标准黄金比例尺寸'
      },
      prompt: slot3.promptEn,
      promptCn: slot3.promptCn,
      isGenerated: false,
      status: 'idle',
      customStyleName: '工业尺寸标线'
    },
    {
      id: 'suite_slot_4',
      slot: 'slot_4_scene',
      slotIndex: 4,
      slotTitle: '第4张：场景氛围图 (真实生活/商用空间实景)',
      slotShortName: '第4张 (场景图)',
      slotPurpose: is1688 ? '展示现代化厂房产线/商用展厅场景，凸显供货体量与现货规模' : '将产品置于高颜值真实生活/办公/商业使用场景中，激发代入感与使用向往，营造生活方式情绪价值',
      headline: is1688 ? '实力展厅 · 现货储备' : '多场景随行 · 融入生活',
      subheadline: product.sellingPoints?.[2] || '随时随地，尽享高品质舒适体验',
      badgeText: is1688 ? '🏭 展厅实景' : '🌿 实景氛围',
      prompt: slot4.promptEn,
      promptCn: slot4.promptCn,
      isGenerated: false,
      status: 'idle',
      customStyleName: is1688 ? '工厂展厅实景' : '生活美学实景'
    },
    {
      id: 'suite_slot_5',
      slot: 'slot_5_whitebg',
      slotIndex: 5,
      slotTitle: '第5张：合规白底图 (RGB 255纯白透底/主搜入库)',
      slotShortName: '第5张 (白底图)',
      slotPurpose: '100% 纯白底 (RGB 255,255,255)，无杂物无水印文字，主体占比超85%，符合淘宝/京东/1688/亚马逊官方主搜算法加权与大市场入库规范',
      headline: '',
      subheadline: '',
      badgeText: '',
      prompt: slot5.promptEn,
      promptCn: slot5.promptCn,
      isGenerated: false,
      status: 'idle',
      customStyleName: '100% 合规纯白底'
    }
  ];
}

