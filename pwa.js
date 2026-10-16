const status = document.querySelector('#offlineStatus');
const network = document.querySelector('#networkStatus');
const installButton = document.querySelector('#installApp');
const installLabel = document.querySelector('#installLabel');
const updateButton = document.querySelector('#updateApp');
const help = document.querySelector('#installHelp');
let installPrompt, registration, reloading = false;
function updateNetwork() {
  network.hidden = navigator.onLine;
  network.textContent = navigator.onLine ? '' : 'You’re offline';
}
updateNetwork();
window.addEventListener('online', () => { updateNetwork(); registration?.update().catch(() => {}); });
window.addEventListener('offline', updateNetwork);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event;
  installLabel.textContent = 'Install app'; installButton.hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null; installButton.hidden = true; help.hidden = true;
});
installButton.addEventListener('click', async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice; installPrompt = null;
    installLabel.textContent = 'Install app';
  } else {
    help.hidden = !help.hidden;
    installButton.setAttribute('aria-expanded', String(!help.hidden));
    if (!help.hidden) help.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
});
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  installButton.hidden = true;
}
function offlineReady() {
  status.textContent = '✓ Offline ready';
  status.dataset.ready = 'true';
}
function offerUpdate() {
  updateButton.hidden = !(navigator.serviceWorker.controller && registration?.waiting);
}
updateButton.addEventListener('click', () => {
  if (document.querySelector('dialog[open]') ||
      /Saving|failed/i.test(document.querySelector('#saveStatus').textContent)) {
    help.textContent = 'Finish editing and confirm your draft is saved, then apply the update.';
    help.hidden = false; return;
  }
  if (registration?.waiting) {
    reloading = true;
    registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
  }
});
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
