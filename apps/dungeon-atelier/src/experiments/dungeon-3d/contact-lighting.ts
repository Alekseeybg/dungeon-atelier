import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { createSelectiveBloom } from './selective-bloom'
import type { DungeonEffects } from './effects-settings'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

/** Short-range, depth/normal-aware grounding. No painted wall-border strips or bloom. */
export function createContactLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  fire: THREE.ShaderMaterial,
) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    composer = new EffectComposer(renderer, target),
    beauty = new RenderPass(scene, camera),
    ao = new GTAOPass(scene, camera, 1, 1),
    output = new OutputPass(),
    experimentalOutput = new OutputPass(),
    bloomBlend = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, bloomTexture: { value: null } },
      vertexShader:
        'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform sampler2D tDiffuse;uniform sampler2D bloomTexture;varying vec2 vUv;void main(){vec4 base=texture2D(tDiffuse,vUv);vec3 glow=texture2D(bloomTexture,vUv).rgb;gl_FragColor=vec4(base.rgb+glow,base.a);}',
    })
  let selective: ReturnType<typeof createSelectiveBloom> | undefined,
    size = { width: 1, height: 1 },
    bloomEnabled = false,
    occlusionValid = false,
    occlusionComputations = 0,
    occlusionReuses = 0
  const cachedQuad = new FullScreenQuad(ao.copyMaterial)
  bloomBlend.enabled = false
  // Composite the unlit void after exposure/color conversion, keeping its existing color.
  beauty.clearColor = new THREE.Color(0)
  beauty.clearAlpha = 0
  const background = renderer
    .getClearColor(new THREE.Color())
    .getRGB(new THREE.Color(), THREE.SRGBColorSpace)
  output.uniforms.contactBackground = {
    value: new THREE.Vector3(background.r, background.g, background.b),
  }
  output.material.fragmentShader = output.material.fragmentShader
    .replace(
      'uniform sampler2D tDiffuse;',
      'uniform sampler2D tDiffuse; uniform vec3 contactBackground;',
    )
    .replace(
      'gl_FragColor = texture2D( tDiffuse, vUv );',
      'gl_FragColor = texture2D( tDiffuse, vUv );\nif(gl_FragColor.a<0.001){gl_FragColor=vec4(contactBackground,1.0);return;}',
    )
  // Keep the approved output shader intact. Experimental bloom composites glow over the void.
  experimentalOutput.uniforms.contactBackground = output.uniforms.contactBackground!
  experimentalOutput.material.fragmentShader = output.material.fragmentShader
    .replace(
      'if(gl_FragColor.a<0.001){gl_FragColor=vec4(contactBackground,1.0);return;}',
      'float contactCoverage=step(.001,gl_FragColor.a);',
    )
    .replace(
      /}\s*$/,
      'gl_FragColor.rgb+=contactBackground*(1.-contactCoverage);gl_FragColor.a=1.;\n}',
    )
  experimentalOutput.uniforms.effectSaturation = { value: 1 }
  experimentalOutput.uniforms.effectContrast = { value: 1 }
  experimentalOutput.uniforms.effectTemperature = { value: 0 }
  experimentalOutput.material.fragmentShader = experimentalOutput.material.fragmentShader
    .replace(
      'uniform vec3 contactBackground;',
      'uniform vec3 contactBackground; uniform float effectSaturation;uniform float effectContrast;uniform float effectTemperature;',
    )
    .replace(
      'gl_FragColor.rgb+=contactBackground',
      `if(contactCoverage>.5){float luminance=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));gl_FragColor.rgb=mix(vec3(luminance),gl_FragColor.rgb,effectSaturation);gl_FragColor.rgb=(gl_FragColor.rgb-.5)*effectContrast+.5;gl_FragColor.rgb*=vec3(1.+effectTemperature*.18,1.,1.-effectTemperature*.18);}
    gl_FragColor.rgb+=contactBackground`,
    )
  experimentalOutput.enabled = false
  ao.blendIntensity = 0.8
  ao.updateGtaoMaterial({
    radius: 0.65,
    thickness: 0.9,
    distanceExponent: 2,
    distanceFallOff: 0.8,
    scale: 1.2,
    samples: 16,
    screenSpaceRadius: false,
  })
  ao.updatePdMaterial({ radius: 3, samples: 8, depthPhi: 4, normalPhi: 5 })
  // Reproducible spatial denoising, independent of scene generation and animation time.
  const noise = ao.pdNoiseTexture.image.data!
  let state = 0x1a7e11
  for (let i = 0; i < noise.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    noise[i] = state >>> 24
  }
  ao.pdNoiseTexture.needsUpdate = true
  const renderAO = ao.render.bind(ao)
  ao.render = (r, write, read, delta, mask) => {
    // Camera, geometry and AO parameters determine occlusion. Flame time and
    // lighting do not: reuse the denoised field, with the original blend shader.
    if (occlusionValid) {
      const autoClear = r.autoClear
      r.autoClear = false
      try {
        r.setRenderTarget(ao.renderToScreen ? null : write)
        ao.copyMaterial.uniforms.tDiffuse!.value =
          ao.output === GTAOPass.OUTPUT.Denoise ? ao.pdRenderTarget.texture : read.texture
        ao.copyMaterial.blending = THREE.NoBlending
        cachedQuad.material = ao.copyMaterial
        cachedQuad.render(r)
        if (ao.output === GTAOPass.OUTPUT.Default) {
          ao.blendMaterial.uniforms.intensity!.value = ao.blendIntensity
          ao.blendMaterial.uniforms.tDiffuse!.value = ao.pdRenderTarget.texture
          cachedQuad.material = ao.blendMaterial
          cachedQuad.render(r)
        }
        occlusionReuses++
      } finally {
        r.autoClear = autoClear
      }
      return
    }
    const excluded: THREE.Object3D[] = []
    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return
      const material = node.material as THREE.Material | THREE.Material[]
      const materials = Array.isArray(material) ? material : [material]
      // Flame cards contribute light/color but must not occlude as solid rectangles.
      if (materials.some((m) => m.transparent && !m.depthWrite)) {
        excluded.push(node)
        node.visible = false
      }
    })
    const shadowAutoUpdate = r.shadowMap.autoUpdate,
      shadowNeedsUpdate = r.shadowMap.needsUpdate
    r.shadowMap.autoUpdate = false
    r.shadowMap.needsUpdate = false
    try {
      renderAO(r, write, read, delta, mask)
      occlusionValid = true
      occlusionComputations++
    } finally {
      r.shadowMap.autoUpdate = shadowAutoUpdate
      r.shadowMap.needsUpdate = shadowNeedsUpdate
      excluded.forEach((node) => {
        node.visible = true
      })
    }
  }
  composer.addPass(beauty)
  composer.addPass(ao)
  composer.addPass(bloomBlend)
  composer.addPass(output)
  composer.addPass(experimentalOutput)
  return {
    invalidate() {
      occlusionValid = false
    },
    configure(intensity: number, radius: number, diagnostic = false) {
      if (ao.gtaoMaterial.uniforms.radius!.value !== radius) occlusionValid = false
      ao.blendIntensity = intensity
      ao.updateGtaoMaterial({ radius })
      ao.output = diagnostic ? GTAOPass.OUTPUT.Denoise : GTAOPass.OUTPUT.Default
    },
    configureBloom(settings: DungeonEffects) {
      bloomEnabled = settings.bloom
      bloomBlend.enabled = bloomEnabled
      output.enabled = !(bloomEnabled || settings.grade)
      experimentalOutput.enabled = bloomEnabled || settings.grade
      experimentalOutput.uniforms.effectSaturation!.value = settings.grade ? settings.saturation : 1
      experimentalOutput.uniforms.effectContrast!.value = settings.grade ? settings.contrast : 1
      experimentalOutput.uniforms.effectTemperature!.value = settings.grade
        ? settings.temperature
        : 0
      if (bloomEnabled) {
        if (!selective) {
          selective = createSelectiveBloom(renderer, scene, camera, fire)
          selective.resize(size.width, size.height)
        }
        selective.configure(settings.bloomStrength, settings.bloomRadius, settings.bloomThreshold)
        bloomBlend.uniforms.bloomTexture!.value = selective.texture
      }
    },
    state() {
      return {
        bloomAllocated: !!selective,
        bloomEnabled,
        intensity: ao.blendIntensity,
        radius: ao.gtaoMaterial.uniforms.radius!.value as number,
        diagnostic: ao.output === GTAOPass.OUTPUT.Denoise,
        occlusionComputations,
        occlusionReuses,
      }
    },
    resize(width: number, height: number) {
      occlusionValid = false
      size = { width, height }
      composer.setSize(width, height)
      selective?.resize(width, height)
    },
    render(occlusion = true) {
      ao.enabled = occlusion
      if (bloomEnabled) selective?.render()
      composer.render(0)
    },
    dispose() {
      selective?.dispose()
      bloomBlend.dispose()
      beauty.dispose()
      cachedQuad.dispose()
      // GTAOPass.dispose() does not own these two materials in this Three.js version.
      ao.gtaoMaterial.dispose()
      ao.blendMaterial.dispose()
      ao.dispose()
      output.dispose()
      experimentalOutput.dispose()
      composer.dispose()
    },
  }
}
