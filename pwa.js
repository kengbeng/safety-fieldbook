const status = document.querySelector('#offlineStatus');
const network = document.querySelector('#networkStatus');
const installButton = document.querySelector('#installApp');
const installLabel = document.querySelector('#installLabel');
const updateButton = document.querySelector('#updateApp');
const help = document.querySelector('#installHelp');
let installPrompt, registration, reloading = false, installedThisSession = false;
const appDisplay = window.matchMedia('(display-mode: standalone)');
function installed(){return installedThisSession || appDisplay.matches || navigator.standalone === true || window.matchMedia('(display-mode: window-controls-overlay)').matches;}
function updateReady(){return !!(navigator.serviceWorker?.controller && registration?.waiting);}
function renderAppControl(){
 const update=updateReady(), app=installed();
 installButton.hidden=false;
 installLabel.textContent=update?'Update & reload':app?'✓ Installed':'Install app';
 installButton.classList.toggle('has-update',update);installButton.classList.toggle('is-installed',app&&!update);
 installButton.title=update?'An update is ready. Finish editing, then update and reload.':app?'Safety Fieldbook is installed':'Install app or view installation instructions';
 installButton.setAttribute('aria-label',installLabel.textContent);installButton.setAttribute('aria-disabled',String(app&&!update));
 installButton.setAttribute('aria-expanded',String(!help.hidden));
 updateButton.hidden=true;
}
appDisplay.addEventListener('change',renderAppControl);
renderAppControl();
function updateNetwork() {
  network.hidden = navigator.onLine;
  network.textContent = navigator.onLine ? '' : 'You’re offline';
}
updateNetwork();
window.addEventListener('online', () => { updateNetwork(); registration?.update().catch(() => {}); });
window.addEventListener('offline', updateNetwork);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event;
  renderAppControl();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null; installedThisSession = true; help.hidden = true; renderAppControl();
});
installButton.addEventListener('click', async () => {
  if(updateReady()){applyUpdate();return;}
  if(installed())return;
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice; installPrompt = null;
    renderAppControl();
  } else {
    help.hidden = !help.hidden;
    installButton.setAttribute('aria-expanded', String(!help.hidden));
    if (!help.hidden) help.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
});
renderAppControl();
function offlineReady() {
  status.textContent = '✓ Offline ready';
  status.dataset.ready = 'true';
}
function offerUpdate() {
  renderAppControl();
}
function applyUpdate() {
  if (document.querySelector('dialog[open]') ||
      /Saving|failed/i.test(document.querySelector('#saveStatus').textContent)) {
    help.textContent = 'Finish editing and confirm your draft is saved, then apply the update.';
    help.hidden = false; return;
  }
  if (registration?.waiting) {
    reloading = true;
    registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
  }
}
updateButton.addEventListener('click', applyUpdate);
if ('serviceWorker' in navigator && window.isSecureContext) {
  try {
    registration = await navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
    if (navigator.serviceWorker.controller) offlineReady();
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'OFFLINE_READY') offlineReady();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) location.reload();
      else { offlineReady(); offerUpdate(); }
    });
    navigator.serviceWorker.ready.then(offlineReady);
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate();
        if (worker.state === 'redundant' && !navigator.serviceWorker.controller) {
          status.textContent = 'Offline preparation failed · Reopen while online';
        }
      });
    });
  } catch (error) {
    status.textContent = 'Offline preparation unavailable · Reopen while online';
    console.error('Offline setup failed', error);
  }
} else {
  status.textContent = 'Offline app loading needs HTTPS and service worker support';
}
