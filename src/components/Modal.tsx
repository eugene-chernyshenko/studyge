import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  label: string
  /** Called on Esc / backdrop dismissal. Omit to make the dialog undismissable. */
  onDismiss?: () => void
  children: ReactNode
}

/** Native <dialog> in modal mode: top layer, focus trap and Esc handling for free. */
export function Modal({ label, onDismiss, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog?.isConnected || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault() // let the app decide, so the dialog can't vanish mid-round
        onDismiss?.()
      }}
    >
      {children}
    </dialog>
  )
}
