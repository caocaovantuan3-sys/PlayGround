Shader "Custom/Stone"
{
    Properties
    {
        _Color ("Màu Đá", Color) = (0.7, 0.7, 0.7, 1)
        _MainTex ("Văn Bản Đá", 2D) = "white" {}
        _BumpMap ("Map Núi", 2D) = "bump" {}
        _Metallic ("Kim Loại", Range(0,1)) = 0.1
        _Smoothness ("Mịn", Range(0,1)) = 0.3
        _Size ("Kích Thước", Float) = 1
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200

        Pass
        {
            Name "ForwardBase"
            Tags { "LightMode" = "ForwardBase" }

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            #include "Lighting.cginc"

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
                float3 worldNormal : TEXCOORD1;
                float3 worldPos : TEXCOORD2;
            };

            sampler2D _MainTex;
            sampler2D _BumpMap;
            float4 _Color;
            float _Metallic;
            float _Smoothness;
            float _Size;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv * _Size;
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 texCol = tex2D(_MainTex, i.uv) * _Color;
                fixed3 normal = UnpackNormal(tex2D(_BumpMap, i.uv));
                normal = normalize(i.worldNormal);

                // Ánh sáng đơn giản
                fixed3 lightDir = normalize(_WorldSpaceLightPos0.xyz);
                fixed diff = max(0, dot(normal, lightDir));
                fixed3 ambient = fixed3(0.3, 0.3, 0.35);

                fixed3 result = ambient + texCol.rgb * diff * 0.7;
                result += texCol.rgb * _Metallic * 0.3;

                return fixed4(result, texCol.a * _Smoothness);
            }
            ENDCG
        }
    }
}