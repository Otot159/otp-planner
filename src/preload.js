const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Day data
  getDayData: (date) => ipcRenderer.invoke('get-day-data', date),
  getDatesWithData: () => ipcRenderer.invoke('get-dates-with-data'),

  // Items
  addItem: (sectionId, date, text, parentId) => ipcRenderer.invoke('add-item', sectionId, date, text, parentId),
  updateStatus: (itemId, status) => ipcRenderer.invoke('update-status', itemId, status),
  updateText: (itemId, text) => ipcRenderer.invoke('update-text', itemId, text),
  updateItemMeeting: (itemId, meetingTime, meetingDuration) => ipcRenderer.invoke('update-item-meeting', itemId, meetingTime, meetingDuration),
  deleteItem: (itemId) => ipcRenderer.invoke('delete-item', itemId),

  // Projects (clients)
  getClients: (includeArchived) => ipcRenderer.invoke('get-clients', includeArchived),
  addClient: (name, color) => ipcRenderer.invoke('add-client', name, color),
  updateClient: (clientId, updates) => ipcRenderer.invoke('update-client', clientId, updates),
  setClientStatus: (clientId, date, text) => ipcRenderer.invoke('set-client-status', clientId, date, text),
  deleteClient: (clientId) => ipcRenderer.invoke('delete-client', clientId),
  reorderClients: (orderedIds) => ipcRenderer.invoke('reorder-clients', orderedIds),
  getAvailableColors: () => ipcRenderer.invoke('get-available-colors'),

  // Sections
  addSection: (clientId, name) => ipcRenderer.invoke('add-section', clientId, name),
  updateSection: (sectionId, name) => ipcRenderer.invoke('update-section', sectionId, name),
  deleteSection: (sectionId) => ipcRenderer.invoke('delete-section', sectionId),

  // Personal Tasks
  getPersonalTasks: () => ipcRenderer.invoke('get-personal-tasks'),
  addPersonalTask: (text, folderId) => ipcRenderer.invoke('add-personal-task', text, folderId),
  updatePersonalTask: (taskId, updates) => ipcRenderer.invoke('update-personal-task', taskId, updates),
  deletePersonalTask: (taskId) => ipcRenderer.invoke('delete-personal-task', taskId),

  // Task Notes
  getTaskNotes: (clientId) => ipcRenderer.invoke('get-task-notes', clientId),
  getTaskNote: (noteId) => ipcRenderer.invoke('get-task-note', noteId),
  addTaskNote: (title, clientId, folderId, isNote) => ipcRenderer.invoke('add-task-note', title, clientId, folderId, isNote),
  updateTaskNote: (noteId, updates) => ipcRenderer.invoke('update-task-note', noteId, updates),
  deleteTaskNote: (noteId) => ipcRenderer.invoke('delete-task-note', noteId),

  // Folders
  getFolders: (type) => ipcRenderer.invoke('get-folders', type),
  addFolder: (name, type) => ipcRenderer.invoke('add-folder', name, type),
  updateFolder: (folderId, updates) => ipcRenderer.invoke('update-folder', folderId, updates),
  deleteFolder: (folderId) => ipcRenderer.invoke('delete-folder', folderId),

  // Recurring
  getRecurring: () => ipcRenderer.invoke('get-recurring'),
  addRecurring: (sectionId, text, days, time) => ipcRenderer.invoke('add-recurring', sectionId, text, days, time),
  updateRecurring: (recId, updates) => ipcRenderer.invoke('update-recurring', recId, updates),
  deleteRecurring: (recId) => ipcRenderer.invoke('delete-recurring', recId),

  // Daily Focus
  getDailyFocus: (date) => ipcRenderer.invoke('get-daily-focus', date),
  addDailyFocusItem: (date, section, text) => ipcRenderer.invoke('add-daily-focus-item', date, section, text),
  toggleDailyFocusItem: (date, section, itemId) => ipcRenderer.invoke('toggle-daily-focus-item', date, section, itemId),
  deleteDailyFocusItem: (date, section, itemId) => ipcRenderer.invoke('delete-daily-focus-item', date, section, itemId),
  updateDailyFocusItem: (date, section, itemId, text) => ipcRenderer.invoke('update-daily-focus-item', date, section, itemId, text),
  getSupplementDefaults: () => ipcRenderer.invoke('get-supplement-defaults'),
  setSupplementDefaults: (items) => ipcRenderer.invoke('set-supplement-defaults', items),

  // Export / Import
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data) => ipcRenderer.invoke('import-data', data),

  // Export & Claude
  exportNotePDF: (title, html) => ipcRenderer.invoke('export-note-pdf', title, html),
  claudeImprove: (content, instructions) => ipcRenderer.invoke('claude-improve', content, instructions),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),

  // Dictation
  transcribeAudio: (audioData) => ipcRenderer.invoke('transcribe-audio', audioData),

  // Pomodoro
  pomoOpen: () => ipcRenderer.send('pomo-open'),
  pomoClose: () => ipcRenderer.send('pomo-close'),
  onPomoClosed: (cb) => ipcRenderer.on('pomo-closed', cb),
});
