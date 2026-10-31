using UnityEngine;

namespace StoneThrowing
{
    public class GameInitializer : MonoBehaviour
    {
        [Header("References")]
        public GameManager gameManager;
        public StonePicker stonePicker;
        public StoneThrower stoneThrower;
        public UIManager uiManager;
        public WaterVFXManager vfxManager;
        public EnvironmentManager envManager;
        public QualityManager qualityManager;
        public StoneDataSetup stoneSetup;

        void Awake()
        {
            // Tìm các component nếu chưa gán
            if (gameManager == null) gameManager = FindObjectOfType<GameManager>();
            if (stonePicker == null) stonePicker = FindObjectOfType<StonePicker>();
            if (stoneThrower == null) stoneThrower = FindObjectOfType<StoneThrower>();
            if (uiManager == null) uiManager = FindObjectOfType<UIManager>();
            if (vfxManager == null) vfxManager = FindObjectOfType<WaterVFXManager>();
            if (envManager == null) envManager = FindObjectOfType<EnvironmentManager>();
            if (qualityManager == null) qualityManager = FindObjectOfType<QualityManager>();
            if (stoneSetup == null) stoneSetup = FindObjectOfType<StoneDataSetup>();
        }

        void Start()
        {
            // Thiết lập loại đá
            if (stoneSetup != null && gameManager != null)
                stoneSetup.SetupStoneTypes(gameManager);

            // Khởi động game
            if (uiManager != null)
                uiManager.ShowMenu();

            Debug.Log("=== STONE THROWING 3D – VFX 2.0 ĐÃ KHỞI ĐỘNG ===");
        }
    }
}