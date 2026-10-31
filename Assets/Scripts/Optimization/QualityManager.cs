using UnityEngine;
using UnityEngine.Rendering;

namespace StoneThrowing
{
    public class QualityManager : MonoBehaviour
    {
        public static QualityManager Instance { get; private set; }

        [Header("Quality Levels")]
        public int currentQualityLevel = 2; // 0=Low, 1=Medium, 2=High, 3=Ultra
        public string[] qualityNames = { "LOW", "MEDIUM", "HIGH", "ULTRA" };

        [Header("FPS Target")]
        public int targetFPS = 60;
        public bool support90FPS = true;
        public bool support120FPS = true;
        public bool autoDetectFPS = true;

        [Header("Auto Quality")]
        public bool autoAdjustQuality = true;
        public float lowDeviceThreshold = 0.5f; // Tỷ lệ màn hình dưới đây coi là yếu

        [Header("Settings")]
        public bool motionBlurEnabled = false;
        public int particleCount = 100;
        public int waterQuality = 2;
        public int shadowQuality = 2;

        private bool isLowEndDevice = false;
        private FrameRateCounter fpsCounter;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start()
        {
            DetectDevice();
            ApplyQualitySettings();
            SetupFrameRate();
        }

        void DetectDevice()
        {
            // Phát hiện thiết bị yếu dựa trên RAM và màn hình
            float screenRatio = (float)Screen.width / Screen.height;
            int systemMemory = SystemInfo.systemMemorySize;

            if (systemMemory < 2048 || screenRatio < lowDeviceThreshold)
            {
                isLowEndDevice = true;
                currentQualityLevel = 0;
                Debug.Log("Thiết bị yếu - tự động giảm chất lượng");
            }
        }

        public void ApplyQualitySettings()
        {
            QualitySettings.SetQualityLevel(currentQualityLevel, true);

            switch (currentQualityLevel)
            {
                case 0: // Low
                    particleCount = 30;
                    waterQuality = 1;
                    shadowQuality = 0;
                    motionBlurEnabled = false;
                    break;
                case 1: // Medium
                    particleCount = 60;
                    waterQuality = 2;
                    shadowQuality = 1;
                    motionBlurEnabled = false;
                    break;
                case 2: // High
                    particleCount = 100;
                    waterQuality = 3;
                    shadowQuality = 2;
                    motionBlurEnabled = true;
                    break;
                case 3: // Ultra
                    particleCount = 200;
                    waterQuality = 4;
                    shadowQuality = 2;
                    motionBlurEnabled = true;
                    break;
            }

            ApplyWaterQuality();
            ApplyParticleSettings();
            ApplyShadowSettings();
            ApplyMotionBlur(motionBlurEnabled);

            Debug.Log($"Chất lượng đồ họa: {qualityNames[currentQualityLevel]}");
        }

        public void SetQualityLevel(int level)
        {
            currentQualityLevel = Mathf.Clamp(level, 0, 3);
            ApplyQualitySettings();
        }

        public void SetupFrameRate()
        {
            if (autoDetectFPS)
            {
                int supportedMax = Screen.currentResolution.refreshRate;
                if (support120FPS && supportedMax >= 120)
                    targetFPS = 120;
                else if (support90FPS && supportedMax >= 90)
                    targetFPS = 90;
                else
                    targetFPS = 60;
            }

            Application.targetFrameRate = targetFPS;
            Debug.Log($"FPS mục tiêu: {targetFPS}");
        }

        void ApplyWaterQuality()
        {
            // Điều chỉnh shader water dựa trên chất lượng
            Shader waterShader = Shader.Find("Custom/WaterSurface");
            if (waterShader != null)
            {
                switch (waterQuality)
                {
                    case 0:
                        waterShader.maximumLOD = 200;
                        break;
                    case 1:
                        waterShader.maximumLOD = 300;
                        break;
                    case 2:
                        waterShader.maximumLOD = 400;
                        break;
                    case 3:
                        waterShader.maximumLOD = 500;
                        break;
                    case 4:
                        waterShader.maximumLOD = 600;
                        break;
                }
            }
        }

        void ApplyParticleSettings()
        {
            ParticleSystem[] allParticles = FindObjectsOfType<ParticleSystem>();
            foreach (var ps in allParticles)
            {
                var main = ps.main;
                main.maxParticles = particleCount;
            }
        }

        void ApplyShadowSettings()
        {
            switch (shadowQuality)
            {
                case 0:
                    QualitySettings.shadows = ShadowQuality.Disable;
                    break;
                case 1:
                    QualitySettings.shadows = ShadowQuality.HardOnly;
                    break;
                case 2:
                    QualitySettings.shadows = ShadowQuality.All;
                    break;
            }
            QualitySettings.shadowDistance = shadowQuality == 0 ? 0 : 50f;
        }

        public void EnableMotionBlur(bool enable)
        {
            motionBlurEnabled = enable;
            ApplyMotionBlur(enable);
        }

        void ApplyMotionBlur(bool enable)
        {
            // Tìm và bật/tắt Motion Blur effect
            var volume = FindObjectOfType<UnityEngine.Rendering.Volume>();
            if (volume != null)
            {
                if (volume.profile.TryGet(out UnityEngine.Rendering.PostProcessing.MotionBlur mb))
                {
                    mb.active = enable;
                }
            }
        }

        public void AutoReduceQualityIfNeeded(float currentFPS)
        {
            if (!autoAdjustQuality) return;

            if (currentFPS < 30f && currentQualityLevel > 0)
            {
                currentQualityLevel--;
                ApplyQualitySettings();
                Debug.Log($"Giảm chất lượng do FPS thấp: {qualityNames[currentQualityLevel]}");
            }
        }

        public bool IsLowEndDevice() => isLowEndDevice;
    }
}