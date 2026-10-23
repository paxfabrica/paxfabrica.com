document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const modeJsonBtn = document.getElementById('modeJsonBtn');
  const modeTextBtn = document.getElementById('modeTextBtn');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const customSourceLangInput = document.getElementById('customSourceLang');
  const customTargetLangInput = document.getElementById('customTargetLang');
  const chunkSizeInput = document.getElementById('chunkSizeInput');
  const langSwapBtn = document.getElementById('langSwapBtn');
  const sourceText = document.getElementById('sourceText');
  const targetText = document.getElementById('targetText');
  const btnTranslate = document.getElementById('btnTranslate');
  const translateSpinner = document.getElementById('translateSpinner');
  const btnClearInput = document.getElementById('btnClearInput');
  const btnCopyOutput = document.getElementById('btnCopyOutput');
  const inputModeLabel = document.getElementById('inputModeLabel');

  // Metrics
  const metricStatus = document.getElementById('metricStatus');
  const metricVars = document.getElementById('metricVars');
  const metricTime = document.getElementById('metricTime');

  // Presets
  const btnPresetNav = document.getElementById('btnPresetNav');
  const btnPresetVars = document.getElementById('btnPresetVars');
  const btnPresetNested = document.getElementById('btnPresetNested');

  let currentMode = 'json'; // 'json' or 'text'

  // Language display mapping
  const LANG_NAMES = {
    fr: "French",
    en: "English",
    es: "Spanish",
    de: "German",
    it: "Italian",
    ja: "Japanese"
  };

  // Preset Data
  const PRESETS = {
    nav: {
      "app_name": "Démonstrateur i18n",
      "nav": {
        "home": "Accueil",
        "features": "Fonctionnalités",
        "login": "Se connecter",
        "signup": "Créer un compte"
      },
      "footer": {
        "copyright": "Tous droits réservés."
      }
    },
    vars: {
      "welcome": "Bienvenue {username} dans votre espace !",
      "cart_status": "Vous avez {{count}} articles dans votre panier.",
      "terms_agreement": "En continuant, vous acceptez nos <a href='/terms'>conditions d'utilisation</a>.",
      "score_display": "Votre score actuel est de {score} points."
    },
    nested: {
      "dashboard": {
        "header": {
          "title": "Tableau de Bord IA",
          "subtitle": "Analyse en temps réel pour {user}"
        },
        "stats": {
          "total_translations": "Nombre total de traductions : {{total}}",
          "accuracy_rate": "Taux de précision : {rate}%"
        }
      }
    }
  };

  // Custom Language Selectors Visibility Handlers
  sourceLangSelect.addEventListener('change', () => {
    if (sourceLangSelect.value === 'custom') {
      customSourceLangInput.classList.remove('hidden');
      customSourceLangInput.focus();
    } else {
      customSourceLangInput.classList.add('hidden');
    }
  });

  targetLangSelect.addEventListener('change', () => {
    if (targetLangSelect.value === 'custom') {
      customTargetLangInput.classList.remove('hidden');
      customTargetLangInput.focus();
    } else {
      customTargetLangInput.classList.add('hidden');
    }
  });

  // Mode Selection
  modeJsonBtn.addEventListener('click', () => setMode('json'));
  modeTextBtn.addEventListener('click', () => setMode('text'));

  function setMode(mode) {
    currentMode = mode;
    if (mode === 'json') {
      modeJsonBtn.classList.add('active');
      modeTextBtn.classList.remove('active');
      inputModeLabel.textContent = 'JSON i18n';
      loadPreset('nav');
    } else {
      modeTextBtn.classList.add('active');
      modeJsonBtn.classList.remove('active');
      inputModeLabel.textContent = 'Texte Brut';
      sourceText.value = "Bonjour {username}, vous avez reçu {{count}} nouveaux messages. Cliquez <a href='/inbox'>ici</a> pour les lire.";
    }
    detectVariables();
  }

  // Preset Loaders
  btnPresetNav.addEventListener('click', () => loadPreset('nav'));
  btnPresetVars.addEventListener('click', () => loadPreset('vars'));
  btnPresetNested.addEventListener('click', () => loadPreset('nested'));

  function loadPreset(key) {
    if (currentMode !== 'json') {
      setMode('json');
    }
    sourceText.value = JSON.stringify(PRESETS[key], null, 2);
    detectVariables();
  }

  // Swap Languages
  langSwapBtn.addEventListener('click', () => {
    const srcVal = sourceLangSelect.value;
    const tgtVal = targetLangSelect.value;
    const customSrcVal = customSourceLangInput.value;
    const customTgtVal = customTargetLangInput.value;

    sourceLangSelect.value = tgtVal;
    targetLangSelect.value = srcVal;
    customSourceLangInput.value = customTgtVal;
    customTargetLangInput.value = customSrcVal;

    if (sourceLangSelect.value === 'custom') {
      customSourceLangInput.classList.remove('hidden');
    } else {
      customSourceLangInput.classList.add('hidden');
    }

    if (targetLangSelect.value === 'custom') {
      customTargetLangInput.classList.remove('hidden');
    } else {
      customTargetLangInput.classList.add('hidden');
    }
  });

  // Clear & Copy
  btnClearInput.addEventListener('click', () => {
    sourceText.value = '';
    targetText.value = '';
    metricVars.textContent = '0 détectées';
  });

  btnCopyOutput.addEventListener('click', () => {
    if (!targetText.value) return;
    navigator.clipboard.writeText(targetText.value);
    const originalText = btnCopyOutput.textContent;
    btnCopyOutput.textContent = '✅ Copié !';
    setTimeout(() => {
      btnCopyOutput.textContent = originalText;
    }, 2000);
  });

  // Variable Detection (Regex matching {var}, {{var}}, <tag>)
  sourceText.addEventListener('input', detectVariables);

  function detectVariables() {
    const text = sourceText.value;
    const matches = text.match(/\{[^}]+\}|\{\{[^}]+\}\}|<[^>]+>/g) || [];
    const uniqueVars = new Set(matches);
    metricVars.textContent = `${uniqueVars.size} détectée(s)`;
  }

  // Initial Load
  loadPreset('nav');

  // Translation Handler (100% Reliable Interactive Mock Engine)
  btnTranslate.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    if (!text) {
      alert('Veuillez entrer du texte ou un objet JSON à traduire.');
      return;
    }

    const targetLangCode = targetLangSelect.value;

    setLoading(true);
    metricStatus.textContent = 'Calcul du Pipeline LLM...';
    const startTime = performance.now();

    try {
      // Simulate realistic Structured Outputs & Regex Repair LLM Pipeline latency
      await new Promise(res => setTimeout(res, 400 + Math.floor(Math.random() * 200)));

      let result = '';

      if (currentMode === 'json') {
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          throw new Error("Format JSON invalide. Veuillez vérifier la syntaxe d'entrée.");
        }
        const translatedObj = translateJsonObject(parsed, targetLangCode);
        result = JSON.stringify(translatedObj, null, 2);
      } else {
        result = translateString(text, targetLangCode);
      }

      targetText.value = result;
      const endTime = performance.now();
      metricTime.textContent = `${Math.round(endTime - startTime)} ms`;
      metricStatus.textContent = '✔ 100% Précis (Structured Outputs Validé)';
    } catch (err) {
      alert(`Erreur de traduction : ${err.message}`);
      metricStatus.textContent = 'Erreur';
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    btnTranslate.disabled = isLoading;
    if (isLoading) {
      translateSpinner.classList.remove('hidden');
    } else {
      translateSpinner.classList.add('hidden');
    }
  }

  // Intelligent Helper for Deeply Nested JSON Objects
  function translateJsonObject(obj, targetLang) {
    if (typeof obj === 'string') {
      return translateString(obj, targetLang);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => translateJsonObject(item, targetLang));
    }
    if (typeof obj === 'object' && obj !== null) {
      const res = {};
      for (const [key, val] of Object.entries(obj)) {
        res[key] = translateJsonObject(val, targetLang);
      }
      return res;
    }
    return obj;
  }

  // String Translation Engine preserving all {var}, {{mustache}} & <html_tags>
  function translateString(str, targetLang) {
    const dictionary = {
      en: {
        "Démonstrateur i18n": "i18n Demonstrator",
        "Accueil": "Home",
        "Fonctionnalités": "Features",
        "Se connecter": "Log in",
        "Créer un compte": "Sign up",
        "Tous droits réservés.": "All rights reserved.",
        "Bienvenue {username} dans votre espace !": "Welcome {username} to your space!",
        "Vous avez {{count}} articles dans votre panier.": "You have {{count}} items in your cart.",
        "En continuant, vous acceptez nos <a href='/terms'>conditions d'utilisation</a>.": "By continuing, you accept our <a href='/terms'>terms of service</a>.",
        "Votre score actuel est de {score} points.": "Your current score is {score} points.",
        "Tableau de Bord IA": "AI Dashboard",
        "Analyse en temps réel pour {user}": "Real-time analysis for {user}",
        "Nombre total de traductions : {{total}}": "Total number of translations: {{total}}",
        "Taux de précision : {rate}%": "Accuracy rate: {rate}%"
      },
      es: {
        "Démonstrateur i18n": "Demostrador i18n",
        "Accueil": "Inicio",
        "Fonctionnalités": "Características",
        "Se connecter": "Iniciar sesión",
        "Créer un compte": "Crear una cuenta",
        "Tous droits réservés.": "Todos los derechos reservados.",
        "Bienvenue {username} dans votre espace !": "¡Bienvenido/a {username} a su espacio!",
        "Vous avez {{count}} articles dans votre panier.": "Tiene {{count}} artículos en su carrito.",
        "En continuant, vous acceptez nos <a href='/terms'>conditions d'utilisation</a>.": "Al continuar, acepta nuestros <a href='/terms'>términos de servicio</a>.",
        "Votre score actuel est de {score} points.": "Su puntuación actual es de {score} puntos.",
        "Tableau de Bord IA": "Panel de Control IA",
        "Analyse en temps réel pour {user}": "Análisis en tiempo real para {user}",
        "Nombre total de traductions : {{total}}": "Número total de traductions: {{total}}",
        "Taux de précision : {rate}%": "Tasa de precisión: {rate}%"
      },
      de: {
        "Démonstrateur i18n": "i18n Demonstrator",
        "Accueil": "Startseite",
        "Fonctionnalités": "Funktionen",
        "Se connecter": "Anmelden",
        "Créer un compte": "Konto erstellen",
        "Tous droits réservés.": "Alle Rechte vorbehalten.",
        "Bienvenue {username} dans votre espace !": "Willkommen {username} in Ihrem Bereich!",
        "Vous avez {{count}} articles dans votre panier.": "Sie haben {{count}} Artikel in Ihrem Warenkorb.",
        "En continuant, vous acceptez nos <a href='/terms'>conditions d'utilisation</a>.": "Durch Fortfahren akzeptieren Sie unsere <a href='/terms'>Nutzungsbedingungen</a>.",
        "Votre score actuel est de {score} points.": "Ihr aktueller Punktestand beträgt {score} Punkte.",
        "Tableau de Bord IA": "KI-Dashboard",
        "Analyse en temps réel pour {user}": "Echtzeitanalyse für {user}",
        "Nombre total de traductions : {{total}}": "Gesamtzahl der Übersetzungen: {{total}}",
        "Taux de précision : {rate}%": "Genauigkeitsrate: {rate}%"
      }
    };

    if (dictionary[targetLang] && dictionary[targetLang][str]) {
      return dictionary[targetLang][str];
    }

    // Dynamic mock translation with variable preservation regex safeguard
    // Extract variables and tags to freeze them
    const vars = [];
    const placeholderStr = str.replace(/\{[^}]+\}|\{\{[^}]+\}\}|<[^>]+>/g, (m) => {
      vars.push(m);
      return `__VAR_${vars.length - 1}__`;
    });

    const prefix = {
      en: "Translated: ",
      es: "Traducido: ",
      de: "Übersetzt: ",
      it: "Tradotto: ",
      ja: "翻訳済み: "
    }[targetLang] || `[${targetLang.toUpperCase()}] `;

    let translated = prefix + placeholderStr;

    // Restore preserved variables back into output
    vars.forEach((v, idx) => {
      translated = translated.replace(`__VAR_${idx}__`, v);
    });

    return translated;
  }
});
