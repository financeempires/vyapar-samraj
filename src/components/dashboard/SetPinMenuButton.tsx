'use client'

import { useState } from 'react'
import { KeyRound, ChevronRight } from 'lucide-react'
import { SetPinModal } from './SetPinModal'

export function SetPinMenuButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#EEF2FF' }}
          >
            <KeyRound className="w-4 h-4" style={{ color: '#2351D9' }} strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#0D1B3E' }}>
            Set PIN
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 text-[10px] font-semibold rounded-md"
            style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
          >
            Security
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      <SetPinModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
