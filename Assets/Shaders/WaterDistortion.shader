Shader "Custom/WaterDistortion"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _DistortionStrength ("Cường Độ", Float) = 0.1
        _Center ("Tâm", Vector) = (0,0,0,0)
        _Radius ("Bán Kính", Float) = 1
        _Opacity ("Độ Trong Suối", Float) = 1
    }

    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        LOD 200

        Pass
        {
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            float _DistortionStrength;
            float4 _Center;
            float _Radius;
            float _Opacity;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Tính khoảng cách từ tâm
                float2 centerUV = _Center.xy;
                float dist = distance(i.uv, centerUV);

                // Hiệu ứng vặn ngoài bên trong bán kính
                float distortion = 0;
                if (dist < _Radius)
                {
                    float t = 1 - dist / _Radius;
                    distortion = sin(_Time.y * 10 + dist * 20) * _DistortionStrength * t * t;
                }

                fixed2 distortedUV = i.uv + float2(distortion, -distortion);
                fixed4 col = tex2D(_MainTex, distortedUV);
                col.a *= _Opacity * (1 - dist / _Radius);

                return col;
            }
            ENDCG
        }
    }
}