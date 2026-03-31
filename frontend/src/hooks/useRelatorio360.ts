import { useMemo } from 'react'
import { useRelatorio360Store } from '@/store/relatorio360Store'

export function useCurrentReport() {
  return useRelatorio360Store((s) => s.reports[s.currentDate] ?? null)
}

export function useCurrentDate() {
  return useRelatorio360Store((s) => s.currentDate)
}

export function useSummaryMetrics() {
  // useCurrentReport returns a stable object reference (same ref when state unchanged),
  // so useMemo only recomputes when the report actually changes. This avoids returning
  // a new object literal from a Zustand selector, which would cause an infinite re-render
  // loop via useSyncExternalStore's Object.is snapshot comparison (React error #185).
  const report = useCurrentReport()
  return useMemo(() => {
    if (!report) {
      return {
        activityCount: 0,
        timecardCount: 0,
        totalTimecardHours: 0,
        totalTimecardCost: 0,
        equipmentCount: 0,
        totalEquipmentHours: 0,
        totalEquipmentCost: 0,
      }
    }

    const allTimecards = report.crews.flatMap((c) => c.timecards)
    const timecardCount = allTimecards.length
    const totalTimecardHours = allTimecards.reduce((s, t) => s + t.hoursWorked, 0)
    const totalTimecardCost = allTimecards.reduce((s, t) => s + t.hoursWorked * t.hourlyRate, 0)

    const equipmentCount = report.equipmentLogs.length
    const totalEquipmentHours = report.equipmentLogs.reduce((s, e) => s + e.utilizationHours, 0)
    const totalEquipmentCost = report.equipmentLogs.reduce((s, e) => s + e.utilizationHours * e.hourlyRate, 0)

    return {
      activityCount: report.activities.length,
      timecardCount,
      totalTimecardHours,
      totalTimecardCost,
      equipmentCount,
      totalEquipmentHours,
      totalEquipmentCost,
    }
  }, [report])
}
