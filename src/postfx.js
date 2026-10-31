import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 1.05 },
    uGrain: { value: 0.018 },
    uAberration: { value: 0.0007 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.025 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);
      vec2 warp = centered * (0.0025 + r2 * 0.012);
      vec2 uv = vUv + warp;
      vec2 shift = centered * uAberration;

      vec3 color;
      color.r = texture2D(tDiffuse, uv + shift).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - shift).b;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation);
      color = (color - 0.5) * uContrast + 0.5;

      float aspect = uResolution.x / max(1.0, uResolution.y);
      vec2 vp = centered * vec2(aspect, 1.0);
      float vig = 1.0 - smoothstep(0.18, 0.86, length(vp));
      color *= mix(1.0, vig, uVignette * 0.42);

      // Very fine animated film grain in highlights only.
      float grain = hash(vUv * uResolution + fract(uTime) * 91.7) - 0.5;
      color += grain * uGrain * (0.22 + luma * 0.78);

      gl_FragColor = vec4(max(vec3(0.0), color), 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, width, height) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;
    this.quality = 'high';
    this.bloomEnabled = true;
    this.dofEnabled = true;
    this.pixelRatio = 1;

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bokehPass = new BokehPass(scene, camera, {
      focus: 240,
      aperture: 0.000018,
      maxblur: 0.0022,
    });
    this.composer.addPass(this.bokehPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.08,
      0.55,
      0.72,
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.gradePass = new ShaderPass(GradeShader);
    this.gradePass.renderToScreen = true;
    this.composer.addPass(this.gradePass);

    this.gradePass.uniforms.uResolution.value.set(width, height);
    this.setSize(width, height);
    this.applyQuality('high');
  }

  setPixelRatio(ratio) {
    this.pixelRatio = ratio;
    this.composer.setPixelRatio(ratio);
    this.setSize(this.width, this.height);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.composer.setSize(width, height);
    this.gradePass.uniforms.uResolution.value.set(width, height);
    this.bloomPass.setSize(width, height);
    this.bokehPass.uniforms.aspect.value = width / Math.max(1, height);
  }

  applyQuality(quality) {
    if (quality === 'auto') return;
    this.quality = quality;
    const cfgs = {
      low: { bloom: false, dof: false, strength: 0.82, radius: 0.48, threshold: 0.78 },
      medium: { bloom: true, dof: false, strength: 0.94, radius: 0.52, threshold: 0.75 },
      high: { bloom: true, dof: true, strength: 1.08, radius: 0.56, threshold: 0.71 },
      ultra: { bloom: true, dof: true, strength: 1.28, radius: 0.64, threshold: 0.66 },
    };
    const cfg = cfgs[quality] || cfgs.high;
    this.bloomPass.strength = cfg.strength;
    this.bloomPass.radius = cfg.radius;
    this.bloomPass.threshold = cfg.threshold;
    this.gradePass.uniforms.uGrain.value = quality === 'low' ? 0.007 : 0.012;
    this.gradePass.uniforms.uAberration.value = quality === 'low' ? 0.00012 : 0.00038;
    this.updatePasses();
  }

  setBloomEnabled(on) {
    this.bloomEnabled = !!on;
    this.updatePasses();
  }

  setDofEnabled(on) {
    this.dofEnabled = !!on;
    this.updatePasses();
  }

  updatePasses() {
    this.bloomPass.enabled = this.bloomEnabled;
    this.bokehPass.enabled = this.dofEnabled;
  }

  setFocus(distance) {
    this.bokehPass.uniforms.focus.value = THREE.MathUtils.clamp(distance, 20, 900);
  }

  setCinemaMode(on) {
    this.gradePass.uniforms.uVignette.value = on ? 1.35 : 1.05;
    this.gradePass.uniforms.uSaturation.value = on ? 1.12 : 1.08;
    this.gradePass.uniforms.uContrast.value = on ? 1.05 : 1.025;
  }

  render(dt, time) {
    this.gradePass.uniforms.uTime.value = time;
    this.composer.render(dt);
  }
}
