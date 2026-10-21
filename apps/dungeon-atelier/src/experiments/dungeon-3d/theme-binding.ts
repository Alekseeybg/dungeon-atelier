import * as THREE from 'three'

/** Canonical slots allow repeated palette swaps, including after architecture rebuilds. */
export function createMaterialThemeBinding(
  variants: ReadonlyMap<string, ReadonlyMap<THREE.Material, THREE.Material>>,
) {
  const original = new Map(
    [...variants.values()].flatMap((palette) =>
      [...palette].map(([source, themed]) => [themed, source]),
    ),
  )
  function resolve(material: THREE.Material, theme: string) {
    const canonical = original.get(material) ?? material
    return variants.get(theme)?.get(canonical) ?? canonical
  }
  return {
    resolve,
    apply(root: THREE.Object3D, theme: string) {
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        const mesh = node as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => resolve(m, theme))
          : resolve(mesh.material, theme)
      })
    },
  }
}
