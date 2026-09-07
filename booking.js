// portfolio-static/booking.js: Adaptive modal overlay, dynamic slots, honeypot & submission.

const DEFAULT_API_URL = typeof window !== 'undefined' && window.PAX_API_URL
  ? window.PAX_API_URL
  : (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `${window.location.protocol}//${window.location.hostname}:8787`
      : 'https://dashboard.paxfabrica.com');

export const MAX_TOTAL_FILES_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB
export const MAX_FILE_SIZE_BYTES = MAX_TOTAL_FILES_SIZE_BYTES; export const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv', '.ods', '.png', '.jpg', '.jpeg'];

export function formatSlotLabel(slot) {
  if (!slot || !slot.startTime) return 'Créneau indéfini';
  try {
    const d = new Date(slot.startTime);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} à ${timeStr}`;
  } catch {
    return slot.startTime;
  }
}

export async function fetchAvailableSlots(apiBaseUrl = DEFAULT_API_URL, fetchImpl = fetch) {
  const res = await fetchImpl(`${apiBaseUrl}/api/v1/creneaux`);
  if (!res.ok) throw new Error(`Erreur serveur (${res.status}) lors du chargement des créneaux.`);
  const data = await res.json();
  return data.slots || [];
}

export function validateBookingForm(values, fileOrFiles, mode = 'demo') {
  const errors = [];
  if (!values.name || values.name.trim().length < 2) errors.push('Veuillez renseigner votre nom complet.');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!values.email || !emailRegex.test(values.email.trim())) errors.push('Veuillez renseigner une adresse e-mail valide.');
  if (mode === 'demo' && !values.slotId) errors.push('Veuillez sélectionner un créneau de rendez-vous.');

  const filesList = Array.isArray(fileOrFiles) ? fileOrFiles : (fileOrFiles ? [fileOrFiles] : []);
  if (mode === 'pilote' && filesList.length === 0) errors.push('Veuillez déposer vos fichiers (PDF, Excel ou Image/Scan) pour le Pilote 48h.');
  const totalSize = filesList.reduce((acc, f) => acc + (f.size || 0), 0);
  if (totalSize > MAX_TOTAL_FILES_SIZE_BYTES) errors.push('La taille totale des fichiers dépasse 50 Mo.');
  for (const f of filesList) {
    if (!ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      errors.push(`Format non supporté pour "${f.name}". Formats acceptés : .pdf, .xlsx, .xls, .csv, .ods, .png, .jpg, .jpeg.`);
    }
  }
  return { isValid: errors.length === 0, errors };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(undefined);
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result.split(',')[1] : '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function submitBooking(apiBaseUrl = DEFAULT_API_URL, payload = {}, fetchImpl = fetch) {
  const res = await fetchImpl(`${apiBaseUrl}/api/v1/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur lors de la réservation.');
  return data;
}

export async function confirmBookingByToken(apiBaseUrl = DEFAULT_API_URL, token = '', fetchImpl = fetch) {
  const res = await fetchImpl(`${apiBaseUrl}/api/v1/bookings/confirm?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Validation de confirmation échouée.');
  return data;
}

const MODE_CONFIGS = {
  demo: {
    title: '0. Démo Directe en Visio (15 min)', subtitle: 'Découvrez l\'outil en direct sur un DPGF type et posez vos questions techniques ou métier.',
    showSlot: true, slotLabel: '1. Créneau de démo disponible *', showDropzone: false,
    messageLabel: '5. Un message à nous faire parvenir ? (Optionnel)', submitHtml: '<span>Confirmer la réservation de Démo (15 min)</span>',
  },
  pilote: {
    title: '1. Lancer votre Pilote Flash 48 h (490 € net)', subtitle: 'Déposez vos DPGF, BPU, DQE ou scans. Livraison sous 48h du fichier Excel structuré et du rapport d\'anomalies (100 % déduit de l\'Outil Métier).',
    showSlot: false, showDropzone: true, fileLabel: '5. Joindre vos dossiers DPGF, BPU, DQE ou scans (PDF, Excel ou Image, max 50 Mo) *',
    messageLabel: '6. Précisions sur votre dossier (Optionnel)', submitHtml: '<span>Transmettre les fichiers &amp; Lancer le Pilote 48h</span>',
  },
  deploy: {
    title: '2. Mise en Production de Votre Outil Métier', subtitle: 'Déploiement de votre espace web privé dédié (2 990 € net — 50 % d\'acompte à la commande — Pilote 490 € déduit — 1 an de service inclus).',
    showSlot: false, showDropzone: true, fileLabel: '5. Joindre un cahier des charges, trame type ou scan (PDF, Excel ou Image, max 50 Mo)',
    messageLabel: '6. Précisions sur vos volumes ou vos besoins d\'intégration (Optionnel)', submitHtml: '<span>Échanger pour déployer l\'Outil Métier</span>',
  },
  contact: {
    title: '3. Extensions & Automatisation Sur-Mesure', subtitle: 'Recherche dans les archives CCTP/DTU, connecteurs logiciels, workflows sur-mesure.',
    showSlot: false, showDropzone: false, messageLabel: '5. Décrivez vos besoins d\'automatisation ou d\'extensions (Optionnel)',
    submitHtml: '<span>Envoyer la demande de contact / devis</span>',
  },
};

export function initBookingGateway(root = document, { apiBaseUrl = DEFAULT_API_URL, fetchImpl } = {}) {
  const byId = (id) => root.getElementById(id);
  const overlay = byId('gatewayModalOverlay'), backdrop = byId('gatewayModalBackdrop'), btnClose = byId('btnCloseGatewayModal');
  const form = byId('gatewayBookingForm'), slotGroup = byId('gatewaySlotGroup'), dropzoneGroup = byId('gatewayDropzoneGroup');
  const slotSelect = byId('gatewaySlotSelect'), slotLabel = byId('gatewaySlotLabel'), fileLabel = byId('gatewayFileLabel');
  const nameInput = byId('gatewayNameInput'), emailInput = byId('gatewayEmailInput'), companyInput = byId('gatewayCompanyInput');
  const messageInput = byId('gatewayMessageInput'), messageLabel = byId('gatewayMessageLabel');
  const modalTitle = byId('gatewayModalTitle'), modalSubtitle = byId('gatewayModalSubtitle');
  const feedback = byId('gatewayFeedback'), submitBtn = byId('btnSubmitGatewayBooking');
  const dropzone = byId('gatewayFileDropzone'), fileInput = byId('gatewayPdfInput'), fileDisplay = byId('gatewayFileSelectedDisplay');
  const honeypotInput = root.querySelector('input[name="website_url"]');

  const modeBtns = {
    demo: byId('modeBtnDemo'), pilote: byId('modeBtnPilote'),
    deploy: byId('modeBtnDeploy'), contact: byId('modeBtnContact'),
  };

  let currentMode = 'pilote';
  let turnstileToken = 'mock-valid-token';
  let selectedFiles = [];
  if (typeof window !== 'undefined') window.onTurnstileSuccess = (t) => { turnstileToken = t; };

  function setMode(mode) {
    currentMode = mode;
    const cfg = MODE_CONFIGS[mode] || MODE_CONFIGS.pilote;
    Object.entries(modeBtns).forEach(([k, btn]) => btn?.classList.toggle('active', k === mode));
    if (modalTitle) modalTitle.textContent = cfg.title;
    if (modalSubtitle) modalSubtitle.textContent = cfg.subtitle;
    if (slotGroup) slotGroup.style.display = cfg.showSlot ? '' : 'none';
    if (slotLabel && cfg.slotLabel) slotLabel.textContent = cfg.slotLabel;
    if (dropzoneGroup) dropzoneGroup.style.display = cfg.showDropzone ? '' : 'none';
    if (fileLabel && cfg.fileLabel) fileLabel.textContent = cfg.fileLabel;
    if (messageLabel) messageLabel.textContent = cfg.messageLabel;
    if (submitBtn) submitBtn.innerHTML = cfg.submitHtml;
  }

  const openModal = (mode = 'pilote') => {
    setMode(mode);
    overlay?.classList.add('active');
    overlay?.setAttribute('aria-hidden', 'false');
    if (typeof document !== 'undefined' && document.body) document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    overlay?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
    if (typeof document !== 'undefined' && document.body) document.body.style.overflow = '';
  };

  ['Demo', 'Pilote', 'Deploy', 'Contact'].forEach((m) => {
    root.getElementById(`btnSelectMode${m}`)?.addEventListener('click', () => openModal(m.toLowerCase()));
    modeBtns[m.toLowerCase()]?.addEventListener('click', () => setMode(m.toLowerCase()));
  });
  btnClose?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  root.addEventListener?.('keydown', (e) => e.key === 'Escape' && overlay?.classList.contains('active') && closeModal());

  if (slotSelect && (fetchImpl || typeof fetch !== 'undefined')) {
    fetchAvailableSlots(apiBaseUrl, fetchImpl || fetch).then((slots) => {
      slotSelect.innerHTML = slots.length
        ? '<option value="">-- Sélectionnez un créneau --</option>' + slots.map((s) => `<option value="${s.slotId}">${formatSlotLabel(s)}</option>`).join('')
        : '<option value="">Aucun créneau disponible</option>';
    }).catch(() => { slotSelect.innerHTML = '<option value="">Créneaux indisponibles</option>'; });
  }

  function renderFilesList() {
    if (!fileDisplay) return;
    if (selectedFiles.length === 0) {
      fileDisplay.style.display = 'none'; fileDisplay.innerHTML = ''; return;
    }
    fileDisplay.style.display = 'flex';
    fileDisplay.style.flexDirection = 'column';
    fileDisplay.innerHTML = selectedFiles.map((f, idx) => `
      <div class="gateway-file-item" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin-bottom:3px;font-size:0.8rem;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:85%;">📄 ${f.name} <span style="opacity:0.65;">(${(f.size / 1024).toFixed(1)} Ko)</span></span>
        <button type="button" class="gateway-file-remove-btn" data-index="${idx}" style="background:transparent;border:none;color:#ef4444;font-size:1.1rem;cursor:pointer;padding:0 4px;line-height:1;" title="Supprimer">✕</button>
      </div>`).join('');
    fileDisplay.querySelectorAll('.gateway-file-remove-btn').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(i)) { selectedFiles.splice(i, 1); renderFilesList(); }
    }));
  }

  function handleFilesSelection(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    for (const f of list) {
      if (!selectedFiles.some((item) => item.name === f.name && item.size === f.size)) selectedFiles.push(f);
    }
    renderFilesList();
  }

  fileInput?.addEventListener('change', (e) => handleFilesSelection(e.target.files));
  if (dropzone) {
    const preventDrag = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover'].forEach((evt) => dropzone.addEventListener(evt, (e) => { preventDrag(e); dropzone.classList.add('dragover'); }));
    ['dragleave', 'dragend'].forEach((evt) => dropzone.addEventListener(evt, (e) => { preventDrag(e); dropzone.classList.remove('dragover'); }));
    dropzone.addEventListener('drop', (e) => {
      preventDrag(e); dropzone.classList.remove('dragover');
      if (e.dataTransfer?.files?.length) handleFilesSelection(e.dataTransfer.files);
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('dragover', (e) => overlay?.classList.contains('active') && e.preventDefault());
    window.addEventListener('drop', (e) => overlay?.classList.contains('active') && e.preventDefault());
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {
      mode: currentMode, slotId: slotSelect?.value || '', name: nameInput?.value || '',
      email: emailInput?.value || '', company: companyInput?.value || '', message: messageInput?.value || '',
      website_url: honeypotInput?.value || '', cf_turnstile_response: turnstileToken,
    };
    const validation = validateBookingForm(values, selectedFiles, currentMode);
    if (!validation.isValid) {
      feedback.className = 'gateway-feedback-banner error';
      feedback.innerHTML = `⚠️ ${validation.errors.join('<br>')}`;
      feedback.style.display = 'block';
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    feedback.className = 'gateway-feedback-banner pending';
    feedback.textContent = 'Traitement de votre demande en cours...';
    feedback.style.display = 'block';
    try {
      if (selectedFiles.length > 0) {
        values.files = await Promise.all(selectedFiles.map(async (f) => ({
          fileName: f.name, fileSize: f.size, fileBase64: await fileToBase64(f),
        })));
        values.fileName = selectedFiles[0].name;
        values.fileBase64 = values.files[0].fileBase64;
      }
      const result = await submitBooking(DEFAULT_API_URL, values);
      feedback.className = 'gateway-feedback-banner success';
      feedback.innerHTML = `🎉 <strong>Demande enregistrée !</strong> ${result.message}`;
      form.reset();
      selectedFiles = [];
      if (fileDisplay) fileDisplay.style.display = 'none';
    } catch (err) {
      feedback.className = 'gateway-feedback-banner error';
      feedback.textContent = `❌ ${err.message}`;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (typeof document !== 'undefined') {
  const init = () => initBookingGateway(document);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
}
