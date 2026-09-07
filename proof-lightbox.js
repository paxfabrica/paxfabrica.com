// portfolio-static/proof-lightbox.js
// Fluid zoom lightbox and interactive 4-step progression for Pax.Extract proof showcase.

export const PROOF_STEPS = [
  {
    step: 'Étape 01 / 04',
    title: '01 · Document source (PDF)',
    image: './img/1_pdf.png',
    alt: 'Capture d’écran du document DPGF source au format PDF avec lots Menuiseries & Plâtrerie',
    desc: 'Document PDF source (DPGF, CCTP ou BPU) : les données sont extraites et structurées à partir du document source. Les éléments incertains sont signalés pour vérification.',
    tag: 'ENTRÉE BRUTE',
  },
  {
    step: 'Étape 02 / 04',
    title: '02 · Pipeline & Extraction IA',
    image: './img/2_extract.png',
    alt: 'Suivi de traitement Pax.Extract : numérisation OCR et extraction LLM en temps réel',
    desc: 'Pipeline asynchrone temps réel : numérisation OCR haute précision, découpage des blocs et extraction LLM avec barre de progression par lot.',
    tag: 'TRAITEMENT EN DIRECT',
  },
  {
    step: 'Étape 03 / 04',
    title: '03 · Audit & Contrôles Métier',
    image: './img/3_rapport.png',
    alt: 'Synthèse et rapport de contrôle arithmétique avec détection des anomalies',
    desc: 'Contrôle automatique de cohérence arithmétique (détection des écarts PU × Qté ≠ Total), pointage des lignes à valider et traçabilité immédiate vers la page source.',
    tag: 'CONTRÔLE QUALITÉ',
  },
  {
    step: 'Étape 04 / 04',
    title: '04 · Livrable Excel Exploitable',
    image: './img/4_excel.png',
    alt: 'Classeur Excel final structuré avec colonnes normalisées et surlignage des points de vigilance',
    desc: 'Classeur .xlsx final propre et exploitable dans votre logiciel de chiffrage : lignes catégorisées, traçabilité page et surlignage immédiat des lignes à valider.',
    tag: 'LIVRABLE FINAL',
  },
];

let currentIndex = 0;
let isModalOpen = false;

function getElements() {
  return {
    modal: document.getElementById('proofLightbox'),
    backdrop: document.getElementById('proofLightboxBackdrop'),
    closeBtn: document.getElementById('proofLightboxClose'),
    prevBtn: document.getElementById('proofLightboxPrev'),
    nextBtn: document.getElementById('proofLightboxNext'),
    img: document.getElementById('proofLightboxImg'),
    stepEl: document.getElementById('proofLightboxStep'),
    titleEl: document.getElementById('proofLightboxTitle'),
    descEl: document.getElementById('proofLightboxDesc'),
    dotsEl: document.getElementById('proofLightboxDots'),
  };
}

export function openLightbox(index) {
  const elements = getElements();
  if (!elements.modal) return;

  currentIndex = Math.max(0, Math.min(index, PROOF_STEPS.length - 1));
  updateLightboxContent(elements);

  elements.modal.classList.add('active');
  elements.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-locked');
  isModalOpen = true;

  if (elements.closeBtn) {
    elements.closeBtn.focus();
  }
}

export function closeLightbox() {
  const elements = getElements();
  if (!elements.modal || !isModalOpen) return;

  elements.modal.classList.remove('active');
  elements.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-locked');
  isModalOpen = false;
}

export function stepLightbox(direction) {
  const count = PROOF_STEPS.length;
  const nextIndex = (currentIndex + direction + count) % count;
  openLightbox(nextIndex);
}

function updateLightboxContent(elements) {
  const current = PROOF_STEPS[currentIndex];
  if (!current) return;

  if (elements.stepEl) elements.stepEl.textContent = current.step;
  if (elements.titleEl) elements.titleEl.textContent = current.title;
  if (elements.descEl) elements.descEl.textContent = current.desc;

  if (elements.img) {
    elements.img.style.opacity = '0.3';
    elements.img.style.transform = 'scale(0.98)';
    elements.img.src = current.image;
    elements.img.alt = current.alt;

    const onLoad = () => {
      elements.img.style.opacity = '1';
      elements.img.style.transform = 'scale(1)';
      elements.img.removeEventListener('load', onLoad);
    };
    elements.img.addEventListener('load', onLoad);
    if (elements.img.complete) onLoad();
  }

  // Render dots
  if (elements.dotsEl) {
    elements.dotsEl.innerHTML = PROOF_STEPS.map((step, idx) => `
      <button type="button" class="proof-lightbox-dot ${idx === currentIndex ? 'active' : ''}" 
              data-index="${idx}" 
              aria-label="${step.title}">
      </button>
    `).join('');

    const dotButtons = elements.dotsEl.querySelectorAll('.proof-lightbox-dot');
    dotButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index') || '0', 10);
        openLightbox(idx);
      });
    });
  }

  // Update Stepper active state on the main page
  const stepperItems = document.querySelectorAll('.proof-step-nav');
  stepperItems.forEach((item, idx) => {
    if (idx === currentIndex) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

let isInitialized = false;

export function initProofLightbox() {
  if (isInitialized) return;
  isInitialized = true;

  const elements = getElements();

  // Attach click listeners to cards and thumbnails
  const triggers = document.querySelectorAll('[data-proof-index]');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const idx = parseInt(trigger.getAttribute('data-proof-index') || '0', 10);
      openLightbox(idx);
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = parseInt(trigger.getAttribute('data-proof-index') || '0', 10);
        openLightbox(idx);
      }
    });
  });

  // Attach click to stepper navigation
  const stepNavs = document.querySelectorAll('[data-step-target]');
  stepNavs.forEach((nav) => {
    nav.addEventListener('click', () => {
      const idx = parseInt(nav.getAttribute('data-step-target') || '0', 10);
      openLightbox(idx);
    });
  });

  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', closeLightbox);
  }

  if (elements.backdrop) {
    elements.backdrop.addEventListener('click', closeLightbox);
  }

  if (elements.prevBtn) {
    elements.prevBtn.addEventListener('click', () => stepLightbox(-1));
  }

  if (elements.nextBtn) {
    elements.nextBtn.addEventListener('click', () => stepLightbox(1));
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!isModalOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepLightbox(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepLightbox(1);
    }
  });
}

// Auto-initialize when loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProofLightbox);
  } else {
    initProofLightbox();
  }
}
