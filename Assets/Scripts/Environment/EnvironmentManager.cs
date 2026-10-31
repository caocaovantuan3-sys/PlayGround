using UnityEngine;
using System.Collections;

namespace StoneThrowing
{
    public class EnvironmentManager : MonoBehaviour
    {
        public static EnvironmentManager Instance { get; private set; }

        [Header("Day/Night Cycle")]
        public Light directionalLight;
        public float dayCycleDuration = 120f; // 2 phút cho một ngày
        public Gradient skyGradient;
        public Color dawnColor = new Color(1f, 0.6f, 0.3f);
        public Color dayColor = new Color(0.5f, 0.7f, 1f);
        public Color sunsetColor = new Color(1f, 0.4f, 0.2f);
        public Color nightColor = new Color(0.1f, 0.1f, 0.2f);

        [Header("Wind")]
        public float windStrength = 1f;
        public float windDirectionChangeTime = 30f;
        public Transform[] trees;
        public float treeSwayAmount = 0.1f;
        public float treeSwaySpeed = 2f;

        [Header("Clouds")]
        public Material cloudMaterial;
        public float cloudSpeed = 0.5f;
        public Vector2 cloudDirection = new Vector2(0.5f, 0.3f);

        [Header("Water")]
        public WaterSurface waterSurface;

        private float cycleTime = 0f;
        private Vector3 currentWindDirection;
        private float windTimer = 0f;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        void Start()
        {
            currentWindDirection = Random.insideUnitCircle.normalized;
            SetupSkybox();
        }

        void Update()
        {
            UpdateDayNightCycle();
            UpdateWind();
            UpdateClouds();
            UpdateTrees();
        }

        void UpdateDayNightCycle()
        {
            cycleTime += Time.deltaTime / dayCycleDuration;
            if (cycleTime > 1f) cycleTime = 0f;

            // Thay đổi màu ánh sáng theo thời gian
            Color lightColor = Color.Lerp(dawnColor, dayColor, Mathf.PingPong(cycleTime, 1f));
            if (directionalLight != null)
            {
                directionalLight.color = lightColor;
                directionalLight.intensity = Mathf.Lerp(0.3f, 1.5f, Mathf.PingPong(cycleTime, 1f));
            }

            // Cập nhật Skybox
            RenderSettings.skybox.SetColor("_SkyTint", lightColor);
        }

        void SetupSkybox()
        {
            if (RenderSettings.skybox == null)
            {
                Material skyboxMat = new Material(Shader.Find("Skybox/Procedural"));
                RenderSettings.skybox = skyboxMat;
            }
        }

        void UpdateWind()
        {
            windTimer += Time.deltaTime;
            if (windTimer > windDirectionChangeTime)
            {
                currentWindDirection = Random.insideUnitCircle.normalized;
                windTimer = 0f;
            }
        }

        void UpdateTrees()
        {
            if (trees == null) return;

            float time = Time.time * treeSwaySpeed;
            foreach (var tree in trees)
            {
                if (tree == null) continue;

                // Mô phỏng gió làm cây lay động
                float sway = Mathf.Sin(time + tree.position.x) * treeSwayAmount * windStrength;
                tree.localRotation = Quaternion.Euler(0, sway * 10f, 0);
            }
        }

        void UpdateClouds()
        {
            if (cloudMaterial != null)
            {
                Vector2 offset = cloudMaterial.GetTextureOffset("_MainTex");
                offset += cloudDirection * cloudSpeed * Time.deltaTime;
                cloudMaterial.SetTextureOffset("_MainTex", offset);
            }
        }

        public void UpdateWaterWaves(float waveHeight, float waveSpeed)
        {
            if (waterSurface != null)
            {
                waterSurface.UpdateWaveParameters(waveHeight, waveSpeed);
            }
        }

        public Vector3 GetWindDirection() => currentWindDirection;
        public float GetWindStrength() => windStrength;
    }
}