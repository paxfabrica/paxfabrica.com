// ==============================================================================
// JavaScript Interactif — Showcase AIPE_Framework (Portfolio Static)
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTestStudio();
  initTabs();
  initAccordions();
});

// ==============================================================================
// 1. SIMULATEUR INTERACTIF DE TESTS (QA TERMINAL)
// ==============================================================================

const TEST_SUITES = {
  all: {
    title: "pytest tests/",
    time: "3.69s",
    output: `============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-8.4.2, pluggy-1.6.0
rootdir: /home/michael/Code/ai-engineering/projets/AIPE_Framework
configfile: pyproject.toml
plugins: cov-4.1.0, anyio-4.14.2
collected 64 items

<span class="t-purple">tests/test_dockerfile.py</span> ...............                                 [ 23%]
<span class="t-purple">tests/test_gatekeeping.py</span> ...                                            [ 28%]
<span class="t-purple">tests/test_main.py</span> .                                                     [ 29%]
<span class="t-purple">tests/test_makefile.py</span> ...                                               [ 34%]
<span class="t-purple">tests/test_onboarding.py</span> .....................                           [ 67%]
<span class="t-purple">tests/test_poetry.py</span> ......                                              [ 76%]
<span class="t-purple">tests/test_pre_commit.py</span> ..                                              [ 79%]
<span class="t-purple">tests/test_vscode_settings.py</span> .............                              [100%]

---------- coverage: platform linux, python 3.10.12-final-0 ----------
Name                         Stmts   Miss  Cover   Missing
----------------------------------------------------------
src/__init__.py                  0      0   100%
src/api/__init__.py              0      0   100%
src/api/routes/__init__.py       0      0   100%
src/api/routes/health.py         7      0   100%
src/core/__init__.py             0      0   100%
src/core/config.py               8      0   100%
src/main.py                      5      0   100%
src/schemas/__init__.py          0      0   100%
src/schemas/health.py            5      0   100%
----------------------------------------------------------
TOTAL                           25      0   100%
Coverage XML written to file coverage.xml

<span class="t-green">Required test coverage of 100.0% reached. Total coverage: 100.00%</span>

<span class="t-green">============================== 64 passed in 3.69s ==============================</span>`
  },
  onboarding: {
    title: "pytest tests/test_onboarding.py",
    time: "0.21s",
    output: `============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-8.4.2
collected 21 items

<span class="t-purple">tests/test_onboarding.py</span>::test_readme_exists_and_not_empty <span class="t-green">PASSED</span>        [  4%]
<span class="t-purple">tests/test_onboarding.py</span>::test_readme_contains_quickstart_section <span class="t-green">PASSED</span> [  9%]
<span class="t-purple">tests/test_onboarding.py</span>::test_readme_documents_make_install <span class="t-green">PASSED</span>      [ 14%]
<span class="t-purple">tests/test_onboarding.py</span>::test_readme_documents_make_dev <span class="t-green">PASSED</span>          [ 19%]
<span class="t-purple">tests/test_onboarding.py</span>::test_makefile_exists <span class="t-green">PASSED</span>                    [ 23%]
<span class="t-purple">tests/test_onboarding.py</span>::test_makefile_has_install_target <span class="t-green">PASSED</span>        [ 28%]
<span class="t-purple">tests/test_onboarding.py</span>::test_makefile_has_dev_target <span class="t-green">PASSED</span>            [ 33%]
<span class="t-purple">tests/test_onboarding.py</span>::test_makefile_has_test_target <span class="t-green">PASSED</span>           [ 38%]
<span class="t-purple">tests/test_onboarding.py</span>::test_makefile_has_onboarding_check_target <span class="t-green">PASSED</span> [ 42%]
<span class="t-purple">tests/test_onboarding.py</span>::test_project_has_pyproject_toml <span class="t-green">PASSED</span>         [ 47%]
<span class="t-purple">tests/test_onboarding.py</span>::test_project_has_poetry_lock <span class="t-green">PASSED</span>            [ 52%]
<span class="t-purple">tests/test_onboarding.py</span>::test_project_has_precommit_config <span class="t-green">PASSED</span>       [ 57%]
<span class="t-purple">tests/test_onboarding.py</span>::test_project_has_gitignore <span class="t-green">PASSED</span>              [ 61%]
<span class="t-purple">tests/test_onboarding.py</span>::test_project_has_src_package <span class="t-green">PASSED</span>            [ 66%]
<span class="t-purple">tests/test_onboarding.py</span>::test_project_has_tests_directory <span class="t-green">PASSED</span>        [ 71%]
<span class="t-purple">tests/test_onboarding.py</span>::test_onboarding_script_exists <span class="t-green">PASSED</span>           [ 76%]
<span class="t-purple">tests/test_onboarding.py</span>::test_onboarding_script_is_executable <span class="t-green">PASSED</span>    [ 80%]
<span class="t-purple">tests/test_onboarding.py</span>::test_onboarding_script_has_shebang <span class="t-green">PASSED</span>      [ 85%]
<span class="t-purple">tests/test_onboarding.py</span>::test_api_healthcheck_responds <span class="t-green">PASSED</span>           [ 90%]
<span class="t-purple">tests/test_onboarding.py</span>::test_api_healthcheck_contract <span class="t-green">PASSED</span>           [ 95%]
<span class="t-purple">tests/test_onboarding.py</span>::test_make_help_lists_all_critical_targets <span class="t-green">PASSED</span> [100%]

<span class="t-green">============================== 21 passed in 0.21s ==============================</span>`
  },
  vscode: {
    title: "pytest tests/test_vscode_settings.py",
    time: "0.03s",
    output: `============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-8.4.2
collected 13 items

<span class="t-purple">tests/test_vscode_settings.py</span>::test_vscode_settings_file_exists <span class="t-green">PASSED</span>   [  7%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_vscode_extensions_file_exists <span class="t-green">PASSED</span> [ 15%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_vscode_settings_is_valid_json <span class="t-green">PASSED</span> [ 23%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_vscode_extensions_is_valid_json <span class="t-green">PASSED</span> [ 30%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_has_ruff_formatter <span class="t-green">PASSED</span>   [ 38%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_has_format_on_save <span class="t-green">PASSED</span>   [ 46%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_has_code_actions_on_save <span class="t-green">PASSED</span> [ 53%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_has_correct_line_length <span class="t-green">PASSED</span> [ 61%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_has_ruff_lint_enabled <span class="t-green">PASSED</span> [ 69%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_final_newline_matches_precommit <span class="t-green">PASSED</span> [ 76%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_settings_trim_whitespace_matches_precommit <span class="t-green">PASSED</span> [ 84%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_extensions_recommends_ruff <span class="t-green">PASSED</span>    [ 92%]
<span class="t-purple">tests/test_vscode_settings.py</span>::test_extensions_recommends_python <span class="t-green">PASSED</span>  [100%]

<span class="t-green">============================== 13 passed in 0.03s ==============================</span>`
  },
  docker: {
    title: "pytest tests/test_dockerfile.py",
    time: "0.15s",
    output: `============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-8.4.2
collected 15 items

<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_exists <span class="t-green">PASSED</span>                  [  6%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_has_builder_stage <span class="t-green">PASSED</span>        [ 13%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_has_runtime_stage <span class="t-green">PASSED</span>        [ 20%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_copies_venv_from_builder <span class="t-green">PASSED</span>  [ 26%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_creates_appuser <span class="t-green">PASSED</span>         [ 33%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_uses_non_root_user <span class="t-green">PASSED</span>       [ 40%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_chown_appuser <span class="t-green">PASSED</span>            [ 46%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_exposes_port_8000 <span class="t-green">PASSED</span>       [ 53%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_has_healthcheck <span class="t-green">PASSED</span>          [ 60%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_healthcheck_interval <span class="t-green">PASSED</span>     [ 66%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_healthcheck_timeout <span class="t-green">PASSED</span>      [ 73%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_healthcheck_start_period <span class="t-green">PASSED</span> [ 80%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_healthcheck_retries <span class="t-green">PASSED</span>      [ 86%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_runtime_has_curl <span class="t-green">PASSED</span>         [ 93%]
<span class="t-purple">tests/test_dockerfile.py</span>::test_dockerfile_curl_before_user <span class="t-green">PASSED</span>        [100%]

<span class="t-green">============================== 15 passed in 0.15s ==============================</span>`
  },
  simulation: {
    title: "make onboarding-check (bash scripts/simulate_onboarding.sh)",
    time: "2m 14s",
    output: `<span class="t-blue">╔══════════════════════════════════════════════════════════════╗
║     🚀 AIPE_Framework — Simulation d'Onboarding            ║
║        Validation du scénario Zero-Setup Friction           ║
╚══════════════════════════════════════════════════════════════╝</span>

<span class="t-blue">▶ Étape 1/5 : Création d'un dossier temporaire isolé</span>
  Dossier temporaire créé : /tmp/aipe_onboarding_8f3a1b
<span class="t-green">✅ Environnement isolé prêt</span>

<span class="t-blue">▶ Étape 2/5 : Clonage du dépôt depuis GitHub</span>
  Clonage dans '/tmp/aipe_onboarding_8f3a1b/AIPE_Framework'...
<span class="t-green">✅ Clonage terminé en 4s</span>

<span class="t-blue">▶ Étape 3/5 : Exécution de 'make install' (Poetry + pre-commit)</span>
  Installing dependencies from lock file...
  Installing pre-commit hooks...
<span class="t-green">✅ 'make install' terminé en 124s</span>

<span class="t-blue">▶ Étape 4/5 : Vérifications de cohérence de l'environnement</span>
<span class="t-green">✅ .venv/ créé localement</span>
<span class="t-green">✅ Interpréteur Python fonctionnel dans .venv/</span>
<span class="t-green">✅ Dépendances de production importables</span>
<span class="t-green">✅ .vscode/settings.json présent</span>
<span class="t-green">✅ Hook pre-commit installé dans .git/hooks/</span>

<span class="t-blue">▶ Étape 5/5 : Démarrage de 'make dev' et test du healthcheck</span>
  Attente du démarrage du serveur (PID: 14822)...
<span class="t-green">✅ Serveur FastAPI démarré en 1s</span>
  Réponse /health : {"status":"healthy","environment":"development","version":"0.1.0"}
<span class="t-green">✅ Healthcheck /health conforme au contrat d'interface</span>

<span class="t-blue">╔══════════════════════════════════════════════════════════════╗
║               📊 RAPPORT D'ONBOARDING                      ║
╠══════════════════════════════════════════════════════════════╣</span>
║  Clonage Git .......................... <span class="t-green">4s</span>
║  make install ......................... <span class="t-green">124s</span>
║  Vérifications de cohérence ........... <span class="t-green">ok</span>
║  Démarrage serveur + healthcheck ...... <span class="t-green">1s</span>
<span class="t-blue">╠══════════════════════════════════════════════════════════════╣</span>
║  <span class="t-green">⏱️  DURÉE TOTALE : 134s / 300s (< 5 min) ✅</span>
║  <span class="t-green">🏆 KPI Zero-Setup Friction : VALIDÉ</span>
<span class="t-blue">╚══════════════════════════════════════════════════════════════╝</span>`
  }
};

function initTestStudio() {
  const buttons = document.querySelectorAll('.test-suite-btn');
  const terminalBody = document.getElementById('terminalBody');
  const terminalTitle = document.getElementById('terminalTitle');

  if (!terminalBody) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const suiteKey = btn.getAttribute('data-suite');
      const suiteData = TEST_SUITES[suiteKey];

      if (!suiteData) return;

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (terminalTitle) {
        terminalTitle.textContent = `user@aipe-framework:~$ ${suiteData.title}`;
      }

      terminalBody.innerHTML = `<span class="t-yellow">⏳ Exécution de la commande '${suiteData.title}' en cours...</span>`;

      setTimeout(() => {
        terminalBody.innerHTML = suiteData.output;
      }, 300);
    });
  });
}

// ==============================================================================
// 2. NATIVE TAB EXPLORER (Roadmap / FAQ / Glossaire / Journal)
// ==============================================================================

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// ==============================================================================
// 3. ACCORDION SYSTEM FOR FAQ AND GLOSSARY
// ==============================================================================

function initAccordions() {
  const headers = document.querySelectorAll('.accordion-header');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.parentElement;
      parent.classList.toggle('open');
    });
  });
}
