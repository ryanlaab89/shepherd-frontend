import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export default function QrScanner({ onScan, onClose }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        const video = videoRef.current
        video.srcObject = stream
        video.play()
        video.addEventListener('loadedmetadata', () => {
          setReady(true)
          requestAnimationFrame(tick)
        })
      } catch (err) {
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera access denied — please allow camera permission in your browser settings.'
            : 'Could not access camera. Try typing the code instead.'
        )
      }
    }

    function tick() {
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const result = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })
      if (result?.data) {
        stop()
        onScan(result.data)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    function stop() {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }

    start()
    return stop
  }, []) // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[9995] bg-black flex flex-col">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Dark overlay with cutout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Semi-dark surround */}
        <div className="absolute inset-0 bg-black/55" style={{ maskImage: 'radial-gradient(ellipse 260px 260px at 50% 42%, transparent 100%, black 100%)' }} />

        {/* Targeting frame */}
        <div className="relative w-64 h-64 mb-4" style={{ marginTop: '-6vh' }}>
          {/* Corner brackets */}
          <span className="absolute top-0 left-0 w-9 h-9 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
          <span className="absolute top-0 right-0 w-9 h-9 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
          <span className="absolute bottom-0 left-0 w-9 h-9 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
          <span className="absolute bottom-0 right-0 w-9 h-9 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
          {/* Animated scan line */}
          {ready && (
            <div className="absolute left-3 right-3 h-0.5 bg-[var(--primary)] rounded-full shadow-[0_0_8px_var(--primary)] qr-scan-line" />
          )}
        </div>

        <p className="relative text-white/90 text-sm font-medium tracking-wide drop-shadow">
          {error ? '' : 'Point at the QR code on the label'}
        </p>

        {error && (
          <div className="relative mx-6 mt-4 px-4 py-3 rounded-xl bg-red-600/90 text-white text-sm text-center max-w-sm">
            {error}
          </div>
        )}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-11 h-11 rounded-full bg-black/50
          flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        aria-label="Close scanner"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Bottom hint */}
      <div className="absolute bottom-8 inset-x-0 text-center">
        <p className="text-white/50 text-xs">Camera will auto-detect when aligned</p>
      </div>
    </div>
  )
}
