export function selectFindings(findings,{query='',page=0,pageSize=10}={}){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=findings.map((finding,index)=>({finding,index})).filter(({finding:f})=>{const text=[f.description,f.building,f.floor,f.room,f.category,f.priority,f.reviewed?'reviewed':'needs review'].join(' ').toLowerCase();return terms.every(term=>text.includes(term));});
 const pages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
 return {items:matches.slice(page*pageSize,(page+1)*pageSize),total:matches.length,pages,page};
}
