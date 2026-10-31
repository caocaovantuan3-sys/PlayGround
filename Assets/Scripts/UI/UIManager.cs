using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace StoneThrowing
{
    public class UIManager : MonoBehaviour
    {
        [Header("Panels")]
        public GameObject menuPanel;
        public GameObject hudPanel;
        public GameObject resultPanel;
        public GameObject settingsPanel;

        [Header("Buttons")]
        public Button pickUpButton;
        public Button throwButton;
        public Button resetButton;
        public Button settingsButton;
        public Button soundButton;
        public Button graphicsButton;
        public Button backButton;

        [Header("HUD")]
        public Slider powerSlider;
        public TextMeshProUGUI powerText;
        public TextMeshProUGUI scoreText;
        public TextMeshProUGUI distanceText;
        public TextMeshProUGUI skipsText;
        public TextMeshProUGUI throwsText;

        [Header("Result")]
        public TextMeshProUGUI resultScoreText;
        public TextMeshProUGUI resultDistanceText;
        public TextMeshProUGUI resultSkipsText;
        public TextMeshProUGUI resultBestText;

        [Header("Settings")]
        public Toggle soundToggle;
        public Toggle musicToggle;
        public Dropdown graphicsDropdown;
        public Button applyGraphicsButton;

        [Header("Mobile")]
        public RectContextual joystickArea;

        void Awake()
        {
            // Bind button events
            if (pickUpButton != null)
                pickUpButton.onClick.AddListener(OnPickUpClicked);

            if (throwButton != null)
                throwButton.onClick.AddListener(OnThrowClicked);

            if (resetButton != null)
                resetButton.onClick.AddListener(OnResetClicked);

            if (settingsButton != null)
                settingsButton.onClick.AddListener(OpenSettings);

            if (soundButton != null)
                soundButton.onClick.AddListener(ToggleSound);

            if (graphicsButton != null)
                graphicsButton.onClick.AddListener(OpenGraphics);

            if (backButton != null)
                backButton.onClick.AddListener(CloseSettings);

            if (applyGraphicsButton != null)
                applyGraphicsButton.onClick.AddListener(ApplyGraphicsSettings);

            if (graphicsDropdown != null)
                graphicsDropdown.onValueChanged.AddListener(OnGraphicsChanged);
        }

        void Start()
        {
            ShowMenu();
            HideSettings();
            UpdateHUD();
        }

        void OnPickUpClicked()
        {
            if (GameManager.Instance.currentState == GameState.Menu ||
                GameManager.Instance.currentState == GameState.Result)
            {
                GameManager.Instance.StartPicking();
            }
        }

        void OnThrowClicked()
        {
            StoneThrower thrower = FindObjectOfType<StoneThrower>();
            if (thrower != null)
                thrower.OnThrowButtonPressed();
        }

        void OnResetClicked()
        {
            GameManager.Instance.ResetGame();
        }

        void OpenSettings()
        {
            settingsPanel.SetActive(true);
            hudPanel.SetActive(false);
            Time.timeScale = 0f;
        }

        void CloseSettings()
        {
            settingsPanel.SetActive(false);
            hudPanel.SetActive(true);
            Time.timeScale = 1f;
        }

        void ToggleSound()
        {
            AudioListener.pause = !AudioListener.pause;
            AudioManager.Instance.ToggleMute();
        }

        void OpenGraphics()
        {
            settingsPanel.SetActive(true);
        }

        void OnGraphicsChanged(int index)
        {
            QualityManager.Instance.SetQualityLevel(index);
        }

        void ApplyGraphicsSettings()
        {
            QualityManager.Instance.ApplyQualitySettings();
            CloseSettings();
        }

        public void ShowMenu()
        {
            if (menuPanel != null) menuPanel.SetActive(true);
            if (hudPanel != null) hudPanel.SetActive(false);
            if (resultPanel != null) resultPanel.SetActive(false);
            if (pickUpButton != null) pickUpButton.SetActive(true);
            if (throwButton != null) throwButton.SetActive(false);
            if (resetButton != null) resetButton.SetActive(false);
        }

        public void ShowHUD()
        {
            if (menuPanel != null) menuPanel.SetActive(false);
            if (hudPanel != null) hudPanel.SetActive(true);
            if (resultPanel != null) resultPanel.SetActive(false);
            if (pickUpButton != null) pickUpButton.SetActive(false);
            if (throwButton != null) throwButton.SetActive(true);
            if (resetButton != null) resetButton.SetActive(false);
            UpdateHUD();
        }

        public void ShowResult()
        {
            if (menuPanel != null) menuPanel.SetActive(false);
            if (hudPanel != null) hudPanel.SetActive(false);
            if (resultPanel != null) resultPanel.SetActive(true);
            if (pickUpButton != null) pickUpButton.SetActive(false);
            if (throwButton != null) throwButton.SetActive(false);
            if (resetButton != null) resetButton.SetActive(true);

            if (resultScoreText != null)
                resultScoreText.text = "ĐIỂM: " + GameManager.Instance.totalScore;
            if (resultDistanceText != null)
                resultDistanceText.text = "KHOẢNG CÁCH: " + GameManager.Instance.maxDistance.ToString("F1") + " m";
            if (resultSkipsText != null)
                resultSkipsText.text = "LẦN NẤY: " + GameManager.Instance.currentSkips;
            if (resultBestText != null)
                resultBestText.text = "CAO NHẤT: " + GameManager.Instance.maxSkips + " lần";
        }

        public void UpdateHUD()
        {
            if (scoreText != null) scoreText.text = "ĐIỂM: " + GameManager.Instance.totalScore;
            if (distanceText != null) distanceText.text = "KHOẢNG CÁCH: " + GameManager.Instance.maxDistance.ToString("F1") + " m";
            if (skipsText != null) skipsText.text = "LẦN NẤY: " + GameManager.Instance.currentSkips;
            if (throwsText != null) throwsText.text = "LẦN NÉM: " + GameManager.Instance.totalThrows;
        }

        public void HideSettings()
        {
            if (settingsPanel != null) settingsPanel.SetActive(false);
        }
    }
}