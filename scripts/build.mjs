import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../web/vendor/',import.meta.url),{recursive:true});
await copyFile(new URL('../node_modules/chart.js/dist/chart.umd.js',import.meta.url),new URL('../web/vendor/chart.umd.js',import.meta.url));
console.log('Chart.js 4.4.1 copied to application asset route.');
