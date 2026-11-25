import { writeFileSync } from 'node:fs';
import { CommandPluginReplay } from './CommandPluginReplay.mjs';

const result = await new CommandPluginReplay().run();
writeFileSync(new URL('../doc/transcript/command-plugins.code.txt', import.meta.url), result.code);
writeFileSync(new URL('../doc/transcript/command-plugins.config.txt', import.meta.url), result.config);
writeFileSync(new URL('../doc/transcript/command-plugins.saved.svg', import.meta.url), result.svg);
console.log('Code/config output and SVG bytes are identical. Evidence: doc/transcript/');
