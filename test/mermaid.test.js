import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectDiagramType, parseDirectives, withTitleMargin, hideSubgraphTitles, buildPageIndex } from '../src/client/mermaid.js'

describe('detectDiagramType', () => {
  it('detects flowchart from graph TD', () => assert.equal(detectDiagramType('graph TD\n  A --> B'), 'flowchart'))
  it('detects flowchart from flowchart LR', () => assert.equal(detectDiagramType('flowchart LR\n  A --> B'), 'flowchart'))
  it('detects sequence diagram', () => assert.equal(detectDiagramType('sequenceDiagram\n  A->>B: hi'), 'sequence'))
  it('detects gantt', () => assert.equal(detectDiagramType('gantt\n  title plan'), 'gantt'))
  it('detects timeline', () => assert.equal(detectDiagramType('timeline\n  2024: event'), 'timeline'))
  it('detects pie', () => assert.equal(detectDiagramType('pie\n  "A": 30'), 'pie'))
  it('detects mindmap', () => assert.equal(detectDiagramType('mindmap\n  root'), 'mindmap'))
  it('falls back to mermaid for unknown', () => assert.equal(detectDiagramType('something\n  A --> B'), 'mermaid'))
  it('handles empty source', () => assert.equal(detectDiagramType(''), 'mermaid'))
})

describe('parseDirectives', () => {
  it('defaults showTitle to true', () => assert.equal(parseDirectives('flowchart TD\n A-->B').showTitle, true))
  it('TITLE false sets showTitle false and strips the line', () => {
    const { showTitle, source } = parseDirectives('TITLE false\nflowchart TD\n A-->B')
    assert.equal(showTitle, false)
    assert.equal(source, 'flowchart TD\n A-->B')
  })
  it('TITLE true is stripped, showTitle true', () => {
    const { showTitle, source } = parseDirectives('TITLE true\nflowchart TD')
    assert.equal(showTitle, true)
    assert.equal(source, 'flowchart TD')
  })
  it('is case-insensitive', () => assert.equal(parseDirectives('title FALSE\nflowchart').showTitle, false))
})

describe('withTitleMargin', () => {
  it('injects subGraphTitleMargin when a subgraph is present', () =>
    assert.ok(withTitleMargin('flowchart TD\n subgraph a[X]\n  A-->B\n end').includes('subGraphTitleMargin')))
  it('leaves diagrams without subgraphs untouched', () =>
    assert.equal(withTitleMargin('flowchart TD\n A-->B'), 'flowchart TD\n A-->B'))
  it('respects an author init directive', () => {
    const s = '%%{init: {"theme":"dark"}}%%\nflowchart TD\n subgraph a[X]\n A-->B\n end'
    assert.equal(withTitleMargin(s), s)
  })
})

describe('hideSubgraphTitles', () => {
  it('blanks a bracketed subgraph label', () =>
    assert.ok(hideSubgraphTitles('flowchart TD\n subgraph mac[This Mac]\n A-->B\n end').includes('subgraph mac[" "]')))
  it('blanks a bare subgraph id', () =>
    assert.ok(hideSubgraphTitles('flowchart TD\n subgraph mac\n A-->B\n end').includes('subgraph mac[" "]')))
})

describe('buildPageIndex', () => {
  const idx = buildPageIndex([{ title: 'SVG Capsule', slug: 'svg-capsule' }, { title: 'Render Broker', slug: 'render-broker' }])
  it('indexes by normalised title', () => assert.equal(idx.get('svg capsule'), 'SVG Capsule'))
  it('indexes by slug', () => assert.equal(idx.get('render-broker'), 'Render Broker'))
  it('misses unknown labels', () => assert.equal(idx.get('nope'), undefined))
  it('handles empty list', () => assert.equal(buildPageIndex().size, 0))
})
