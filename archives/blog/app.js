(function () {
  'use strict';

  /**
   * Articles sélectionnés pour le profil AI Product Engineer dans le BTP
   */
  const ARTICLES = [
    {
      slug: '2026-08-25-ai-product-engineer-btp',
      title: "AI Product Engineer dans le BTP : le métier qui transforme les processus de construction en produits IA",
      desc: "Pourquoi une démo ChatGPT ne fait pas un produit exploitable dans le BTP : tolérance zéro sur les DPGF et CCTP, analyse de disposition documentaire, validation déterministe et architecture logicielle hybride.",
      date: '25 Août 2026',
      tag: '🏗️ Métier & BTP',
      readTime: '11 min de lecture',
      pills: ['#BTP', '#AIProductEngineer', '#DPGF', '#Architecture']
    },
    {
      slug: '2026-08-20-ia-btp-decryptage-produit-revolution-terrain',
      title: "IA et BTP : Décryptage Produit d'une Révolution sur le Terrain",
      desc: "Analyse des opportunités et écueils du déploiement de produits IA dans le BTP : cartographie chronologique de l'acte de construire, product-market fit terrain, explicabilité et retours d'expérience.",
      date: '20 Août 2026',
      tag: '🏗️ IA & BTP',
      readTime: '9 min de lecture',
      pills: ['#BTP', '#ProductEngineering', '#ComputerVision', '#LLM']
    },
    {
      slug: '2026-07-29-vibe-coding-agentic-engineering',
      title: "Du Vibe Coding à l'Agentic Engineering : Le Nouveau Paradigme des AI Product Engineers",
      desc: "Le passage du prototype jetable à l'ingénierie de production : rigueur méthodologique, automatisation, évaluation continue et nouvelles compétences clés de l'AI Product Engineer.",
      date: '29 Juillet 2026',
      tag: '⚙️ Méthodologie IA',
      readTime: '7 min de lecture',
      pills: ['#VibeCoding', '#AgenticEngineering', '#ProductEngineers', '#Quality']
    }
  ];

  /**
   * Parse et convertit le Markdown avec support des callouts
   */
  function renderMarkdown(md) {
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        marked.setOptions({ gfm: true, breaks: true });
        const html = marked.parse(md);
        return html.replace(
          /<blockquote>\s*<p>\s*<strong>(.*?)<\/strong>/gi,
          '<blockquote class="callout"><p><strong class="callout-title">$1</strong>'
        );
      } catch (e) {
        console.warn('Erreur lors du parsing Markdown:', e);
      }
    }
    return md;
  }

  /**
   * Génère le flux de cartes d'articles sur la vue liste
   */
  function renderFeed() {
    const gridEl = document.getElementById('blogGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    ARTICLES.forEach(art => {
      const pillsHtml = art.pills.map(p => `<span>${p}</span>`).join('\n');
      const card = document.createElement('a');
      card.href = `#${art.slug}`;
      card.className = 'glass-card blog-card';
      card.innerHTML = `
        <div class="card-meta-row">
          <span class="card-tag">${art.tag}</span>
          <div class="card-date-time">
            <span>📅 ${art.date}</span>
            <span>⏱️ ${art.readTime}</span>
          </div>
        </div>
        <div>
          <h2 class="card-title">${art.title}</h2>
          <p class="card-summary">${art.desc}</p>
        </div>
        <div class="card-footer">
          <div class="card-pills">
            ${pillsHtml}
          </div>
          <span class="card-action-text">Lire l'article &rarr;</span>
        </div>
      `;
      gridEl.appendChild(card);
    });
  }

  /**
   * Charge et affiche un article spécifique à partir de son slug
   */
  async function loadArticle(slug) {
    const feedView = document.getElementById('blogFeedView');
    const articleView = document.getElementById('blogArticleView');
    const contentEl = document.getElementById('articleContent');
    const titleEl = document.getElementById('articleTitle');
    const metaTagEl = document.getElementById('articleMetaTag');
    const metaDateEl = document.getElementById('articleMetaDate');
    const metaReadTimeEl = document.getElementById('articleMetaReadTime');
    const pillsEl = document.getElementById('articlePills');

    const art = ARTICLES.find(a => a.slug === slug);
    if (!art) {
      window.location.hash = '';
      return;
    }

    if (titleEl) titleEl.textContent = art.title;
    if (metaTagEl) metaTagEl.textContent = art.tag;
    if (metaDateEl) metaDateEl.textContent = `📅 ${art.date}`;
    if (metaReadTimeEl) metaReadTimeEl.textContent = `⏱️ ${art.readTime}`;
    if (pillsEl) pillsEl.innerHTML = art.pills.map(p => `<span class="pill">${p}</span>`).join('');

    if (contentEl) {
      contentEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">Chargement de l\'article...</p>';
    }

    try {
      const res = await fetch(`./${slug}.md`);
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
      const mdText = await res.text();
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(mdText);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de l'article :", err);
      if (contentEl) {
        contentEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px;">Impossible de charger l'article : ${err.message}</p>`;
      }
    }

    if (feedView) feedView.style.display = 'none';
    if (articleView) articleView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Routeur hash pour basculer entre la liste et un article
   */
  function handleRoute() {
    const hash = window.location.hash.replace(/^#/, '');
    const feedView = document.getElementById('blogFeedView');
    const articleView = document.getElementById('blogArticleView');

    if (!hash) {
      renderFeed();
      if (feedView) feedView.style.display = 'block';
      if (articleView) articleView.style.display = 'none';
    } else {
      loadArticle(hash);
    }
  }

  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
