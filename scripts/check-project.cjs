const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const files=[];
for(const root of ['src','public/js','scripts','tests']) {
 const visit=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);entry.isDirectory()?visit(p):/\.(?:js|cjs)$/.test(p)&&files.push(p);}};
 visit(root);
}
files.push('server.js','electron.js','preload.js','public/sw.js','public/i18n.js');
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status)throw new Error(file+'\n'+r.stderr);}
const pkg=require('../package.json');
if(pkg.dependencies['sql.js'])throw new Error('Unused sql.js dependency remains');
const scripts=fs.readFileSync('public/index.html','utf8').match(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)||[];
for(const ref of scripts.map(x=>x.match(/"([^"?#]+)/)[1]).filter(x=>!/^https?:|^\/socket/.test(x))){if(!fs.existsSync(path.join('public',ref.replace(/^\//,''))))throw new Error('Missing public asset: '+ref);}
console.log(`PASS check: ${files.length} JavaScript files and referenced local assets`);
