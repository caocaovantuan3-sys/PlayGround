using UnityEngine;

namespace StoneThrowing
{
    /// <summary>
    /// Tự động tạo scene cơ bản cho game Stone Throwing 3D.
    /// Gán script này vào một GameObject trống trong scene rồi nhấn Play.
    /// </summary>
    [RequireComponent(typeof(GameInitializer))]
    public class SimpleSceneSetup : MonoBehaviour
    {
        [Header("Scene Objects")]
        public GameObject groundPrefab;
        public GameObject waterPrefab;
        public GameObject stonePrefab;
        public GameObject handPrefab;

        [Header("Setup Options")]
        public bool autoCreateCamera = true;
        public bool autoCreateLight = true;
        public bool autoCreateGround = true;
        public bool autoCreateWater = true;
        public bool autoCreateStones = true;

        void Start()
        {
            SetupScene();
        }

        void SetupScene()
        {
            // 1. Tạo Camera chính
            if (autoCreateCamera && Camera.main == null)
            {
                GameObject camObj = new GameObject("Main Camera");
                var cam = camObj.AddComponent<Camera>();
                cam.tag = "MainCamera";
                cam.transform.position = new Vector3(0, 2f, -5f);
                cam.transform.rotation = Quaternion.Euler(15f, 0f, 0f);
                cam.backgroundColor = new Color(0.5f, 0.7f, 1f);
                Debug.Log("Đã tạo Main Camera");
            }

            // 2. Tạo Directional Light
            if (autoCreateLight && GameObject.Find("Directional Light") == null)
            {
                GameObject lightObj = new GameObject("Directional Light");
                var light = lightObj.AddComponent<Light>();
                light.type = LightType.Directional;
                light.intensity = 1.2f;
                light.color = Color.white;
                lightObj.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
                Debug.Log("Đã tạo Directional Light");
            }

            // 3. Tạo Ground (mặt đất)
            if (autoCreateGround && groundPrefab == null)
            {
                GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
                ground.name = "Ground";
                ground.transform.position = new Vector3(0, 0, 0);
                ground.transform.localScale = new Vector3(10, 1, 10);
                var groundRb = ground.AddComponent<Rigidbody>();
                groundRb.isKinematic = true;
                var groundCol = ground.GetComponent<Collider>();
                groundCol.material = new PhysicMaterial { bounciness = 0f };
                ground.tag = "Ground";

                // Tạo sắc đá rải xung quanh
                for (int i = 0; i < 15; i++)
                {
                    CreateRandomStone(new Vector3(
                        Random.Range(-6f, 6f),
                        0.05f,
                        Random.Range(-6f, 6f)
                    ));
                }
                Debug.Log("Đã tạo Ground và đá");
            }
            else if (autoCreateGround && groundPrefab != null)
            {
                Instantiate(groundPrefab, Vector3.zero, Quaternion.identity);
            }

            // 4. Tạo Water (hồ nước)
            if (autoCreateWater && waterPrefab == null)
            {
                GameObject water = GameObject.CreatePrimitive(PrimitiveType.Plane);
                water.name = "Water";
                water.transform.position = new Vector3(0, 0.5f, 8f);
                water.transform.localScale = new Vector3(20, 1, 20);
                water.transform.Rotate(0, 0, 0);

                var waterRenderer = water.GetComponent<MeshRenderer>();
                waterRenderer.material = new Material(Shader.Find("Custom/WaterSurface"));

                var waterCol = water.GetComponent<Collider>();
                waterCol.isTrigger = true;
                waterCol.gameObject.layer = LayerMask.NameToLayer("Water");

                if (waterCol.gameObject.layer == 0) // Layer "Water" chưa tồn tại
                {
                    waterCol.gameObject.layer = 0; // Default
                    Debug.LogWarning("Tạo layer 'Water' trong Project Settings > Tags and Layers để va chạm nước hoạt động chính xác");
                }

                Debug.Log("Đã tạo mặt nước");
            }
            else if (autoCreateWater && waterPrefab != null)
            {
                Instantiate(waterPrefab, new Vector3(0, 0.5f, 8f), Quaternion.identity);
            }

            // 5. Tạo các viên đá mẫu nếu có prefab
            if (autoCreateStones && stonePrefab != null)
            {
                for (int i = 0; i < 8; i++)
                {
                    Instantiate(stonePrefab, new Vector3(
                        Random.Range(-4f, 4f),
                        0.3f,
                        Random.Range(-4f, 4f)
                    ), Quaternion.Euler(Random.Range(0, 360), Random.Range(0, 360), Random.Range(0, 360)));
                }
            }

            Debug.Log("=== Scene đã được thiết lập xong ===");
        }

        void CreateRandomStone(Vector3 position)
        {
            GameObject stone = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            stone.name = "Stone_" + Random.Range(1000, 9999);
            stone.transform.position = position;
            stone.transform.localScale = Vector3.one * Random.Range(0.2f, 0.5f);
            stone.transform.rotation = Quaternion.Euler(Random.Range(0, 360), Random.Range(0, 360), Random.Range(0, 360));

            var rb = stone.AddComponent<Rigidbody>();
            rb.mass = Random.Range(0.1f, 0.5f);
            rb.isKinematic = true;

            var col = stone.GetComponent<Collider>();
            col.material = new PhysicMaterial { bounciness = 0.3f };

            // Thêm StoneData component
            var stoneData = stone.AddComponent<StoneData>();
            stoneData.type = GameManager.StoneType.Pebble;
            stoneData.displayName = "Đá Cuội";
            stoneData.size = 0.3f;
            stoneData.weight = 0.2f;
            stoneData.drag = 0.1f;
            stoneData.stoneColor = new Color(0.6f, 0.5f, 0.4f);
        }
    }
}