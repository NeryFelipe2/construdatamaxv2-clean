import { useMemo, useState } from 'react'
import { useAgendaStore } from '@/store/agendaStore'
import { AgendaHeader } from './components/AgendaHeader'
import { AgendaToolbar } from './components/AgendaToolbar'
import { GanttChart } from './components/GanttChart'
import { ThreeDWallCalendar } from './components/ThreeDWallCalendar'
import { AgendaBottomBar } from './components/AgendaBottomBar'
import { TaskEditDialog } from './components/TaskEditDialog'

export function AgendaPage() {
  const { resources, editingTaskId, setEditingTask, displayView } = useAgendaStore()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredResourceIds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return resources.map((r) => r.id)
    return resources
      .filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.code.toLowerCase().includes(term)
      )
      .map((r) => r.id)
  }, [resources, searchTerm])

  function handleAddTask() {
    setEditingTask('new')
  }

  return (
    <div className="flex flex-col h-full">
      <AgendaHeader />
      <AgendaToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddTask={handleAddTask}
      />
      <div className="flex-1 overflow-hidden">
        {displayView === 'gantt'
          ? <GanttChart filteredResourceIds={filteredResourceIds} />
          : <ThreeDWallCalendar />
        }
      </div>
      {displayView === 'gantt' && <AgendaBottomBar />}

      {editingTaskId && <TaskEditDialog />}
    </div>
  )
}
