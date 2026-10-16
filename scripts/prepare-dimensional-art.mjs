import fs from 'node:fs'
import path from 'node:path'
import { browserSession } from '../tests/helpers/browser.mjs'
const directory = path.resolve('apps/dungeon-atelier/src/assets/dimensional')
const browser = await browserSession('http://localhost:9000')
try {
  for (const name of [
    'doorway-front-v2',
    'fitted-floor-v1',
    'floor-stone-v1',
    'masonry-v1',
    'door-leaf-v1',
    'carved-inlay-v1',
    'wall-sconce-v1',
  ]) {
    const result = await browser.evaluate(`(async()=>{
      const image=new Image();image.src='/src/assets/dimensional/${name}.png';await image.decode()
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
      canvas.getContext('2d').drawImage(image,0,0)
      return canvas.toDataURL('image/webp',.9).split(',')[1]
    })()`)
    fs.writeFileSync(path.join(directory, name + '.webp'), Buffer.from(result, 'base64'))
    console.log(name + ': ' + fs.statSync(path.join(directory, name + '.webp')).size + ' bytes')
  }
} finally {
  browser.close()
}
