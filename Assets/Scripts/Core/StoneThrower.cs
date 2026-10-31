using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace StoneThrowing
{
    public class StoneThrower : MonoBehaviour
    {
        [Header("Throw Settings")]
        public float minThrowForce = 5f;
        public float maxThrowForce = 40f;
        public float forceMultiplier = 2f;
        public float maxSwipeTime = 1f;
        public float minSwipeDistance = 10f;
        public LayerMask waterLayer;
        public Transform aimLineOrigin;
        public LineRenderer aimLine;

        [Header("UI")]
        public Slider powerSlider;
        public GameObject powerSliderUI;
        public TextMeshProUGUI powerText;

        private Vector2 touchStartPos;
        private Vector2 touchEndPos;
        private float touchStartTime;
        private bool isDragging = false;
        private bool canThrow = false;

        void Update()
        {
            if (GameManager.Instance.currentState != GameState.Aiming)
            {
                HideAimLine();
                powerSliderUI.SetActive(false);
                return;
            }

            HandleTouchInput();

            if (isDragging)
            {
                UpdateAimLine();
                UpdatePowerUI();
            }
        }

        void HandleTouchInput()
        {
            if (Input.touchCount > 0)
            {
                Touch touch = Input.GetTouch(0);

                if (EventSystem.current.IsPointerOverGameObject(touch.fingerId))
                    return;

                switch (touch.phase)
                {
                    case TouchPhase.Began:
                        touchStartPos = touch.position;
                        touchEndPos = touch.position;
                        touchStartTime = Time.time;
                        isDragging = true;
                        canThrow = false;
                        powerSliderUI.SetActive(true);
                        break;

                    case TouchPhase.Moved:
                    case TouchPhase.Stationary:
                        touchEndPos = touch.position;
                        break;

                    case TouchPhase.Ended:
                        if (isDragging && Time.time - touchStartTime <= maxSwipeTime)
                        {
                            PerformThrow();
                        }
                        isDragging = false;
                        canThrow = false;
                        powerSliderUI.SetActive(false);
                        HideAimLine();
                        break;
                }
            }

            // Hỗ trợ phím để test trên PC
            if (Input.GetMouseButtonDown(0))
            {
                if (EventSystem.current.IsPointerOverGameObject()) return;
                touchStartPos = Input.mousePosition;
                touchEndPos = Input.mousePosition;
                touchStartTime = Time.time;
                isDragging = true;
                powerSliderUI.SetActive(true);
            }

            if (Input.GetMouseButton(0) && isDragging)
            {
                touchEndPos = Input.mousePosition;
            }

            if (Input.GetMouseButtonUp(0) && isDragging)
            {
                if (Time.time - touchStartTime <= maxSwipeTime)
                {
                    PerformThrow();
                }
                isDragging = false;
                canThrow = false;
                powerSliderUI.SetActive(false);
                HideAimLine();
            }
        }

        void UpdateAimLine()
        {
            Vector2 swipe = touchEndPos - touchStartPos;
            if (swipe.magnitude < minSwipeDistance)
            {
                HideAimLine();
                return;
            }

            Vector3 dir = GetThrowDirection(swipe);
            float force = CalculateForce(swipe);

            if (aimLine != null && aimLineOrigin != null)
            {
                aimLine.positionCount = 2;
                aimLine.SetPosition(0, aimLineOrigin.position);
                Vector3 endPos = aimLineOrigin.position + dir * (force * 0.1f);
                aimLine.SetPosition(1, endPos);
                aimLine.enabled = true;
            }
        }

        void UpdatePowerUI()
        {
            Vector2 swipe = touchEndPos - touchStartPos;
            float force = CalculateForce(swipe);
            float normalized = Mathf.InverseLerp(minThrowForce, maxThrowForce, force);

            if (powerSlider != null)
                powerSlider.value = normalized;

            if (powerText != null)
                powerText.text = $"LỰC NÉM: {force:F1}";
        }

        void PerformThrow()
        {
            if (!canThrow)
            {
                Vector2 swipe = touchEndPos - touchStartPos;
                if (swipe.magnitude < minSwipeDistance) return;

                float force = CalculateForce(swipe);
                Vector3 direction = GetThrowDirection(swipe);

                GameManager.Instance.ThrowStone(direction, force);
                canThrow = true;
            }
        }

        Vector3 GetThrowDirection(Vector2 swipe)
        {
            // Chuyển vector vuốt 2D thành hướng 3D theo camera
            Camera cam = Camera.main;
            Vector3 forward = cam.transform.forward;
            forward.y = 0f;
            forward.Normalize();

            Vector3 right = cam.transform.right;
            right.y = 0f;
            right.Normalize();

            float swipeX = swipe.x / Screen.width;
            float swipeY = swipe.y / Screen.height;

            Vector3 dir = forward * swipeY + right * swipeX;
            dir.y = Mathf.Clamp01(swipeY * 0.5f + 0.5f); // Hướng lên trên khi vuốt lên
            dir.Normalize();

            return dir;
        }

        float CalculateForce(Vector2 swipe)
        {
            float distance = swipe.magnitude;
            float time = Mathf.Max(Time.time - touchStartTime, 0.01f);
            float speed = distance / time;

            float force = Mathf.Clamp(speed * forceMultiplier * 0.1f, minThrowForce, maxThrowForce);
            return force;
        }

        void HideAimLine()
        {
            if (aimLine != null)
                aimLine.enabled = false;
        }

        public void OnThrowButtonPressed()
        {
            if (GameManager.Instance.currentState == GameState.Aiming)
            {
                // Ném với lực mặc định từ slider
                float force = Mathf.Lerp(minThrowForce, maxThrowForce,
                    powerSlider != null ? powerSlider.value : 0.5f);
                Vector3 dir = Camera.main.transform.forward;
                dir.y = 0.5f;
                dir.Normalize();
                GameManager.Instance.ThrowStone(dir, force);
            }
        }
    }
}