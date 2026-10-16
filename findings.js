export function selectFindings(findings,{query='',page=0,pageSize=10,filter='all'}={}){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=findings.map((finding,index)=>({finding,index})).filter(({finding:f})=>{const text=[findingTitle(f),missingFindingDetails(f).length?'incomplete needs '+missingFindingDetails(f).join(' '):'',f.building,f.floor,f.room,f.category,f.priority].join(' ').toLowerCase();return (filter!=='incomplete'||missingFindingDetails(f).length>0)&&(filter!=='high'||f.priority==='High')&&terms.every(term=>text.includes(term));});
 const pages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
 return {items:matches.slice(page*pageSize,(page+1)*pageSize),total:matches.length,pages,page};
}
export function missingFindingDetails(finding){
 const missing=[];if(!String(finding.description||'').trim())missing.push('description');if(!finding.photos?.length)missing.push('photos');return missing;
}
export function findingTitle(finding){return String(finding.description||'').trim()||'Incomplete finding';}
export function createPhotoFinding(previous,id=crypto.randomUUID()){
 return {id,description:'',building:previous?.building||'',floor:previous?.floor||'',room:previous?.room||'',category:'General safety',priority:'Medium',photos:[],reviewed:false};
}

export function selectInspections(inspections,{query='',sort='recent'}={}){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const selected=inspections.filter(d=>{const text=[d.title,d.inspector,d.date].join(' ').toLowerCase();return terms.every(t=>text.includes(t));});
 return selected.slice().sort((a,b)=>sort==='title'?String(a.title).localeCompare(String(b.title)):sort==='date'?String(b.date).localeCompare(String(a.date)):String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
export function inspectionProgress(d){const total=d.findings.length,reviewed=d.findings.filter(f=>!missingFindingDetails(f).length).length;return {total,reviewed,remaining:total-reviewed};}
