import { useEffect, useRef, useState } from 'react'
import { parseCustomerQr } from './lib/customerQr'
import StampIcon from './StampIcon'

type Props = { onDetected: (customerId: string) => void; onClose: () => void }

export default function CustomerQrScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('Starting camera…')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const handlers = useRef({ onDetected, onClose })
  useEffect(() => { handlers.current = { onDetected, onClose } }, [onDetected, onClose])

  useEffect(() => {
    let disposed = false
    let stream: MediaStream | null = null
    let frame = 0
    let lastScan = 0
    let confirmationTimer: number | undefined
    function stop() {
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach(track => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
    function visibilityChanged() {
      if (document.hidden) { disposed = true; stop(); handlers.current.onClose() }
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera scanning needs HTTPS and a supported browser. Enter the customer ID manually instead.')
        const { default: jsQR } = await import('jsqr')
        if (disposed) return
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (disposed) { stop(); return }
        const video = videoRef.current
        if (!video) { stop(); return }
        video.srcObject = stream
        await video.play()
        if (disposed) { stop(); return }
        setStatus('Point the camera at the customer’s DigiStamp QR code.')
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Camera scanning is unavailable. Enter the customer ID manually.')
        function scan(time: number) {
          if (disposed) return
          try {
            if (video!.readyState >= 2 && video!.videoWidth && time - lastScan > 150) {
              lastScan = time
              const scale = Math.min(1, 800 / video!.videoWidth)
              canvas.width = Math.round(video!.videoWidth * scale)
              canvas.height = Math.round(video!.videoHeight * scale)
              context!.drawImage(video!, 0, 0, canvas.width, canvas.height)
              const pixels = context!.getImageData(0, 0, canvas.width, canvas.height)
              const result = jsQR(pixels.data, pixels.width, pixels.height)
              if (result) {
                const customerId = parseCustomerQr(result.data)
                if (customerId) {
                  disposed = true
                  stop()
                  setConfirmed(true)
                  setStatus('Customer QR scanned. Moving to receipt details…')
                  confirmationTimer = window.setTimeout(() => handlers.current.onDetected(customerId), 1200)
                  return
                }
                setStatus('This is not a customer DigiStamp QR code. Ask the customer to open Account → Your customer QR.')
              }
            }
            frame = requestAnimationFrame(scan)
          } catch {
            stop()
            setError('Unable to read the camera. Try again or enter the customer ID manually.')
          }
        }
        frame = requestAnimationFrame(scan)
      } catch (error) {
        stop()
        if (disposed) return
        const name = error instanceof DOMException ? error.name : ''
        setError(name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser or enter the customer ID manually.'
          : name === 'NotFoundError' ? 'No camera was found. Enter the customer ID manually.'
          : name === 'NotReadableError' ? 'The camera is busy. Close other apps using it and try again.'
          : error instanceof Error ? error.message : 'Could not open the camera. Try again or enter the customer ID manually.')
      }
    }
    void start()
    return () => { disposed = true; stop(); window.clearTimeout(confirmationTimer); document.removeEventListener('visibilitychange', visibilityChanged) }
  }, [attempt])

  return <section className="customer-scanner" aria-label="Customer QR scanner">
    <div className="scanner-heading"><h3>Scan customer QR</h3><button type="button" className="text-button" onClick={onClose}>Close camera</button></div>
    {!error && !confirmed && <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />}
    {confirmed && <div className="scan-confirmation" aria-hidden="true"><StampIcon kind="check" /></div>}
    <p role="status" className={error ? 'error' : confirmed ? 'success' : 'wallet-note'}>{error || status}</p>
    {error && <button type="button" className="wallet-refresh" onClick={() => { setError(''); setStatus('Starting camera…'); setAttempt(value => value + 1) }}>Retry camera</button>}
    <p className="wallet-note">Scanning fills the customer ID only. Verify the purchase and receipt before awarding a stamp.</p>
  </section>
}
