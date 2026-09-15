'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, Plus, MapPin, Landmark, X } from 'lucide-react'
import { UserMenu } from '@/components/dashboard/UserMenu'

type SectionType = 'DAILY' | 'WEEKLY' | 'MONTHLY'

interface AreaItem {
  id: string
  name: string
  section: SectionType
}

function getInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts.map((part) => part[0].toUpperCase()).join('')
}

interface UserDashboardClientProps {
  userName?: string
}

export function UserDashboardClient({ userName: initialUserName }: UserDashboardClientProps = {}) {
  const [userName, setUserName] = useState<string>(initialUserName || '')
  const [activeTab, setActiveTab] = useState<SectionType>('DAILY')
  const [searchQuery, setSearchQuery] = useState('')
  const [areas, setAreas] = useState<AreaItem[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState<SectionType>('DAILY')
  const [newAreaName, setNewAreaName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch logged-in user profile if name is not passed as prop
  useEffect(() => {
    if (!userName) {
      fetch('/api/users')
        .then((res) => res.json())
        .then((json) => {
          const user = json?.data?.users?.[0] || json?.users?.[0]
          const name = user?.full_name || user?.username
          if (name) {
            setUserName(name)
          }
        })
        .catch(() => {})
    }
  }, [userName])

  // Load only the currently authenticated User's areas from the database
  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await fetch('/api/areas')
        if (res.ok) {
          const json = await res.json()
          const list = json?.data?.areas || json?.areas || []
          if (Array.isArray(list)) {
            setAreas(
              list.map((item: any) => ({
                id: String(item.id),
                name: String(item.name || ''),
                section: (['DAILY', 'WEEKLY', 'MONTHLY'].includes(item.section)
                  ? item.section
                  : 'DAILY') as SectionType,
              }))
            )
          }
        }
      } catch (err) {
        console.error('Failed to load areas:', err)
      }
    }

    loadAreas()
  }, [])

  const handleOpenAddModal = () => {
    setSelectedSection(activeTab)
    setNewAreaName('')
    setIsAddModalOpen(true)
  }

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAreaName.trim() || isSubmitting) return

    const areaNameToAdd = newAreaName.trim()
    const sectionToAdd = selectedSection

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: areaNameToAdd,
          section: sectionToAdd,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const added = json?.data?.area || json?.area
        if (added) {
          const newArea: AreaItem = {
            id: String(added.id),
            name: String(added.name),
            section: (added.section as SectionType) || sectionToAdd,
          }
          setAreas((prev) => [...prev, newArea])
        }
      } else {
        console.error('Failed to save area on server')
      }
    } catch (err) {
      console.error('Error adding area:', err)
    } finally {
      setIsSubmitting(false)
      setActiveTab(sectionToAdd)
      setNewAreaName('')
      setIsAddModalOpen(false)
    }
  }

  const filteredAreas = areas.filter((area) => {
    if (area.section !== activeTab) return false
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return area.name.toLowerCase().startsWith(query)
  })

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col relative pb-20 sm:pb-24">
      {/* ── Top Header Bar ── */}
      <header className="w-full bg-white border-b border-slate-100 py-3 sm:py-3.5 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
        <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer">
          <Image
            src="/vs-logo.png"
            alt="Vyapar Samraj logo"
            width={160}
            height={160}
            priority
            unoptimized
            className="h-8 sm:h-10 w-auto select-none object-contain shrink-0"
            style={{ mixBlendMode: 'multiply' }}
          />
          <span className="text-lg sm:text-[22px] font-bold tracking-tight text-[#0D1B3E] truncate">
            Vyapar Samraj
          </span>
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {/* User Profile Circle with Dropdown */}
          <UserMenu userName={userName} />
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <div className="w-full max-w-xl mx-auto px-4 sm:px-0 flex-1 flex flex-col pt-3 sm:pt-4">

        {/* ── Time Horizon Tabs (Segmented Control) ── */}
        <div className="flex w-full items-center rounded-2xl bg-[#F4F7FC] p-1.5 border border-slate-200/60 shadow-xs">
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-xl py-2.5 sm:py-3 text-center text-xs font-extrabold tracking-wider transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#1B52E8] text-white shadow-sm'
                    : 'bg-transparent text-[#0D1B3E] hover:bg-slate-200/50'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* ── Search Input & Add Area Button ── */}
        <div className="mt-3.5 sm:mt-4 flex items-center gap-2.5 sm:gap-3 w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area or account..."
              className="w-full rounded-2xl border border-slate-200/80 bg-white py-2.5 sm:py-3 pl-10 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/15 shadow-2xs transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-2xl bg-[#1B52E8] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#1542C2] active:scale-[0.98] transition-all shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Area</span>
          </button>
        </div>

        {/* ── Area Cards Section ── */}
        <div className="mt-3.5 sm:mt-4 space-y-2.5 sm:space-y-3 w-full">
          {filteredAreas.length > 0 ? (
            filteredAreas.map((area) => (
              <Link
                key={area.id}
                href={`/dashboard/areas/${area.id}`}
                className="flex items-center justify-between rounded-2xl bg-white p-3.5 sm:p-4 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] border border-slate-100 transition-all hover:shadow-[0_4px_16px_-3px_rgba(13,27,62,0.1)] cursor-pointer group"
              >
                {/* Left: Icon & Area details */}
                <div className="flex items-center gap-3 sm:gap-3.5 flex-1 min-w-0">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-[#EBF3FF] text-[#1B52E8] group-hover:bg-[#dbeafe] transition-colors">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6 fill-[#EBF3FF] text-[#1B52E8]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] sm:text-[17px] font-bold text-[#0D1B3E] truncate leading-tight">
                      {area.name}
                    </span>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="h-8 sm:h-9 w-[1px] bg-slate-200/80 mx-2 sm:mx-2.5 shrink-0" />

                {/* Right: Account Button */}
                <span
                  className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-[#EBF3FF] px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-[#1B52E8] group-hover:bg-blue-100/70 transition-all shrink-0 cursor-pointer whitespace-nowrap"
                >
                  <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#1B52E8]" />
                  <span>Account</span>
                </span>
              </Link>
            ))
          ) : (
            <div className="py-8 sm:py-12 text-center rounded-2xl bg-white border border-dashed border-slate-200 px-4">
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                {searchQuery
                  ? `No areas found matching "${searchQuery}"`
                  : `No areas found in ${activeTab.charAt(0) + activeTab.slice(1).toLowerCase()}`}
              </p>
            </div>
          )}
        </div>

        {/* ── Faint Watermark Branding Graphic & Tagline ── */}
        <div className="mt-auto pt-8 sm:pt-16 pb-6 flex flex-col items-center justify-center text-center opacity-40 pointer-events-none select-none">
          <svg className="w-16 h-16 sm:w-24 sm:h-24 text-slate-300 mb-2" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="55" width="14" height="35" rx="3" fill="currentColor" />
            <rect x="36" y="40" width="14" height="50" rx="3" fill="currentColor" />
            <rect x="57" y="25" width="14" height="65" rx="3" fill="currentColor" />
            <rect x="78" y="10" width="14" height="80" rx="3" fill="currentColor" />
            <path d="M15 50 L40 32 L60 42 L88 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M74 12 H88 V26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-slate-400">
            <span>Manage Areas</span>
            <span>|</span>
            <span>Track Accounts</span>
            <span>|</span>
            <span>Grow Together</span>
          </div>
        </div>

      </div>

      {/* ── Add Area Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3.5 sm:mb-4">
              <h3 className="text-base sm:text-lg font-bold text-[#0D1B3E]">Add New Area</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddArea} className="space-y-3.5 sm:space-y-4">
              {/* Section Selection (DAILY, WEEKLY, MONTHLY) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Section
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((sec) => {
                    const isSecActive = selectedSection === sec
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSelectedSection(sec)}
                        className={`py-2 text-xs font-extrabold tracking-wide rounded-lg transition-all cursor-pointer ${
                          isSecActive
                            ? 'bg-[#1B52E8] text-white shadow-xs'
                            : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        {sec}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Area Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Area Name
                </label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Enter area name (e.g. Visakhapatnam)"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newAreaName.trim() || isSubmitting}
                  className="rounded-xl bg-[#1B52E8] px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1542C2] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Adding...' : 'Add Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}
