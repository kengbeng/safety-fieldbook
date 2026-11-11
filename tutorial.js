export const TUTORIAL_STAGES=['welcome','install','inspection','capture','details','annotate','export','complete'];
export function transition(state,event,data={}){
 if(state.status!=='active')return state;
 const next={...state};
 if(event==='install-continue'&&state.stage==='install')next.stage='inspection';
 if(event==='inspection-created'&&state.stage==='inspection'&&data.inspectionId)next.pendingInspectionId=data.inspectionId;
 if(event==='inspection-saved'&&state.stage==='inspection'&&(data.isNew||data.inspectionId===state.pendingInspectionId)){next.stage='capture';next.inspectionId=data.inspectionId;next.pendingInspectionId=null;next.findingId=null;}
 if(data.inspectionId===state.inspectionId){
  if((event==='finding-opened'||event==='photos-saved')&&state.stage==='capture'){next.stage='details';next.findingId=data.findingId||null;}
  if(event==='photos-saved'&&state.stage==='details'&&(!state.findingId||state.findingId===data.findingId))next.findingId=data.findingId;
  if(event==='finding-saved'&&state.stage==='details'&&data.description?.trim()&&(!state.findingId||data.findingId===state.findingId)){next.stage='annotate';next.findingId=data.findingId;}
  if(event==='export-requested'&&state.stage==='export'&&data.mode!=='recovery')next.stage='complete';
 }
 if(event==='annotation-continue'&&state.stage==='annotate'&&data.photoCount>0){next.stage='export';next.photosSkipped=false;}
 if(event==='photos-skip'&&state.stage==='annotate'&&data.photoCount===0){next.stage='export';next.photosSkipped=true;}
 return next;
}
export function readProgress(storage,key){try{const s=JSON.parse(storage.getItem(key));if(s?.version===1&&['active','dismissed','complete','invited'].includes(s.status)&&TUTORIAL_STAGES.includes(s.stage))return s;}catch{}return null;}
export function createTutorial({getContext,openInspection,openFinding,addImages,openExport,openDraft,storage=null}){
 try{storage=storage||window.localStorage;}catch{}
 const key='safety-fieldbook:tutorial:'+new URL('./',location.href).pathname;
 let state=null,initialised=false,visible=false,resume=false,lastAnnouncement='',lastFocusKey='';
 const $=s=>document.querySelector(s),card=document.createElement('section');card.className='tutorial-card';card.setAttribute('aria-label','First inspection tutorial');card.innerHTML='<div class="tutorial-heading"><span class="tutorial-step"></span><button type="button" class="tutorial-skip">Skip tutorial</button></div><h2 class="tutorial-title" tabindex="-1"></h2><p class="tutorial-copy"></p><p class="tutorial-feedback" role="status" aria-live="polite"></p><div class="tutorial-actions"></div>';
 const title=card.querySelector('.tutorial-title'),copy=card.querySelector('.tutorial-copy'),actions=card.querySelector('.tutorial-actions'),feedback=card.querySelector('.tutorial-feedback');

 const popup=document.createElement('dialog');popup.className='tutorial-popup';popup.setAttribute('aria-labelledby','tutorialPopupTitle');
 const coach=document.createElement('div');coach.className='tutorial-popover';coach.setAttribute('popover','manual');coach.setAttribute('role','dialog');coach.setAttribute('aria-modal','false');coach.setAttribute('aria-labelledby','tutorialPopupTitle');coach.hidden=true;
 title.id='tutorialPopupTitle';document.body.append(popup,coach);let coachVisible=false,positionFrame=0;
 function hideCoach(){coachVisible=false;if(coach.matches(':popover-open'))coach.hidePopover();coach.hidden=true;}
 function hidePresentation(){hideCoach();if(popup.open)popup.close();}
 function pause(){visible=false;if(state?.status==='invited')state={...state,status:'dismissed'};persist();hidePresentation();card.remove();clearHighlight();}
 popup.addEventListener('cancel',event=>{event.preventDefault();pause();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&coachVisible&&!document.querySelector('dialog[open]')){event.preventDefault();pause();}});
 function placeCard(host,center){
  if(host){hidePresentation();host.append(card);return;}
  if(center){hideCoach();popup.append(card);if(!popup.open)popup.showModal();return;}
  if(popup.open)popup.close();coach.append(card);coach.hidden=false;coachVisible=true;if(coach.showPopover&&!coach.matches(':popover-open'))coach.showPopover();queueMicrotask(positionCoach);
 }
 function positionCoach(){if(!coachVisible||coach.hidden)return;const target=document.querySelector('.tutorial-target'),r=target?.getBoundingClientRect(),box=coach.getBoundingClientRect(),margin=16;
  if(innerWidth<=700){const bar=document.querySelector('.finding-entry-actions'),b=bar?.getBoundingClientRect();const fixed=bar&&getComputedStyle(bar).position==='fixed'&&b.top<innerHeight;coach.style.left='16px';coach.style.right='16px';coach.style.top='auto';coach.style.bottom=(fixed?Math.max(16,innerHeight-b.top+12):16)+'px';return;}
  coach.style.right='auto';coach.style.bottom='auto';const width=box.width,height=box.height;
  let left=innerWidth-width-margin,top=100;
  if(r&&r.bottom>0&&r.top<innerHeight){left=Math.min(innerWidth-width-margin,Math.max(margin,r.right-width));if(r.bottom+12+height<=innerHeight-margin)top=r.bottom+12;else if(r.top-12-height>=margin)top=r.top-12-height;else{top=Math.max(margin,Math.min(innerHeight-height-margin,r.top));left=r.left-width-16>=margin?r.left-width-16:r.right+16+width<=innerWidth-margin?r.right+16:left;}}
  coach.style.left=left+'px';coach.style.top=Math.max(margin,Math.min(top,innerHeight-height-margin))+'px';
 }
 function requestPosition(){if(!positionFrame)positionFrame=requestAnimationFrame(()=>{positionFrame=0;positionCoach();});}
 window.addEventListener('resize',requestPosition);window.addEventListener('scroll',requestPosition,{passive:true});window.visualViewport?.addEventListener('resize',requestPosition);
 new ResizeObserver(requestPosition).observe(card);

 function persist(){try{storage.setItem(key,JSON.stringify(state));}catch{}}
 function clearHighlight(){document.querySelectorAll('.tutorial-target').forEach(n=>n.classList.remove('tutorial-target'));}
 function setState(value){state=value;persist();refresh();}
 function dismiss(){visible=false;resume=false;state={...state,status:'dismissed'};persist();refresh();}
 card.querySelector('.tutorial-skip').onclick=dismiss;
 function button(text,handler,primary=false){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.tutorialAction=text;if(primary)b.className='primary';b.onclick=handler;actions.append(b);}
 function start(){visible=true;resume=false;setState({version:1,status:'active',stage:'install',inspectionId:null,findingId:null});}
 function emit(event,data={}){if(getContext().saveError&&['inspection-saved','finding-opened','finding-saved','photos-saved','annotation-continue','photos-skip','export-requested'].includes(event))return;const next=transition(state||{},event,data);if(next!==state){state=next;persist();}refresh();}
 function replay(){visible=true;resume=false;state={version:1,status:'invited',stage:'welcome',inspectionId:null,findingId:null};persist();refresh();title.focus({preventScroll:false});}
 function init(existingCount){initialised=true;state=readProgress(storage,key);const request=new URL(location.href);if(request.searchParams.get('tutorial')==='1'){request.searchParams.delete('tutorial');history.replaceState(null,'',request);replay();return;}
 if(state?.status==='active'){visible=true;resume=true;}
 else if(!state&&existingCount===0){state={version:1,status:'invited',stage:'welcome'};visible=true;persist();}
 else if(!state){state={version:1,status:'dismissed',stage:'welcome'};persist();}
 refresh();}
 function resumeAction(){resume=false;visible=true;const c=getContext();if(state.inspectionId&&c.inspections.some(d=>d.id===state.inspectionId)&&!document.querySelector('dialog[open]:not(.tutorial-popup)'))openDraft(state.inspectionId);refresh();}

 function refresh(){
  const before=document.activeElement,actionKey=before?.dataset?.tutorialAction,hadCardFocus=card.contains(before);
  renderTutorial();
  if(!card.isConnected){lastFocusKey='';if(hadCardFocus&&document.activeElement===document.body){const open=[...document.querySelectorAll('dialog[open]:not(.tutorial-popup)')].at(-1);(open?.querySelector('input,textarea,button')||$('#pageTitle'))?.focus({preventScroll:true});}return;}
  const key=(resume?'resume':state.stage)+':'+title.textContent,changed=key!==lastFocusKey;lastFocusKey=key;
  const insideForm=!!card.closest('form')||!!card.closest('#appInfoDialog');
  if((changed&&!insideForm)||(hadCardFocus&&actionKey)){queueMicrotask(()=>{if(!card.isConnected||key!==lastFocusKey)return;const same=!changed&&[...actions.querySelectorAll('button')].find(b=>b.dataset.tutorialAction===actionKey);const target=same||actions.querySelector('.primary')||actions.querySelector('button')||title;target.focus({preventScroll:true});});}
 }

 function renderTutorial(){
  if(!initialised)return;clearHighlight();if(!visible){hidePresentation();card.remove();return;}
  const c=getContext(),draft=c.inspections.find(d=>d.id===state.inspectionId),pending=c.inspections.find(d=>d.id===state.pendingInspectionId);
  if(state.pendingInspectionId&&!pending){state={...state,pendingInspectionId:null};persist();}
  const finding=draft?.findings.find(f=>f.id===state.findingId);
  if(state.status==='active'&&!resume&&state.stage==='export'&&finding&&!finding.photos.length&&!state.photosSkipped){state={...state,stage:'annotate'};persist();}
  if(state.status==='active'&&!resume&&state.inspectionId&&!draft){state={...state,stage:'inspection',inspectionId:null,findingId:null};persist();}
  if(state.status==='active'&&!resume&&draft&&state.findingId&&!draft.findings.some(f=>f.id===state.findingId)&&['details','annotate','export','complete'].includes(state.stage)){state={...state,stage:'capture',findingId:null};persist();}
  const openDialogs=[...document.querySelectorAll('dialog[open]:not(.tutorial-popup)')],top=openDialogs.at(-1);
  const hosts={inspectionDialog:'#inspectionTutorial',findingDialog:'#findingTutorial',exportDialog:'#exportTutorial',appInfoDialog:'#installTutorial'};
  if(top&&!hosts[top.id]){hidePresentation();card.remove();return;}
  const host=top?$(hosts[top.id]):null;if(top&&!host)return;placeCard(host,!top&&(resume||['welcome','install','complete'].includes(state.stage)));actions.replaceChildren();feedback.textContent='';card.querySelector('.tutorial-skip').hidden=state.stage==='complete'&&!resume;
  const step={welcome:1,install:2,inspection:3,capture:4,details:5,annotate:5,export:6,complete:6}[state.stage];card.querySelector('.tutorial-step').textContent=resume?'Your first inspection':state.stage==='complete'?'Tutorial complete':`Step ${step} of 6`;
  if(resume){title.textContent='Resume your walkthrough?';copy.textContent='Continue from where you stopped. Your inspection records are unchanged.';button('Resume tutorial',resumeAction,true);button('Not now',()=>{visible=false;refresh();});return;}
  if(state.stage==='welcome'){title.textContent='Your first inspection';copy.textContent='Create an inspection, capture a finding and export your work. Your records stay on this device, so export a ZIP to keep a separate copy.';button('Start tutorial',start,true);button('Not now',dismiss);return;}
  if(state.stage==='install'){title.textContent='Install for quick access (optional)';const installed=$('#installApp').dataset.state==='installed';copy.textContent=installed?'Safety Fieldbook is running as an installed app. Continue to create your inspection.':'Add Safety Fieldbook to your device’s apps for quick access. Open it online once and wait for Offline ready. You can also continue in this browser.';if(!installed)button('Install as an app',()=>{const control=$('#installApp');if(['update','updating'].includes(control.dataset.state))$('#appInfoDialog').showModal();else control.click();queueMicrotask(refresh);},true);button(installed?'Continue':'Continue in browser',()=>{if($('#appInfoDialog').open)$('#appInfoDialog').close();emit('install-continue');},installed);if(!top)$('#installApp').classList.add('tutorial-target');}
  else if(state.stage==='inspection'){title.textContent=pending?'Save your inspection to continue':'Start with the inspection details';copy.textContent=top?.id==='findingDialog'?'Close this finding form when ready to start a new inspection. Your edits are unchanged.':pending?'Your inspection details are kept in this session. Retry saving them; there is no need to create another inspection.':'Give your inspection a clear title, check the date and enter the inspector’s name. Save it to continue.';if(!top)button(pending?'Retry saving inspection':'New inspection',()=>openInspection(pending?.id),true);const target=$(top?.id==='inspectionDialog'?'#inspectionForm button[type="submit"]':pending&&c.currentId===pending.id?'#editInspection':'#newInspection');target?.classList.add('tutorial-target');}
  else if(c.currentId!==state.inspectionId&&!top){title.textContent='Return to your tutorial inspection';copy.textContent='Continue the walkthrough in the inspection you started. Other inspections are unchanged.';button('Continue inspection',()=>openDraft(state.inspectionId),true);}
  else if(state.stage==='capture'){title.textContent='Record what you see';copy.textContent='Take a photo, add existing images, or select Add finding to enter the details first. Cancelling a camera or picker will keep you here.';$('.finding-entry-actions')?.classList.add('tutorial-target');}
  else if(state.stage==='details'){title.textContent='Make the finding clear';copy.textContent='Describe what you observed. Add a building, floor or room if useful, then save the finding.';if(!top)button(state.findingId?'Complete finding details':'Add finding',()=>openFinding(state.findingId),true);if(top?.id==='findingDialog')$('#saveFindingDetails').classList.add('tutorial-target');}
  else if(state.stage==='annotate'){const count=finding?.photos.length||0;if(!count){title.textContent='Add a photo, or skip for now';copy.textContent='This finding has no photos. Add an image to practise photo annotations, or choose to continue without photos. It will be exported as a draft.';button('Add images to this finding',()=>addImages(state.findingId),true);button('Continue without photos',()=>emit('photos-skip',{photoCount:0}));}else{title.textContent='Mark up a photo (optional)';copy.textContent='Select a photo in this finding to add arrows, shapes or text. You can also continue without annotating it.';button('Continue to export',()=>emit('annotation-continue',{photoCount:count}),true);[...document.querySelectorAll('[data-photo]')].find(el=>el.dataset.finding===state.findingId)?.classList.add('tutorial-target');}}
  else if(state.stage==='export'){title.textContent='Keep a copy and share';copy.textContent=top?.id==='exportDialog'?'Choose Compact sharing for a smaller ZIP, then select Download ZIP. The ZIP can be used in Safety Fieldbook Report Studio.':'Export this inspection as a ZIP to keep a separate copy or share your findings. Compact sharing is recommended for Report Studio.';if(!top)button('Export ZIP',()=>openExport(),true);$(top?.id==='exportDialog'?'#downloadExport':'#export')?.classList.add('tutorial-target');if(top?.id==='exportDialog')document.querySelector('input[name="mode"][value="compact"]')?.closest('label')?.classList.add('tutorial-target');}
  else if(state.stage==='complete'){title.textContent='You’re ready for the field';copy.textContent='Check that the ZIP appears in your downloads. Continue adding findings and export another copy whenever needed. Replay this walkthrough from Help.';button('Finish tutorial',()=>{state={...state,status:'complete'};persist();visible=false;refresh();},true);}
  if(c.saveError)feedback.textContent='Local saving needs attention. Keep this page open and resolve the save error before continuing.';
  const announcement=`${state.stage}:${title.textContent}`;if(announcement!==lastAnnouncement){lastAnnouncement=announcement;$('#tutorialAnnouncement').textContent=title.textContent;}
 }
 for(const id of ['inspectionDialog','findingDialog','exportDialog','appInfoDialog','helpDialog','photoImportDialog','photoDialog','captureDialog','unsavedFormDialog'])$('#'+id)?.addEventListener('close',()=>queueMicrotask(refresh));
 const installObserver=new MutationObserver(()=>queueMicrotask(refresh));installObserver.observe($('#installApp'),{attributes:true,attributeFilter:['data-state']});
 window.addEventListener('fieldbook:replay-tutorial',replay);return {init,refresh,event:emit,replay};
}
