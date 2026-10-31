using UnityEngine;

namespace StoneThrowing
{
    [RequireComponent(typeof(Rigidbody))]
    public class StonePhysics : MonoBehaviour
    {
        [Header("Physics")]
        public float waterDrag = 2f;
        public float airDrag = 0.1f;
        public float skipForceMultiplier = 0.6f;
        public float minSkipVelocity = 2f;
        public float sinkSpeed = 3f;

        [Header("Visual")]
        public TrailRenderer stoneTrail;
        public ParticleSystem wakeParticles;
        public ParticleSystem bubbleParticles;

        [Header("Audio")]
        public AudioSource stoneAudioSource;
        public AudioClip skipSound;
        public AudioClip sinkSound;

        public bool IsInWater { get; private set; }
        public bool IsSinking { get; private set; }

        private Rigidbody rb;
        private Collider stoneCollider;
        private bool hasEnteredWater = false;
        private float waterEntryTime = 0f;
        private Vector3 lastVelocity;
        private int skipCount = 0;

        void Awake()
        {
            rb = GetComponent<Rigidbody>();
            stoneCollider = GetComponent<Collider>();

            if (stoneTrail != null)
                stoneTrail.enabled = true;

            if (wakeParticles != null)
                wakeParticles.Play();
        }

        void FixedUpdate()
        {
            if (rb == null) return;

            lastVelocity = rb.velocity;

            // Lực cản không khí khi bay
            if (!IsInWater)
            {
                rb.drag = airDrag;

                // Xoay viên đá theo hướng bay
                if (rb.velocity.magnitude > 1f)
                {
                    Quaternion targetRot = Quaternion.LookRotation(rb.velocity);
                    rb.MoveRotation(Quaternion.Slerp(rb.rotation, targetRot, Time.fixedDeltaTime * 5f));
                }
            }
        }

        void OnTriggerEnter(Collider other)
        {
            if ((GameManager.Instance.waterLayer.value & (1 << other.gameObject.layer)) != 0)
            {
                EnterWater();
            }
        }

        void OnTriggerStay(Collider other)
        {
            if ((GameManager.Instance.waterLayer.value & (1 << other.gameObject.layer)) != 0)
            {
                ApplyWaterPhysics();
            }
        }

        void OnTriggerExit(Collider other)
        {
            if ((GameManager.Instance.waterLayer.value & (1 << other.gameObject.layer)) != 0)
            {
                ExitWater();
            }
        }

        void EnterWater()
        {
            IsInWater = true;
            hasEnteredWater = true;
            waterEntryTime = Time.time;

            // Thông báo VFX
            if (GameManager.Instance.currentStoneInstance == gameObject)
            {
                float impactForce = rb.velocity.magnitude;
                Vector3 impactPoint = transform.position;
                GameManager.Instance.OnStoneHitWater(impactPoint, impactForce);
            }

            // Giảm drag ngay khi vào nước
            if (rb != null)
                rb.drag = waterDrag;

            Debug.Log("Đá chạm mặt nước!");
        }

        void ApplyWaterPhysics()
        {
            if (rb == null) return;

            // Áp lực nổi đơn giản
            Vector3 buoyancy = Vector3.up * 9.81f * rb.mass * 0.5f;
            rb.AddForce(buoyancy, ForceMode.Acceleration);

            // Drag trong nước cao hơn
            rb.drag = Mathf.Lerp(rb.drag, waterDrag, Time.fixedDeltaTime * 5f);

            // Nếu chậm trong nước, bắt đầu chìm
            if (rb.velocity.magnitude < minSkipVelocity && Time.time - waterEntryTime > 0.5f)
            {
                StartSinking();
            }
        }

        void StartSinking()
        {
            if (IsSinking) return;
            IsSinking = true;

            if (rb != null)
            {
                rb.useGravity = false;
                rb.velocity = Vector3.zero;
                rb.angularVelocity = Vector3.zero;
            }

            StartCoroutine(SinkCoroutine());
        }

        IEnumerator SinkCoroutine()
        {
            while (transform.position.y > -10f)
            {
                transform.position += Vector3.down * sinkSpeed * Time.deltaTime;

                // Bọt khí khi chìm
                if (bubbleParticles != null && Random.value < 0.3f)
                {
                    bubbleParticles.Emit(1);
                }

                yield return null;
            }

            // Kết thúc vụ ném
            GameManager.Instance.EndThrow();
        }

        void ExitWater()
        {
            IsInWater = false;
            if (rb != null)
                rb.drag = airDrag;
        }

        // Kiểm tra nảy trên mặt nước (skip)
        public void CheckWaterSkip(Vector3 hitPoint, Vector3 hitNormal)
        {
            if (!IsInWater || IsSinking) return;

            float velocityY = Mathf.Abs(rb.velocity.y);
            float stoneWeight = GameManager.Instance.GetStoneWeight();

            // Đá dẹt, nhẹ, vitesse cao -> nảy dễ hơn
            float skipChance = (1f / stoneWeight) * (velocityY / 10f);
            if (Random.value < skipChance * 0.5f && velocityY > minSkipVelocity)
            {
                PerformSkip(hitNormal);
            }
        }

        void PerformSkip(Vector3 normal)
        {
            if (rb == null) return;

            skipCount++;
            GameManager.Instance.OnStoneSkip();

            // Phản xạ velocità
            Vector3 reflect = Vector3.Reflect(rb.velocity, normal);
            reflect.y = Mathf.Abs(reflect.y) * skipForceMultiplier;
            reflect.x *= skipForceMultiplier;
            reflect.z *= skipForceMultiplier;

            rb.velocity = reflect;
            rb.AddForce(Vector3.up * 5f, ForceMode.Impulse);

            // Phát âm thanh nảy
            if (stoneAudioSource != null && skipSound != null)
                stoneAudioSource.PlayOneShot(skipSound);

            // VFX nước nhỏ tại điểm nảy
            WaterVFXManager.Instance.SpawnSmallSplash(transform.position, 0.3f);

            Debug.Log($"Lần nảy {skipCount}");
        }

        void OnCollisionEnter(Collision collision)
        {
            // Va chạm với mặt nước (nếu dùng collider thay vì trigger)
            if ((GameManager.Instance.waterLayer.value & (1 << collision.gameObject.layer)) != 0)
            {
                ContactPoint contact = collision.contacts[0];
                CheckWaterSkip(contact.point, contact.normal);
            }
        }
    }
}