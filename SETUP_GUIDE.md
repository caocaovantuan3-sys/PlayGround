# 🎮 HƯỚNG DẪN SETUP NHANH - STONE THROWING 3D – VFX 2.0

## Bước 1: Import vào Unity
1. Mở Unity Hub → New Project (3D Core)
2. Copy toàn bộ thư mục `Assets/` vào dự án Unity của bạn
3. Đợi Unity import hoàn tất

## Bước 2: Tự động tạo Scene (khuyên dùng)
1. Trong Unity Editor, tạo GameObject trống (GameObject → Create Empty)
2. Đặt tên là `GameSetup`
3. Thêm component `SimpleSceneSetup` vào GameObject này
4. Nhấn **Play** — script sẽ tự động tạo:
   - Main Camera
   - Đèn mặt trời (Directional Light)
   - Mặt đất (Ground)
   - Mặt nước (Water)
   - Các viên đá ngẫu nhiên

## Bước 3: Thiết lập Scripts thủ công (nếu không dùng SimpleSceneSetup)

### Tạo GameInitializer
1. Tạo GameObject trống tên `GameInitializer`
2. Thêm các component sau:
   - `GameManager`
   - `StonePicker`
   - `StoneThrower`
   - `UIManager`
   - `WaterVFXManager`
   - `EnvironmentManager`
   - `QualityManager`
   - `StoneDataSetup`
   - `AudioManager`
   - `FrameRateCounter`

### Gán References trong Inspector
| Component | Trường | Gán gì |
|-----------|--------|--------|
| GameInitializer | GameManager | Kéo GameManager từ GameInitializer |
| GameInitializer | StonePicker | Kéo StonePicker |
| GameInitializer | StoneThrower | Kéo StoneThrower |
| GameInitializer | UIManager | Kéo UIManager |
| GameInitializer | VFXManager | Kéo WaterVFXManager |
| GameInitializer | EnvManager | Kéo EnvironmentManager |
| GameInitializer | QualityManager | Kéo QualityManager |
| GameInitializer | StoneSetup | Kéo StoneDataSetup |

### Thiết lập StoneDataSetup
1. Chọn `StoneDataSetup` trên GameInitializer
2. Tạo 5 Prefab cho các loại đá (Pebble, Flat, Round, Big, Colored)
3. Kéo từng prefab vào trường tương ứng trong Inspector
4. Tạo Materials cho từng loại đá và gán vào trường Material

### Thiết lập UIManager
1. Tạo Canvas (GameObject → UI → Canvas)
2. Tạo các Panel: MenuPanel, HUDPanel, ResultPanel, SettingsPanel
3. Tạo các Button: Play, Pick Up, Throw, Reset, Settings, Sound, Graphics
4. Tạo Slider cho lực ném
5. Tạo TextMeshPro cho hiển thị điểm, khoảng cách, lần nảy, lần ném
6. Kéo các object này vào trường tương ứng trong UIManager

## Bước 4: Tạo Layer "Water"
1. Mở **Edit → Project Settings → Tags and Layers**
2. Trong **Layers**, tạo layer mới tên là `Water`
3. Chọn mặt nước (Water plane) → thay Layer = `Water`

## Bước 5: Cài đặt Mobile (Build)
1. **File → Build Settings**
2. Chọn **Android** hoặc **iOS**
3. Nhấn **Switch Platform**
4. **Player Settings**:
   - Bundle Identifier: `com.stonethrowing.vfx2`
   - Minimum API Level: Android 7.0 (API 24)
   - Target Architectures: ARM64
5. Nhấn **Build**

## 🎮 Luồng Chơi
```
MENU (nút PLAY) 
    → Nhấn PLAY 
    → HIỂN THỊ NÚT PICK UP 
    → Nhấn PICK UP để nhặt đá 
    → Vuốt màn hình để nhắm và ném 
    → Xem VFX 2.0 khi đá chạm nước 
    → Nhấn RESET để chơi lại
```

## ⚙️ Chất Lượng Đồ Họa
Truy cập **Settings → Graphics** để chọn:
- **LOW**: 30 particles, tắt motion blur
- **MEDIUM**: 60 particles
- **HIGH**: 100 particles, bật motion blur
- **ULTRA**: 200 particles, tất cả hiệu ứng

## 📱 Mục Tiêu FPS
- 60 FPS: Thiết bị trung bình trở lên
- 90/120 FPS: Thiết bị flagship (iPhone 13+, Samsung S21+)

---

Nếu gặp lỗi compile, hãy kiểm tra lại các reference trong Inspector đã được gán đầy đủ chưa.