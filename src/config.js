export const VERSION = '1.0.0';

export const QUALITY = {
  low: {
    label: 'LOW', pixelRatio: 0.62, shadows: false, shadowSize: 512, fog: [110, 430], far: 620,
    buildings: 120, trees: 80, grass: 0, rocks: 36, particles: 0.45, anisotropy: 1, antialias: false,
    dust: 0, grassShadows: false, bloom: false
  },
  medium: {
    label: 'MEDIUM', pixelRatio: 0.8, shadows: true, shadowSize: 1024, fog: [150, 560], far: 800,
    buildings: 170, trees: 140, grass: 260, rocks: 50, particles: 0.7, anisotropy: 2, antialias: true,
    dust: 120, grassShadows: false, bloom: false
  },
  high: {
    label: 'HIGH', pixelRatio: 1, shadows: true, shadowSize: 1536, fog: [190, 720], far: 1000,
    buildings: 220, trees: 220, grass: 520, rocks: 64, particles: 1, anisotropy: 4, antialias: true,
    dust: 220, grassShadows: false, bloom: false
  },
  ultra: {
    label: 'ULTRA', pixelRatio: 1.25, shadows: true, shadowSize: 2048, fog: [230, 900], far: 1250,
    buildings: 260, trees: 300, grass: 900, rocks: 80, particles: 1.3, anisotropy: 8, antialias: true,
    dust: 320, grassShadows: true, bloom: false
  },
  extreme: {
    label: 'EXTREME', pixelRatio: 1.5, shadows: true, shadowSize: 3072, fog: [280, 1200], far: 1600,
    buildings: 300, trees: 380, grass: 1400, rocks: 100, particles: 1.7, anisotropy: 16, antialias: true,
    dust: 480, grassShadows: true, bloom: false
  }
};

export const FPS_CAPS = [30, 60, 90, 120];

export const UPGRADES = {
  blade: {
    name: 'Lưỡi kiếm', icon: '⚔', max: 8, baseCost: 120, growth: 1.55,
    desc: 'Tăng sát thương chém và sát thương chí mạng vào gáy.',
    stat: l => `Sát thương +${l * 12}%`,
    apply: (l) => ({ damage: 1 + l * 0.12 })
  },
  gas: {
    name: 'Bình gas', icon: '◉', max: 8, baseCost: 100, growth: 1.45,
    desc: 'Tăng dung tích gas, cho phép bay và đu dây lâu hơn.',
    stat: l => `Gas tối đa ${100 + l * 16}`,
    apply: (l) => ({ gas: 100 + l * 16 })
  },
  reel: {
    name: 'Móc ODM', icon: '⌁', max: 8, baseCost: 140, growth: 1.5,
    desc: 'Tăng lực kéo, tốc độ cuộn dây và tầm móc.',
    stat: l => `Lực kéo +${l * 9}% · Tầm ${120 + l * 6}m`,
    apply: (l) => ({ reel: 1 + l * 0.09, hookRange: 120 + l * 6 })
  },
  health: {
    name: 'Thể lực', icon: '♥', max: 8, baseCost: 110, growth: 1.45,
    desc: 'Tăng máu tối đa và tốc độ hồi phục khi đứng trên mặt đất.',
    stat: l => `HP tối đa ${100 + l * 18}`,
    apply: (l) => ({ hp: 100 + l * 18, regen: 1.2 + l * 0.28 })
  },
  armor: {
    name: 'Giáp nhẹ', icon: '⛨', max: 8, baseCost: 160, growth: 1.6,
    desc: 'Giảm sát thương nhận vào từ Titan và va chạm.',
    stat: l => `Giảm sát thương ${l * 4}%`,
    apply: (l) => ({ armor: 1 - l * 0.04 })
  },
  combo: {
    name: 'Kỹ thuật combo', icon: '✦', max: 8, baseCost: 150, growth: 1.5,
    desc: 'Mở rộng cửa sổ combo và tăng sát thương đòn kết liễu.',
    stat: l => `Combo +${(l * 0.14).toFixed(2)}s · Kết liễu +${l * 10}%`,
    apply: (l) => ({ comboWindow: 1.25 + l * 0.14, finisher: 1 + l * 0.1 })
  }
};

export const TITAN_TYPES = {
  dummy: {
    key: 'dummy', name: 'HÌNH NỘM', height: 3.4, hp: 150, speed: 0, detect: 0, attackRange: 0,
    damage: 0, color: 0x8a7157, hair: 0x2e241c, scale: 1, reward: 0, aggro: false,
    desc: 'Mục tiêu huấn luyện'
  },
  normal: {
    key: 'normal', name: 'TITAN 4M', height: 4.4, hp: 95, speed: 3.9, detect: 92, attackRange: 6.2,
    damage: 13, color: 0xc59b78, hair: 0x3a2a1d, scale: 1, reward: 12, aggro: true,
    desc: 'Titan thường'
  },
  aberrant: {
    key: 'aberrant', name: 'TITAN DỊ DẠNG', height: 5.4, hp: 150, speed: 7.2, detect: 135, attackRange: 7,
    damage: 18, color: 0xb48664, hair: 0x1d1712, scale: 0.92, reward: 22, aggro: true,
    desc: 'Nhanh và hung hãn'
  },
  armored: {
    key: 'armored', name: 'TITAN BỌC THÉP', height: 7.4, hp: 340, speed: 3.2, detect: 110, attackRange: 8.4,
    damage: 26, color: 0x8b8d8c, hair: 0x6b5b4a, scale: 1.06, reward: 65, aggro: true, armor: 0.55,
    desc: 'Giáp cứng, chỉ gáy là điểm yếu'
  },
  colossal: {
    key: 'colossal', name: 'TITAN KHỔNG LỒ', height: 12.5, hp: 720, speed: 2.1, detect: 130, attackRange: 12,
    damage: 38, color: 0xa4553f, hair: 0x2b1712, scale: 1.1, reward: 130, aggro: true, armor: 0.72,
    desc: 'Sức mạnh hủy diệt, hơi nước bốc cháy'
  }
};

export const ZONES = [
  { key: 'city', name: 'THÀNH PHỐ', desc: 'Khu dân cư · nhiều điểm móc', color: '#9fb0bd' },
  { key: 'walls', name: 'TƯỜNG THÀNH', desc: 'Bức tường cuối cùng · điểm móc cao', color: '#c2b9a3' },
  { key: 'forest', name: 'RỪNG CÂY', desc: 'Tán cây rậm rạp · Titan ẩn nấp', color: '#6fae7a' },
  { key: 'grass', name: 'ĐỒNG CỎ', desc: 'Đồng bằng mở · tầm nhìn rộng', color: '#8fc27a' },
  { key: 'waste', name: 'VÙNG ĐẤT HOANG', desc: 'Tro tàn · Titan bọc thép tuần tra', color: '#c9a27a' }
];

export const STORY = [
  {
    id: 1, title: 'Ngày đầu huấn luyện', zone: 'city', reward: 80,
    brief: 'Học cách di chuyển, móc ODM và kết liễu hình nộm trước khi ra chiến trường.',
    intro: [
      { who: 'SỸ QUAN KAI', text: 'Tân binh! Đây là ODM Gear — móc, đu dây, và chém vào GÁY Titan. Đừng chết trước khi được huấn luyện xong.' },
      { who: 'BẠN', text: 'Tôi đã sẵn sàng. Bắt đầu với hình nộm.' }
    ],
    objectives: [
      { type: 'move', amount: 30, label: 'Di chuyển 30m bằng ODM' },
      { type: 'kill', count: 3, label: 'Hạ 3 hình nộm', titan: 'dummy' },
      { type: 'combo', count: 3, label: 'Đạt combo 3 đòn' }
    ],
    spawns: [{ type: 'dummy', at: [26, 34] }, { type: 'dummy', at: [-30, 26] }, { type: 'dummy', at: [4, 62] }]
  },
  {
    id: 2, title: 'Bức tường vỡ', zone: 'walls', reward: 140,
    brief: 'Một nhóm Titan đang tấn công cổng Nam. Bảo vệ cổng và tiêu diệt chúng.',
    intro: [
      { who: 'SỸ QUAN KAI', text: 'Cổng Nam đang bị phá! Nếu cổng thủng, thành phố sẽ chìm trong máu. Giữ vị trí!' },
      { who: 'BẠN', text: 'Tôi sẽ móc lên tường và cắt đầu chúng.' }
    ],
    objectives: [
      { type: 'defend', hp: 100, label: 'Bảo vệ cổng thành', position: [0, 170] },
      { type: 'kill', count: 6, label: 'Tiêu diệt 6 Titan' }
    ],
    spawns: [
      { type: 'normal', at: [30, 250] }, { type: 'normal', at: [-36, 255] },
      { type: 'aberrant', at: [70, 235] }, { type: 'normal', at: [-80, 245] },
      { type: 'normal', at: [110, 280] }, { type: 'aberrant', at: [-120, 270] }
    ]
  },
  {
    id: 3, title: 'Giải cứu đội trinh sát', zone: 'forest', reward: 210,
    brief: 'Một đội trinh sát bị hạ gục trong rừng. Tìm họ, hồi sinh và dọn sạch Titan.',
    intro: [
      { who: 'SỸ QUAN KAI', text: 'Đội trinh sát mất liên lạc ở rừng phía Bắc. Tìm người sống sót. Đừng để Titan ăn thịt họ.' },
      { who: 'BẠN', text: 'Tôi sẽ đưa họ về.' }
    ],
    objectives: [
      { type: 'rescue', label: 'Giải cứu đồng đội trong rừng', position: [120, -300] },
      { type: 'kill', count: 5, label: 'Tiêu diệt 5 Titan' }
    ],
    spawns: [
      { type: 'normal', at: [160, -330] }, { type: 'aberrant', at: [80, -360] },
      { type: 'normal', at: [200, -280] }, { type: 'aberrant', at: [40, -300] },
      { type: 'normal', at: [140, -250] }
    ]
  },
  {
    id: 4, title: 'Bóng tối trong rừng', zone: 'forest', reward: 300,
    brief: 'Một Titan bọc thép chỉ huy bầy đàn. Hạ gục nó để mở đường.',
    intro: [
      { who: 'SỸ QUAN KAI', text: 'Có thứ gì đó rất lớn trong rừng. Giáp nó dày — chỉ chém được gáy từ trên cao.' },
      { who: 'BẠN', text: 'Càng to thì càng dễ móc. Tôi sẽ kết thúc nó.' }
    ],
    objectives: [
      { type: 'boss', titan: 'armored', label: 'Hạ gục Titan Bọc Thép', position: [150, -330] }
    ],
    spawns: [
      { type: 'armored', at: [150, -330], boss: true },
      { type: 'normal', at: [90, -280] }, { type: 'normal', at: [210, -290] },
      { type: 'aberrant', at: [120, -390] }
    ]
  },
  {
    id: 5, title: 'Trận chiến cuối cùng', zone: 'waste', reward: 520,
    brief: 'Titan Khổng Lồ xuất hiện ở vùng đất hoang. Đây là trận chiến định mệnh.',
    intro: [
      { who: 'SỸ QUAN KAI', text: 'Mọi thứ đều dồn vào trận này. Titan Khổng Lồ đang tiến về thành phố. Chặn nó tại vùng đất hoang!' },
      { who: 'BẠN', text: 'Vì những người đã ngã xuống. Tôi sẽ không thất bại.' }
    ],
    objectives: [
      { type: 'boss', titan: 'colossal', label: 'Hạ gục Titan Khổng Lồ', position: [-300, -60] },
      { type: 'kill', count: 4, label: 'Dọn sạch Titan hộ vệ', excludeBoss: true }
    ],
    spawns: [
      { type: 'colossal', at: [-300, -60], boss: true },
      { type: 'armored', at: [-240, 10] }, { type: 'aberrant', at: [-360, -140] },
      { type: 'normal', at: [-210, -120] }, { type: 'normal', at: [-390, 20] }
    ]
  }
];

export const DIFFICULTY = {
  story: { hp: 1, dmg: 1, reward: 1 },
  roam: { hp: 1, dmg: 1, reward: 1 },
  training: { hp: 0.6, dmg: 0, reward: 1 },
  survival: { hp: 1.1, dmg: 1.1, reward: 1.1 },
  squad: { hp: 1.15, dmg: 1.15, reward: 1.2 }
};

export const TIPS = [
  'MẸO: Móc vào tòa nhà cao rồi giữ GAS để lấy đà — đòn chém từ trên cao gây sát thương gáy.',
  'MẸO: Titan Bọc Thép giảm 55% sát thương thường. Hãy nhắm GÁY từ phía sau.',
  'MẸO: Khóa mục tiêu (Tab / ◎) giúp đòn chém tự lao tới Titan gần nhất.',
  'MẸO: Đứng trên mặt đất để hồi gas, máu và độ bền lưỡi kiếm.',
  'MẸO: Combo 3 đòn kết thúc bằng một cú xoay người gây sát thương lớn.',
  'MẸO: Trong chế độ Biệt đội, hãy hồi sinh đồng đội bị gục trước khi họ bị Titan ăn thịt.',
  'MẸO: Bản đồ có 5 vùng: Thành phố, Tường thành, Rừng cây, Đồng cỏ, Vùng đất hoang.',
  'MẸO: Dùng Lộn né (Q / ⟲) để tránh đòn vung tay của Titan.'
];

export const RANKS = [
  { xp: 0, name: 'Binh nhì' },
  { xp: 400, name: 'Binh nhất' },
  { xp: 1200, name: 'Hạ sĩ' },
  { xp: 2600, name: 'Trung sĩ' },
  { xp: 5000, name: 'Thượng sĩ' },
  { xp: 9000, name: 'Chuẩn úy' },
  { xp: 15000, name: 'Sĩ quan' },
  { xp: 24000, name: 'Đội trưởng' },
  { xp: 40000, name: 'Chỉ huy' },
  { xp: 70000, name: 'Anh hùng nhân loại' }
];

export const ZONE_TITANS = {
  city: ['normal', 'normal', 'aberrant'],
  walls: ['normal', 'aberrant'],
  forest: ['normal', 'aberrant', 'aberrant', 'armored'],
  grass: ['normal', 'normal', 'aberrant'],
  waste: ['normal', 'armored', 'aberrant', 'colossal']
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const fmt = n => Math.round(n).toLocaleString('vi-VN');
export function angleDelta(a, b) {
  let d = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
