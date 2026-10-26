'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react'
import clsx from '@/lib/clsx'
import { tapFeedback } from '@/lib/haptics'
import { Button } from './Button'

/**
 * App-wide feedback, so every screen feels the same:
 *   useToast()    a short "Saved ✓" message that slides up and fades away
 *   useConfirm()  an "Are you sure?" sheet in the app's own style, instead of
 *                 the browser's (which shows the web address as its title)
 *   <ConfirmForm> a form (e.g. a Delete button) that asks first
 */

export interface ConfirmOptions {
  title: string
  message?: string
  /** The button that goes ahead, e.g. "Delete". */
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for things that can't be undone. */
  danger?: boolean
}

type ToastTone = 'success' | 'error' | 'info'

interface FeedbackContext {
  toast: (message: string, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const Context = createContext<FeedbackContext | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<{ id: number; message: string; tone: ToastTone } | null>(null)
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    if (timer.current) clearTimeout(timer.current)
    setToastState({ id: Date.now(), message, tone })
    if (tone === 'success') tapFeedback()
    timer.current = setTimeout(() => setToastState(null), tone === 'error' ? 4000 : 2400)
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...options, resolve })
      }),
    []
  )

  const close = useCallback(
    (ok: boolean) => {
      dialog?.resolve(ok)
      setDialog(null)
    },
    [dialog]
  )

  return (
    <Context.Provider value={{ toast, confirm }}>
      {children}
      {dialog && <ConfirmSheet options={dialog} onClose={close} />}
      {toastState && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 md:bottom-6"
          style={{ bottom: 'max(5.75rem, calc(env(safe-area-inset-bottom, 0px) + 5.25rem))' }}
        >
          <p
            key={toastState.id}
            role={toastState.tone === 'error' ? 'alert' : 'status'}
            className={clsx(
              'toast-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-pill px-4 py-2.5 text-sm font-medium shadow-lg md:mb-0',
              toastState.tone === 'success' && 'bg-ink text-white',
              toastState.tone === 'error' && 'bg-clay text-white',
              toastState.tone === 'info' && 'bg-base-card text-ink ring-1 ring-ink/10'
            )}
          >
            {toastState.tone === 'success' && (
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-pill bg-sage text-xs text-white">
                ✓
              </span>
            )}
            {toastState.message}
          </p>
        </div>
      )}
    </Context.Provider>
  )
}

function ConfirmSheet({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Cancel has focus, so a stray Enter never deletes anything.
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Cancel" tabIndex={-1} onClick={() => onClose(false)} className="fade-in absolute inset-0 bg-ink/50" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? 'confirm-message' : undefined}
        className="sheet-in relative w-full max-w-sm rounded-t-[24px] bg-base-card p-5 shadow-lg sm:rounded-card"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-10 rounded-pill bg-ink/15 sm:hidden" />
        <p id="confirm-title" className="font-display text-xl leading-tight text-ink">
          {options.title}
        </p>
        {options.message && (
          <p id="confirm-message" className="mt-2 text-sm text-ink-muted">
            {options.message}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button ref={cancelRef} type="button" variant="secondary" onClick={() => onClose(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button type="button" variant={options.danger ? 'danger' : 'primary'} onClick={() => onClose(true)}>
            {options.confirmLabel ?? 'OK'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function useFeedback(): FeedbackContext {
  const ctx = useContext(Context)
  // Outside the provider (shouldn't happen): fall back to the browser's own.
  return (
    ctx ?? {
      toast: () => {},
      confirm: async (o) => window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title),
    }
  )
}

export const useToast = () => useFeedback().toast
export const useConfirm = () => useFeedback().confirm

/** Shows `message` each time a form action succeeds (its state gets a new nonce and no error). */
export function useSuccessToast(state: { error: string | null; nonce: number }, message: string) {
  const toast = useToast()
  const shown = useRef(state.nonce)
  useEffect(() => {
    if (state.nonce !== 0 && state.nonce !== shown.current && !state.error) toast(message)
    shown.current = state.nonce
  }, [state.nonce, state.error, message, toast])
}

/**
 * A form that asks before it submits, e.g. a Delete button with a server
 * action. Works like a normal <form action={…}>; the action only runs after "yes".
 */
export function ConfirmForm({ confirm: options, onSubmit, ...props }: FormHTMLAttributes<HTMLFormElement> & { confirm: ConfirmOptions }) {
  const ask = useConfirm()
  const approved = useRef(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (approved.current) {
      approved.current = false
      onSubmit?.(e)
      return
    }
    e.preventDefault()
    const form = e.currentTarget
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    if (await ask(options)) {
      approved.current = true
      form.requestSubmit(submitter ?? undefined)
    }
  }

  return <form {...props} onSubmit={handleSubmit} />
}
