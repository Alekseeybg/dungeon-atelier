import fs from 'node:fs'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import assert from 'node:assert/strict'
const phase = process.argv.includes('--before') ? 'before' : 'after'
const out = 'reports/torch-bloom-stability'
fs.mkdirSync(out, { recursive: true })
const b = await browserSession('http://localhost:9000')
try {
  await b.send('Page.navigate', { url: 'http://localhost:9000/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.fx=n.exposed;const s=fx.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    'scene',
  )
  await b.evaluate(
    `if(fx.getFlameState().enabled)document.querySelector('[aria-label="3D flame animation"]').click()`,
  )
  await b.evaluate(`fx.openEffects()`)
  await poll(() => b.evaluate(`!!document.querySelector('#dungeon-effects')`), 'panel')
  await b.evaluate(
    `(()=>{let n=document.querySelector('#dungeon-effects').__vueParentComponent;while(n&&!n.props.modelValue)n=n.parent;window.setFx=v=>n.emit('update:modelValue',{...fx.getEffectsState().settings,...v});window.setCam=(label,v)=>document.querySelector('[aria-label="'+label+'"]').__vueParentComponent.emit('update:modelValue',v)})()`,
  )
  const user = {
    aoIntensity: 1,
    aoRadius: 0.65,
    aoOnly: false,
    cavity: 0,
    edgeResponse: 2,
    shadowIntensity: 0.25,
    shadowSoftness: 6,
    keyLight: 0.75,
    ambientLight: 0.5,
    torchIntensity: 1,
    torchRange: 1,
    torchDecay: 2.2,
    torchShadows: false,
    torchBudget: 8,
    normals: false,
    normalStrength: 1,
    roughness: true,
    stoneRoughness: 0.05,
    woodRoughness: 0.05,
    ironRoughness: 0.35,
    grade: true,
    bloom: true,
    bloomStrength: 0.25,
    bloomRadius: 0.5,
    bloomThreshold: 1,
    exposure: 1.1,
    saturation: 1.5,
    contrast: 1.05,
    temperature: 0.3,
  }
  // Reproduce the live session history: bloom first sees glossy coals, then roughness is disabled.
  await b.evaluate(`setFx(${JSON.stringify(user)})`)
  await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  await b.evaluate('fx.capture3D()')
  await b.evaluate(
    `setFx(${JSON.stringify({ ...user, roughness: false, normals: true, normalStrength: 0.85 })})`,
  )
  const sourceChecks = await b.evaluate(`(async()=>{
    const path='/src/experiments/dungeon-3d/selective-bloom.ts';
    const text=await (await fetch(path)).text();
    const url=text.match(/"([^"]*three[.]js[^"]*)"/)[1];
    const T=await import(url), {createSelectiveBloom}=await import(path);
    const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(64,64);renderer.setClearColor(0);
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
    const material=new T.MeshStandardMaterial({color:0,emissive:'#ff6000',emissiveIntensity:.5,roughness:.05});
    const geometry=new T.PlaneGeometry(.6,.6),mesh=new T.Mesh(geometry,material),light=new T.PointLight(0xffffff,0);light.position.z=.2;scene.add(mesh,light);
    const fire=new T.ShaderMaterial(),bloom=createSelectiveBloom(renderer,scene,camera,fire);bloom.resize(64,64);bloom.configure(.3,.25,.08);
    const quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:bloom.texture,toneMapped:false}));
    const display=new T.Scene();display.add(quad);
    function capture(){bloom.render();renderer.setRenderTarget(null);renderer.render(display,camera);return renderer.domElement.toDataURL()}
    try{
      const base=capture();light.intensity=10000;const lit=capture();material.roughness=.98;const rough=capture();
      material.emissiveIntensity=1;const stronger=capture();material.emissiveIntensity=.5;const restored=capture();
      return {lightIndependent:base===lit,roughnessIndependent:base===rough,emissionUpdates:base!==stronger,emissionRestores:base===restored,materialRestored:mesh.material===material};
    }finally{bloom.dispose();quad.geometry.dispose();quad.material.dispose();geometry.dispose();material.dispose();fire.dispose();renderer.dispose();renderer.forceContextLoss()}
  })()`)
  for (const [name, passed] of Object.entries(sourceChecks)) assert(passed, name)
  fs.writeFileSync(out + '/emission-source-checks.json', JSON.stringify(sourceChecks, null, 2))
  const results = []
  let best = -1
  for (const elevation of process.argv.includes('--source-only') ? [] : [55, 63.75, 68, 75])
    for (const rotation of [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180])
      for (const zoom of [1, 1.22]) {
        const result = await b.evaluate(
          `(async()=>{setCam('3D camera elevation',${elevation});setCam('3D camera rotation',${rotation});setCam('3D camera zoom',${zoom});await Promise.resolve();const png=fx.capture3D();const i=new Image();i.src=png;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);const p=x.getImageData(0,0,c.width,c.height).data;let bright=0;for(let j=0;j<p.length;j+=4)if(p[j]>245&&p[j+1]>220)bright++;return {bright,png}})()`,
        )
        if (result.bright > best) {
          best = result.bright
          fs.writeFileSync(
            out + '/' + phase + '-worst.png',
            Buffer.from(result.png.split(',')[1], 'base64'),
          )
          fs.writeFileSync(
            out + '/' + phase + '-worst-camera.json',
            JSON.stringify({ elevation, rotation, zoom, bright: best }),
          )
        }
        results.push({ elevation, rotation, zoom, bright: result.bright })
      }
  assert.deepEqual(b.errors, [])
  if (!process.argv.includes('--source-only'))
    fs.writeFileSync(
      out + '/' + phase + '.json',
      JSON.stringify({ results, errors: b.errors }, null, 2),
    )
  if (process.argv.includes('--source-only')) console.log('Bloom emission-source regression passed')
  else
    console.log(
      phase +
        ' bloom angle/zoom sweep passed; brightest camera: ' +
        fs.readFileSync(out + '/' + phase + '-worst-camera.json', 'utf8'),
    )
} finally {
  await b.close()
}
