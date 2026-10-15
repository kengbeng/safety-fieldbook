const query=document.querySelector('#helpQuery'),clear=document.querySelector('#clearHelp'),topics=[...document.querySelectorAll('.help-topic')],results=document.querySelector('#helpResults');
let previousOpen=null;
function filter(){
 const terms=query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 if(terms.length&&!previousOpen)previousOpen=new Set(topics.filter(t=>t.open).map(t=>t.id));
 let count=0;
 for(const topic of topics){const text=topic.textContent.toLocaleLowerCase(),match=terms.every(term=>text.includes(term));topic.hidden=!match;if(match)count++;if(terms.length)topic.open=match;else if(previousOpen)topic.open=previousOpen.has(topic.id);}
 if(!terms.length)previousOpen=null;
 clear.hidden=!query.value;results.textContent=terms.length?`${count} matching topic${count===1?'':'s'}`:`${topics.length} help topics · Select a topic to open it.`;document.querySelector('#helpEmpty').hidden=count!==0;
}
function openHash(){const topic=topics.find(t=>'#'+t.id===location.hash);if(!topic)return;if(query.value){query.value='';filter();}topic.open=true;topic.querySelector('summary').focus();topic.scrollIntoView({block:'start'});}
query.addEventListener('input',filter);clear.onclick=()=>{query.value='';filter();query.focus();};document.querySelector('#helpSearch').onsubmit=e=>{e.preventDefault();filter();};
document.querySelectorAll('.help-topics a').forEach(a=>a.addEventListener('click',()=>{query.value='';filter();const topic=topics.find(t=>'#'+t.id===a.getAttribute('href'));if(topic){topic.open=true;topic.querySelector('summary').focus();}}));window.addEventListener('hashchange',openHash);filter();openHash();
