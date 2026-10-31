# STONE THROWING 3D – VFX 2.0

Trò chơi mobile 3D mô phỏng nhặt và ném đá xuống hồ với hệ thống VFX chuyên sâu, vật lý thực tế và đồ họa tối ưu cho điện thoại.

## 📋 Tính Năng Chính

### 1. Gameplay
- **Nhặt đá**: Nhìn xuống đất, chạm vào viên đá để nhặt. Bàn tay 3D xuất hiện với animation ngón tay và cổ tay tự nhiên.
- **Ném đá**: Vuốt ngón tay trên màn hình để điều chỉnh hướng và lực ném. Vuốt nhanh = ném mạnh, vuốt nhẹ = ném gần.
- **Vật lý**: Quỹ đạo parabol, trọng lực, lực cản không khí, va chạm nước, viên đá xoay khi bay.
- **Theo dõi camera**: Camera tự động theo dõi viên đá trong khoảng thời gian bay.

### 2. Hệ Thống VFX 2.0 (Nhiều lớp kết hợp)
| VFX | Mô Tả |
|-----|-------|
| Splash | Nước bắn tung lên khi đá chạm mặt hồ |
| Ripple | Nhiều vòng sóng tròn lan rộng từ va chạm |
| Droplets | Hàng trăm giọt nước nhỏ bay lên rồi rơi xuống |
| Foam | Bọt nước xuất hiện tại vị trí va chạm |
| Water Distortion | Mặt nước biến dạng theo lực tác động |
| Reflection | Phản chiếu bầu trời và môi trường |
| Caustics | Ánh sáng khúc xạ dưới mặt nước |
| Motion Blur | Hiệu ứng chuyển động khi viên đá bay |
| Slow Motion | Quay chậm khoảnh khắc đá chạm nước |

### 3. Môi Trường 3D
- Hồ nước trong xanh, bờ hồ có cỏ và đá
- Cây cối chuyển động theo gió
- Mây trôi trên bầu trời
- Ánh sáng bình minh, ban ngày, hoàng hôn
- Âm thanh chim, gió, nước 3D
- Bóng đổ và phản chiếu thời gian thực

### 4. Tối Ưu Đồ Họa
- Mục tiêu 60 FPS, hỗ trợ 90/120 FPS
- Chất lượng: Low, Medium, High, Ultra
- Tự động giảm chất lượng trên thiết bị yếu
- Tối ưu shader, particle, hiệu ứng nước

## 🗂️ Cấu Trúc Dự Án

```
Assets/
├── Scenes/
│   └── Main.unity
├── Scripts/
│   ├── Core/
│   │   ├── GameManager.cs
│   │   ├── GameInitializer.cs
│   │   ├── StonePicker.cs
│   │   ├── StoneThrower.cs
│   │   ├── StonePhysics.cs
│   │   └── StoneDataSetup.cs
│   ├── VFX/
│   │   ├── WaterVFXManager.cs
│   │   └── WaterSurface.cs
│   ├── UI/
│   │   └── UIManager.cs
│   ├── Audio/
│   │   └── AudioManager.cs
│   ├── Optimization/
│   │   ├── QualityManager.cs
│   │   └── FrameRateCounter.cs
│   └── Environment/
│       ├── EnvironmentManager.cs
│       └── WaterSurface.cs
├── Shaders/
│   ├── WaterSurface.shader
│   ├── WaterDistortion.shader
│   ├── WaterRipple.shader
│   ├── Stone.shader
│   └── SplashParticle.shader
├── Materials/
├── Prefabs/
├── Audio/
└── Textures/
```

## 🚀 Hướng Dẫn Cài Đặt Unity

### Yêu cầu
- Unity 2021.3 LTS hoặc mới hơn
- Unity Hub
- Android SDK / Xcode (để build mobile)

### Bước 1: Tạo dự án mới
1. Mở Unity Hub → New project → 3D (Core)
2. Chọn phiên bản Unity 2021.3 LTS+

### Bước 2: Import script
1. Copy toàn bộ thư mục `Assets/` vào dự án Unity của bạn
2. Mở Unity, chờ import hoàn tất

### Bước 3: Thiết lập Scene
1. Tạo Scene mới (File → New Scene)
2. Tạo GameObject trống tên `GameInitializer`
3. Gán các component sau vào `GameInitializer`:
   - GameManager
   - StonePicker
   - StoneThrower
   - UIManager
   - WaterVFXManager
   - EnvironmentManager
   - QualityManager
   - StoneDataSetup

### Bước 4: Thiết lập Prefab
- Tạo Prefab cho các loại đá: pebble, flat, round, big, colored
- Gán vào `StoneDataSetup` trong Inspector

### Bước 5: Cài đặt Mobile
1. File → Build Settings → Chọn Android hoặc iOS
2. Player Settings → Bundle Identifier: `com.stonethrowing.vfx2`
3. Minimum API Level: Android 7.0 (API 24)
4. Chọn Architecture: ARM64
5. Nhấn Build

## 🎮 Cách Chơi

1. **Bắt đầu**: Nhấn nút "PICK UP" trên màn hình
2. **Nhặt đá**: Nhìn xuống mặt đất, chạm vào viên đá muốn nhặt
3. **Nhắm準**: Vuốt ngón tay trên màn hình để chọn hướng và lực ném
4. **Ném**: Nhả ngón tay hoặc nhấn nút "THROW"
5. **Xem kết quả**: Camera theo dõi đá bay và chạm nước, VFX 2.0 kích hoạt
6. **Chơi lại**: Nhấn nút "RESET"

## 📱 Điều Khiển Cảm Ứng

| Hành Động | Điều Khiển |
|-----------|------------|
| Nhặt đá | Chạm vào viên đá trên đất |
| Nhắm hướng | Vuốt ngón tay trên màn hình |
| Điều chỉnh lực | Vuốt lâu hơn = lực lớn hơn |
| Ném đá | Nhả ngón tay hoặc nhấn THROW |
| Cài đặt | Nhấn nút Settings (bắn/settings) |
| Tắt âm thanh | Nhấn nút Sound |

## ⚙️ Cài Đất Chất Lượng

Truy cập Settings → Graphics để chọn:
- **LOW**: 30 partículas, tắt motion blur, sombra tắt
- **MEDIUM**: 60 partículas, chất lượng nước trung bình
- **HIGH**: 100 partículas, bật motion blur, sombra đầy đủ
- **ULTRA**: 200 partículas, tất cả hiệu ứng bật

## 🔧 Cấu Hình Script Quan Trọng

### GameManager.cs
Quản lý trạng thái game, điểm số, số lần ném, số lần nảy.

### StoneThrower.cs
Xử lý input vuốt, tính toán hướng và lực ném, đường tiro chuẩn đoán.

### WaterVFXManager.cs
Kích hoạt tất cả hiệu ứng VFX 2.0 khi đá chạm nước, đồng bộ thời điểm.

### QualityManager.cs
Tự động điều chỉnh chất lượng dựa trên FPS và thiết bị.

## 📊 Hiệu Suất Mong Đợi

| Thiết bị | Chất lượng | FPS |
|----------|-----------|-----|
| iPhone 13+ / Android flagship | Ultra | 60-120 |
| iPhone 11 / Android trung cấp | High | 60 |
| Androidentry | Medium/Low | 30-60 |

## 📄 Giấy Phép

MIT License - Sử dụng miễn phí cho mục đích học tập và thương mại.

## 🤝 Đóng Góp

Mọi đóng góp đều được hoan nghênh. Vui lòng tạo issue hoặc pull request.

---

**STONE THROWING 3D – VFX 2.0**  
Trải nghiệm ném đá thực tế nhất trên mobile.  
© 2026