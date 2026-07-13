import { useEffect, useRef } from 'react'
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force'

/**
 * Knowledge-graph canvas: d3-force drives the layout (quadtree many-body,
 * proper alpha cooling, collision), a hand-tuned canvas renderer draws it
 * in the app's design language. Nodes are typed; documents anchor the
 * layout, entities cluster around them by mention edges and co-occurrence.
 */
const TYPE_COLORS = {
  DOC: '#59e3a7',
  PER: '#74c7d6',
  ORG: '#e5c36c',
  LOC: '#e8926f',
  MISC: '#b79fe0',
  AMOUNT: '#8fd48a',
  DATE: '#d6a7c3',
  EMAIL: '#9ab8e8',
  ID: '#94a79b',
}

export function GraphCanvas({ graph, selected, onSelect, height = 440 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !graph?.nodes?.length) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const size = () => ({ w: canvas.parentElement.clientWidth, h: height })
    const resize = () => {
      const { w, h } = size()
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    resize()

    const nodes = graph.nodes.map((n) => ({
      ...n,
      r: n.type === 'DOC' ? 12 + Math.min(n.weight, 16) * 0.4 : 4 + Math.min(n.weight, 9),
    }))
    const links = graph.links.map((l) => ({ ...l }))
    const neighborhood = new Set()
    if (selected) {
      neighborhood.add(selected)
      for (const l of graph.links) {
        if (l.source === selected) neighborhood.add(l.target)
        if (l.target === selected) neighborhood.add(l.source)
      }
    }

    const { w, h } = size()
    const sim = forceSimulation(nodes)
      .force('charge', forceManyBody().strength((n) => (n.type === 'DOC' ? -420 : -120)))
      .force(
        'link',
        forceLink(links)
          .id((n) => n.id)
          .distance((l) => (l.kind === 'mention' ? 95 : 70))
          .strength((l) => Math.min(0.2 + l.weight * 0.08, 0.7)),
      )
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide((n) => n.r + 6))
      .force('x', forceX(w / 2).strength(0.045))
      .force('y', forceY(h / 2).strength(0.06))

    const draw = () => {
      const { w, h } = size()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      for (const l of links) {
        const dim = selected && !(neighborhood.has(l.source.id) && neighborhood.has(l.target.id))
        ctx.strokeStyle =
          l.kind === 'cooccur'
            ? `rgba(89,227,167,${dim ? 0.05 : 0.25})`
            : `rgba(148,167,155,${dim ? 0.05 : 0.18})`
        ctx.lineWidth = Math.min(0.6 + l.weight * 0.35, 2.4)
        ctx.beginPath()
        ctx.moveTo(l.source.x, l.source.y)
        ctx.lineTo(l.target.x, l.target.y)
        ctx.stroke()
      }

      for (const n of nodes) {
        const color = TYPE_COLORS[n.type] ?? TYPE_COLORS.MISC
        const dim = selected && !neighborhood.has(n.id)
        ctx.globalAlpha = dim ? 0.25 : 1
        if (n.type === 'DOC') {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(89,227,167,0.12)'
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        if (n.id === selected) {
          ctx.strokeStyle = '#e8efe9'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        if (n.type === 'DOC' || n.r > 8 || n.id === selected || neighborhood.has(n.id)) {
          ctx.fillStyle = dim ? 'rgba(232,239,233,0.4)' : '#e8efe9'
          ctx.font = `${n.type === 'DOC' ? '600 ' : ''}11px "Archivo Variable", sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(truncate(n.label, 24), n.x, n.y - n.r - 6)
        }
        ctx.globalAlpha = 1
      }
    }

    sim.on('tick', draw)

    // ---- interaction --------------------------------------------------
    const pos = (e) => {
      const rect = canvas.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top]
    }
    const hit = (x, y) => nodes.find((n) => Math.hypot(n.x - x, n.y - y) <= n.r + 5)

    let dragNode = null
    let moved = false
    const down = (e) => {
      const [x, y] = pos(e)
      dragNode = hit(x, y) ?? null
      moved = false
      if (dragNode) {
        canvas.setPointerCapture?.(e.pointerId)
        sim.alphaTarget(0.25).restart()
        dragNode.fx = dragNode.x
        dragNode.fy = dragNode.y
      }
    }
    const move = (e) => {
      if (!dragNode) return
      moved = true
      const [x, y] = pos(e)
      dragNode.fx = x
      dragNode.fy = y
    }
    const up = () => {
      if (dragNode) {
        sim.alphaTarget(0)
        if (!moved) onSelect?.(dragNode.id === selected ? null : dragNode.id)
        dragNode.fx = null
        dragNode.fy = null
      }
      dragNode = null
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    window.addEventListener('resize', resize)

    return () => {
      sim.stop()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      window.removeEventListener('resize', resize)
    }
  }, [graph, selected, onSelect, height])

  return <canvas ref={canvasRef} className="graphcanvas" aria-label="Knowledge graph" />
}

export const GRAPH_TYPE_COLORS = TYPE_COLORS

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
