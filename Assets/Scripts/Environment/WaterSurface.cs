using UnityEngine;

namespace StoneThrowing
{
    [RequireComponent(typeof(MeshRenderer))]
    [RequireComponent(typeof(MeshFilter))]
    public class WaterSurface : MonoBehaviour
    {
        [Header("Wave Settings")]
        public float waveHeight = 0.1f;
        public float waveSpeed = 1f;
        public float waveScale = 10f;
        public int waveOctaves = 4;

        [Header("Reflection")]
        public bool enableReflection = true;
        public LayerMask reflectionMask;
        public RenderTexture reflectionTexture;

        [Header("Caustics")]
        public Texture2D causticsTexture;
        public float causticsSpeed = 0.5f;
        public float causticsIntensity = 0.3f;

        [Header("Distortion")]
        public float distortionAmount = 0.05f;

        private Material waterMaterial;
        private Vector4[] waveParams;

        void Awake()
        {
            waterMaterial = GetComponent<MeshRenderer>().material;
            InitializeWaves();
        }

        void InitializeWaves()
        {
            waveParams = new Vector4[waveOctaves];
            for (int i = 0; i < waveOctaves; i++)
            {
                waveParams[i] = new Vector4(
                    Random.Range(0.5f, 2f),   // wavelength
                    Random.Range(0.5f, 2f),   // amplitude
                    Random.Range(0f, 360f),   // phase
                    Random.Range(0f, 1f)      // speed
                );
            }
        }

        void Update()
        {
            UpdateShaderParameters();
            UpdateCaustics();
        }

        void UpdateShaderParameters()
        {
            if (waterMaterial == null) return;

            waterMaterial.SetFloat("_WaveHeight", waveHeight);
            waterMaterial.SetFloat("_WaveSpeed", waveSpeed);
            waterMaterial.SetFloat("_WaveScale", waveScale);
            waterMaterial.SetFloat("_Time", Time.time);
            waterMaterial.SetFloat("_DistortionAmount", distortionAmount);

            // Cập nhật tham số sóng
            for (int i = 0; i < waveOctaves; i++)
            {
                waterMaterial.SetVector($"_Wave{i}", waveParams[i]);
            }
        }

        void UpdateCaustics()
        {
            if (causticsTexture != null && waterMaterial != null)
            {
                float offset = Time.time * causticsSpeed;
                waterMaterial.SetTexture("_CausticsTex", causticsTexture);
                waterMaterial.SetVector("_CausticsOffset", new Vector2(offset, offset * 0.5f));
                waterMaterial.SetFloat("_CausticsIntensity", causticsIntensity);
            }
        }

        public void UpdateWaveParameters(float height, float speed)
        {
            waveHeight = height;
            waveSpeed = speed;
        }

        public Vector3 GetWaterHeight(Vector3 worldPos)
        {
            // Trả về độ cao nước tại vị trí (dùng để kiểm tra đá chìm)
            float y = transform.position.y;
            for (int i = 0; i < waveOctaves; i++)
            {
                float wave = Mathf.Sin((worldPos.x + worldPos.z) * waveScale + Time.time * waveSpeed + waveParams[i].z) *
                             waveParams[i].y * waveHeight;
                y += wave;
            }
            return new Vector3(worldPos.x, y, worldPos.z);
        }
    }
}