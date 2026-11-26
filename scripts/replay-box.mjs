import { writeFileSync } from 'node:fs';
import { BoxReplay } from './BoxReplay.mjs';

const result = await new BoxReplay().run();
writeFileSync(new URL('../doc/transcript/box.code.txt', import.meta.url), result.code);
writeFileSync(new URL('../doc/transcript/box.config.txt', import.meta.url), result.config);
writeFileSync(new URL('../doc/transcript/box.saved.svg', import.meta.url), result.svg);
console.log('Box session: code/config output and SVG bytes are identical.');
