import fs from 'node:fs'
import path from 'node:path'
import { browserSession } from '../tests/helpers/browser.mjs'
import { fourDoorRoom } from './scenes/four-door-room.mjs'
const args = process.argv.slice(2)
const stage = args.includes('--candidate') ? 'candidate' : 'baseline'
const output = path.resolve('reports/dimensional/doors', stage)
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
try {
  const images = await browser.evaluate(`(async()=>{
    const root='/src/features/dungeon/rendering/${stage === 'candidate' ? 'projection-study/' : ''}'
    const sprites=await import(root+'dimensional-sprites.ts')
    await sprites.prepareDimensionalAtlas()
    const renderer=await import(root+'dimensional-renderer.ts')
    const model=await import(root+'dimensional-model.ts')
    const base=${JSON.stringify(fourDoorRoom())},secret=${JSON.stringify(fourDoorRoom(true))}
    const depth=model.dimensionalProjection(32).floorDepth ?? 1
    const images={}
    for(const [name,floor,options] of [['closed',base,{}],['open',base,{openDoorIds:base.doors.map(d=>d.id)}],['secret-concealed',secret,{}],['secret-revealed',secret,{revealSecrets:true}]]) {
      const canvas=document.createElement('canvas');canvas.width=688;canvas.height=base.height*32*depth+40
      const c=canvas.getContext('2d');c.fillStyle='#080c0d';c.fillRect(0,0,688,canvas.height);c.translate(8,32)
      c.scale(1,depth)
      renderer.renderDimensional(c,floor,false,options)
      images[name]=canvas.toDataURL().split(',')[1]
      if(name==='closed'||name==='open') {
        const detail=document.createElement('canvas');detail.width=1024;detail.height=264
        const dc=detail.getContext('2d');dc.fillStyle='#080c0d';dc.fillRect(0,0,1024,264);dc.imageSmoothingEnabled=false
        floor.doors.forEach((door,i)=>{const x=door.position.x*32+8,y=door.position.y*32*depth+32;dc.drawImage(canvas,x-32,y-32,96,88,i*256,24,256,235);dc.fillStyle='#eee0c1';dc.font='16px sans-serif';dc.fillText(door.id.toUpperCase(),i*256+8,18)})
        images[name+'-details']=detail.toDataURL().split(',')[1]
      }
    }
    return images
  })()`)
  for (const [name, png] of Object.entries(images))
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png, 'base64'))
  if (browser.errors.length) throw new Error(JSON.stringify(browser.errors))
  console.log('Four-door room rendered: ' + output)
} finally {
  browser.close()
}
