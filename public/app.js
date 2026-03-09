/* === JSONPoint - JSON Formatter & Validator === */
/* All processing client-side, no data sent anywhere */

'use strict';

// =====================================================
// SAMPLE JSON
// =====================================================

var SAMPLE_JSON = JSON.stringify({
  "name": "JSONPoint",
  "version": "1.0.0",
  "description": "A free online JSON formatter and validator",
  "features": ["format", "validate", "minify", "tree view", "syntax highlighting"],
  "config": {
    "theme": "dark",
    "indent": 2,
    "lineNumbers": true,
    "syntaxHighlight": true
  },
  "stats": {
    "users": 42000,
    "rating": 4.9,
    "isPremium": false,
    "lastUpdated": null
  },
  "tags": [
    { "id": 1, "label": "developer tools", "active": true },
    { "id": 2, "label": "productivity", "active": true },
    { "id": 3, "label": "free", "active": false }
  ]
}, null, 2);

// =====================================================
// DOM REFS
// =====================================================

var els = {};

function cacheDom() {
  var ids = [
    'jsonInput', 'charCount', 'lineCount', 'formatBtn', 'minifyBtn',
    'indentSelect', 'errorBox', 'errorTitle', 'errorDetail',
    'successBox', 'successText', 'outputSection', 'outputPre', 'outputCode',
    'copyOutputBtn', 'downloadBtn', 'treeWrapper', 'expandAllBtn',
    'collapseAllBtn', 'sampleBtn', 'clearBtn', 'themeToggle',
    'themeIconSun', 'themeIconMoon'
  ];
  ids.forEach(function(id) {
    els[id] = document.getElementById(id);
  });
}

// =====================================================
// STATE
// =====================================================

var currentParsed = null;
var currentFormatted = '';

// =====================================================
// UTILITY
// =====================================================

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =====================================================
// TOAST
// =====================================================

var toastTimeout;

function showToast(message) {
  var toast = document.querySelector('.copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, 1500);
}

// =====================================================
// CLIPBOARD
// =====================================================

function copyText(text, btn) {
  try {
    navigator.clipboard.writeText(text).then(function() {
      if (btn) {
        btn.classList.add('copied');
        setTimeout(function() { btn.classList.remove('copied'); }, 1200);
      }
      showToast('Copied to clipboard');
    }).catch(function() {
      fallbackCopy(text, btn);
    });
  } catch(e) {
    fallbackCopy(text, btn);
  }
}

function fallbackCopy(text, btn) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  if (btn) {
    btn.classList.add('copied');
    setTimeout(function() { btn.classList.remove('copied'); }, 1200);
  }
  showToast('Copied to clipboard');
}

// =====================================================
// INPUT STATS
// =====================================================

function updateStats() {
  var text = els.jsonInput.value;
  els.charCount.textContent = text.length.toLocaleString() + ' character' + (text.length !== 1 ? 's' : '');
  var lines = text ? text.split('\n').length : 0;
  els.lineCount.textContent = lines.toLocaleString() + ' line' + (lines !== 1 ? 's' : '');
}

// =====================================================
// PARSE JSON WITH ENHANCED ERRORS
// =====================================================

function parseJson(text) {
  try {
    var parsed = JSON.parse(text);
    return { ok: true, data: parsed };
  } catch(e) {
    var msg = e.message || 'Unknown error';
    var result = { ok: false, message: msg, line: null, col: null };

    // Try to extract line/col from error message
    // Chrome: "at position N"
    // Firefox: "at line X column Y"
    var posMatch = msg.match(/position\s+(\d+)/i);
    var lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);

    if (lineColMatch) {
      result.line = parseInt(lineColMatch[1], 10);
      result.col = parseInt(lineColMatch[2], 10);
    } else if (posMatch) {
      var pos = parseInt(posMatch[1], 10);
      var upToPos = text.substring(0, pos);
      var linesSplit = upToPos.split('\n');
      result.line = linesSplit.length;
      result.col = linesSplit[linesSplit.length - 1].length + 1;
    }

    return result;
  }
}

// =====================================================
// SYNTAX HIGHLIGHTING
// =====================================================

function highlightJson(jsonStr) {
  // Tokenize and colorize JSON string
  var html = '';
  var i = 0;
  var len = jsonStr.length;
  var inKey = false;

  while (i < len) {
    var ch = jsonStr[i];

    if (ch === '"') {
      // Find end of string
      var start = i;
      i++;
      while (i < len) {
        if (jsonStr[i] === '\\') {
          i += 2;
          continue;
        }
        if (jsonStr[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      var str = jsonStr.substring(start, i);
      var escaped = escapeHtml(str);

      // Determine if this is a key or value
      // Look ahead for colon
      var rest = jsonStr.substring(i).trimStart();
      if (rest[0] === ':') {
        html += '<span class="syn-key">' + escaped + '</span>';
      } else {
        html += '<span class="syn-str">' + escaped + '</span>';
      }
    } else if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      html += '<span class="syn-brace">' + ch + '</span>';
      i++;
    } else if (ch === ':' || ch === ',') {
      html += ch;
      i++;
    } else if (ch === 't' || ch === 'f') {
      // true or false
      if (jsonStr.substring(i, i + 4) === 'true') {
        html += '<span class="syn-bool">true</span>';
        i += 4;
      } else if (jsonStr.substring(i, i + 5) === 'false') {
        html += '<span class="syn-bool">false</span>';
        i += 5;
      } else {
        html += escapeHtml(ch);
        i++;
      }
    } else if (ch === 'n' && jsonStr.substring(i, i + 4) === 'null') {
      html += '<span class="syn-null">null</span>';
      i += 4;
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      // Number
      var numStart = i;
      if (ch === '-') i++;
      while (i < len && ((jsonStr[i] >= '0' && jsonStr[i] <= '9') || jsonStr[i] === '.' || jsonStr[i] === 'e' || jsonStr[i] === 'E' || jsonStr[i] === '+' || jsonStr[i] === '-')) {
        if ((jsonStr[i] === '+' || jsonStr[i] === '-') && jsonStr[i-1] !== 'e' && jsonStr[i-1] !== 'E') break;
        i++;
      }
      var numStr = jsonStr.substring(numStart, i);
      html += '<span class="syn-num">' + escapeHtml(numStr) + '</span>';
    } else {
      // Whitespace or other
      html += escapeHtml(ch);
      i++;
    }
  }

  return html;
}

function renderWithLineNumbers(highlighted) {
  var lines = highlighted.split('\n');
  return lines.map(function(line) {
    return '<span class="line">' + (line || ' ') + '</span>';
  }).join('\n');
}

// =====================================================
// TREE VIEW
// =====================================================

function buildTree(data, key, depth) {
  var type = Array.isArray(data) ? 'array' : typeof data;
  if (data === null) type = 'null';

  var container = document.createElement('div');
  if (depth > 0) container.className = 'tree-node';

  var row = document.createElement('div');
  row.className = 'tree-row';

  if (type === 'object' || type === 'array') {
    var isObj = type === 'object';
    var entries = isObj ? Object.keys(data) : data;
    var count = isObj ? Object.keys(data).length : data.length;

    // Toggle button
    var toggle = document.createElement('button');
    toggle.className = 'tree-toggle';
    toggle.textContent = '\u25BC';
    toggle.setAttribute('aria-label', 'Toggle');
    row.appendChild(toggle);

    // Key
    if (key !== null && key !== undefined) {
      var keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = '"' + key + '"';
      row.appendChild(keySpan);
      var colon = document.createElement('span');
      colon.className = 'tree-colon';
      colon.textContent = ': ';
      row.appendChild(colon);
    }

    // Type badge
    var badge = document.createElement('span');
    badge.className = 'tree-type-badge';
    badge.textContent = isObj ? '{' + count + '}' : '[' + count + ']';
    row.appendChild(badge);

    container.appendChild(row);

    // Children
    var children = document.createElement('div');
    children.className = 'tree-children';

    if (isObj) {
      Object.keys(data).forEach(function(k) {
        children.appendChild(buildTree(data[k], k, depth + 1));
      });
    } else {
      data.forEach(function(item, idx) {
        children.appendChild(buildTree(item, idx, depth + 1));
      });
    }

    container.appendChild(children);

    // Toggle behavior
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var isCollapsed = children.classList.contains('collapsed');
      if (isCollapsed) {
        children.classList.remove('collapsed');
        toggle.classList.remove('collapsed');
      } else {
        children.classList.add('collapsed');
        toggle.classList.add('collapsed');
      }
    });

    // Auto-collapse deep nodes (depth > 3)
    if (depth > 3) {
      children.classList.add('collapsed');
      toggle.classList.add('collapsed');
    }

  } else {
    // Leaf node
    var spacer = document.createElement('span');
    spacer.style.width = '16px';
    spacer.style.display = 'inline-block';
    row.appendChild(spacer);

    if (key !== null && key !== undefined) {
      var keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = typeof key === 'number' ? key : '"' + key + '"';
      row.appendChild(keySpan);
      var colon = document.createElement('span');
      colon.className = 'tree-colon';
      colon.textContent = ': ';
      row.appendChild(colon);
    }

    var valSpan = document.createElement('span');
    if (type === 'string') {
      valSpan.className = 'tree-value-str';
      valSpan.textContent = '"' + data + '"';
    } else if (type === 'number') {
      valSpan.className = 'tree-value-num';
      valSpan.textContent = String(data);
    } else if (type === 'boolean') {
      valSpan.className = 'tree-value-bool';
      valSpan.textContent = String(data);
    } else if (type === 'null') {
      valSpan.className = 'tree-value-null';
      valSpan.textContent = 'null';
    }
    row.appendChild(valSpan);

    container.appendChild(row);
  }

  return container;
}

function renderTree(data) {
  els.treeWrapper.innerHTML = '';
  els.treeWrapper.appendChild(buildTree(data, null, 0));
}

function toggleAllTree(expand) {
  var children = els.treeWrapper.querySelectorAll('.tree-children');
  var toggles = els.treeWrapper.querySelectorAll('.tree-toggle');
  children.forEach(function(c) {
    if (expand) {
      c.classList.remove('collapsed');
    } else {
      c.classList.add('collapsed');
    }
  });
  toggles.forEach(function(t) {
    if (expand) {
      t.classList.remove('collapsed');
    } else {
      t.classList.add('collapsed');
    }
  });
}

// =====================================================
// FORMAT
// =====================================================

function formatJson() {
  var input = els.jsonInput.value.trim();
  if (!input) {
    hideMessages();
    els.outputSection.style.display = 'none';
    return;
  }

  var result = parseJson(input);

  if (!result.ok) {
    showError(result);
    els.outputSection.style.display = 'none';
    currentParsed = null;
    currentFormatted = '';
    return;
  }

  hideMessages();
  currentParsed = result.data;

  var indent = els.indentSelect.value;
  var indentVal = indent === 'tab' ? '\t' : parseInt(indent, 10);
  var formatted = JSON.stringify(result.data, null, indentVal);
  currentFormatted = formatted;

  // Syntax highlighted output with line numbers
  var highlighted = highlightJson(formatted);
  var withLines = renderWithLineNumbers(highlighted);
  els.outputCode.innerHTML = withLines;

  // Tree view
  renderTree(result.data);

  // Show output
  els.outputSection.style.display = 'block';

  // Show success
  var keys = typeof result.data === 'object' && result.data !== null
    ? (Array.isArray(result.data) ? result.data.length + ' items' : Object.keys(result.data).length + ' keys')
    : typeof result.data;
  showSuccess('Valid JSON \u2014 ' + keys + ' \u2014 ' + formatted.split('\n').length + ' lines');
}

// =====================================================
// MINIFY
// =====================================================

function minifyJson() {
  var input = els.jsonInput.value.trim();
  if (!input) {
    hideMessages();
    els.outputSection.style.display = 'none';
    return;
  }

  var result = parseJson(input);

  if (!result.ok) {
    showError(result);
    els.outputSection.style.display = 'none';
    return;
  }

  hideMessages();
  currentParsed = result.data;

  var minified = JSON.stringify(result.data);
  currentFormatted = minified;

  // Display minified (single line, still highlighted)
  var highlighted = highlightJson(minified);
  els.outputCode.innerHTML = '<span class="line">' + highlighted + '</span>';

  // Tree view
  renderTree(result.data);

  els.outputSection.style.display = 'block';

  var savedBytes = new Blob([input]).size - new Blob([minified]).size;
  var savedStr = savedBytes > 0 ? ' \u2014 saved ' + savedBytes.toLocaleString() + ' bytes' : '';
  showSuccess('Minified' + savedStr);
}

// =====================================================
// MESSAGES
// =====================================================

function showError(result) {
  els.errorBox.style.display = 'flex';
  els.successBox.style.display = 'none';

  var detail = result.message;
  if (result.line) {
    detail = 'Line ' + result.line;
    if (result.col) detail += ', Column ' + result.col;
    detail += ': ' + result.message;
  }
  els.errorDetail.textContent = detail;
}

function showSuccess(msg) {
  els.successBox.style.display = 'flex';
  els.errorBox.style.display = 'none';
  els.successText.textContent = msg;
}

function hideMessages() {
  els.errorBox.style.display = 'none';
  els.successBox.style.display = 'none';
}

// =====================================================
// DOWNLOAD
// =====================================================

function downloadJson() {
  if (!currentFormatted) return;
  var blob = new Blob([currentFormatted], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'formatted.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded formatted.json');
}

// =====================================================
// TABS
// =====================================================

function switchTab(name) {
  document.querySelectorAll('.output-section .tab').forEach(function(t) {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.output-section .tab-panel').forEach(function(p) {
    p.classList.remove('active');
  });

  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('tab-' + name).setAttribute('aria-selected', 'true');
  document.getElementById('panel-' + name).classList.add('active');
}

// =====================================================
// THEME
// =====================================================

function initTheme() {
  var saved = localStorage.getItem('jp-theme');
  applyTheme(saved || 'dark');
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    els.themeIconSun.style.display = 'none';
    els.themeIconMoon.style.display = 'block';
  } else {
    document.documentElement.removeAttribute('data-theme');
    els.themeIconSun.style.display = 'block';
    els.themeIconMoon.style.display = 'none';
  }
  localStorage.setItem('jp-theme', theme);
}

function toggleTheme() {
  var current = localStorage.getItem('jp-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// =====================================================
// TAB KEY IN TEXTAREA
// =====================================================

function handleTab(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    var ta = e.target;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + 2;
    updateStats();
  }
}

// =====================================================
// INIT
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
  cacheDom();
  initTheme();

  // Input stats
  els.jsonInput.addEventListener('input', updateStats);
  els.jsonInput.addEventListener('keydown', handleTab);

  // Action buttons
  els.formatBtn.addEventListener('click', formatJson);
  els.minifyBtn.addEventListener('click', minifyJson);

  // Sample / Clear
  els.sampleBtn.addEventListener('click', function() {
    els.jsonInput.value = SAMPLE_JSON;
    updateStats();
    formatJson();
  });

  els.clearBtn.addEventListener('click', function() {
    els.jsonInput.value = '';
    updateStats();
    hideMessages();
    els.outputSection.style.display = 'none';
    currentParsed = null;
    currentFormatted = '';
  });

  // Copy output
  els.copyOutputBtn.addEventListener('click', function() {
    if (currentFormatted) copyText(currentFormatted, this);
  });

  // Download
  els.downloadBtn.addEventListener('click', downloadJson);

  // Tree controls
  els.expandAllBtn.addEventListener('click', function() { toggleAllTree(true); });
  els.collapseAllBtn.addEventListener('click', function() { toggleAllTree(false); });

  // Output tabs
  document.querySelectorAll('.output-section .tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      switchTab(this.dataset.tab);
    });
  });

  // Theme toggle
  els.themeToggle.addEventListener('click', toggleTheme);

  // Indent change re-formats
  els.indentSelect.addEventListener('change', function() {
    if (currentParsed !== null) formatJson();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter = Format
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formatJson();
    }
    // Ctrl/Cmd + Shift + M = Minify
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      minifyJson();
    }
  });

  // Paste auto-format: if input is empty and user pastes, auto-format
  els.jsonInput.addEventListener('paste', function() {
    var self = this;
    setTimeout(function() {
      updateStats();
      if (self.value.trim()) {
        formatJson();
      }
    }, 50);
  });

  // Drop file support
  els.jsonInput.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.style.borderColor = 'var(--accent)';
  });

  els.jsonInput.addEventListener('dragleave', function() {
    this.style.borderColor = '';
  });

  els.jsonInput.addEventListener('drop', function(e) {
    e.preventDefault();
    this.style.borderColor = '';
    var file = e.dataTransfer.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        els.jsonInput.value = ev.target.result;
        updateStats();
        formatJson();
      };
      reader.readAsText(file);
    }
  });
});
