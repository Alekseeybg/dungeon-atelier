import fs from 'node:fs'
import path from 'node:path'
import { browserSession } from '../tests/helpers/browser.mjs'
import { dimensionalBenchmark } from './scenes/dimensional-benchmark.mjs'
const output = path.resolve('reports/dimensional/prototype')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
try {
  const floor = dimensionalBenchmark()
  const result = await browser.evaluate(`(async()=>{
    await (await import('/src/features/dungeon/rendering/dimensional-sprites.ts')).prepareDimensionalAtlas()
    const {renderDimensional}=await import('/src/features/dungeon/rendering/dimensional-renderer.ts')
    const {dimensionalProjection}=await import('/src/features/dungeon/rendering/dimensional-model.ts')
    const floor=${JSON.stringify(floor)},metrics=dimensionalProjection(32),images={}
    for(const revealSecrets of [false,true]) {
      const canvas=document.createElement('canvas');canvas.width=floor.width*32+metrics.padding.left+metrics.padding.right;canvas.height=floor.height*32+metrics.padding.top+metrics.padding.bottom
      const context=canvas.getContext('2d');context.fillStyle='#080c0d';context.fillRect(0,0,canvas.width,canvas.height);context.translate(metrics.padding.left,metrics.padding.top)
      renderDimensional(context,floor,false,{revealSecrets,openDoorIds:['door-a']})
      images[revealSecrets?'revealed':'concealed']=canvas.toDataURL().split(',')[1]
    }
    return images
  })()`)
  for (const [name, png] of Object.entries(result))
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png, 'base64'))
  fs.writeFileSync(path.join(output, 'floor.json'), JSON.stringify(floor, null, 2) + '\n')
  console.log('Prototype rendered. Runtime errors: ' + JSON.stringify(browser.errors))
} finally {
  browser.close()
}
