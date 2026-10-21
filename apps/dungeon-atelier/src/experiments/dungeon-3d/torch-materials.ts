import * as THREE from 'three'

/** Torch-only surfaces: dark oxidized iron and charred fuel, independent of door hardware. */
export function createTorchMaterials() {
  const flameClock = { value: 0 }
  const grain = document.createElement('canvas')
  grain.width = grain.height = 128
  const context = grain.getContext('2d')!,
    pixels = context.createImageData(128, 128)
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4,
        value = 125 + 24 * Math.sin(x * 1.7 + Math.sin(y * 0.7)) * Math.sin(y * 2.3 + x)
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value
      pixels.data[i + 3] = 255
    }
  context.putImageData(pixels, 0, 0)
  const bump = new THREE.CanvasTexture(grain)
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  const torchIron = new THREE.MeshStandardMaterial({
      color: '#242725',
      metalness: 0.85,
      roughness: 0.86,
      bumpMap: bump,
      bumpScale: 0.0007,
    }),
    charcoal = new THREE.MeshStandardMaterial({
      color: '#211b16',
      roughness: 1,
      bumpMap: bump,
      bumpScale: 0.002,
    }),
    fuel = new THREE.MeshStandardMaterial({
      color: '#39291a',
      roughness: 1,
      bumpMap: bump,
      bumpScale: 0.003,
    }),
    fire = new THREE.ShaderMaterial({
      uniforms: { flameClock },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `varying vec2 fireUV; varying float firePhase; uniform float flameClock;
        void main(){fireUV=uv;vec3 p=position;firePhase=dot(position.xz,vec2(1.73,2.91));
          p.x+=sin(flameClock*3.1+firePhase)*uv.y*uv.y*.009;
          p.z+=cos(flameClock*2.7+firePhase)*uv.y*uv.y*.006;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader: `varying vec2 fireUV; varying float firePhase; uniform float flameClock;
        float noise(vec2 p){return sin(p.x*19.7+sin(p.y*11.3))*sin(p.y*23.1+p.x*7.9);}
        void main(){
          float h=fireUV.y;
          float flicker=sin(flameClock*4.3+firePhase)*.018+sin(flameClock*7.7+firePhase*2.0)*.009;
          float bend=sin(h*7.0+flameClock*1.7+firePhase*.15)*0.07+h*h*0.13+flicker*h;
          float width=(0.12+0.30*sin(pow(h,0.7)*3.14159))*pow(1.0-h,0.65);
          float d=abs(fireUV.x-0.5-bend)/max(width,0.001);
          float edge=1.0-smoothstep(0.45,1.0,d+noise(fireUV*2.0+vec2(0.0,-flameClock*.25))*0.11*h);
          float alpha=edge*smoothstep(0.0,0.12,h)*(1.0-smoothstep(0.72,1.0,h))*0.48;
          float core=(1.0-smoothstep(0.0,0.55,d))*pow(1.0-h,1.8);
          vec3 color=mix(vec3(1.0,0.13,0.008),vec3(1.0,0.48,0.045),1.0-h);
          color=mix(color,vec3(1.0,0.78,0.32),core*0.55);
          gl_FragColor=vec4(color,alpha*(1.0+flicker));
        }`,
    })
  return { torchIron, charcoal, fuel, fire, bump, flameClock }
}
