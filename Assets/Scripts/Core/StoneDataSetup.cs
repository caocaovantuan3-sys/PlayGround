using UnityEngine;
using System.Collections.Generic;

namespace StoneThrowing
{
    public class StoneDataSetup : MonoBehaviour
    {
        [Header("Stone Prefabs")]
        public GameObject pebblePrefab;
        public GameObject flatStonePrefab;
        public GameObject roundStonePrefab;
        public GameObject bigStonePrefab;
        public GameObject coloredStonePrefab;

        [Header("Materials")]
        public Material pebbleMaterial;
        public Material flatMaterial;
        public Material roundMaterial;
        public Material bigMaterial;
        public Material coloredMaterial;

        public void SetupStoneTypes(GameManager gm)
        {
            gm.stoneTypes.Clear();

            // Đá cuội nhỏ
            gm.stoneTypes.Add(new StoneData
            {
                type = StoneType.Pebble,
                displayName = "Đá Cuội Nhỏ",
                prefab = pebblePrefab,
                size = 0.3f,
                weight = 0.2f,
                bounciness = 0.3f,
                drag = 0.1f,
                stoneColor = new Color(0.6f, 0.5f, 0.4f),
                material = pebbleMaterial
            });

            // Đá dẹt
            gm.stoneTypes.Add(new StoneData
            {
                type = StoneType.Flat,
                displayName = "Đá Dẹt",
                prefab = flatStonePrefab,
                size = 0.5f,
                weight = 0.15f,
                bounciness = 0.8f,
                drag = 0.05f,
                stoneColor = new Color(0.5f, 0.5f, 0.6f),
                material = flatMaterial
            });

            // Đá tròn
            gm.stoneTypes.Add(new StoneData
            {
                type = StoneType.Round,
                displayName = "Đá Tròn",
                prefab = roundStonePrefab,
                size = 0.4f,
                weight = 0.3f,
                bounciness = 0.4f,
                drag = 0.15f,
                stoneColor = new Color(0.4f, 0.4f, 0.4f),
                material = roundMaterial
            });

            // Đá lớn
            gm.stoneTypes.Add(new StoneData
            {
                type = StoneType.Big,
                displayName = "Đá Lớn",
                prefab = bigStonePrefab,
                size = 0.8f,
                weight = 1.0f,
                bounciness = 0.2f,
                drag = 0.2f,
                stoneColor = new Color(0.5f, 0.5f, 0.5f),
                material = bigMaterial
            });

            // Đá màu
            gm.stoneTypes.Add(new StoneData
            {
                type = StoneType.Colored,
                displayName = "Đá Màu",
                prefab = coloredStonePrefab,
                size = 0.45f,
                weight = 0.25f,
                bounciness = 0.5f,
                drag = 0.12f,
                stoneColor = Random.ColorHSV(),
                material = coloredMaterial
            });

            Debug.Log($"Đã thiết lập {gm.stoneTypes.Count} loại đá");
        }
    }
}