using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

namespace StoneThrowing
{
    public enum GameState
    {
        Menu,
        Picking,
        Aiming,
        Throwing,
        Flying,
        Splash,
        Result
    }

    public enum StoneType
    {
        Pebble,      // Đá cuội nhỏ
        Flat,        // Đá dẹt
        Round,       // Đá tròn
        Big,         // Đá lớn
        Colored      // Đá màu
    }

    [System.Serializable]
    public class StoneData
    {
        public StoneType type;
        public string displayName;
        public GameObject prefab;
        public float size;
        public float weight;
        public float bounciness;
        public float drag;
        public Color stoneColor;
        public Material material;
    }

    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Game State")]
        public GameState currentState = GameState.Menu;

        [Header("Stone Settings")]
        public List<StoneData> stoneTypes = new List<StoneData>();
        public StoneData currentStone;
        public GameObject currentStoneInstance;
        public Transform stoneSpawnPoint;
        public Transform handTransform;

        [Header("Scoring")]
        public int totalThrows = 0;
        public int maxSkips = 0;
        public int currentSkips = 0;
        public float maxDistance = 0f;
        public int totalScore = 0;
        public TextMeshProUGUI scoreText;
        public TextMeshProUGUI distanceText;
        public TextMeshProUGUI skipsText;
        public TextMeshProUGUI throwsText;

        [Header("UI References")]
        public GameObject menuPanel;
        public GameObject hudPanel;
        public GameObject resultPanel;
        public GameObject pickUpButton;
        public GameObject throwButton;
        public GameObject resetButton;

        [Header("Camera")]
        public Camera mainCamera;
        public Transform followTarget;
        public float followSmoothTime = 0.1f;
        private Vector3 followVelocity = Vector3.zero;

        [Header("Audio")]
        public AudioSource ambienceSource;
        public AudioClip stoneFlyClip;
        public AudioClip waterSplashClip;
        public AudioClip waterRippleClip;
        public AudioClip stoneSinkClip;

        private float lastThrowTime = 0f;
        private bool isSlowMotion = false;

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
            QualityManager.Instance.ApplyQualitySettings();
            AudioManager.Instance.PlayAmbience();
            ShowMenu();
            UpdateHUD();
        }

        void Update()
        {
            HandleStateInput();

            if (currentState == GameState.Flying && currentStoneInstance != null)
            {
                UpdateFlightTracking();
            }

            if (currentState == GameState.Splash && followTarget != null)
            {
                SmoothCameraFollow();
            }
        }

        void HandleStateInput()
        {
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                if (currentState == GameState.Menu)
                    Application.Quit();
                else
                    ResetGame();
            }
        }

        void UpdateFlightTracking()
        {
            // Camera theo dõi viên đá khi bay
            if (followTarget != null && mainCamera != null)
            {
                Vector3 targetPos = followTarget.position + new Vector3(0, 2f, -3f);
                mainCamera.transform.position = Vector3.SmoothDamp(
                    mainCamera.transform.position, targetPos, ref followVelocity, followSmoothTime);
                mainCamera.transform.LookAt(followTarget);
            }

            // Kiểm tra đá đã dừng hoặc chìm
            Rigidbody rb = currentStoneInstance.GetComponent<Rigidbody>();
            if (rb != null && rb.velocity.magnitude < 0.1f && rb.IsSleeping())
            {
                EndThrow();
            }
        }

        void SmoothCameraFollow()
        {
            if (followTarget != null && mainCamera != null)
            {
                Vector3 targetPos = followTarget.position + new Vector3(0, 1.5f, -2f);
                mainCamera.transform.position = Vector3.SmoothDamp(
                    mainCamera.transform.position, targetPos, ref followVelocity, followSmoothTime);
            }
        }

        public void StartPicking()
        {
            currentState = GameState.Picking;
            pickUpButton.SetActive(false);
            throwButton.SetActive(false);
            hudPanel.SetActive(true);
            menuPanel.SetActive(false);

            // Tạo bàn tay 3D
            if (handTransform != null)
                handTransform.gameObject.SetActive(true);

            Debug.Log("Đang chờ người chơi nhặt đá...");
        }

        public void OnStonePicked(GameObject stoneObj, StoneData data)
        {
            currentStoneInstance = stoneObj;
            currentStone = data;
            currentState = GameState.Aiming;
            throwButton.SetActive(true);

            // Cập nhật camera nhìn về tay cầm đá
            if (handTransform != null && mainCamera != null)
            {
                Vector3 handPos = handTransform.position;
                Vector3 camPos = handPos + new Vector3(0, 0.5f, -0.8f);
                mainCamera.transform.position = camPos;
                mainCamera.transform.LookAt(handPos);
            }

            Debug.Log($"Đã nhặt: {data.displayName} (Trọng lượng: {data.weight})");
        }

        public void ThrowStone(Vector3 direction, float force)
        {
            if (currentStoneInstance == null || currentState != GameState.Aiming)
                return;

            currentState = GameState.Throwing;
            totalThrows++;
            UpdateHUD();

            Rigidbody rb = currentStoneInstance.GetComponent<Rigidbody>();
            if (rb != null)
            {
                rb.isKinematic = false;
                rb.useGravity = true;
                rb.drag = currentStone.drag;
                rb.mass = currentStone.weight;
                rb.AddForce(direction * force, ForceMode.Impulse);

                // Thêm xoay ngẫu nhiên cho viên đá
                rb.AddTorque(Random.insideUnitSphere * 5f, ForceMode.Impulse);

                // Phát âm thanh đá bay
                AudioManager.Instance.PlayStoneFly();

                // Bật motion blur
                QualityManager.Instance.EnableMotionBlur(true);
            }

            followTarget = currentStoneInstance.transform;
            currentState = GameState.Flying;
            lastThrowTime = Time.time;
        }

        public void OnStoneHitWater(Vector3 impactPoint, float impactForce)
        {
            if (currentState != GameState.Flying)
                return;

            currentState = GameState.Splash;

            // Kích hoạt VFX 2.0
            WaterVFXManager.Instance.TriggerAllVFX(impactPoint, impactForce, currentStone);

            // Phát âm thanh nước
            AudioManager.Instance.PlayWaterSplash(impactPoint);

            // Kích hoạt slow motion nếu lực va chạm lớn
            if (impactForce > 15f)
            {
                StartSlowMotion(0.3f, 1f);
            }

            // Theo dõi viên đá trong nước
            if (currentStoneInstance != null)
            {
                followTarget = currentStoneInstance.transform;
                Invoke(nameof(CheckStoneInWater), 1f);
            }
        }

        void CheckStoneInWater()
        {
            if (currentStoneInstance != null)
            {
                StonePhysics stonePhys = currentStoneInstance.GetComponent<StonePhysics>();
                if (stonePhys != null && stonePhys.IsInWater)
                {
                    AudioManager.Instance.PlayStoneSink();
                    WaterVFXManager.Instance.SpawnBubbles(currentStoneInstance.transform.position);
                }
            }
        }

        public void OnStoneSkip()
        {
            currentSkips++;
            if (currentSkips > maxSkips)
                maxSkips = currentSkips;
            UpdateHUD();
            AudioManager.Instance.PlayWaterRipple();
        }

        void EndThrow()
        {
            currentState = GameState.Result;
            if (currentStoneInstance != null)
            {
                float dist = Vector3.Distance(stoneSpawnPoint.position, currentStoneInstance.transform.position);
                if (dist > maxDistance)
                    maxDistance = dist;

                int throwScore = Mathf.RoundToInt(dist * 10f + currentSkips * 50f);
                totalScore += throwScore;
            }
            UpdateHUD();

            throwButton.SetActive(false);
            resetButton.SetActive(true);

            // Tắt motion blur
            QualityManager.Instance.EnableMotionBlur(false);
        }

        public void ResetGame()
        {
            currentState = GameState.Menu;
            currentSkips = 0;
            totalThrows = 0;

            if (currentStoneInstance != null)
            {
                Destroy(currentStoneInstance);
                currentStoneInstance = null;
            }

            if (handTransform != null)
                handTransform.gameObject.SetActive(false);

            followTarget = null;
            isSlowMotion = false;
            Time.timeScale = 1f;

            ShowMenu();
            UpdateHUD();

            QualityManager.Instance.EnableMotionBlur(false);
        }

        public void ShowMenu()
        {
            menuPanel.SetActive(true);
            hudPanel.SetActive(false);
            resultPanel.SetActive(false);
            pickUpButton.SetActive(true);
            throwButton.SetActive(false);
            resetButton.SetActive(false);
        }

        public void ShowResult()
        {
            resultPanel.SetActive(true);
            hudPanel.SetActive(false);
        }

        void UpdateHUD()
        {
            if (scoreText != null) scoreText.text = "ĐIỂM: " + totalScore;
            if (distanceText != null) distanceText.text = "KHOẢNG CÁCH: " + maxDistance.ToString("F1") + " m";
            if (skipsText != null) skipsText.text = "LẦN NẤY: " + currentSkips;
            if (throwsText != null) throwsText.text = "LẦN NÉM: " + totalThrows;
        }

        public void StartSlowMotion(float scale, float duration)
        {
            isSlowMotion = true;
            Time.timeScale = scale;
            Time.fixedDeltaTime = 0.02f * Time.timeScale;
            Invoke(nameof(EndSlowMotion), duration);
        }

        void EndSlowMotion()
        {
            isSlowMotion = false;
            Time.timeScale = 1f;
            Time.fixedDeltaTime = 0.02f;
        }

        public float GetStoneWeight() => currentStone != null ? currentStone.weight : 1f;
        public float GetStoneSize() => currentStone != null ? currentStone.size : 0.5f;
    }
}