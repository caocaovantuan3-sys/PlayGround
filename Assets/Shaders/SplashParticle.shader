Shader "Custom/SplashParticle"
{
    Properties
    {
        _ParticleTex ("Vật Chất", 2D) = "white" {}
        _TintColor ("Màu", Color) = (1,1,1,1)
        _Softness ("Độ Mịn", Range(0,1)) = 1
    }

    Category
    {
        Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" }
        Blend SrcAlpha One
        Cull Off Lighting Off ZWrite Off

        SubShader
        {
            Pass
            {
                Name "FORWARD"
                CGPROGRAM
                #pragma vertex vert
                #pragma fragment frag
                #include "UnityCG.cginc"

                struct appdata
                {
                    float4 vertex : POSITION;
                    fixed4 color : COLOR;
                    float2 texcoord : TEXCOORD0;
                };

                struct v2f
                {
                    fixed4 color : COLOR;
                    float2 texcoord : TEXCOORD0;
                    float4 vertex : SV_POSITION;
                };

                sampler2D _ParticleTex;
                fixed4 _TintColor;
                float _Softness;

                v2f vert (appdata v)
                {
                    v2f o;
                    o.vertex = UnityObjectToClipPos(v.vertex);
                    o.texcoord = v.texcoord;
                    o.color = v.color * _TintColor;
                    return o;
                }

                fixed4 frag (v2f i) : SV_Target
                {
                    fixed4 tex = tex2D(_ParticleTex, i.texcoord);
                    fixed4 col = tex * i.color;

                    // Làm mờ viền hạt nước
                    float alpha = tex.a * i.color.a;
                    alpha *= 1 - saturate(length(i.texcoord - 0.5) * 2 * _Softness);
                    col.a = alpha;

                    return col;
                }
                ENDCG
            }
        }
    }
}