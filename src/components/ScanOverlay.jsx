import { useEffect, useRef, useState, useCallback } from 'react'
import { defaultQuad, warpPerspective } from '../services/scanService.js'
import { recognizeDocument } from '../ml/ocr/index.js'
import { docFromUpload } from '../services/corpusService.js'
import { indexUserDoc } from '../services/engineService.js'
import { IconClose, IconUpload } from './icons.jsx'
import { formatMs, cn } from '../lib/format.js'

/**
 * Camera-to-corpus intake. Steps: capture (camera or photo) → adjust
 * (draggable corner quad) → process (dewarp + OCR) → review → index.
 * Everything happens in this tab; the photo never leaves the device.
 */
export function ScanOverlay({ onClose }) {
  const [step, setStep] = useState('capture') // capture | adjust | processing | review
  const [error, setError] = useState(null)
  const [sourceCanvas, setSourceCanvas] = useState(null)
  const [quad, setQuad] = useState(null)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null) // {canvas, text, provider, ms, confidence}
  const [title, setTitle] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)

  // camera lifecycle
  useEffect(() => {
    if (step !== 'capture') return undefined
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraOn(true)
      })
      .catch(() => setCameraOn(false))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [step])

  const acceptImage = useCallback((canvas) => {
    setSourceCanvas(canvas)
    setQuad(defaultQuad(canvas.width, canvas.height))
    setStep('adjust')
  }, [])

  const captureFrame = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    acceptImage(canvas)
  }

  const loadFile = async (file) => {
    if (!file) return
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    acceptImage(canvas)
  }

  const process = async () => {
    setStep('processing')
    setError(null)
    try {
      const flat = warpPerspective(sourceCanvas, quad)
      const ocr = await recognizeDocument(flat, { onStatus: setProgress })
      setResult({ canvas: flat, ...ocr })
      setTitle(ocr.text.split('\n')[0]?.slice(0, 80) ?? 'Scanned document')
      setStep('review')
    } catch (err) {
      setError(String(err.message ?? err))
      setStep('adjust')
    }
  }

  const save = async () => {
    try {
      const doc = {
        ...docFromUpload(`${title || 'scanned-document'}.md`, result.text),
        title: title || 'Scanned document',
        collection: 'scanned',
        category: 'uploads',
      }
      await indexUserDoc(doc)
      onClose(doc)
    } catch (err) {
      setError(String(err.message ?? err))
    }
  }

  return (
    <div className="scan__backdrop" role="dialog" aria-modal="true" aria-label="Scan a document">
      <div className="scan">
        <header className="scan__head">
          <h3>
            {step === 'capture' && 'Scan a document'}
            {step === 'adjust' && 'Align the page corners'}
            {step === 'processing' && 'Reading the page — on this device'}
            {step === 'review' && 'Review & add to library'}
          </h3>
          <button className="iconbtn" onClick={() => onClose(null)} aria-label="Close scanner">
            <IconClose />
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        {step === 'capture' && (
          <div className="scan__capture">
            {cameraOn ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="scan__video" />
                <button className="btn btn--accent scan__shutter" onClick={captureFrame}>
                  Capture
                </button>
              </>
            ) : (
              <p className="dim">Camera unavailable — use a photo instead.</p>
            )}
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <IconUpload width={16} height={16} /> Use a photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
            <p className="mono dim">the image never leaves this device</p>
          </div>
        )}

        {step === 'adjust' && sourceCanvas && (
          <div className="scan__adjust">
            <QuadEditor canvas={sourceCanvas} quad={quad} onChange={setQuad} />
            <div className="scan__actions">
              <button className="btn" onClick={() => setStep('capture')}>
                Retake
              </button>
              <button className="btn btn--accent" onClick={process}>
                Dewarp & read
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="scan__processing">
            <p className="boot__line">
              {progress?.phase === 'ocr'
                ? `Recognizing text · ${Math.round((progress.progress ?? 0) * 100)}%`
                : 'Preparing OCR engine…'}
            </p>
            <div className="progress progress--indeterminate">
              <div className="progress__fill" />
            </div>
          </div>
        )}

        {step === 'review' && result && (
          <div className="scan__review">
            <PagePreview canvas={result.canvas} />
            <div className="scan__reviewtext">
              <input
                className="tester__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Document title"
              />
              <textarea
                className="scan__text"
                value={result.text}
                onChange={(e) => setResult({ ...result, text: e.target.value })}
                rows={10}
                aria-label="Extracted text"
              />
              <p className="mono dim">
                {result.provider} · {formatMs(result.ms)}
                {result.confidence != null && ` · ${Math.round(result.confidence)}% confidence`} ·
                on-device
              </p>
              <div className="scan__actions">
                <button className="btn" onClick={() => setStep('adjust')}>
                  Back
                </button>
                <button className="btn btn--accent" onClick={save} disabled={!result.text.trim()}>
                  Add to library
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Source image with four draggable corner handles over an SVG quad. */
function QuadEditor({ canvas, quad, onChange }) {
  const wrapRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [url] = useState(() => canvas.toDataURL('image/jpeg', 0.85))

  const toLocal = (e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height
    return [Math.max(0, Math.min(canvas.width, x)), Math.max(0, Math.min(canvas.height, y))]
  }

  const onPointerMove = (e) => {
    if (drag === null) return
    const p = toLocal(e)
    onChange(quad.map((q, i) => (i === drag ? p : q)))
  }

  const points = quad.map(([x, y]) => `${(x / canvas.width) * 100},${(y / canvas.height) * 100}`).join(' ')

  return (
    <div
      ref={wrapRef}
      className="quad"
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <img src={url} alt="Captured document" className="quad__img" draggable={false} />
      <svg className="quad__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={points} className="quad__poly" />
      </svg>
      {quad.map(([x, y], i) => (
        <button
          key={i}
          className={cn('quad__handle', drag === i && 'quad__handle--active')}
          style={{ left: `${(x / canvas.width) * 100}%`, top: `${(y / canvas.height) * 100}%` }}
          onPointerDown={(e) => {
            e.target.setPointerCapture?.(e.pointerId)
            setDrag(i)
          }}
          aria-label={`Corner ${i + 1}`}
        />
      ))}
    </div>
  )
}

function PagePreview({ canvas }) {
  const [url] = useState(() => canvas.toDataURL('image/jpeg', 0.85))
  return <img src={url} alt="Dewarped page" className="scan__page" />
}
