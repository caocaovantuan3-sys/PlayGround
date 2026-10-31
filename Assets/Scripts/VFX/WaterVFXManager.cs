using UnityEngine;
using System.Collections.Generic;

namespace StoneThrowing
{
    public class WaterVFXManager : MonoBehaviour
    {
        public static WaterVFXManager Instance { get; private set; }

        [Header("Splash VFX")]
        public GameObject splashPrefab;
        public int splashParticleCount = 50;
        public float splashForce = 10f;
        public float splashRadius = 1f;

        [Header("Ripple VFX")]
        public GameObject ripplePrefab;
        public int maxRipples = 8;
        public float rippleSpeed = 5f;
        public float rippleDuration = 3f;

        [Header("Droplets VFX")]
        public GameObject dropletPrefab;
        public int dropletCount = 100;
        public float dropletHeight = 5f;
        public float dropletLife = 2f;

        [Header("Foam VFX")]
        public GameObject foamPrefab;
        public float foamRadius = 1.5f;
        public float foamDuration = 4f;

        [Header("Water Distortion")]
        public Material distortionMaterial;
        public float distortionStrength = 0.1f;
        public float distortionDuration = 1f;

        [Header("Slow Motion")]
        public bool enableSlowMotion = true;
        public float slowMotionScale = 0.25f;
        public float slowMotionDuration = 1f;

        [Header("Motion Blur")]
        public bool enableMotionBlur = true;

        private List<GameObject> activeRipples = new List<GameObject>();
        private GameObject distortionInstance;

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
            // Tối ưu particle pool
            InitializeParticlePools();
        }

        void InitializeParticlePools()
        {
            // Pré-instantiate để tránh lag khi spawn
        }

        public void TriggerAllVFX(Vector3 impactPoint, float impactForce, StoneData stoneData)
        {
            // Điều chỉnh các tham số dựa trên loại đá và lực va chạm
            float forceMultiplier = impactForce / 20f;
            int dropletAmount = Mathf.RoundToInt(dropletCount * forceMultiplier);
            float splashSize = Mathf.Clamp(forceMultiplier, 0.5f, 2f);

            // 1. VFX Splash - nước bắn tung lên
            SpawnSplash(impactPoint, splashSize);

            // 2. VFX Ripple - vòng sóng tròn
            SpawnRipple(impactPoint, splashSize);

            // 3. VFX Droplets - giọt nước bay lên rồi rơi
            SpawnDroplets(impactPoint, dropletAmount);

            // 4. VFX Foam - bọt nước
            SpawnFoam(impactPoint);

            // 5. VFX Water Distortion - biến dạng mặt nước
            StartCoroutine(WaterDistortionEffect(impactPoint, distortionStrength * forceMultiplier));

            // 6. VFX Slow Motion - quay chậm
            if (enableSlowMotion && GameManager.Instance != null)
            {
                GameManager.Instance.StartSlowMotion(slowMotionScale, slowMotionDuration);
            }

            // 7. VFX Motion Blur
            if (enableMotionBlur && QualityManager.Instance != null)
            {
                QualityManager.Instance.EnableMotionBlur(true);
                Invoke(nameof(DisableMotionBlur), 1f);
            }

            Debug.Log($"VFX 2.0 kích hoạt tại {impactPoint} với lực {impactForce:F1}");
        }

        void SpawnSplash(Vector3 position, float size)
        {
            if (splashPrefab == null) return;

            GameObject splash = Instantiate(splashPrefab, position, Quaternion.identity);
            ParticleSystem ps = splash.GetComponent<ParticleSystem>();
            if (ps != null)
            {
                var main = ps.main;
                main.startSize = 0.5f * size;
                main.startSpeed = splashForce * size;
                main.maxParticles = splashParticleCount;
            }
            Destroy(splash, 3f);
        }

        void SpawnRipple(Vector3 position, float size)
        {
            if (ripplePrefab == null) return;

            // Tối ưu: giới hạn số ripple đồng thời
            while (activeRipples.Count >= maxRipples)
            {
                GameObject old = activeRipples[0];
                activeRipples.RemoveAt(0);
                if (old != null) Destroy(old);
            }

            GameObject ripple = Instantiate(ripplePrefab, position, Quaternion.identity);
            activeRipples.Add(ripple);

            WaterRipple rippleScript = ripple.AddComponent<WaterRipple>();
            rippleScript.Initialize(position, rippleSpeed, rippleDuration, size);
            Destroy(ripple, rippleDuration);
        }

        void SpawnDroplets(Vector3 position, int count)
        {
            if (dropletPrefab == null) return;

            for (int i = 0; i < count; i++)
            {
                Vector3 randomDir = Random.insideUnitSphere.normalized;
                randomDir.y = Mathf.Abs(randomDir.y) * 0.5f + 0.5f;
                Vector3 spawnPos = position + randomDir * 0.5f;

                GameObject droplet = Instantiate(dropletPrefab, spawnPos, Quaternion.identity);
                Rigidbody rb = droplet.GetComponent<Rigidbody>();
                if (rb != null)
                {
                    rb.AddForce(randomDir * Random.Range(2f, 8f), ForceMode.Impulse);
                    rb.AddTorque(Random.insideUnitSphere, ForceMode.Impulse);
                }
                Destroy(droplet, dropletLife);
            }
        }

        void SpawnFoam(Vector3 position)
        {
            if (foamPrefab == null) return;

            GameObject foam = Instantiate(foamPrefab, position, Quaternion.identity);
            Destroy(foam, foamDuration);
        }

        public void SpawnSmallSplash(Vector3 position, float scale)
        {
            if (splashPrefab == null) return;
            GameObject splash = Instantiate(splashPrefab, position, Quaternion.identity);
            ParticleSystem ps = splash.GetComponent<ParticleSystem>();
            if (ps != null)
            {
                var main = ps.main;
                main.startSize = 0.2f * scale;
                main.startSpeed = 5f * scale;
                main.maxParticles = 15;
            }
            Destroy(splash, 2f);
        }

        public void SpawnBubbles(Vector3 position)
        {
            if (bubbleParticles == null) return;
            // Bubbles handled in StonePhysics, but can add here
            var emitter = bubbleParticles.GetComponent<ParticleSystem>();
            if (emitter != null)
            {
                emitter.transform.position = position;
                emitter.Emit(20);
            }
        }

        System.Collections.IEnumerator WaterDistortionEffect(Vector3 position, float strength)
        {
            if (distortionMaterial == null) yield break;

            // Tạo distortion mesh hoặc shader effect tại vị trí va chạm
            GameObject distortionObj = new GameObject("WaterDistortion");
            distortionObj.transform.position = position;
            MeshRenderer mr = distortionObj.AddComponent<MeshRenderer>();
            MeshFilter mf = distortionObj.AddComponent<MeshFilter>();
            mf.mesh = CreateDistortionMesh();
            mr.material = distortionMaterial;

            float elapsed = 0f;
            Color startColor = distortionMaterial.color;
            while (elapsed < distortionDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / distortionDuration;
                distortionMaterial.SetFloat("_DistortionStrength", Mathf.Lerp(strength, 0f, t));
                distortionMaterial.color = Color.Lerp(startColor, Color.clear, t);
                yield return null;
            }

            Destroy(distortionObj);
        }

        Mesh CreateDistortionMesh()
        {
            Mesh mesh = new Mesh();
            Vector3[] vertices = new Vector3[4];
            Vector2[] uv = new Vector2[4];
            int[] triangles = new int[6];

            float s = 1f;
            vertices[0] = new Vector3(-s, 0, -s);
            vertices[1] = new Vector3(s, 0, -s);
            vertices[2] = new Vector3(s, 0, s);
            vertices[3] = new Vector3(-s, 0, s);

            uv[0] = new Vector2(0, 0);
            uv[1] = new Vector2(1, 0);
            uv[2] = new Vector2(1, 1);
            uv[3] = new Vector2(0, 1);

            triangles[0] = 0; triangles[1] = 1; triangles[2] = 2;
            triangles[3] = 0; triangles[4] = 2; triangles[5] = 3;

            mesh.vertices = vertices;
            mesh.uv = uv;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            return mesh;
        }

        void DisableMotionBlur()
        {
            if (QualityManager.Instance != null)
                QualityManager.Instance.EnableMotionBlur(false);
        }
    }

    public class WaterRipple : MonoBehaviour
    {
        private Vector3 center;
        private float speed;
        private float duration;
        private float size;
        private float elapsed = 0f;
        private Material rippleMaterial;

        public void Initialize(Vector3 centerPos, float rippleSpeed, float rippleDuration, float rippleSize)
        {
            center = centerPos;
            speed = rippleSpeed;
            duration = rippleDuration;
            size = rippleSize;

            rippleMaterial = new Material(Shader.Find("Custom/WaterRipple"));
            GetComponent<MeshRenderer>().material = rippleMaterial;
        }

        void Update()
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;

            if (rippleMaterial != null)
            {
                float radius = t * speed * 10f;
                rippleMaterial.SetFloat("_Radius", radius);
                rippleMaterial.SetFloat("_Opacity", 1f - t);
                rippleMaterial.SetVector("_Center", center);
            }

            transform.localScale = Vector3.one * (1f + t * 5f);

            if (t >= 1f)
            {
                Destroy(gameObject);
            }
        }
    }
}