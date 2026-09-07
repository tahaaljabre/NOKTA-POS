const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const results=[];
for(const file of fs.readdirSync(__dirname).filter(f=>/^\d{2}-.*\.cjs$/.test(f)).sort()) {
 const p=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000});
 const passed=p.status===0;results.push({file,passed,output:(p.stdout||'')+(p.stderr||'')});
 console.log((passed?'PASS ':'FAIL ')+file);if(!passed)console.log(results.at(-1).output);
}
fs.writeFileSync(path.join(__dirname,'../audit/verification.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
console.log(results.filter(r=>r.passed).length+'/'+results.length+' passed');
process.exitCode=results.every(r=>r.passed)?0:1;
