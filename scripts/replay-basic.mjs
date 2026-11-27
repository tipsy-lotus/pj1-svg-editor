import { writeFileSync } from 'node:fs';
import { BasicReplay } from './BasicReplay.mjs';

for (const result of await new BasicReplay().run()) {
  writeFileSync(new URL(`../doc/transcript/${result.name}.code.txt`, import.meta.url), result.code);
  writeFileSync(new URL(`../doc/transcript/${result.name}.config.txt`, import.meta.url), result.config);
  writeFileSync(new URL(`../doc/transcript/${result.name}.saved.svg`, import.meta.url), result.svg);
  console.log(`${result.name}: identical code/config output and SVG bytes`);
}
