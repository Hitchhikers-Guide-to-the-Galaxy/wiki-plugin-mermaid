import {
  getPageIndex, linkifyNodes, freezeToGhost, buildPageIndex,
  sanitizeSVG, fetchKroki, DEFAULT_ENDPOINTS, attachCapsuleInteractions,
} from '@fortyfoxes/wiki-capsule'

// Re-export shared helpers used by this plugin's tests.
export { buildPageIndex }

// Detect the Mermaid diagram type from source for display hint
export const detectDiagramType = (source) => {
  const first = source.trim().split('\n')[0].trim().toLowerCase()
  if (first.startsWith('graph') || first.startsWith('flowchart')) return 'flowchart'
  if (first.startsWith('sequencediagram')) return 'sequence'
  if (first.startsWith('gantt')) return 'gantt'
  if (first.startsWith('timeline')) return 'timeline'
  if (first.startsWith('classDiagram') || first.startsWith('classdiagram')) return 'class'
  if (first.startsWith('erdiagram') || first.startsWith('er')) return 'er'
  if (first.startsWith('statediagram')) return 'state'
  if (first.startsWith('pie')) return 'pie'
  if (first.startsWith('mindmap')) return 'mindmap'
  if (first.startsWith('gitgraph') || first.startsWith('gitGraph')) return 'gitgraph'
  if (first.startsWith('xychart') || first.startsWith('%%')) return 'chart'
  return 'mermaid'
}


// ── TITLE directive ───────────────────────────────────────────────────────────
// A leading `TITLE true|false` line (DSL convention: UPPERCASE = command) toggles
// subgraph titles. Default true. The directive is stripped before Kroki sees it.
export const parseDirectives = (raw) => {
  let showTitle = true
  const lines = (raw || '').split('\n').filter((line) => {
    const m = line.match(/^\s*TITLE\s+(true|false)\s*$/i)
    if (m) { showTitle = m[1].toLowerCase() !== 'false'; return false }
    return true
  })
  return { showTitle, source: lines.join('\n') }
}

const hasSubgraph = (s) => /(^|\n)\s*subgraph\b/i.test(s || '')

// Mermaid renders subgraph titles flush against the cluster's top edge. Give
// them breathing room above and below — but only when there ARE subgraphs and
// the author hasn't supplied their own init directive or frontmatter config.
const TITLE_MARGIN_INIT =
  '%%{init: {"flowchart": {"subGraphTitleMargin": {"top": 14, "bottom": 14}}}}%%'
export const withTitleMargin = (src) => {
  const s = src || ''
  if (!hasSubgraph(s)) return s         // no subgraphs to space out
  if (/%%\{\s*init/i.test(s)) return s  // author already set an init directive
  if (/^\s*---/.test(s)) return s       // author has YAML frontmatter config
  return `${TITLE_MARGIN_INIT}\n${s}`
}

// TITLE false: blank each subgraph's label so no title renders and the cluster
// content sits evenly centred (no title band, no margin).
export const hideSubgraphTitles = (src) =>
  (src || '')
    .split('\n')
    .map((line) => line.replace(/^(\s*subgraph\s+)(\S+)(\s*\[[^\]]*\])?\s*$/i, '$1$2[" "]'))
    .join('\n')

export const emit = (div, item) => {
  // Strip DSL directives (e.g. TITLE) before type-detection and rendering.
  const { showTitle, source } = parseDirectives(item.text || '')

  if (!source.trim()) {
    div.html(`<p class="mermaid-hint" style="padding:8px;color:#999;font-style:italic;">
      Enter Mermaid source — e.g. <code>graph TD</code>, <code>sequenceDiagram</code>, <code>gantt</code>…
    </p>`)
    return
  }

  const hint = detectDiagramType(source)

  div.html(`
    <div class="mermaid-wrap" style="position:relative;">
      <span class="mermaid-badge" style="
        position:absolute;top:4px;right:6px;
        font-size:10px;color:#999;font-family:monospace;
        background:rgba(255,255,255,0.85);padding:1px 4px;border-radius:3px;
        pointer-events:none;z-index:1;
      ">${hint}</span>
      <div class="mermaid-svg" style="width:100%;padding:4px 8px;box-sizing:border-box;cursor:zoom-in;">
        <p style="padding:8px;color:#999;font-size:12px;">Rendering…</p>
      </div>
      <span class="mermaid-freeze" title="Freeze as a portable capsule page (then fork/keep to save)" style="
        position:absolute;bottom:4px;right:6px;z-index:2;display:none;
        cursor:pointer;font-size:14px;line-height:1;color:#aaa;
        background:rgba(255,255,255,0.85);border-radius:4px;padding:2px 6px;
      ">❄</span>
    </div>
  `)

  fetchKroki('mermaid', showTitle ? withTitleMargin(source) : hideSubgraphTitles(source))
    .then(({ svg, endpoint }) => {
      const svgEl = sanitizeSVG(svg)
      if (!svgEl) { div.find('.mermaid-svg').html('<p style="padding:8px;color:#c00;font-size:12px;">⚠ SVG sanitise error</p>'); return }

      const container = div.find('.mermaid-svg')[0]
      if (!container) return
      container.innerHTML = ''
      container.appendChild(svgEl)

      // Make nodes that name a wiki page clickable
      getPageIndex().then((index) => linkifyNodes(svgEl, index))

      // Reveal & wire the freeze control now that we have a rendered SVG
      const freezeBtn = div.find('.mermaid-freeze')
      freezeBtn.css('display', 'inline-block')
      freezeBtn.on('click', (e) => {
        e.stopPropagation()
        const s = div.find('.mermaid-svg svg')[0]
        if (s) freezeToGhost(div, s, 'mermaid', item.text || '')
      })

      if (endpoint !== DEFAULT_ENDPOINTS[0]) {
        const badge = div.find('.mermaid-badge')[0]
        if (badge) badge.title = `via ${endpoint}`
      }

      // click → navigate / fullscreen, double-click → edit
      attachCapsuleInteractions(container, div, item)
    })
    .catch((err) => {
      div.find('.mermaid-svg').html(`<p style="padding:8px;color:#c00;font-size:12px;">⚠ ${err.message}</p>`)
    })
}

export const bind = (div, item) => {
  // rendering handled in emit; bind is a no-op
}

if (typeof window !== 'undefined') {
  window.plugins = window.plugins || {}
  window.plugins['mermaid'] = { emit, bind }
}
