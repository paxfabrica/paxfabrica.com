// ==============================================================================
// JavaScript Interactif — Showcase AI Watcher CLI (Wrapper_CLI)
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initCliTerminal();
});

// ==============================================================================
// TERMINAL CLI MOCK EMULATOR & FINOPS SIMULATOR
// ==============================================================================

const MODEL_PRICING = {
  'gemini-1.5-pro': { input: 1.25, output: 5.0, name: 'Google Gemini 1.5 Pro' },
  'gpt-4o': { input: 2.50, output: 10.0, name: 'OpenAI GPT-4o' },
  'claude-3-5-sonnet': { input: 3.00, output: 15.0, name: 'Anthropic Claude 3.5 Sonnet' },
  'llama-3-1-70b': { input: 0.90, output: 0.90, name: 'Meta Llama 3.1 70B (Groq)' }
};

const PRESETS = {
  text: {
    command: 'ai-watcher scan "Google announces Gemini 1.5 Pro with 2M token context window." --demo',
    source: 'Google announces Gemini 1.5 Pro with 2M token context window.',
    type: 'text',
    output: 'console',
    model: 'gemini-1.5-pro',
    cached: false
  },
  file: {
    command: 'ai-watcher scan ./docs/specifications_en.md -o summary.md --demo',
    source: './docs/specifications_en.md',
    type: 'file',
    output: 'file_md',
    model: 'claude-3-5-sonnet',
    cached: false
  },
  url: {
    command: 'ai-watcher scan https://news.ycombinator.com -o json --demo',
    source: 'https://news.ycombinator.com',
    type: 'url',
    output: 'json',
    model: 'gpt-4o',
    cached: false
  },
  json: {
    command: 'ai-watcher scan "Quantum computing breakthrough in silicon Qubits." -o json --demo',
    source: 'Quantum computing breakthrough in silicon Qubits.',
    type: 'text',
    output: 'json',
    model: 'llama-3-1-70b',
    cached: false
  },
  cache: {
    command: 'ai-watcher scan ./docs/specifications_en.md --cache-ttl 3600',
    source: './docs/specifications_en.md',
    type: 'file',
    output: 'console',
    model: 'gemini-1.5-pro',
    cached: true
  }
};

function initCliTerminal() {
  const terminalOutput = document.getElementById('terminalOutput');
  const cliInput = document.getElementById('cliCommandInput');
  const btnRun = document.getElementById('btnRunCli');

  const selSourceType = document.getElementById('selSourceType');
  const selOutput = document.getElementById('selOutput');
  const selModel = document.getElementById('selModel');
  const chkDemo = document.getElementById('chkDemo');

  // Preset buttons
  const btnPresetText = document.getElementById('btnPresetText');
  const btnPresetFile = document.getElementById('btnPresetFile');
  const btnPresetUrl = document.getElementById('btnPresetUrl');
  const btnPresetJson = document.getElementById('btnPresetJson');
  const btnPresetCache = document.getElementById('btnPresetCache');

  const presetBtns = [btnPresetText, btnPresetFile, btnPresetUrl, btnPresetJson, btnPresetCache];

  function setActivePreset(selectedBtn) {
    presetBtns.forEach(btn => btn?.classList.remove('active'));
    selectedBtn?.classList.add('active');
  }

  function applyPreset(key, btn) {
    const p = PRESETS[key];
    if (!p) return;

    cliInput.value = p.command;
    if (selSourceType) selSourceType.value = p.type;
    if (selOutput) selOutput.value = p.output;
    if (selModel) selModel.value = p.model;
    if (chkDemo) chkDemo.checked = !p.cached;

    setActivePreset(btn);
    executeCliCommand(p);
  }

  btnPresetText?.addEventListener('click', () => applyPreset('text', btnPresetText));
  btnPresetFile?.addEventListener('click', () => applyPreset('file', btnPresetFile));
  btnPresetUrl?.addEventListener('click', () => applyPreset('url', btnPresetUrl));
  btnPresetJson?.addEventListener('click', () => applyPreset('json', btnPresetJson));
  btnPresetCache?.addEventListener('click', () => applyPreset('cache', btnPresetCache));

  btnRun?.addEventListener('click', () => {
    runCustomCliCommand();
  });

  cliInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      runCustomCliCommand();
    }
  });

  function runCustomCliCommand() {
    const cmdText = cliInput.value.trim();
    const isDemo = chkDemo ? chkDemo.checked : true;
    const modelKey = selModel ? selModel.value : 'gemini-1.5-pro';
    const outputFmt = selOutput ? selOutput.value : 'console';

    let srcType = selSourceType ? selSourceType.value : 'auto';
    let sourceVal = cmdText.replace(/^ai-watcher\s+scan\s+/, '').replace(/\s+--demo.*$/, '').replace(/["']/g, '');

    if (sourceVal.startsWith('http://') || sourceVal.startsWith('https://')) {
      srcType = 'url';
    } else if (sourceVal.includes('/') || sourceVal.includes('.')) {
      srcType = 'file';
    } else {
      srcType = 'text';
    }

    executeCliCommand({
      command: cmdText,
      source: sourceVal || 'Gemini 1.5 Pro update analysis',
      type: srcType,
      output: outputFmt,
      model: modelKey,
      cached: cmdText.includes('--cache-ttl') && !cmdText.includes('--no-cache')
    });
  }

  // Initial Run
  executeCliCommand(PRESETS.text);
}

function executeCliCommand(config) {
  const terminalOutput = document.getElementById('terminalOutput');
  if (!terminalOutput) return;

  const modelInfo = MODEL_PRICING[config.model] || MODEL_PRICING['gemini-1.5-pro'];
  const isCached = config.cached;

  const promptTokens = isCached ? 0 : Math.floor(120 + Math.random() * 80);
  const completionTokens = isCached ? 0 : Math.floor(250 + Math.random() * 150);
  const totalTokens = promptTokens + completionTokens;

  const execTimeSeconds = isCached ? 0.012 : parseFloat((0.4 + Math.random() * 0.5).toFixed(3));
  const tps = execTimeSeconds > 0 ? (totalTokens / execTimeSeconds).toFixed(1) : '9999.0';

  const costUsd = isCached ? 0 : (
    (promptTokens * modelInfo.input / 1000000) +
    (completionTokens * modelInfo.output / 1000000)
  ).toFixed(6);

  // Update FinOps cards
  document.getElementById('valPromptTokens').innerText = promptTokens;
  document.getElementById('valCompletionTokens').innerText = completionTokens;
  document.getElementById('valTps').innerText = `${tps} t/s`;
  document.getElementById('valCostUsd').innerText = `$${costUsd}`;

  // Content Generation
  let renderedOutput = '';

  if (config.output === 'json') {
    const jsonReport = {
      status: "success",
      cached: isCached,
      source_metadata: {
        raw_source: config.source,
        detected_type: config.type.toUpperCase(),
        sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      analysis: {
        summary: `Surveillance report for [${config.type.toUpperCase()}]: ${config.source}`,
        key_insights: [
          "Major technical breakthrough identified in AI ecosystem.",
          "High deployment feasibility with enterprise-grade security invariants.",
          "Token efficiency improved by 40% over previous architecture baseline."
        ],
        strategic_impact_score: 9.4,
        category: "Generative AI & LLM Infrastructure"
      },
      finops_metrics: {
        model_name: modelInfo.name,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        execution_time_seconds: execTimeSeconds,
        tokens_per_second: parseFloat(tps),
        estimated_cost_usd: parseFloat(costUsd)
      }
    };

    renderedOutput = `<span class="t-muted">[STDOUT] Raw JSON Pydantic V2 Export:</span>\n` +
      JSON.stringify(jsonReport, null, 2);

  } else if (config.output === 'file_md') {
    renderedOutput = `<span class="t-green">✔ Output successfully exported to markdown report file: summary.md</span>\n\n` +
      `<span class="t-cyan">--- [FILE CONTENTS: summary.md] ---</span>\n` +
      `# 🚀 AI Surveillance Executive Report\n\n` +
      `**Source:** \`${config.source}\` (${config.type.toUpperCase()})\n` +
      `**Timestamp:** ${new Date().toISOString()}\n` +
      `**FinOps Model:** ${modelInfo.name}\n\n` +
      `## 💡 Strategic Summary\n` +
      `Automated AI Watcher detected high-value technological developments. Key capabilities involve expanded context windows and enhanced zero-shot structured tool calling.\n\n` +
      `## 💰 FinOps & Resource Footprint\n` +
      `- **Prompt Tokens:** ${promptTokens}\n` +
      `- **Completion Tokens:** ${completionTokens}\n` +
      `- **Throughput:** ${tps} tokens/sec\n` +
      `- **Total USD Cost:** $${costUsd}\n\n` +
      `--- *Generated by ai-watcher CLI v1.0.0* ---`;

  } else {
    // Console Rich UI Format
    const cacheBadge = isCached
      ? `<span class="t-purple">[CACHE HIT - TTL ACTIVE]</span>`
      : `<span class="t-cyan">[LIVE INFERENCE - ${modelInfo.name}]</span>`;

    renderedOutput =
`<span class="t-purple">╭─────────────────────────────────────────────────────────────────────────────╮</span>
<span class="t-purple">│</span> <span class="t-bold t-cyan">🚀 AI WATCHER SURVEILLANCE REPORT</span> ${cacheBadge}
<span class="t-purple">├─────────────────────────────────────────────────────────────────────────────┤</span>
<span class="t-purple">│</span> <span class="t-yellow">Input Source :</span> ${config.source}
<span class="t-purple">│</span> <span class="t-yellow">Type         :</span> <span class="t-green">${config.type.toUpperCase()}</span> (Detected automatically)
<span class="t-purple">│</span> <span class="t-yellow">SHA-256 Hash :</span> <span class="t-muted">a8f5f167f44f4964e6c998dee827110c...</span>
<span class="t-purple">├─────────────────────────────────────────────────────────────────────────────┤</span>
<span class="t-purple">│</span> <span class="t-bold t-green">💡 Executive Strategic Analysis</span>
<span class="t-purple">│</span>  • Significant architectural milestone observed in LLM ecosystem.
<span class="t-purple">│</span>  • Demonstrates enterprise-grade reliability and strict Pydantic safety.
<span class="t-purple">│</span>  • Impact Score: <span class="t-bold t-yellow">9.5 / 10</span> (Critical Technological Trend)
<span class="t-purple">├─────────────────────────────────────────────────────────────────────────────┤</span>
<span class="t-purple">│</span> <span class="t-bold t-blue">💰 FinOps Token & Cost Breakdown</span>
<span class="t-purple">│</span>  • Prompt Tokens     : <span class="t-cyan">${promptTokens}</span> tokens
<span class="t-purple">│</span>  • Completion Tokens : <span class="t-cyan">${completionTokens}</span> tokens
<span class="t-purple">│</span>  • Latency           : <span class="t-cyan">${execTimeSeconds}s</span> (${tps} tokens/sec)
<span class="t-purple">│</span>  • Total Cost (USD)  : <span class="t-green">$${costUsd}</span>
<span class="t-purple">╰─────────────────────────────────────────────────────────────────────────────╯</span>
<span class="t-green">✔ Analysis complete. Exit code 0.</span>`;
  }

  terminalOutput.innerHTML = renderedOutput;
}
