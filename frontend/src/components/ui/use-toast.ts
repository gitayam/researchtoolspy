import * as React from 'react'

type ToastVariant = 'default' | 'destructive'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
}

interface ToastContextType {
  toasts: Toast[]
  toast: (props: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

let toastCount = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const toast = React.useCallback((props: Omit<Toast, 'id'>) => {
    const id = (++toastCount).toString()
    setToasts((prev) => [...prev, { ...props, id }])
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return React.createElement(
    ToastContext.Provider,
    { value: { toasts, toast, removeToast } },
    children,
    React.createElement(ToastContainer)
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return React.createElement(
    'div',
    { className: 'fixed top-4 right-4 z-50 space-y-2' },
    toasts.map((toast) =>
      React.createElement(
        'div',
        {
          key: toast.id,
          className: `p-4 rounded-lg shadow-lg max-w-md relative ${
            toast.variant === 'destructive' 
              ? 'bg-red-500 text-white' 
              : 'bg-white border border-gray-200 text-gray-900'
          }`
        },
        toast.title && React.createElement('div', { className: 'font-medium' }, toast.title),
        toast.description && React.createElement(
          'div', 
          { 
            className: `text-sm ${toast.variant === 'destructive' ? 'text-red-100' : 'text-gray-600'}` 
          }, 
          toast.description
        ),
        React.createElement(
          'button',
          {
            onClick: () => removeToast(toast.id),
            className: 'absolute top-2 right-2 text-xs opacity-70 hover:opacity-100'
          },
          '×'
        )
      )
    )
  )
}