const fs=require('fs'),ts=require('typescript');
for(const f of ['ReferenceLanding','ReferenceOverview','PrerequisiteMap']) {
 const s=fs.readFileSync('src/'+f+'.tsx','utf8');
 const d=ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true}).diagnostics;
 console.log(f+': '+d.length+' syntax diagnostics');
 if(d.length)process.exitCode=1;
 console.log([...s.matchAll(/href="(\/[^\"]*)"/g)].map(m=>m[1]));
}
