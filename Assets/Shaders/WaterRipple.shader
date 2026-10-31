Shader "Custom/WaterRipple"
{
    Properties
    {
        _Color ("Màu Sóng", Color) = (1,1,1,0.5)
        _Radius ("Bán Kính", Float) = 1
        _Opacity ("Độ Trong Suối", Float) = 1
        _Center ("Tâm", Vector) = (0,0,0,0)
    }

    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        LOD 100

        Pass
        {
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha
            Cull Off

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
                float worldDist : TEXCOORD1;
            };

            float4 _Color;
            float _Radius;
            float _Opacity;
            float4 _Center;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                float3 worldPos = mul(unity_ObjectToWorld, v.vertex);
                o.worldDist = distance(worldPos.xz, _Center.xz);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Chỉ vẽ vòng sóng ở bán kính cụ thể
                float dist = i.worldDist;
                float ripple = smoothstep(_Radius - 0.1, _Radius, dist) *
                              smoothstep(_Radius, _Radius - 0.1, dist);

                fixed4 col = _Color;
                col.a = ripple * _Opacity;

                return col;
            }
            ENDCG
        }
    }
}