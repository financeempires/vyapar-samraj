'use client'

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import { AddPlanModal } from '@/components/dashboard/AddPlanModal'
import { EditPlanModal } from '@/components/dashboard/EditPlanModal'
import { DeletePlanModal } from '@/components/dashboard/DeletePlanModal'
import {
  Crown,
  CheckCircle2,
  XCircle,
  Plus,
  Calendar,
  Users,
  Pencil,
  Trash2,
  MapPin,
  Pause,
  Play,
} from 'lucide-react'

export interface Plan {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  duration_days: number
  max_sub_users?: number
  areas?: string
  is_active: boolean
  isActive?: boolean
  status?: string
  created_at: string
}

function formatPrice(price: number, currency: string) {
  if (currency === 'INR') {
    return `₹ ${Number(price).toLocaleString('en-IN')}`
  }
  return `${currency} ${Number(price).toLocaleString()}`
}

function PlanCard({
  plan,
  onEdit,
  onDelete,
  onToggle,
  isToggling,
}: {
  plan: Plan
  onEdit: (plan: Plan) => void
  onDelete: (plan: Plan) => void
  onToggle: (plan: Plan) => void
  isToggling: boolean
}) {
  const daysNum = plan.duration_days || 0
  const active = isPlanActive(plan)

  return (
    <div
      className="bg-white rounded-2xl p-4 flex flex-col gap-3"
      style={{
        border: active ? '1px solid #DBEAFE' : '1px solid #F1F5F9',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: active ? '#EEF2FF' : '#F8FAFF' }}
          >
            <Crown
              className="w-4 h-4"
              style={{ color: active ? '#2351D9' : '#94A3B8' }}
              strokeWidth={2}
            />
          </div>
          <div className="min-w-0">
            <h3
              className="text-sm font-bold truncate"
              style={{ color: '#0D1B3E' }}
            >
              {plan.name}
            </h3>
            {plan.description && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {plan.description}
              </p>
            )}
          </div>
        </div>

        {/* Action icons & Active badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={
              active
                ? { backgroundColor: '#DCFCE7', color: '#15803D' }
                : { backgroundColor: '#F1F5F9', color: '#64748B' }
            }
          >
            {active ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {active ? 'Active' : 'Inactive'}
          </span>

          <div className="flex items-center gap-1 border-l border-slate-100 pl-1.5">
            <button
              onClick={() => onToggle(plan)}
              disabled={isToggling}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={active ? 'Pause Plan' : 'Resume Plan'}
              aria-label={active ? `Pause ${plan.name}` : `Resume ${plan.name}`}
            >
              {active ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => onEdit(plan)}
              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit Plan"
              aria-label={`Edit ${plan.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(plan)}
              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete Plan"
              aria-label={`Delete ${plan.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Areas display */}
      {plan.areas && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span className="font-medium truncate"><span className="font-semibold text-slate-500">Areas:</span> {plan.areas}</span>
        </div>
      )}

      {/* Details row */}
      <div
        className="flex items-center justify-between pt-2 text-xs"
        style={{ borderTop: '1px solid #F1F5F9' }}
      >
        <div className="flex items-center">
          <span className="text-base font-bold" style={{ color: '#0D1B3E' }}>
            {formatPrice(plan.price, plan.currency)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{daysNum} Days</span>
          </div>
          {plan.max_sub_users !== undefined && plan.max_sub_users !== null && (
            <div className="flex items-center gap-1 text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
              <Users className="w-3 h-3 text-slate-500" />
              <span>{plan.max_sub_users} Sub Admins</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function isPlanActive(plan: Plan): boolean {
  if (plan.is_active === false || (plan as any).isActive === false) return false
  if (typeof (plan as any).is_active === 'string' && ((plan as any).is_active === 'false' || (plan as any).is_active === 'f')) return false
  if (typeof (plan as any).status === 'string' && (plan as any).status.toUpperCase() === 'INACTIVE') return false
  return true
}

export function PlansClient({
  initialPlans,
  displayName,
}: {
  initialPlans: Plan[]
  displayName: string
}) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Track which plan IDs are currently being toggled
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans')
      if (res.ok) {
        const data = await res.json()
        if (data.data && Array.isArray(data.data.plans)) {
          setPlans(data.data.plans)
        }
      }
    } catch (err) {
      console.error('Failed to refetch plans:', err)
    }
  }

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (plan: Plan) => {
    setDeletingPlan(plan)
    setIsDeleteModalOpen(true)
  }

  const handleToggle = async (plan: Plan) => {
    if (togglingIds.has(plan.id)) return

    const currentlyActive = isPlanActive(plan)
    const newIsActive = !currentlyActive

    // Optimistic UI update
    setTogglingIds((prev) => new Set(prev).add(plan.id))
    setPlans((prev) =>
      prev.map((p) =>
        p.id === plan.id
          ? {
              ...p,
              is_active: newIsActive,
              isActive: newIsActive,
              status: newIsActive ? 'ACTIVE' : 'INACTIVE',
            }
          : p
      )
    )

    const url = `/api/plans/${plan.id}`

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: newIsActive,
          isActive: newIsActive,
          status: newIsActive ? 'ACTIVE' : 'INACTIVE',
        }),
      })

      if (!res.ok) {
        let errorBody = ''
        try { errorBody = await res.text() } catch { /* ignore */ }
        console.error('[PlansClient] Toggle PATCH failed:', {
          planId: plan.id,
          newIsActive,
          url,
          status: res.status,
          statusText: res.statusText,
          body: errorBody,
        })
        // Rollback optimistic update
        setPlans((prev) =>
          prev.map((p) =>
            p.id === plan.id
              ? {
                  ...p,
                  is_active: currentlyActive,
                  isActive: currentlyActive,
                  status: currentlyActive ? 'ACTIVE' : 'INACTIVE',
                }
              : p
          )
        )
      } else {
        // Sync with authoritative DB value returned by backend
        const data = await res.json()
        const raw = data?.data ?? data
        if (raw && raw.id) {
          // Normalize boolean status from raw DB response
          const hasExplicitFalse =
            raw.is_active === false ||
            raw.isActive === false ||
            raw.is_active === 'false' ||
            raw.isActive === 'false' ||
            raw.is_active === 'f' ||
            (typeof raw.status === 'string' && raw.status.toUpperCase() === 'INACTIVE')

          const finalActive = !hasExplicitFalse

          setPlans((prev) =>
            prev.map((p) =>
              p.id === plan.id
                ? {
                    ...p,
                    ...raw,
                    is_active: finalActive,
                    isActive: finalActive,
                    status: finalActive ? 'ACTIVE' : 'INACTIVE',
                  }
                : p
            )
          )
        }
      }
    } catch (fetchErr) {
      // Rollback on network error
      setPlans((prev) =>
        prev.map((p) =>
          p.id === plan.id
            ? {
                ...p,
                is_active: currentlyActive,
                isActive: currentlyActive,
                status: currentlyActive ? 'ACTIVE' : 'INACTIVE',
              }
            : p
        )
      )
      console.error('[PlansClient] Network error during toggle:', fetchErr)
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(plan.id)
        return next
      })
    }
  }



  const totalPlans = plans.length
  const activePlans = plans.filter((p) => isPlanActive(p)).length
  const inactivePlans = plans.filter((p) => !isPlanActive(p)).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-40 bg-white"
        style={{ borderBottom: '1px solid #F1F5F9' }}
      >
        <DashboardHeader userName={displayName} />
      </div>

      {/* Scrollable content */}
      <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
        {/* Page title */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-[20px] font-bold"
              style={{ color: '#0D1B3E' }}
            >
              Subscription Plans
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
              Manage all available plans
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
              boxShadow: '0 4px 14px rgba(35,81,217,0.25)',
            }}
            aria-label="Add new plan"
          >
            <Plus className="w-4 h-4" />
            Add Plan
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Total', value: totalPlans, color: '#2351D9', bg: '#EEF2FF' },
            { label: 'Active', value: activePlans, color: '#15803D', bg: '#DCFCE7' },
            { label: 'Inactive', value: inactivePlans, color: '#64748B', bg: '#F1F5F9' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-3 text-center"
              style={{ border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div
                className="text-[22px] font-bold leading-tight"
                style={{ color }}
              >
                {value}
              </div>
              <div
                className="text-[11px] font-medium mt-0.5"
                style={{ color: '#7B8BB2' }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Plans list */}
        {plans.length === 0 ? (
          <div
            className="bg-white rounded-2xl p-8 text-center"
            style={{ border: '1px solid #F1F5F9' }}
          >
            <Crown
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: '#CBD5E1' }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: '#0D1B3E' }}
            >
              No plans yet
            </p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              Create your first subscription plan to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
                onToggle={handleToggle}
                isToggling={togglingIds.has(plan.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Plan Modal */}
      <AddPlanModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPlanAdded={fetchPlans}
      />

      {/* Edit Plan Modal */}
      <EditPlanModal
        isOpen={isEditModalOpen}
        plan={editingPlan}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingPlan(null)
        }}
        onPlanUpdated={fetchPlans}
      />

      {/* Delete Plan Confirmation Modal */}
      <DeletePlanModal
        isOpen={isDeleteModalOpen}
        plan={deletingPlan}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setDeletingPlan(null)
        }}
        onPlanDeleted={fetchPlans}
      />

      <BottomNavigation />
    </div>
  )
}
