import {readdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';
for(const dir of ['api','lib','scripts','tests','web'])for(const file of readdirSync(dir))if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',dir+'/'+file],{stdio:'inherit'});
execFileSync(process.execPath,['--check','server.mjs'],{stdio:'inherit'});
