import {Transfer, config} from './transfer.mjs';

const script = path => new Promise((resolve, reject) => {
  const element = document.createElement('script');
  element.src = new URL(path, import.meta.url);
  element.onload = resolve;
  element.onerror = () => reject(Error('QR support could not load. Try again or use a ZIP file.'));
  document.head.append(element);
});
let qrReady, scanReady;
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
export function completionText(outcome = {}) {
  const parts = [];
  if (outcome.duplicates) parts.push(`${outcome.duplicates} identical finding${outcome.duplicates === 1 ? '' : 's'} skipped`);
  if (outcome.conflicts) parts.push(`${outcome.conflicts} conflicting version${outcome.conflicts === 1 ? '' : 's'} to review`);
  if (outcome.warnings) parts.push(`${outcome.warnings} import note${outcome.warnings === 1 ? '' : 's'} to review`);
  return parts.length ? parts.join(' · ') + '.' : 'The inspection is ready to review in Report Studio.';
}
export function friendlyError(error) {
  const text = String(error?.message || 'The connection could not be completed.');
  if (/JSON|Unexpected token|Invalid or expired pairing/.test(text)) return 'This pairing code is invalid or has expired. Generate a new QR in Report Studio, then scan or paste it again.';
  if (/Signalling|fetch|network|timed out|Connection|connection|Data connection/i.test(text)) return 'The devices could not stay connected. Keep both apps open and try the same Wi-Fi network. If this still fails, use a ZIP file.';
  return text;
}

export async function openTransfer(options) {
  const {role, prepare, importFile, context = '', description = '', fallback, review} = options;
  const sender = role === 'sender';
  const dialog = document.createElement('dialog');
  dialog.className = 'device-transfer';
  dialog.setAttribute('aria-label', sender ? 'Send to Report Studio' : 'Receive from Safety Fieldbook');
  dialog.innerHTML = `
    <header class="transfer-heading"><p class="transfer-eyebrow">DEVICE TRANSFER</p><h2>${sender ? 'Send to Report Studio' : 'Receive from Safety Fieldbook'}</h2></header>
    <div class="transfer-body">
      <p class="transfer-context" data-context></p><p class="transfer-description" data-description></p>
      <ol class="transfer-steps" aria-label="Transfer steps"><li data-step="0">Pair</li><li data-step="1">Verify</li><li data-step="2">Transfer</li><li data-step="3">Save</li></ol>
      <h3 data-stage tabindex="-1"></h3><p data-status role="status" aria-live="polite">Starting…</p>
      <div data-qr></div><div data-camera hidden><video playsinline muted aria-label="Scan Report Studio QR"></video><p>Point the rear camera at the QR in Report Studio.</p></div>
      <section class="transfer-verification" data-verification hidden><p data-code></p><p>${sender ? 'No further tap is needed on this phone.' : 'Confirming receives the inspection into the report named above.'}</p></section>
      <p class="transfer-file" data-file hidden></p>
      <section class="transfer-progress" data-progress hidden><div><span data-progress-label></span><strong data-percent></strong></div><progress max="1" value="0" aria-label="Inspection transfer progress"></progress><p data-bytes></p></section>
      <details class="transfer-manual" data-manual hidden><summary>Use a pairing code instead</summary><p>In Report Studio, open “Copy pairing code instead”. Copy the whole code and paste it here. This is not the short verification code.</p><label>Pairing code<textarea rows="3" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea></label><button type="button" class="transfer-secondary" data-pair>Connect devices</button></details>
      <p class="transfer-note" data-note>Keep both apps open. The original inspection stays on the phone. Direct transfer needs a network connection; ZIP export and import also work offline.</p>
    </div>
    <footer class="transfer-footer"><button type="button" class="transfer-secondary" data-close>Cancel</button><button type="button" class="transfer-secondary" data-retry hidden>Try again</button><button type="button" class="transfer-secondary" data-fallback>${sender ? 'Download ZIP instead' : 'Choose ZIP instead'}</button><button type="button" class="transfer-primary" data-verify hidden>Codes match · Receive inspection</button><button type="button" class="transfer-primary" data-review hidden>Review findings</button></footer>`;
  document.body.append(dialog);
  dialog.showModal();
  const $ = selector => dialog.querySelector(selector);
  $('[data-context]').textContent = context;
  $('[data-context]').hidden = !context;
  $('[data-description]').textContent = description;
  $('[data-description]').hidden = !description;
  $('[data-fallback]').hidden = !fallback;
  let transfer, stream, scanTimer, countdown, stopped = false, paired = false, saving = false, finished = false, sendingStarted = false;
  const setStatus = text => { if (!stopped) $('[data-status]').textContent = text; };
  const step = index => {
    dialog.querySelectorAll('[data-step]').forEach((item, i) => {
      item.dataset.state = i < index ? 'done' : i === index ? 'current' : 'pending';
      if (i === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
  };
  const stopCamera = () => {
    clearTimeout(scanTimer);
    stream?.getTracks().forEach(track => track.stop());
    $('[data-camera]').hidden = true;
  };
  const close = () => {
    if (saving) return;
    stopped = true;
    stopCamera();
    clearInterval(countdown);
    transfer?.close();
    dialog.close();
    dialog.remove();
  };
  $('[data-close]').onclick = close;
  dialog.addEventListener('cancel', event => {event.preventDefault(); close();});
  $('[data-fallback]').onclick = () => {close(); fallback?.();};
  $('[data-retry]').onclick = () => {close(); openTransfer(options);};
  $('[data-review]').onclick = () => {close(); review?.();};
  const progressState = (label, indeterminate = false) => {
    $('[data-progress]').hidden = false;
    $('[data-progress-label]').textContent = label;
    if (indeterminate) {
      $('progress').removeAttribute('value');
      $('[data-percent]').textContent = '';
      $('[data-bytes]').textContent = 'Keep this window open until saving is confirmed.';
    }
  };
  const phase = name => {
    if (stopped) return;
    const headings = {connecting:'Connecting devices',verification:'Compare the codes',ready:sender?'Ready to send':'Ready to receive','waiting-accept':'Confirm on Report Studio',sending:'Sending inspection',receiving:'Receiving inspection',checking:'Checking the file',saving:'Saving inspection','waiting-save':'Waiting for Report Studio'};
    $('[data-stage]').textContent = headings[name] || 'Pair your devices';
    const index = ['checking','saving','waiting-save'].includes(name) ? 3 : ['ready','waiting-accept','sending','receiving'].includes(name) ? 2 : name === 'verification' ? 1 : 0;
    step(index);
    $('[data-retry]').hidden = true;
    if (['ready','sending','receiving'].includes(name)) $('[data-verification]').hidden = true;
    if (name === 'waiting-accept') progressState('Waiting for acceptance',true);
    if (name === 'connecting') {stopCamera(); $('[data-manual]').hidden = true;}
    if (name === 'sending' || name === 'receiving') {
      $('[data-close]').textContent = 'Cancel transfer';
      $('[data-fallback]').hidden = true;
      progressState(sender ? 'Sending file' : 'Receiving file');
    }
    if (['checking','saving','waiting-save'].includes(name)) progressState(headings[name], true);
    if (name === 'saving') {
      saving = true;
      $('[data-close]').disabled = true;
      $('[data-close]').textContent = 'Saving…';
    }
  };
  const fatal = error => {
    if (stopped) return;
    saving = false;
    stopCamera(); clearInterval(countdown);
    dialog.dataset.outcome = 'error';
    $('[data-stage]').textContent = 'Transfer not completed';
    setStatus(friendlyError(error));
    $('[data-verify]').hidden = $('[data-verification]').hidden = $('[data-progress]').hidden = true;
    $('[data-qr]').replaceChildren();
    $('[data-manual]').hidden = true;
    $('[data-close]').disabled = false;
    $('[data-close]').textContent = 'Close';
    $('[data-retry]').hidden = false;
    $('[data-retry]').textContent = sender ? 'Scan again' : 'Generate new QR';
    $('[data-fallback]').hidden = !fallback;
    $('[data-note]').textContent = 'The phone inspection is unchanged. If the connection was lost while saving, check Report Studio before trying again.';
    $('[data-stage]').focus();
  };
  const complete = outcome => {
    saving = false; finished = true;
    clearInterval(countdown);
    dialog.dataset.outcome = 'success';
    step(4);
    $('[data-stage]').textContent = 'Inspection saved in Report Studio';
    setStatus(completionText(outcome));
    $('[data-verification]').hidden = $('[data-file]').hidden = $('[data-verify]').hidden = true;
    progressState('Saved successfully');
    $('progress').max = 100; $('progress').value = 100;
    $('[data-percent]').textContent = '100%'; $('[data-bytes]').textContent = 'File checked and import saved.';
    $('[data-close]').disabled = false;
    $('[data-close]').textContent = 'Done';
    $('[data-fallback]').hidden = true;
    $('[data-review]').hidden = sender || !review;
    $('[data-note]').textContent = sender ? 'The original inspection and photographs remain on this phone.' : 'Review the imported findings and any notes before exporting your report.';
    $('[data-stage]').focus();
  };
  try {
    step(0); $('[data-stage]').textContent = sender ? 'Scan the Report Studio QR' : 'Scan this QR from your phone';
    const settings = await config();
    if (stopped) return;
    transfer = new Transfer(settings, {
      status:setStatus, phase, importFile, complete, error:fatal,
      verify:code => {
        stopCamera(); clearInterval(countdown);
        $('[data-qr]').replaceChildren(); $('[data-manual]').hidden = true;
        $('[data-verification]').hidden = false;
        $('[data-code]').textContent = code;
        $('[data-note]').textContent = 'Keep both apps open. The original inspection stays on the phone.';
        $('[data-verify]').hidden = sender;
        if (!sender) setStatus('Check that this code matches the code shown on the phone, then confirm below.');
        if (sender) {
          transfer.confirm();
          if (!transfer.peerVerified) setStatus('Waiting for confirmation on the receiving device. Check the matching code there, then choose Receive inspection.');
        }
        $('[data-stage]').focus();
      },
      progress:(done, total) => {
        if (stopped) return;
        progressState(sender ? 'Sending file' : 'Receiving file');
        $('progress').max = total; $('progress').value = done;
        const percent = Math.floor(done / total * 100);
        $('[data-percent]').textContent = `${percent}%`;
        $('[data-bytes]').textContent = `${formatBytes(done)} of ${formatBytes(total)}`;
      },
      incoming:metadata => {
        phase('ready');
        $('[data-file]').hidden = false;
        $('[data-file]').textContent = `${metadata.description || metadata.name} · ${formatBytes(metadata.size)}`;
        setStatus('Receiving the inspection into the report named above. Identical findings are skipped; changed versions are kept for review.');
        transfer.accept();
      }
    });
    $('[data-verify]').onclick = () => {
      try {transfer.confirm(); $('[data-verify]').hidden = true; $('[data-verification]').hidden = true;}
      catch (error) {transfer.fail(error);}
    };
    if (!sender) {
      const text = await transfer.receive();
      if (stopped) {transfer.close(); return;}
      try {await(qrReady ??= script('./transfer-vendor/qrcode.js'));} catch(error) {qrReady = null; throw error;}
      if (stopped) return;
      const qr = globalThis.qrcode(0, 'M'); qr.addData(text); qr.make();
      $('[data-qr]').innerHTML = qr.createSvgTag({cellSize:4, margin:4, scalable:true});
      const svg = $('[data-qr] svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'One-time Report Studio pairing QR code');
      const instructions = document.createElement('p');
      instructions.textContent = 'On the phone: open the inspection → Export ZIP for Report Studio → Send to Report Studio.';
      const expiry = document.createElement('p'); expiry.className = 'transfer-expiry';
      const details = document.createElement('details'), summary = document.createElement('summary'), code = document.createElement('textarea'), copy = document.createElement('button'), copied = document.createElement('p');
      summary.textContent = 'Copy pairing code instead'; code.value = text; code.readOnly = true; code.rows = 3; code.setAttribute('aria-label','One-time pairing code');
      copy.type = 'button'; copy.className = 'transfer-secondary'; copy.textContent = 'Copy code';
      copied.setAttribute('role','status');
      copy.onclick = async () => {try {await navigator.clipboard.writeText(text); copied.textContent = 'Pairing code copied. Paste it on the phone.';} catch {code.focus(); code.select(); copied.textContent = 'Code selected. Use your device’s Copy command.';}};
      details.className = 'transfer-manual'; details.append(summary,code,copy,copied);
      const regenerate = document.createElement('button'); regenerate.type = 'button'; regenerate.className = 'transfer-link'; regenerate.textContent = 'Generate new QR'; regenerate.onclick = () => {close(); openTransfer(options);};
      $('[data-qr]').append(instructions,expiry,regenerate,details);
      const updateExpiry = () => {const seconds = Math.max(0,Math.ceil((transfer.expires-Date.now())/1000)); expiry.textContent = `QR expires in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}.`;};
      updateExpiry(); countdown = setInterval(updateExpiry,1000);
      $('[data-stage]').textContent = 'Scan this QR from your phone';
      setStatus('In Safety Fieldbook, choose Send to Report Studio to open the phone camera.');

    } else {
      const pair = async text => {
        if (paired || stopped) return;
        paired = true; stopCamera(); $('[data-pair]').disabled = true;
        try {await transfer.send(text);} catch(error) {transfer.fail(error);}
      };
      $('[data-manual]').hidden = false;
      $('[data-pair]').onclick = () => pair($('textarea').value.trim());
      transfer.onready = async () => {
        if (sendingStarted || stopped) return;
        sendingStarted = true;
        $('[data-stage]').textContent = 'Preparing inspection';
        progressState('Preparing Compact ZIP',true);
        try {
          setStatus('Receiver confirmed. Preparing the inspection and photographs…');
          const {blob, name} = await prepare(setStatus);
          if (!stopped) await transfer.offer(blob,name,description ? `${context} · ${description}`.slice(0,300) : context.slice(0,300));
        } catch(error) {transfer.fail(error);}
      };
      setStatus('In Report Studio, open a report and choose Receive from Safety Fieldbook. Scan the QR shown there.');
      try {
        try {await(scanReady ??= script('./transfer-vendor/jsQR.js'));} catch(error) {scanReady = null; throw error;}
        if (stopped || paired) return;
        stream = await navigator.mediaDevices.getUserMedia({audio:false, video:{facingMode:{ideal:'environment'},width:{ideal:960}}});
        if (stopped || paired) {stopCamera(); return;}
        const video = $('video'); $('[data-camera]').hidden = false; video.srcObject = stream; await video.play();
        const canvas = document.createElement('canvas'), context2D = canvas.getContext('2d',{willReadFrequently:true});
        const scan = () => {
          if (stopped || paired || finished) return;
          try {
            if (video.readyState >= 2) {
              canvas.width = video.videoWidth; canvas.height = video.videoHeight;
              context2D.drawImage(video,0,0);
              const pixels = context2D.getImageData(0,0,canvas.width,canvas.height);
              const result = globalThis.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'});
              if (result) {pair(result.data); return;}
            }
            scanTimer = setTimeout(scan,200);
          } catch {stopCamera(); $('[data-manual]').open = true; setStatus('Camera scanning stopped. Paste the pairing code from Report Studio below.');}
        };
        scan();
      } catch {
        if (!stopped && !paired) {
          $('[data-manual]').open = true;
          setStatus('The camera is unavailable. Allow camera access and choose Scan again, or paste the pairing code below.');
          $('[data-retry]').hidden = false; $('[data-retry]').textContent = 'Scan again';
        }
      }
    }
  } catch(error) {transfer?.close(); fatal(error);}
}
