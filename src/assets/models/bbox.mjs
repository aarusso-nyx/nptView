import { NodeIO } from '@gltf-transform/core';
import { inspect } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

import { basename } from 'path';


const args = process.argv.slice(2);
const filePath = args[0];

const fixIt = args[1] === '--fix';

if (!filePath) {
  console.error('Usage: node inspect.js <file.glb> [--fix]');
  process.exit(1);
}



// Initialize IO with Draco and Meshopt support
const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(), 
    'draco3d.encoder': await draco3d.createEncoderModule()
  });

// Read file
const document = await io.read(filePath);

const { bboxMin, bboxMax } = inspect(document).scenes.properties[0];
const size = [ bboxMax[0]-bboxMin[0], bboxMax[1]-bboxMin[1], bboxMax[2]-bboxMin[2] ];
const scale = 1 / size[0];
const disp = [ -bboxMin[0], -bboxMin[1], -bboxMin[2]-size[2]/2 ];


if ( fixIt ) {
  const outFile = `${basename(filePath,'.glb')}-0.glb`;
  console.log(`=> Fixing ${filePath} into ${outFile}`);
  // Apply transform
  document
    .getRoot()
    .getDefaultScene()
    .listChildren()
    .forEach((node) => {
        const scale = x => x/size[0];
        const trans = (t, i) => (t + disp[i]);

        const factor = node.getScale().map(scale);
        const move = node.getTranslation().map(trans).map(scale);
        
        node.setScale(factor);
        node.setTranslation(move);
    });
  
  await io.write(outFile, document);
  console.log(`=> Done.\n`);
} else {
  // Truncation factory
  const Truncator = (n) => {
    const m = Math.pow(10, n);
    return (num) => Math.trunc(num * m) / m;
  }

  const trunc = Truncator(5);

  // Print info
  console.log(`=> ${filePath}`);
  console.log(`\t bbox: ${bboxMin.map(trunc)} to ${bboxMax.map(trunc)}`);
  console.log(`\t size: ${size.map(trunc)}`);
  console.log(`\tscale: ${trunc(scale)}`);
  console.log(`\t disp: ${disp.map(trunc)}\n`);
}