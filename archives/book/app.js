(function () {
  'use strict';

  const BOOK_FILES = {
    summary: { en: '0_summary_en.md', fr: '0_summary_fr.md' },
    ch1: { en: '1_chapter_1_en.md', fr: '1_chapter_1_fr.md' }, proj0: { en: '1_project_1_en.md', fr: '1_project_1_fr.md' },
    ch2: { en: '2_chapter_2_en.md', fr: '2_chapter_2_fr.md' }, proj1: { en: '2_project_2_en.md', fr: '2_project_2_fr.md' },
    ch3: { en: '3_chapter_3_en.md', fr: '3_chapter_3_fr.md' }, proj2: { en: '3_project_3_en.md', fr: '3_project_3_fr.md' },
    ch4: { en: '4_chapter_4_en.md', fr: '4_chapter_4_fr.md' }, proj3: { en: '4_project_4_en.md', fr: '4_project_4_fr.md' },
    ch5: { en: '5_chapter_5_en.md', fr: '5_chapter_5_fr.md' }, proj4: { en: '5_project_5_en.md', fr: '5_project_5_fr.md' },
    ch6: { en: '6_chapter_6_en.md', fr: '6_chapter_6_fr.md' }, proj5: { en: '6_project_6_en.md', fr: '6_project_6_fr.md' },
    ch7: { en: '7_chapter_7_en.md', fr: '7_chapter_7_fr.md' }, proj6: { en: '7_project_7_en.md', fr: '7_project_7_fr.md' }
  };

  const TOC_STRUCTURE = [
    { type: 'item', labelKey: 'book_summary', fileKey: 'summary' },
    { type: 'section', key: 'book_part0' }, { type: 'item', labelKey: 'book_ch1', fileKey: 'ch1' }, { type: 'item', labelKey: 'book_proj0', fileKey: 'proj0' },
    { type: 'section', key: 'book_part1' }, { type: 'item', labelKey: 'book_ch2', fileKey: 'ch2' }, { type: 'item', labelKey: 'book_proj1', fileKey: 'proj1' }, { type: 'item', labelKey: 'book_ch3', fileKey: 'ch3' }, { type: 'item', labelKey: 'book_proj2', fileKey: 'proj2' }, { type: 'item', labelKey: 'book_ch4', fileKey: 'ch4' }, { type: 'item', labelKey: 'book_proj3', fileKey: 'proj3' },
    { type: 'section', key: 'book_part2' }, { type: 'item', labelKey: 'book_ch5', fileKey: 'ch5' }, { type: 'item', labelKey: 'book_proj4', fileKey: 'proj4' }, { type: 'item', labelKey: 'book_ch6', fileKey: 'ch6' }, { type: 'item', labelKey: 'book_proj5', fileKey: 'proj5' },
    { type: 'section', key: 'book_part3' }, { type: 'item', labelKey: 'book_ch7', fileKey: 'ch7' }, { type: 'item', labelKey: 'book_proj6', fileKey: 'proj6' }
  ];

  let currentFileKey = 'summary', currentLang = 'fr', tocListEl, bookContentEl;
  const getLangDict = () => window.TRANSLATIONS ? (window.TRANSLATIONS[currentLang] || window.TRANSLATIONS.fr || window.TRANSLATIONS.en || {}) : {};

  // Markdown renderer with table container wrapper and callout support
  function renderMarkdown(md) {
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        marked.setOptions({ gfm: true, breaks: true });
        let html = marked.parse(md);
        html = html.replace(/<blockquote>\s*<p>\s*<strong>(.*?)<\/strong>/gi, '<blockquote class="callout"><p><strong class="callout-title">$1</strong>');
        html = html.replace(/<table>/gi, '<div class="table-container"><table>').replace(/<\/table>/gi, '</table></div>');
        return html;
      } catch (e) { console.warn('Marked error:', e); }
    }
    return md;
  }

  // Interactive copy button on code blocks
  function attachCodeCopyButtons() {
    if (!bookContentEl) return;
    bookContentEl.querySelectorAll('pre').forEach(pre => {
      if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', currentLang === 'en' ? 'Copy code' : 'Copier le code');
      btn.innerHTML = '<span>📋</span> <span>' + (currentLang === 'en' ? 'Copy' : 'Copier') + '</span>';
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        try {
          await navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
          btn.classList.add('copied');
          btn.innerHTML = '<span>✓</span> <span>' + (currentLang === 'en' ? 'Copied!' : 'Copié !') + '</span>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<span>📋</span> <span>' + (currentLang === 'en' ? 'Copy' : 'Copier') + '</span>';
          }, 2000);
        } catch {}
      });
      wrapper.appendChild(btn);
    });
  }

  // Dynamic Previous / Next chapter footer navigation
  function renderChapterNav(currentKey) {
    if (!bookContentEl) return;
    const existing = bookContentEl.querySelector('.chapter-nav');
    if (existing) existing.remove();

    const langDict = getLangDict(), items = TOC_STRUCTURE.filter(x => x.type === 'item');
    const idx = items.findIndex(x => x.fileKey === currentKey);
    if (idx === -1) return;
    const prevItem = idx > 0 ? items[idx - 1] : null, nextItem = idx < items.length - 1 ? items[idx + 1] : null;
    if (!prevItem && !nextItem) return;

    const nav = document.createElement('nav');
    nav.className = 'chapter-nav';
    const prevLbl = currentLang === 'en' ? 'Previous' : 'Précédent', nextLbl = currentLang === 'en' ? 'Next' : 'Suivant';

    if (prevItem) {
      const prevTitle = langDict[prevItem.labelKey] || prevItem.labelKey, prevBtn = document.createElement('button');
      prevBtn.className = 'chapter-nav-btn prev';
      prevBtn.type = 'button';
      prevBtn.innerHTML = `<span class="chapter-nav-arrow">←</span><div class="chapter-nav-text-group"><span class="chapter-nav-label">${prevLbl}</span><span class="chapter-nav-title">${prevTitle}</span></div>`;
      prevBtn.addEventListener('click', () => loadFile(prevItem.fileKey));
      nav.appendChild(prevBtn);
    } else {
      nav.appendChild(document.createElement('div'));
    }

    if (nextItem) {
      const nextTitle = langDict[nextItem.labelKey] || nextItem.labelKey, nextBtn = document.createElement('button');
      nextBtn.className = 'chapter-nav-btn next';
      nextBtn.type = 'button';
      nextBtn.innerHTML = `<div class="chapter-nav-text-group"><span class="chapter-nav-label">${nextLbl}</span><span class="chapter-nav-title">${nextTitle}</span></div><span class="chapter-nav-arrow">→</span>`;
      nextBtn.addEventListener('click', () => loadFile(nextItem.fileKey));
      nav.appendChild(nextBtn);
    }
    bookContentEl.appendChild(nav);
  }

  // Load a book file by key with smooth scroll and state update
  async function loadFile(fileKey) {
    if (!bookContentEl) bookContentEl = document.getElementById('bookContent');
    const filePath = BOOK_FILES[fileKey] ? BOOK_FILES[fileKey][currentLang] : null;
    if (!filePath) return;

    try {
      let res = await fetch('./' + filePath).catch(() => null);
      if (!res || !res.ok) res = await fetch(filePath).catch(() => null);
      if (!res || !res.ok) res = await fetch('/archives/book/' + filePath).catch(() => null);
      if (!res || !res.ok) res = await fetch('/book/' + filePath).catch(() => null);
      if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'Network Error'}`);

      const md = await res.text();
      if (bookContentEl) {
        bookContentEl.innerHTML = renderMarkdown(md);
        attachCodeCopyButtons();
        renderChapterNav(fileKey);
      }
      currentFileKey = fileKey;
      updateActiveTocItem(fileKey);

      const bookLayout = document.getElementById('bookLayout');
      if (bookLayout) {
        const topOffset = bookLayout.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }

      if (window.innerWidth <= 960 && bookLayout && !bookLayout.classList.contains('toc-hidden')) {
        bookLayout.classList.add('toc-hidden');
        const toggle = document.getElementById('tocToggle');
        if (toggle) {
          toggle.classList.add('toc-hidden');
          const icon = toggle.querySelector('.toggle-icon'), lbl = toggle.querySelector('span:last-child');
          if (icon) icon.textContent = '▶';
          if (lbl) lbl.textContent = currentLang === 'en' ? 'Show Table of Contents' : 'Afficher le Sommaire';
        }
      }
    } catch (err) {
      console.error("Error loading book file:", err);
      if (bookContentEl && !bookContentEl.querySelector('h2')) {
        bookContentEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px;">Error loading content (${filePath}): ${err.message}</p>`;
      }
    }
  }

  // Build the table of contents with sections and visual badges
  function buildToc() {
    if (!tocListEl) tocListEl = document.getElementById('tocList');
    if (!tocListEl) return;
    tocListEl.innerHTML = '';
    const langDict = getLangDict();

    TOC_STRUCTURE.forEach(item => {
      const li = document.createElement('li');
      if (item.type === 'section') {
        const div = document.createElement('div');
        div.className = 'toc-section-header';
        div.textContent = langDict[item.key] || item.key;
        li.appendChild(div);
      } else {
        const btn = document.createElement('button');
        btn.className = 'toc-link';
        btn.type = 'button';
        btn.dataset.fileKey = item.fileKey;
        if (item.fileKey === currentFileKey) btn.classList.add('active');

        let icon = '📖';
        if (item.fileKey === 'summary') icon = '📋';
        else if (item.fileKey.startsWith('proj')) icon = '🛠️';

        const titleText = langDict[item.labelKey] || item.labelKey;
        btn.innerHTML = `<span class="toc-badge">${icon}</span><span class="toc-title">${titleText}</span>`;
        btn.addEventListener('click', function () { loadFile(this.dataset.fileKey); });
        li.appendChild(btn);
      }
      tocListEl.appendChild(li);
    });

    const countBadge = document.getElementById('tocCountBadge');
    if (countBadge) {
      const total = TOC_STRUCTURE.filter(x => x.type === 'item').length;
      countBadge.textContent = `${total} modules`;
    }
  }

  // Update active TOC item and header badge pill
  function updateActiveTocItem(fileKey) {
    if (!tocListEl) tocListEl = document.getElementById('tocList');
    if (tocListEl) {
      tocListEl.querySelectorAll('.toc-link').forEach(link => {
        link.classList.toggle('active', link.dataset.fileKey === fileKey);
      });
    }
    const badgeText = document.getElementById('readingChapterBadgeText');
    if (badgeText) {
      const langDict = getLangDict();
      const it = TOC_STRUCTURE.find(x => x.fileKey === fileKey);
      if (it) badgeText.textContent = langDict[it.labelKey] || it.labelKey;
    }
  }

  // Global listeners (Keyboard, Scroll Progress, Language change)
  function setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const items = TOC_STRUCTURE.filter(x => x.type === 'item');
      const idx = items.findIndex(x => x.fileKey === currentFileKey);
      if (idx === -1) return;
      if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); loadFile(items[idx - 1].fileKey); }
      else if (e.key === 'ArrowRight' && idx < items.length - 1) { e.preventDefault(); loadFile(items[idx + 1].fileKey); }
    });

    window.addEventListener('scroll', () => {
      const bar = document.getElementById('readingProgressBar');
      if (!bar) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = `${docHeight > 0 ? Math.min(100, Math.max(0, (window.pageYOffset / docHeight) * 100)) : 0}%`;
    }, { passive: true });

    const observer = new MutationObserver(() => {
      const newLang = document.documentElement.getAttribute('lang') || 'fr';
      if (newLang !== currentLang) { currentLang = newLang; buildToc(); loadFile(currentFileKey); }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  function init() {
    tocListEl = document.getElementById('tocList');
    bookContentEl = document.getElementById('bookContent');
    currentLang = document.documentElement.getAttribute('lang') || 'fr';
    buildToc();
    loadFile('summary');
    setupListeners();
    if (!window.TRANSLATIONS) window.addEventListener('load', () => buildToc());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();