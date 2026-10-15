export function selectFindings(findings,{query='',page=0,pageSize=10}={}){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=findings.map((finding,index)=>({finding,index})).filter(({finding:f})=>{const text=[findingTitle(f),missingFindingDetails(f).length?'incomplete needs '+missingFindingDetails(f).join(' '):'',f.building,f.floor,f.room,f.category,f.priority,f.reviewed?'reviewed':'needs review'].join(' ').toLowerCase();return terms.every(term=>text.includes(term));});
 const pages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
 return {items:matches.slice(page*pageSize,(page+1)*pageSize),total:matches.length,pages,page};
}
export function missingFindingDetails(finding){
 const missing=[];if(!String(finding.description||'').trim())missing.push('description');if(!finding.photos?.length)missing.push('photos');return missing;
}
export function findingTitle(finding){return String(finding.description||'').trim()||'Incomplete finding · Needs description';}
export function createPhotoFinding(previous,id=crypto.randomUUID()){
 return {id,description:'',building:previous?.building||'',floor:previous?.floor||'',room:'',category:'General safety',priority:'Medium',photos:[],reviewed:false};
}
