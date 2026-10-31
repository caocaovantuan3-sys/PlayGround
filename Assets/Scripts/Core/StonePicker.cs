using UnityEngine;
using UnityEngine.EventSystems;
using System.Collections;

namespace StoneThrowing
{
    public class StonePicker : MonoBehaviour
    {
        [Header("Pick Settings")]
        public LayerMask stoneLayer;
        public LayerMask groundLayer;
        public float pickDistance = 5f;
        public Transform handParent;
        public Animator handAnimator;
        public float pickUpDuration = 0.5f;

        [Header("Hand Animation")]
        public float fingerCurlSpeed = 2f;
        public float wristRotateSpeed = 2f;
        public Vector3 holdPosition = new Vector3(0.1f, -0.05f, 0.15f);
        public Vector3 holdRotation = new Vector3(10f, 0f, 0f);

        private GameObject hoveredStone;
        private GameObject heldStone;
        private StoneThrowing.StoneData heldStoneData;
        private bool isPicking = false;
        private Vector3 originalStonePos;
        private Quaternion originalStoneRot;

        void Update()
        {
            if (GameManager.Instance.currentState != GameState.Picking)
                return;

            if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began)
            {
                if (EventSystem.current.IsPointerOverGameObject(Input.GetTouch(0).fingerId))
                    return;

                Ray ray = Camera.main.ScreenPointToRay(Input.GetTouch(0).position);
                HandlePickRaycast(ray);
            }

            if (Input.GetMouseButtonDown(0))
            {
                if (EventSystem.current.IsPointerOverGameObject())
                    return;

                Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
                HandlePickRaycast(ray);
            }

            UpdateHandAnimation();
        }

        void HandlePickRaycast(Ray ray)
        {
            if (Physics.Raycast(ray, out RaycastHit hit, pickDistance, stoneLayer))
            {
                StoneData stoneData = hit.collider.GetComponent<StoneData>();
                if (stoneData != null)
                {
                    PickUpStone(hit.collider.gameObject, stoneData);
                }
            }
        }

        void PickUpStone(GameObject stoneObj, StoneData data)
        {
            if (isPicking) return;
            isPicking = true;

            heldStone = stoneObj;
            heldStoneData = data;
            originalStonePos = stoneObj.transform.position;
            originalStoneRot = stoneObj.transform.rotation;

            // Hiệu ứng nhặt mượt
            StartCoroutine(PickUpCoroutine(stoneObj, data));
        }

        IEnumerator PickUpCoroutine(GameObject stoneObj, StoneData data)
        {
            float elapsed = 0f;
            Rigidbody rb = stoneObj.GetComponent<Rigidbody>();
            if (rb != null)
                rb.isKinematic = true;

            // Animation ngón tay co lại
            if (handAnimator != null)
                handAnimator.SetTrigger("Grab");

            while (elapsed < pickUpDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / pickUpDuration;
                t = t * t * (3f - 2f * t); // Smoothstep

                if (stoneObj != null && handParent != null)
                {
                    stoneObj.transform.position = Vector3.Lerp(originalStonePos,
                        handParent.position + handParent.TransformVector(holdPosition), t);
                    stoneObj.transform.rotation = Quaternion.Lerp(originalStoneRot,
                        handParent.rotation * Quaternion.Euler(holdRotation), t);
                    stoneObj.transform.localScale = Vector3.one * data.size;
                }
                yield return null;
            }

            // Gán đá vào tay
            if (stoneObj != null && handParent != null)
            {
                stoneObj.transform.SetParent(handParent);
                stoneObj.transform.localPosition = holdPosition;
                stoneObj.transform.localRotation = Quaternion.Euler(holdRotation);
            }

            // Thông báo cho GameManager
            GameManager.Instance.OnStonePicked(stoneObj, data);
            isPicking = false;
        }

        void UpdateHandAnimation()
        {
            if (handAnimator == null) return;

            if (heldStone != null)
            {
                // Cầm nắm tự nhiên
                float curl = Mathf.Lerp(handAnimator.GetFloat("FingerCurl"), 1f, Time.deltaTime * fingerCurlSpeed);
                handAnimator.SetFloat("FingerCurl", curl);

                // Xoay cổ tay nhẹ theo di chuyển
                float wristX = Mathf.Sin(Time.time * wristRotateSpeed) * 5f;
                handAnimator.SetFloat("WristRotation", wristX);
            }
            else
            {
                float curl = Mathf.Lerp(handAnimator.GetFloat("FingerCurl"), 0f, Time.deltaTime * fingerCurlSpeed);
                handAnimator.SetFloat("FingerCurl", curl);
            }
        }

        public void DropStone()
        {
            if (heldStone != null && handParent != null)
            {
                heldStone.transform.SetParent(null);
                Rigidbody rb = heldStone.GetComponent<Rigidbody>();
                if (rb != null)
                    rb.isKinematic = false;

                heldStone = null;
                heldStoneData = null;
            }
        }

        public StoneData GetHeldStoneData() => heldStoneData;
    }
}