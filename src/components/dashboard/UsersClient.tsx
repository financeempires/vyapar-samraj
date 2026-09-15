'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  User,
  UserCheck,
  UserX,
  Clock,
  CalendarX,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  PauseCircle,
  PlayCircle,
  Filter,
} from 'lucide-react'
import { AddUserModal } from './AddUserModal'
import { EditUserModal } from './EditUserModal'

export type UserStatus = 'active' | 'inactive' | 'expired' | 'paused'
export type FilterStatus = 'all' | 'active' | 'inactive' | 'expired'
export type UserRole = 'USER' | 'SUB_USER'

export interface Profile {
  id: string
  username: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  organization?: string
  phone?: string
  plan_id?: string
  start_date?: string | null
  end_date?: string | null
  created_at: string
}

export function getUserEffectiveStatus(profile: Profile): 'active' | 'inactive' | 'expired' {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // 1. If End Date < today → EXPIRED
  if (profile.end_date) {
    const endDate = new Date(profile.end_date)
    if (!isNaN(endDate.getTime())) {
      let endDayEnd: number
      if (typeof profile.end_date === 'string' && profile.end_date.includes('-')) {
        const parts = profile.end_date.split('T')[0].split('-')
        if (parts.length === 3) {
          endDayEnd = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59, 999).getTime()
        } else {
          endDayEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime()
        }
      } else {
        endDayEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime()
      }

      if (endDayEnd < todayStart) {
        return 'expired'
      }
    }
  }

  // 2. Else if user is manually paused → INACTIVE
  if (profile.status === 'paused' || profile.status === 'inactive') {
    return 'inactive'
  }

  // 3. Else → ACTIVE
  return 'active'
}

const STATUS_STYLES: Record<'active' | 'inactive' | 'expired', { bg: string; color: string; label: string }> = {
  active:   { bg: '#DCFCE7', color: '#15803D', label: 'Active' },
  inactive: { bg: '#F1F5F9', color: '#64748B', label: 'Inactive' },
  expired:  { bg: '#FFF7ED', color: '#C2410C', label: 'Expired' },
}

const STATUS_ICON: Record<'active' | 'inactive' | 'expired', React.ElementType> = {
  active:   UserCheck,
  inactive: UserX,
  expired:  CalendarX,
}

function getExpiryInfo(endDateStr?: string | null) {
  if (!endDateStr) return null
  const end = new Date(endDateStr)
  if (isNaN(end.getTime())) return null
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formattedDate = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const isExpiringWithin15Days = daysRemaining >= 0 && daysRemaining <= 15
  const isExpired = daysRemaining < 0
  return { daysRemaining, formattedDate, isExpiringWithin15Days, isExpired }
}

function UserRow({
  profile,
  onEdit,
  onDelete,
  onTogglePause,
  isTogglingPause,
}: {
  profile: Profile
  onEdit: (p: Profile) => void
  onDelete: (p: Profile) => void
  onTogglePause: (p: Profile) => void
  isTogglingPause?: boolean
}) {
  const effectiveStatus = getUserEffectiveStatus(profile)
  const statusStyle = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.inactive
  const StatusIcon = STATUS_ICON[effectiveStatus] ?? User
  const initials = profile.full_name?.slice(0, 2).toUpperCase() ?? profile.username?.slice(0, 2).toUpperCase() ?? 'US'
  const isSubUser = profile.role === 'SUB_USER'
  const expiryInfo = getExpiryInfo(profile.end_date)

  return (
    <div
      className="bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 sm:px-4 sm:py-3 border-b last:border-b-0 hover:bg-slate-50/50 transition-colors overflow-hidden"
      style={{ borderColor: '#F1F5F9' }}
    >
      {/* Top / Main info section */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            backgroundColor: isSubUser ? '#F3E8FF' : '#EEF2FF',
            color: isSubUser ? '#9333EA' : '#2351D9',
          }}
        >
          {initials}
        </div>

        {/* Name + email + expiry */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-sm font-semibold truncate max-w-[200px] sm:max-w-none"
              style={{ color: '#0D1B3E' }}
            >
              {profile.full_name}
            </span>
            {isSubUser && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
                style={{ backgroundColor: '#F3E8FF', color: '#9333EA' }}
              >
                Sub
              </span>
            )}
          </div>
          <p
            className="text-[11px] truncate mt-0.5"
            style={{ color: '#9CA3AF' }}
          >
            {profile.email}
          </p>
          {expiryInfo && (
            <p
              className={`text-[11px] font-medium mt-0.5 flex flex-wrap items-center gap-1 ${
                expiryInfo.isExpiringWithin15Days ? 'text-red-600 font-bold' : ''
              }`}
              style={{ color: expiryInfo.isExpiringWithin15Days ? '#DC2626' : '#9CA3AF' }}
            >
              <span>Expires: {expiryInfo.formattedDate}</span>
              {expiryInfo.isExpiringWithin15Days && (
                <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.2 rounded">
                  {expiryInfo.daysRemaining === 0 ? 'Expires Today' : `${expiryInfo.daysRemaining} days left`}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Status badge + Action Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* Status badge */}
        <span
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
        >
          <StatusIcon className="w-3 h-3" />
          {statusStyle.label}
        </span>

        {/* Pause / Resume & Edit & Delete Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {effectiveStatus !== 'inactive' && (
            <button
              onClick={() => onTogglePause(profile)}
              disabled={isTogglingPause}
              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
              title="Pause user"
              aria-label={`Pause ${profile.full_name}`}
            >
              {isTogglingPause ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
              <span>Pause</span>
            </button>
          )}
          {effectiveStatus === 'inactive' && (
            <button
              onClick={() => onTogglePause(profile)}
              disabled={isTogglingPause}
              className="p-1.5 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
              title="Resume user"
              aria-label={`Resume ${profile.full_name}`}
            >
              {isTogglingPause ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              <span>Resume</span>
            </button>
          )}
          <button
            onClick={() => onEdit(profile)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Edit user"
            aria-label={`Edit ${profile.full_name}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(profile)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete user"
            aria-label={`Delete ${profile.full_name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface UsersClientProps {
  initialUsers: Profile[]
  fetchError?: boolean
}

export function UsersClient({ initialUsers, fetchError = false }: UsersClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')

  const filteredUsers = users.filter((u) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      if (!matches) return false
    }

    // Status filter
    const effStatus = getUserEffectiveStatus(u)
    if (statusFilter === 'all') return true
    return effStatus === statusFilter
  })

  const totalUsers = users.length
  const activeUsers = users.filter((u) => getUserEffectiveStatus(u) === 'active').length
  const inactiveUsers = users.filter((u) => getUserEffectiveStatus(u) === 'inactive').length
  const expiredUsers = users.filter((u) => getUserEffectiveStatus(u) === 'expired').length

  const refreshUsersList = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success && data.data?.users) {
        setUsers(data.data.users)
      } else {
        router.refresh()
      }
    } catch {
      router.refresh()
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete user from database')
      }
      await refreshUsersList()
      setDeletingUser(null)
    } catch (err: any) {
      console.error('Delete user error:', err)
      setDeleteError(err.message || 'Failed to delete user from database')
    } finally {
      setIsDeleting(false)
    }
  }

  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)

  const handleTogglePause = async (profile: Profile) => {
    const effStatus = getUserEffectiveStatus(profile)
    const newStatus = effStatus === 'inactive' ? 'active' : 'paused'
    setTogglingUserId(profile.id)
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update user status in database')
      }
      await refreshUsersList()
    } catch (err: any) {
      console.error('Pause/Resume error:', err)
    } finally {
      setTogglingUserId(null)
    }
  }

  return (
    <>
      <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
        {/* Page title + Add User Button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-[20px] font-bold"
              style={{ color: '#0D1B3E' }}
            >
              User Management
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
              All registered users
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
              boxShadow: '0 4px 14px rgba(35,81,217,0.25)',
            }}
            aria-label="Add new user"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total',    value: totalUsers,    color: '#2351D9', bg: '#EEF2FF' },
            { label: 'Active',   value: activeUsers,   color: '#15803D', bg: '#DCFCE7' },
            { label: 'Inactive', value: inactiveUsers, color: '#64748B', bg: '#F1F5F9' },
            { label: 'Expired',  value: expiredUsers,  color: '#C2410C', bg: '#FFF7ED' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-2.5 text-center"
              style={{ border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div
                className="text-[18px] font-bold leading-tight"
                style={{ color }}
              >
                {value}
              </div>
              <div
                className="text-[10px] font-medium mt-0.5"
                style={{ color: '#7B8BB2' }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              strokeWidth={1.8}
            />
            <input
              type="text"
              placeholder="Search users by name, email or username…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 outline-none placeholder-slate-400 focus:border-blue-600 transition-all"
              style={{
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
              aria-label="Search users"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600 transition-all appearance-none pr-8 cursor-pointer"
              style={{
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
              aria-label="Filter users by status"
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Users list */}
        {fetchError ? (
          <div
            className="bg-white rounded-2xl p-6 text-center"
            style={{ border: '1px solid #FEE2E2' }}
          >
            <p className="text-sm font-medium text-red-500">
              Failed to load users. Please check database connection.
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div
            className="bg-white rounded-2xl p-8 text-center"
            style={{ border: '1px solid #F1F5F9' }}
          >
            <Users
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: '#CBD5E1' }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: '#0D1B3E' }}
            >
              No users yet
            </p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              Users registered on the platform will appear here.
            </p>
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
          >
            {filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                profile={user}
                onEdit={(p) => setEditingUser(p)}
                onDelete={(p) => {
                  setDeletingUser(p)
                  setDeleteError(null)
                }}
                onTogglePause={handleTogglePause}
                isTogglingPause={togglingUserId === user.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserAdded={refreshUsersList}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={refreshUsersList}
      />

      {/* Delete User Confirmation Dialog */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete User</h3>
              <p className="text-xs text-slate-500 mt-1.5">
                Are you sure you want to delete <span className="font-semibold text-slate-800">{deletingUser.full_name || deletingUser.username}</span>? This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-xs text-red-600 font-medium text-left">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors w-1/2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors w-1/2 shadow-md"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
