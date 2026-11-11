export const TUTORIAL_STAGES=['welcome','install','inspection','capture','details','annotate','export','complete'];
export function transition(state,event,data={}){
 if(state.status!=='active')return state;
 const next={...state};
 if(event==='install-continue'&&state.stage==='install')next.stage='inspection';
 if(event==='inspection-saved'&&state.stage==='inspection'&&data.isNew){next.stage='capture';next.inspectionId=data.inspectionId;next.findingId=null;}
 if(data.inspectionId===state.inspectionId){
  if((event==='finding-opened'||event==='photos-saved')&&state.stage==='capture'){next.stage='details';next.findingId=data.findingId||null;}
  if(event==='photos-saved'&&state.stage==='details')next.findingId=data.findingId;
  if(event==='finding-saved'&&state.stage==='details'&&data.description?.trim()&&(!state.findingId||data.findingId===state.findingId)){next.stage='annotate';next.findingId=data.findingId;}
  if(event==='export-requested'&&state.stage==='export'&&data.mode!=='recovery')next.stage='complete';
 }
 if(event==='annotation-continue'&&state.stage==='annotate')next.stage='export';
 return next;
}
export function readProgress(storage,key){try{const s=JSON.parse(storage.getItem(key));if(s?.version===1&&['active','dismissed','complete','invited'].includes(s.status)&&TUTORIAL_STAGES.includes(s.stage))return s;}catch{}return null;}
export function createTutorial({getContext,openInspection,openFinding,openExport,openDraft,storage=null}){
 try{storage=storage||window.localStorage;}catch{}
 const key='safety-fieldbook:tutorial:'+new URL('./',location.href).pathname;
 let state=null,initialised=false,visible=false,resume=false,lastAnnouncement='';
 const $=s=>document.querySelector(s),card=document.createElement('section');card.className='tutorial-card';card.setAttribute('aria-label','First inspection tutorial');card.innerHTML='<div class="tutorial-heading"><span class="tutorial-step"></span><button type="button" class="tutorial-skip">Skip tutorial</button></div><h2 class="tutorial-title" tabindex="-1"></h2><p class="tutorial-copy"></p><p class="tutorial-feedback" role="status" aria-live="polite"></p><div class="tutorial-actions"></div>';
 const title=card.querySelector('.tutorial-title'),copy=card.querySelector('.tutorial-copy'),actions=card.querySelector('.tutorial-actions'),feedback=card.querySelector('.tutorial-feedback');
 function persist(){try{storage.setItem(key,JSON.stringify(state));}catch{}}
 function clearHighlight(){document.querySelectorAll('.tutorial-target').forEach(n=>n.classList.remove('tutorial-target'));}
 function setState(value){state=value;persist();refresh();}
 function dismiss(){visible=false;resume=false;state={...state,status:'dismissed'};persist();refresh();}
 card.querySelector('.tutorial-skip').onclick=dismiss;
 function button(text,handler,primary=false){const b=document.createElement('button');b.type='button';b.textContent=text;if(primary)b.className='primary';b.onclick=handler;actions.append(b);}
 function start(){visible=true;resume=false;setState({version:1,status:'active',stage:'install',inspectionId:null,findingId:null});}
 function emit(event,data={}){if(getContext().saveError)return;const next=transition(state||{},event,data);if(next!==state){state=next;persist();}refresh();}
 function replay(){visible=true;resume=false;state={version:1,status:'invited',stage:'welcome',inspectionId:null,findingId:null};persist();refresh();title.focus({preventScroll:false});}
 function init(existingCount){initialised=true;state=readProgress(storage,key);const request=new URL(location.href);if(request.searchParams.get('tutorial')==='1'){request.searchParams.delete('tutorial');history.replaceState(null,'',request);replay();return;}
 if(state?.status==='active'){visible=true;resume=true;}
 else if(!state&&existingCount===0){state={version:1,status:'invited',stage:'welcome'};visible=true;persist();}
 else if(!state){state={version:1,status:'dismissed',stage:'welcome'};persist();}
 refresh();}
 function resumeAction(){resume=false;visible=true;const c=getContext();if(state.inspectionId&&c.inspections.some(d=>d.id===state.inspectionId)&&!document.querySelector('dialog[open]'))openDraft(state.inspectionId);refresh();}
 function refresh(){
  if(!initialised)return;clearHighlight();if(!visible){card.remove();return;}
  const c=getContext(),draft=c.inspections.find(d=>d.id===state.inspectionId);
  if(state.status==='active'&&!resume&&state.inspectionId&&!draft){state={...state,stage:'inspection',inspectionId:null,findingId:null};persist();}
  if(state.status==='active'&&!resume&&draft&&state.findingId&&!draft.findings.some(f=>f.id===state.findingId)&&['details','annotate','export','complete'].includes(state.stage)){state={...state,stage:'capture',findingId:null};persist();}
  const openDialogs=[...document.querySelectorAll('dialog[open]')],top=openDialogs.at(-1);
  const hosts={inspectionDialog:'#inspectionTutorial',findingDialog:'#findingTutorial',exportDialog:'#exportTutorial',appInfoDialog:'#installTutorial'};
  if(top&&!hosts[top.id]){card.remove();return;}
  const host=$(top?hosts[top.id]:'#tutorialHost');if(!host)return;host.append(card);actions.replaceChildren();feedback.textContent='';card.querySelector('.tutorial-skip').hidden=state.stage==='complete'&&!resume;
  const step={welcome:1,install:2,inspection:3,capture:4,details:5,annotate:5,export:6,complete:6}[state.stage];card.querySelector('.tutorial-step').textContent=resume?'Your first inspection':state.stage==='complete'?'Tutorial complete':`Step ${step} of 6`;
  if(resume){title.textContent='Resume your walkthrough?';copy.textContent='Continue from where you stopped. Your inspection records are unchanged.';button('Resume tutorial',resumeAction,true);button('Not now',()=>{visible=false;refresh();});return;}
  if(state.stage==='welcome'){title.textContent='Your first inspection';copy.textContent='Create an inspection, capture a finding and export your work. Your records stay on this device, so export a ZIP to keep a separate copy.';button('Start tutorial',start,true);button('Not now',dismiss);return;}
  if(state.stage==='install'){title.textContent='Install for quick access (optional)';const installed=$('#installApp').dataset.state==='installed';copy.textContent=installed?'Safety Fieldbook is running as an installed app. Continue to create your inspection.':'Add Safety Fieldbook to your device’s apps for quick access. Open it online once and wait for Offline ready. You can also continue in this browser.';if(!installed)button('Install as an app',()=>{const control=$('#installApp');if(['update','updating'].includes(control.dataset.state))$('#appInfoDialog').showModal();else control.click();queueMicrotask(refresh);},true);button(installed?'Continue':'Continue in browser',()=>{if($('#appInfoDialog').open)$('#appInfoDialog').close();emit('install-continue');},installed);if(!top)$('#installApp').classList.add('tutorial-target');}
  else if(state.stage==='inspection'){title.textContent='Start with the inspection details';copy.textContent=top?.id==='findingDialog'?'Close this finding form when ready to start a new inspection. Your edits are unchanged.':'Give your inspection a clear title, check the date and enter the inspector’s name. Save it to continue.';if(!top)button('New inspection',()=>openInspection(),true);const target=$(top?.id==='inspectionDialog'?'#inspectionForm button[type="submit"]':'#newInspection');target?.classList.add('tutorial-target');}
  else if(c.currentId!==state.inspectionId&&!top){title.textContent='Return to your tutorial inspection';copy.textContent='Continue the walkthrough in the inspection you started. Other inspections are unchanged.';button('Continue inspection',()=>openDraft(state.inspectionId),true);}
  else if(state.stage==='capture'){title.textContent='Record what you see';copy.textContent='Take a photo, add existing images, or select Add finding to enter the details first. Cancelling a camera or picker will keep you here.';$('.finding-entry-actions')?.classList.add('tutorial-target');}
  else if(state.stage==='details'){title.textContent='Make the finding clear';copy.textContent='Describe what you observed. Add a building, floor or room if useful, then save the finding.';if(!top)button(state.findingId?'Complete finding details':'Add finding',()=>openFinding(state.findingId),true);if(top?.id==='findingDialog')$('#saveFindingDetails').classList.add('tutorial-target');}
  else if(state.stage==='annotate'){title.textContent='Mark up a photo (optional)';copy.textContent='Select a photo in your finding to add arrows, shapes or text. You can add photos or annotations later.';button('Continue to export',()=>emit('annotation-continue'),true);document.querySelector('[data-photo]')?.classList.add('tutorial-target');}
  else if(state.stage==='export'){title.textContent='Keep a copy and share';copy.textContent=top?.id==='exportDialog'?'Choose Compact sharing for a smaller ZIP, then select Download ZIP. The ZIP can be used in Safety Fieldbook Report Studio.':'Export this inspection as a ZIP to keep a separate copy or share your findings. Compact sharing is recommended for Report Studio.';if(!top)button('Export ZIP',()=>openExport(),true);$(top?.id==='exportDialog'?'#downloadExport':'#export')?.classList.add('tutorial-target');if(top?.id==='exportDialog')document.querySelector('input[name="mode"][value="compact"]')?.closest('label')?.classList.add('tutorial-target');}
  else if(state.stage==='complete'){title.textContent='You’re ready for the field';copy.textContent='Check that the ZIP appears in your downloads. Continue adding findings and export another copy whenever needed. Replay this walkthrough from Help.';button('Finish tutorial',()=>{state={...state,status:'complete'};persist();visible=false;refresh();},true);}
  if(c.saveError)feedback.textContent='Local saving needs attention. Keep this page open and resolve the save error before continuing.';
  const announcement=`${state.stage}:${title.textContent}`;if(announcement!==lastAnnouncement){lastAnnouncement=announcement;$('#tutorialAnnouncement').textContent=title.textContent;}
 }
 for(const id of ['inspectionDialog','findingDialog','exportDialog','appInfoDialog','helpDialog','photoImportDialog','photoDialog','captureDialog','unsavedFormDialog'])$('#'+id)?.addEventListener('close',()=>queueMicrotask(refresh));
 const installObserver=new MutationObserver(()=>queueMicrotask(refresh));installObserver.observe($('#installApp'),{attributes:true,attributeFilter:['data-state']});
 window.addEventListener('fieldbook:replay-tutorial',replay);return {init,refresh,event:emit,replay};
}
