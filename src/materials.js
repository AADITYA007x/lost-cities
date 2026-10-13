import * as THREE from 'three';

// Indus bricks keep a 1 : 2 : 4 ratio (thickness : width : length).
// Common house bricks at Mohenjo-daro are roughly 7 x 14 x 28 cm.
export const BRICK = {
  length: 0.28,
  width: 0.14,
  height: 0.07,
  joint: 0.008,
};

const NOISE_GLSL = `
  float mdHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float mdNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mdHash(i);
    float b = mdHash(i + vec2(1.0, 0.0));
    float c = mdHash(i + vec2(0.0, 1.0));
    float d = mdHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float mdFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * mdNoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

function addWorldVaryings(shader) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vMdPos;
      varying vec3 vMdNormal;`
    )
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vMdPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vMdNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );
}

// ---------- certainty layer ----------
// Evidence variants of a material: "ghost" (inferred: translucent with soft edges) and
// "sketch" (imagined: faint fill, drawn edges). uMix runs from 0 (the living city)
// to 1 (the evidence view); the shared uniform object lets one animation drive all.
export const EVIDENCE_LOOK = {
  ghost: { tint: new THREE.Color('#ead8b8'), tintAmount: 0.7, fill: 0.22, line: 0.62 },
  sketch: { tint: new THREE.Color('#f3e7d2'), tintAmount: 1.0, fill: 0.025, line: 0.5 },
};

function addEvidence(shader, evidence, mixUniform) {
  if (!evidence) return;
  const look = EVIDENCE_LOOK[evidence];
  shader.uniforms.uMix = mixUniform;
  shader.uniforms.uTint = { value: look.tint };
  shader.uniforms.uTintAmount = { value: look.tintAmount };
  shader.uniforms.uFill = { value: look.fill };
  shader.uniforms.uLine = { value: look.line };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      attribute vec2 aQuad;
      varying vec2 vQuad;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vQuad = aQuad;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec2 vQuad;
      uniform float uMix;
      uniform vec3 uTint;
      uniform float uTintAmount;
      uniform float uFill;
      uniform float uLine;`)
    .replace('#include <emissivemap_fragment>', `
      {
        // edges of each face, about 1.3 px wide on screen
        vec2 fwq = max(fwidth(vQuad), vec2(1e-4));
        vec2 e = min(vQuad, 1.0 - vQuad) / fwq;
        float edgeLine = 1.0 - smoothstep(0.6, 1.6, min(e.x, e.y));
        // far away, faces are only a few pixels across and their edges would pile up
        float tiny = smoothstep(0.06, 0.35, max(fwq.x, fwq.y));
        edgeLine *= 1.0 - 0.85 * tiny;
        vec3 evidenceColor = mix(diffuseColor.rgb, uTint, uTintAmount);
        diffuseColor.rgb = mix(diffuseColor.rgb, evidenceColor, uMix);
        diffuseColor.a *= mix(1.0, mix(uFill, uLine, edgeLine), uMix);
      }
      #include <emissivemap_fragment>`);
}

function evidenceSetup(material, evidence) {
  if (!evidence) return;
  material.transparent = true;
  material.depthWrite = false;
}

// A MeshStandardMaterial that paints bricks at real size from world position,
// so every wall, whatever its size, gets correctly scaled courses (English bond:
// a course of stretchers, then a course of headers). Joints fade out with
// distance to avoid shimmering.
export function createBrickMaterial({ tone = '#b5774c', evidence = null, mixUniform = null } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tone),
    roughness: 0.94,
    metalness: 0.0,
  });
  evidenceSetup(material, evidence);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBrickL = { value: BRICK.length + BRICK.joint };
    shader.uniforms.uBrickW = { value: BRICK.width + BRICK.joint };
    shader.uniforms.uCourse = { value: BRICK.height + BRICK.joint };
    shader.uniforms.uJoint = { value: BRICK.joint };

    addWorldVaryings(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMdPos;
        varying vec3 vMdNormal;
        uniform float uBrickL;
        uniform float uBrickW;
        uniform float uCourse;
        uniform float uJoint;
        ${NOISE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 n = normalize(vMdNormal);
          vec2 q;
          vec2 size;
          float rowId;

          if (abs(n.y) > 0.6) {
            size = vec2(uBrickL, uBrickW);
            rowId = floor(vMdPos.z / size.y);
            float shift = mod(rowId, 2.0) * 0.5 * size.x;
            q = vec2(vMdPos.x + shift, vMdPos.z) / size;
          } else {
            float u = abs(n.x) > abs(n.z) ? vMdPos.z : vMdPos.x;
            rowId = floor(vMdPos.y / uCourse);
            bool header = mod(rowId, 2.0) > 0.5;
            float unit = header ? uBrickW : uBrickL;
            float shift = header ? 0.5 * uBrickW : 0.0;
            size = vec2(unit, uCourse);
            q = vec2(u + shift, vMdPos.y) / size;
          }

          vec2 cell = floor(q);
          vec2 local = fract(q);
          vec2 fw = fwidth(q);

          vec2 jointFrac = uJoint / size;
          vec2 edge = min(local, 1.0 - local);
          vec2 soft = max(jointFrac * 0.5, fw);
          float jx = smoothstep(jointFrac.x - soft.x, jointFrac.x + soft.x, edge.x);
          float jy = smoothstep(jointFrac.y - soft.y, jointFrac.y + soft.y, edge.y);
          float brickMask = jx * jy;

          // Far away (bricks only a few pixels big) fade to an average tone.
          float far = smoothstep(0.12, 0.4, max(fw.x, fw.y));
          brickMask = mix(brickMask, 0.9, far);

          float h = mdHash(cell + n.xz * 7.0);
          float h2 = mdHash(cell.yx + 17.0 + n.xz * 3.0);
          float varAmt = 1.0 - far;
          vec3 base = diffuseColor.rgb;
          vec3 tone = base * mix(1.0, mix(0.82, 1.1, h), varAmt);
          tone = mix(tone, tone * vec3(1.05, 0.93, 0.86), step(0.84, h2) * varAmt);
          tone = mix(tone, tone * vec3(0.9, 0.9, 0.92), step(h2, 0.07) * varAmt);

          float grain = mdNoise(vMdPos.xy * 40.0 + vMdPos.zz * 40.0) * 0.1;
          tone *= 0.95 + grain;

          float footing = smoothstep(0.8, 0.0, vMdPos.y) * 0.16;
          float weather = mdFbm(vMdPos.xz * 0.45 + vMdPos.y * 0.25) * 0.16;
          tone *= 1.0 - footing - weather + 0.06;

          vec3 mortar = base * vec3(0.78, 0.72, 0.68) * (0.92 + grain);
          diffuseColor.rgb = mix(mortar, tone, brickMask);
        }`
      );
    addEvidence(shader, evidence, mixUniform);
  };

  material.customProgramCacheKey = () => `md-brick-v2-${evidence || 'solid'}`;
  return material;
}

// Dusty, trodden earth with soft large-scale variation.
export function createEarthMaterial({ tone = '#a8845f', evidence = null, mixUniform = null } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tone),
    roughness: 1.0,
    metalness: 0.0,
  });
  evidenceSetup(material, evidence);

  material.onBeforeCompile = (shader) => {
    addWorldVaryings(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMdPos;
        varying vec3 vMdNormal;
        ${NOISE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vMdPos.xz;
          float vast = mdFbm(p * 0.0025 + 3.0);
          float broad = mdFbm(p * 0.06);
          float mid = mdFbm(p * 0.45 + 11.0);
          float fine = mdNoise(p * 9.0);
          float fw = length(fwidth(p * 9.0));
          fine = mix(fine, 0.5, smoothstep(0.4, 1.2, fw));
          vec3 c = diffuseColor.rgb;
          c *= 0.84 + vast * 0.26;
          c *= 0.9 + broad * 0.16;
          c = mix(c, c * vec3(0.92, 0.9, 0.86), smoothstep(0.55, 0.75, mid));
          c *= 0.95 + fine * 0.1;
          diffuseColor.rgb = c;
        }`
      );
    addEvidence(shader, evidence, mixUniform);
  };

  material.customProgramCacheKey = () => `md-earth-v1-${evidence || 'solid'}`;
  return material;
}
