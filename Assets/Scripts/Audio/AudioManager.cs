using UnityEngine;
using System.Collections.Generic;

namespace StoneThrowing
{
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Header("Ambience")]
        public AudioSource ambienceSource;
        public AudioClip birdsClip;
        public AudioClip windClip;
        public AudioClip waterClip;

        [Header("SFX")]
        public AudioSource sfxSource;
        public AudioClip stoneFlyClip;
        public AudioClip waterSplashClip;
        public AudioClip waterRippleClip;
        public AudioClip stoneSinkClip;
        public AudioClip stoneSkipClip;

        [Header("3D Audio")]
        public AudioSource spatialSource;
        public float spatialVolume = 1f;

        private bool isMuted = false;
        private float masterVolume = 1f;

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
            PlayAmbience();
        }

        public void PlayAmbience()
        {
            if (ambienceSource == null) return;

            ambienceSource.loop = true;
            ambienceSource.volume = masterVolume * 0.5f;

            // Phát trộn các âm thanh môi trường
            if (birdsClip != null)
            {
                AudioSource birds = gameObject.AddComponent<AudioSource>();
                birds.clip = birdsClip;
                birds.loop = true;
                birds.volume = masterVolume * 0.3f;
                birds.Play();
            }

            if (windClip != null)
            {
                AudioSource wind = gameObject.AddComponent<AudioSource>();
                wind.clip = windClip;
                wind.loop = true;
                wind.volume = masterVolume * 0.2f;
                wind.Play();
            }

            if (waterClip != null)
            {
                ambienceSource.clip = waterClip;
                ambienceSource.Play();
            }
        }

        public void PlayStoneFly()
        {
            if (isMuted) return;
            PlaySpatialSFX(stoneFlyClip, 0.6f);
        }

        public void PlayWaterSplash(Vector3 position)
        {
            if (isMuted) return;
            PlaySpatialSFX(waterSplashClip, 1f, position);
        }

        public void PlayWaterRipple()
        {
            if (isMuted) return;
            PlaySFX(waterRippleClip, 0.4f);
        }

        public void PlayStoneSink()
        {
            if (isMuted) return;
            PlaySpatialSFX(stoneSinkClip, 0.8f);
        }

        public void PlayStoneSkip()
        {
            if (isMuted) return;
            PlaySFX(stoneSkipClip, 0.5f);
        }

        void PlaySFX(AudioClip clip, float volume)
        {
            if (clip == null || sfxSource == null) return;
            sfxSource.PlayOneShot(clip, volume * masterVolume);
        }

        void PlaySpatialSFX(AudioClip clip, float volume, Vector3? position = null)
        {
            if (clip == null) return;

            GameObject go = new GameObject("TempAudio");
            if (position.HasValue)
                go.transform.position = position.Value;

            AudioSource source = go.AddComponent<AudioSource>();
            source.clip = clip;
            source.volume = volume * masterVolume;
            source.spatialBlend = 1f; // 3D sound
            source.dopplerLevel = 0.1f;
            source.Play();

            Destroy(go, clip.length);
        }

        public void ToggleMute()
        {
            isMuted = !isMuted;
            AudioListener.volume = isMuted ? 0f : masterVolume;
        }

        public void SetMasterVolume(float volume)
        {
            masterVolume = Mathf.Clamp01(volume);
            AudioListener.volume = isMuted ? 0f : masterVolume;
        }
    }
}