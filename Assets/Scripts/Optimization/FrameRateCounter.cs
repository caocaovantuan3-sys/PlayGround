using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace StoneThrowing
{
    public class FrameRateCounter : MonoBehaviour
    {
        public TextMeshProUGUI fpsText;
        public float updateInterval = 0.5f;

        private int frameCount = 0;
        private float timeLeft = 0f;
        private float fps = 0f;

        void Update()
        {
            timeLeft -= Time.deltaTime;
            frameCount++;

            if (timeLeft <= 0f)
            {
                fps = frameCount / updateInterval;
                if (fpsText != null)
                    fpsText.text = $"FPS: {Mathf.RoundToInt(fps)}";

                frameCount = 0;
                timeLeft = updateInterval;

                // Tự động giảm chất lượng nếu FPS quá thấp
                if (QualityManager.Instance != null)
                    QualityManager.Instance.AutoReduceQualityIfNeeded(fps);
            }
        }
    }
}