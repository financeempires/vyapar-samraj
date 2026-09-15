'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react'
import type { Plan } from './PlansClient'

interface DeletePlanModalProps {
  isOpen: boolean
  plan: Plan | null
  onClose: () => void
  onPlanDeleted: () => void
}

export function DeletePlanModal({ isOpen, plan, onClose, onPlanDeleted }: DeletePlanModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !plan) return null

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (res.ok && data.success !== false) {
        onPlanDeleted()
        handleClose()
      } else {
        setError(data.message || data.error || 'Failed to delete plan. Please try again.')
      }
    } catch (err) {
      console.error('Delete plan error:', err)
      setError('An internal error occurred while deleting the plan.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        style={{ color: '#0D1B3E' }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          aria-label="Close modal"
          disabled={isDeleting}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4 text-red-600">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>

        {/* Modal Title & Message */}
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0D1B3E' }}>
          Delete Plan?
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Are you sure you want to delete <span className="font-semibold text-slate-800">"{plan.name}"</span>?
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Buttons Row */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
