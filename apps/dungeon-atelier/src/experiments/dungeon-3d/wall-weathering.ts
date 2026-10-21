import * as THREE from 'three'
import { wallCracks } from './wall-wear'
import { appearanceHash } from './plan'

/** Body-only weathering. The cap materials and their maps are never passed here. */
export function createWallWeathering(seed: string) {
  const image = document.createElement('canvas')
  image.width = 1024
  image.height = 512
  const c = image.getContext('2d')!
  c.fillStyle = '#fff'
  c.fillRect(0, 0, 1024, 512)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  for (const crack of wallCracks(seed)) {
    for (const points of [crack.points, crack.branch]) {
      c.beginPath()
      points.forEach((p, i) => {
        const x = (p.x / 8) * 1024,
          y = 512 - (p.y / 4) * 512
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      })
      c.strokeStyle = '#77756d'
      c.lineWidth = crack.width + 1.4
      c.stroke()
      c.strokeStyle = '#252b28'
      c.lineWidth = crack.width
      c.stroke()
    }
  }
  const cracks = new THREE.CanvasTexture(image)
  cracks.wrapS = cracks.wrapT = THREE.RepeatWrapping
  cracks.anisotropy = 4
  const seedOffset = appearanceHash(seed, 0, 0, 7901) * 100
  function apply(material: THREE.MeshStandardMaterial, strength = 1) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.wallCracks = { value: cracks }
      shader.uniforms.wallSeed = { value: seedOffset }
      shader.uniforms.wallWearStrength = { value: strength }
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
        varying vec3 wearPosition; varying vec3 wearNormal;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          wearPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
          wearNormal=normalize(mat3(modelMatrix)*objectNormal);`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
        varying vec3 wearPosition; varying vec3 wearNormal;
        uniform sampler2D wallCracks; uniform float wallSeed; uniform float wallWearStrength;
        float whash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7))+wallSeed)*43758.5453);}
        float wnoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(mix(whash(i),whash(i+vec3(1,0,0)),f.x),mix(whash(i+vec3(0,1,0)),whash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(whash(i+vec3(0,0,1)),whash(i+vec3(1,0,1)),f.x),mix(whash(i+vec3(0,1,1)),whash(i+vec3(1,1,1)),f.x),f.y),f.z);}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 wp=wearPosition;
          float damp=wnoise(vec3(wp.x*.65,wp.y*.4,wp.z*.65));
          float fine=wnoise(wp*7.0);
          float base=1.0-smoothstep(.05,.85,wp.y);
          float moss=smoothstep(.53,.77,damp)*(0.25+0.75*base)*smoothstep(.28,.7,fine)*.62;
          float streak=wnoise(vec3(wp.x*2.4,wp.y*.2,wp.z*2.4)+11.0);
          float dirt=(base*.22+smoothstep(.62,.9,streak)*.18)*(0.5+fine*.5);
          float along=abs(wearNormal.x)>.65?wp.z:wp.x;
          float face=abs(wearNormal.x)>.65?wp.x:wp.z;
          float crack=1.0-texture2D(wallCracks,vec2((along+face*1.731)/8.0,wp.y/4.0)).r;
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.62,.62,.58),dirt*wallWearStrength);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.49,.63,.29),moss*wallWearStrength);
          diffuseColor.rgb*=1.0-crack*.63*wallWearStrength;`,
        )
    }
    material.customProgramCacheKey = () => `ancient-wall-wear-v1:${strength}`
    material.needsUpdate = true
  }
  return { cracks, apply }
}
