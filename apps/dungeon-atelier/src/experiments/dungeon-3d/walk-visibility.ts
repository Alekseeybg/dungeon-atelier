import * as THREE from 'three'
import type { WalkState } from '../../features/dungeon/exploration/useDungeonWalk'

/** Grid-volume clipping, shared by beauty, normal/depth, shadows and bloom sources. */
export function createWalkVisibility(width: number, height: number) {
  const pixels = new Uint8Array(width * height),
    texture = new THREE.DataTexture(pixels, width, height, THREE.RedFormat),
    uniforms = {
      walkEnabled: { value: false },
      walkMap: { value: texture },
      walkSize: { value: new THREE.Vector2(width, height) },
    },
    patched = new WeakSet<THREE.Material>(),
    originals = new Map<
      THREE.Mesh,
      {
        depth: THREE.Material | undefined
        distance: THREE.Material | undefined
      }
    >(),
    depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
    distance = new THREE.MeshDistanceMaterial()
  texture.minFilter = texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  function known(x: number, z: number) {
    return (
      !uniforms.walkEnabled.value ||
      (x >= 0 &&
        z >= 0 &&
        x < width &&
        z < height &&
        pixels[Math.floor(z) * width + Math.floor(x)] === 255)
    )
  }
  function material(material: THREE.Material) {
    if (patched.has(material)) return
    patched.add(material)
    const compile = material.onBeforeCompile.bind(material),
      key = material.customProgramCacheKey()
    material.onBeforeCompile = function (shader, renderer) {
      compile(shader, renderer)
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader =
        'attribute float walkOwner; varying vec2 walkXZ; varying float walkCell;\n' +
        shader.vertexShader
      const world = 'walkCell=walkOwner;walkXZ=(modelMatrix*vec4(transformed,1.)).xz;'
      shader.vertexShader = shader.vertexShader.includes('#include <project_vertex>')
        ? shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\n' + world,
          )
        : shader.vertexShader.replace(
            /void main\s*\(\s*\)\s*\{/,
            '$&walkCell=walkOwner;walkXZ=(modelMatrix*vec4(position,1.)).xz;',
          )
      shader.fragmentShader =
        `uniform bool walkEnabled;uniform sampler2D walkMap;uniform vec2 walkSize;
        varying vec2 walkXZ;varying float walkCell;
        bool walkKnown(vec2 p){return all(greaterThanEqual(p,vec2(0.)))&&all(lessThan(p,walkSize))&&texture2D(walkMap,(floor(p)+.5)/walkSize).r>.5;}
        ` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        /void main\s*\(\s*\)\s*\{/,
        `$&
        if(walkEnabled){if(!walkKnown(walkXZ))discard;
        if(walkCell>=0.&&!walkKnown(vec2(mod(walkCell,walkSize.x),floor(walkCell/walkSize.x))))discard;}`,
      )
    }
    material.customProgramCacheKey = () => key + '|walk-grid-v1'
    material.needsUpdate = true
  }
  material(depth)
  material(distance)
  return {
    material,
    known,
    update(walk: WalkState) {
      uniforms.walkEnabled.value = walk.active
      pixels.fill(0)
      for (const cell of walk.explored) if (cell >= 0 && cell < pixels.length) pixels[cell] = 255
      texture.needsUpdate = true
    },
    apply(root: THREE.Object3D) {
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        const mesh = node as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material(m)
        if (!mesh.geometry.hasAttribute('walkOwner')) {
          mesh.geometry.setAttribute(
            'walkOwner',
            new THREE.BufferAttribute(
              new Float32Array(mesh.geometry.getAttribute('position').count).fill(-1),
              1,
            ),
          )
        }
        if (uniforms.walkEnabled.value) {
          if (!originals.has(mesh))
            originals.set(mesh, {
              depth: mesh.customDepthMaterial,
              distance: mesh.customDistanceMaterial,
            })
          mesh.customDepthMaterial = depth
          mesh.customDistanceMaterial = distance
        } else {
          const saved = originals.get(mesh)
          if (saved) {
            mesh.customDepthMaterial = saved.depth
            mesh.customDistanceMaterial = saved.distance
            originals.delete(mesh)
          }
        }
      })
      // Geometry rebuilds must not retain the replaced architecture.
      for (const mesh of originals.keys()) {
        let parent: THREE.Object3D | null = mesh
        while (parent && parent !== root) parent = parent.parent
        if (!parent) originals.delete(mesh)
      }
    },
    dispose() {
      for (const [mesh, saved] of originals) {
        mesh.customDepthMaterial = saved.depth
        mesh.customDistanceMaterial = saved.distance
      }
      originals.clear()
      depth.dispose()
      distance.dispose()
      texture.dispose()
    },
  }
}
export type WalkVisibility = ReturnType<typeof createWalkVisibility>
