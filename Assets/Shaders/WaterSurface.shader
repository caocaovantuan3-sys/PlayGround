Shader "Custom/WaterSurface"
{
    Properties
    {
        _Color ("Màu Nước", Color) = (0.1, 0.4, 0.7, 1)
        _WaveHeight ("Chiều Cao Sóng", Float) = 0.1
        _WaveSpeed ("Tốc Độ Sóng", Float) = 1
        _WaveScale ("Kích Thước Sóng", Float) = 10
        _Time ("Thời gian", Float) = 0
        _DistortionAmount ("Biến Dạng", Float) = 0.05
        _DistortionStrength ("Cường Độ Biến Dạng", Float) = 0
        _ReflectionTex ("Ảnh Phản Chiếu", 2D) = "white" {}
        _RefractionTex ("Ảnh Gấp Sóng", 2D) = "white" {}
        _CausticsTex ("Ảnh Caustics", 2D) = "white" {}
        _CausticsOffset ("Vị Trí Caustics", Vector) = (0,0,0,0)
        _CausticsIntensity ("Cường Độ Caustics", Float) = 0.3
        _FoamColor ("Màu Bọt", Color) = (1,1,1,1)
        _FoamTiling ("O tiling Bọt", Float) = 5
    }

    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        LOD 400

        Pass
        {
            Name "ForwardBase"
            Tags { "LightMode" = "ForwardBase" }

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
                float3 worldPos : TEXCOORD1;
                float3 worldNormal : TEXCOORD2;
            };

            float4 _Color;
            float _WaveHeight;
            float _WaveSpeed;
            float _WaveScale;
            float _Time;
            float _DistortionAmount;
            float _DistortionStrength;
            float _CausticsIntensity;
            float4 _CausticsOffset;

            v2f vert (appdata v)
            {
                v2f o;

                // Gerstner waves approximation
                float3 pos = v.vertex;
                float3 worldPos = mul(unity_ObjectToWorld, float4(pos, 1));

                // Tính toán sóng đa lớp
                float wave = 0;
                for (int i = 0; i < 4; i++)
                {
                    float4 waveParam = _Wave0 + float4(i*4, 0, 0, 0); // Simplified
                    wave += sin((worldPos.x + worldPos.z) * _WaveScale + _Time * _WaveSpeed + waveParam.z) *
                            waveParam.y * _WaveHeight;
                }

                pos.y += wave;
                worldPos.y += wave;

                o.vertex = UnityObjectToClipPos(pos);
                o.uv = v.uv;
                o.worldPos = worldPos;
                o.worldNormal = v.normal;

                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Màu nước cơ bản
                fixed3 waterColor = _Color.rgb;

                // Phản chiếu bầu trời
                if (_DistortionStrength > 0)
                {
                    waterColor += tex2D(_ReflectionTex, i.uv + _DistortionStrength).rgb * 0.3;
                }

                // Caustics - ánh sáng khúc xạ dưới nước
                float2 causticsUV = i.uv * _FoamTiling + _CausticsOffset.xy;
                float caustics = tex2D(_CausticsTex, causticsUV).r * _CausticsIntensity;
                waterColor += caustics;

                // Biến dạng mặt nước
                fixed2 distortion = float2(
                    sin(_Time * 2 + i.uv.y * 10) * _DistortionAmount,
                    cos(_Time * 3 + i.uv.x * 10) * _DistortionAmount
                );

                fixed4 finalColor = fixed4(waterColor, _Color.a);
                finalColor.rgb *= 1 + caustics;

                // Fog / depth
                float depth = saturate(i.worldPos.y / 10);
                finalColor.rgb = lerp(finalColor.rgb, _Color.rgb, depth * 0.3);

                return finalColor;
            }
            ENDCG
        }
    }
}