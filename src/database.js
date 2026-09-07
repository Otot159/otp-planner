const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let data = { clients: [], sections: [], items: [], personalTasks: [], taskNotes: [], recurring: [], folders: [], nextId: 1 };
let dbPath;

function getDbPath() {
  return path.join(app.getPath('userData'), 'dashboard-data.json');
}

function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function load() {
  if (fs.existsSync(dbPath)) {
    data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    // Migration: add archived field if missing
    data.clients.forEach(c => { if (c.archived === undefined) c.archived = false; });
    // Migration: add dated status log if missing (keeps c.status as the undated baseline)
    data.clients.forEach(c => { if (c.statusLog === undefined) c.statusLog = {}; });
    // Migration: add personalTasks if missing
    if (!data.personalTasks) data.personalTasks = [];
    // Migration: add taskNotes if missing
    if (!data.taskNotes) data.taskNotes = [];
    // Migration: add recurring if missing
    if (!data.recurring) data.recurring = [];
    // Migration: add folders if missing
    if (!data.folders) data.folders = [];
    // Migration: add dailyFocus if missing
    if (!data.dailyFocus) data.dailyFocus = {};
    // Migration: add supplementDefaults if missing — seed from existing day data
    if (!data.supplementDefaults) {
      data.supplementDefaults = [];
      // Seed from the first day that has supplements
      if (data.dailyFocus) {
        for (const date of Object.keys(data.dailyFocus)) {
          const supps = data.dailyFocus[date].supplements;
          if (supps && supps.length > 0) {
            data.supplementDefaults = supps.map(s => s.text);
            break;
          }
        }
      }
      if (data.supplementDefaults.length > 0) save();
    }
    // Migration: add folder_id to personalTasks and taskNotes
    (data.personalTasks || []).forEach(t => { if (t.folder_id === undefined) t.folder_id = null; });
    (data.taskNotes || []).forEach(n => { if (n.folder_id === undefined) n.folder_id = null; if (n.status === undefined) n.status = 'open'; if (n.is_note === undefined) n.is_note = false; });
    // Migration: convert 'Privat' folder to note type and flag its notes
    const privatFolder = (data.folders || []).find(f => f.name === 'Privat' || f.name === 'PRIVAT');
    if (privatFolder) {
      let changed = false;
      if (privatFolder.type !== 'note') { privatFolder.type = 'note'; changed = true; }
      (data.taskNotes || []).forEach(n => { if (n.folder_id === privatFolder.id && !n.is_note) { n.is_note = true; changed = true; } });
      if (changed) save();
    }
  }
}

function newId() {
  return data.nextId++;
}

const defaultSections = ['Meetings', 'Active Tickets', 'Tasks', 'Follow-ups'];
const defaultColors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#BE185D'];

function init() {
  dbPath = getDbPath();
  load();

  if (data.clients.length === 0) {
    data.nextId = 1;

    const c1 = newId();
    data.clients.push({ id: c1, name: 'Client A', color: '#1e3a5f', sort_order: 0, archived: false });
    defaultSections.forEach((name, i) => data.sections.push({ id: newId(), client_id: c1, name, sort_order: i }));

    const c2 = newId();
    data.clients.push({ id: c2, name: 'Client B', color: '#3a1e5f', sort_order: 1, archived: false });
    defaultSections.forEach((name, i) => data.sections.push({ id: newId(), client_id: c2, name, sort_order: i }));

    const c3 = newId();
    data.clients.push({ id: c3, name: 'Intern', color: '#1e5f3a', sort_order: 2, archived: false });
    ['Meetings', 'Tasks', 'Notes'].forEach((name, i) => data.sections.push({ id: newId(), client_id: c3, name, sort_order: i }));

    save();
  }
}

// ─── CLIENT / PROJECT MANAGEMENT ───

function getClients(includeArchived = false) {
  return data.clients
    .filter(c => includeArchived || !c.archived)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function addClient(name, color) {
  const maxOrder = data.clients.length > 0 ? Math.max(...data.clients.map(c => c.sort_order)) : -1;
  const id = newId();
  data.clients.push({ id, name, color: color || defaultColors[data.clients.length % defaultColors.length], sort_order: maxOrder + 1, archived: false });
  // Add default sections
  defaultSections.forEach((sname, i) => {
    data.sections.push({ id: newId(), client_id: id, name: sname, sort_order: i });
  });
  save();
  return id;
}

function updateClient(clientId, updates) {
  const client = data.clients.find(c => c.id === clientId);
  if (client) {
    if (updates.name !== undefined) client.name = updates.name;
    if (updates.color !== undefined) client.color = updates.color;
    if (updates.archived !== undefined) client.archived = updates.archived;
    if (updates.sort_order !== undefined) client.sort_order = updates.sort_order;
    if (updates.status !== undefined) client.status = updates.status;
    save();
  }
}

// Resolve the status shown for a given date: the most recent dated entry on or
// before that date, else the undated baseline (c.status). Returns { text, date }.
function resolveClientStatus(client, date) {
  const log = client.statusLog || {};
  const keys = Object.keys(log).filter(k => k <= date).sort();
  if (keys.length) { const k = keys[keys.length - 1]; return { text: log[k] || '', date: k }; }
  if (client.status) return { text: client.status, date: null };
  return { text: '', date: null };
}

// Stamp a status to a specific date. Empty text removes that day's entry
// (so the day falls back to the previous standing status).
function setClientStatus(clientId, date, text) {
  const client = data.clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.statusLog) client.statusLog = {};
  const t = (text || '').trim();
  if (t) client.statusLog[date] = t;
  else delete client.statusLog[date];
  save();
}

function deleteClient(clientId) {
  const sectionIds = data.sections.filter(s => s.client_id === clientId).map(s => s.id);
  data.items = data.items.filter(i => !sectionIds.includes(i.section_id));
  data.sections = data.sections.filter(s => s.client_id !== clientId);
  data.clients = data.clients.filter(c => c.id !== clientId);
  save();
}

function reorderClients(orderedIds) {
  orderedIds.forEach((id, i) => {
    const c = data.clients.find(c => c.id === id);
    if (c) c.sort_order = i;
  });
  save();
}

function getAvailableColors() {
  return defaultColors;
}

// ─── SECTIONS ───

function getSections(clientId) {
  return data.sections.filter(s => s.client_id === clientId).sort((a, b) => a.sort_order - b.sort_order);
}

function addSection(clientId, name) {
  const siblings = data.sections.filter(s => s.client_id === clientId);
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order)) : -1;
  const id = newId();
  data.sections.push({ id, client_id: clientId, name, sort_order: maxOrder + 1 });
  save();
  return id;
}

function updateSection(sectionId, name) {
  const sec = data.sections.find(s => s.id === sectionId);
  if (sec) { sec.name = name; save(); }
}

function deleteSection(sectionId) {
  data.items = data.items.filter(i => i.section_id !== sectionId);
  data.sections = data.sections.filter(s => s.id !== sectionId);
  save();
}

// ─── ITEMS ───

function getItems(sectionId, date, parentId = null) {
  return data.items
    .filter(i => i.section_id === sectionId && i.date === date && i.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function spawnRecurring(date) {
  // date is 'YYYY-MM-DD'
  const d = new Date(date + 'T12:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
  const recurring = data.recurring || [];
  let changed = false;

  for (const rec of recurring) {
    if (!rec.days.includes(dayOfWeek)) continue;
    // Check if already spawned by recurring_id only (not text, so edits don't cause duplicates)
    const exists = data.items.find(i => i.date === date && i.recurring_id === rec.id);
    if (exists) continue;
    // Build display text with time prefix
    const displayText = rec.time ? `${rec.time} — ${rec.text}` : rec.text;
    // Spawn it — sort by time if available
    const sortKey = rec.time ? parseInt(rec.time.replace(':','')) : 9999;
    const now = new Date().toISOString();
    data.items.push({
      id: newId(), section_id: rec.section_id, date, text: displayText,
      status: 'open', parent_id: null, sort_order: sortKey,
      created_at: now, updated_at: now, recurring_id: rec.id
    });
    changed = true;
  }
  if (changed) save();
}

function getDayData(date) {
  // Auto-spawn recurring items for this date
  spawnRecurring(date);

  const clients = getClients(false);
  const result = [];

  for (const client of clients) {
    const sections = getSections(client.id);
    const _s = resolveClientStatus(client, date);
    const clientData = { id: client.id, name: client.name, color: client.color, status: _s.text, statusDate: _s.date, sections: [] };

    for (const section of sections) {
      const items = getItems(section.id, date);
      const itemsWithSubs = items.map(item => ({
        ...item,
        sub: getItems(section.id, date, item.id)
      }));
      clientData.sections.push({ id: section.id, name: section.name, items: itemsWithSubs });
    }

    result.push(clientData);
  }

  return result;
}

// ─── RECURRING ───

function getRecurring() {
  return data.recurring || [];
}

function addRecurring(sectionId, text, days, time) {
  if (!data.recurring) data.recurring = [];
  const id = newId();
  data.recurring.push({ id, section_id: sectionId, text, days, time: time || null, sort_order: 0 });
  save();
  return id;
}

function updateRecurring(recId, updates) {
  const rec = (data.recurring || []).find(r => r.id === recId);
  if (rec) {
    if (updates.text !== undefined) rec.text = updates.text;
    if (updates.days !== undefined) rec.days = updates.days;
    if (updates.section_id !== undefined) rec.section_id = updates.section_id;
    if (updates.time !== undefined) rec.time = updates.time;
    save();
  }
}

function deleteRecurring(recId) {
  data.recurring = (data.recurring || []).filter(r => r.id !== recId);
  save();
}

function addItem(sectionId, date, text, parentId = null) {
  const siblings = data.items.filter(i => i.section_id === sectionId && i.date === date && i.parent_id === parentId);
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order)) : -1;
  const now = new Date().toISOString();
  const item = { id: newId(), section_id: sectionId, date, text, status: 'open', parent_id: parentId, sort_order: maxOrder + 1, created_at: now, updated_at: now };
  data.items.push(item);
  save();
  return item.id;
}

function updateItemStatus(itemId, status) {
  const item = data.items.find(i => i.id === itemId);
  if (item) { item.status = status; item.updated_at = new Date().toISOString(); save(); }
}

function updateItemText(itemId, text) {
  const item = data.items.find(i => i.id === itemId);
  if (item) { item.text = text; item.updated_at = new Date().toISOString(); save(); }
}

function updateItemMeeting(itemId, meetingTime, meetingDuration) {
  const item = data.items.find(i => i.id === itemId);
  if (item) {
    item.meeting_time = meetingTime;       // minutes from midnight, e.g. 570 = 9:30
    item.meeting_duration = meetingDuration; // minutes, e.g. 45
    item.updated_at = new Date().toISOString();
    save();
  }
}

function deleteItem(itemId) {
  data.items = data.items.filter(i => i.parent_id !== itemId);
  data.items = data.items.filter(i => i.id !== itemId);
  save();
}

// ─── PERSONAL TASKS ───

function getPersonalTasks() {
  return (data.personalTasks || []).sort((a, b) => a.sort_order - b.sort_order);
}

function addPersonalTask(text, folderId = null) {
  const tasks = data.personalTasks || [];
  const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.sort_order)) : -1;
  const now = new Date().toISOString();
  const task = { id: newId(), text, status: 'open', folder_id: folderId, sort_order: maxOrder + 1, created_at: now, updated_at: now };
  data.personalTasks.push(task);
  save();
  return task.id;
}

function updatePersonalTask(taskId, updates) {
  const task = data.personalTasks.find(t => t.id === taskId);
  if (task) {
    if (updates.text !== undefined) task.text = updates.text;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.folder_id !== undefined) task.folder_id = updates.folder_id;
    task.updated_at = new Date().toISOString();
    save();
  }
}

function deletePersonalTask(taskId) {
  data.personalTasks = data.personalTasks.filter(t => t.id !== taskId);
  save();
}

// ─── TASK NOTES (rich text documents) ───

function getTaskNotes(clientId = null) {
  let notes = data.taskNotes || [];
  if (clientId !== null && clientId !== undefined) {
    notes = notes.filter(n => n.client_id === clientId);
  }
  return notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

function getTaskNote(noteId) {
  return (data.taskNotes || []).find(n => n.id === noteId) || null;
}

function addTaskNote(title, clientId, folderId = null, isNote = false) {
  if (!data.taskNotes) data.taskNotes = [];
  const now = new Date().toISOString();
  const note = { id: newId(), title, client_id: clientId || null, folder_id: folderId, status: isNote ? null : 'open', is_note: isNote, content: '', created_at: now, updated_at: now };
  data.taskNotes.push(note);
  save();
  return note;
}

function updateTaskNote(noteId, updates) {
  const note = (data.taskNotes || []).find(n => n.id === noteId);
  if (note) {
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;
    if (updates.client_id !== undefined) note.client_id = updates.client_id;
    if (updates.folder_id !== undefined) note.folder_id = updates.folder_id;
    if (updates.status !== undefined) note.status = updates.status;
    note.updated_at = new Date().toISOString();
    save();
  }
  return note;
}

function deleteTaskNote(noteId) {
  data.taskNotes = (data.taskNotes || []).filter(n => n.id !== noteId);
  save();
}

// ─── FOLDERS ───

function getFolders(type = null) {
  const folders = data.folders || [];
  if (type) return folders.filter(f => f.type === type).sort((a, b) => a.sort_order - b.sort_order);
  return folders.sort((a, b) => a.sort_order - b.sort_order);
}

function addFolder(name, type) {
  // type: 'task' or 'note'
  if (!data.folders) data.folders = [];
  const siblings = data.folders.filter(f => f.type === type);
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.sort_order)) : -1;
  const id = newId();
  data.folders.push({ id, name, type, sort_order: maxOrder + 1, collapsed: false });
  save();
  return id;
}

function updateFolder(folderId, updates) {
  const folder = (data.folders || []).find(f => f.id === folderId);
  if (folder) {
    if (updates.name !== undefined) folder.name = updates.name;
    if (updates.collapsed !== undefined) folder.collapsed = updates.collapsed;
    if (updates.sort_order !== undefined) folder.sort_order = updates.sort_order;
    save();
  }
}

function deleteFolder(folderId) {
  // Unassign items from this folder (set folder_id to null)
  (data.personalTasks || []).forEach(t => { if (t.folder_id === folderId) t.folder_id = null; });
  (data.taskNotes || []).forEach(n => { if (n.folder_id === folderId) n.folder_id = null; });
  data.folders = (data.folders || []).filter(f => f.id !== folderId);
  save();
}

function getDatesWithData() {
  const dates = [...new Set(data.items.map(i => i.date))];
  return dates.sort().reverse().slice(0, 60);
}

function exportAll() {
  return { ...data, exportedAt: new Date().toISOString() };
}

function importAll(imported) {
  data = { ...imported };
  delete data.exportedAt;
  if (!data.nextId) {
    const allIds = [...data.clients.map(c => c.id), ...data.sections.map(s => s.id), ...data.items.map(i => i.id)];
    data.nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
  }
  data.clients.forEach(c => { if (c.archived === undefined) c.archived = false; });
  data.clients.forEach(c => { if (c.statusLog === undefined) c.statusLog = {}; });
  if (!data.personalTasks) data.personalTasks = [];
  if (!data.taskNotes) data.taskNotes = [];
  if (!data.recurring) data.recurring = [];
  if (!data.folders) data.folders = [];
  save();
}

// ═══ DAILY FOCUS ═══
function getDailyFocus(date) {
  if (!data.dailyFocus) data.dailyFocus = {};
  const defaults = data.supplementDefaults || [];
  if (!data.dailyFocus[date]) {
    // New day — populate supplements from defaults
    const supplements = defaults.map(text => ({ id: newId(), text, done: false }));
    data.dailyFocus[date] = { todos: [], supplements, supplementsSeeded: true };
    if (supplements.length > 0) save();
  } else if (!data.dailyFocus[date].supplementsSeeded && defaults.length > 0) {
    // Existing day created before defaults system — seed it now
    if (!data.dailyFocus[date].supplements || data.dailyFocus[date].supplements.length === 0) {
      data.dailyFocus[date].supplements = defaults.map(text => ({ id: newId(), text, done: false }));
    }
    data.dailyFocus[date].supplementsSeeded = true;
    save();
  }
  return data.dailyFocus[date];
}

function addDailyFocusItem(date, section, text) {
  if (!data.dailyFocus) data.dailyFocus = {};
  if (!data.dailyFocus[date]) data.dailyFocus[date] = { todos: [], supplements: [] };
  const item = { id: newId(), text, done: false };
  data.dailyFocus[date][section].push(item);
  save();
  return item;
}

function toggleDailyFocusItem(date, section, itemId) {
  const focus = getDailyFocus(date);
  const item = focus[section]?.find(i => i.id === itemId);
  if (item) { item.done = !item.done; save(); }
  return item;
}

function deleteDailyFocusItem(date, section, itemId) {
  const focus = getDailyFocus(date);
  if (focus[section]) {
    data.dailyFocus[date][section] = focus[section].filter(i => i.id !== itemId);
    save();
  }
}

function updateDailyFocusItem(date, section, itemId, text) {
  const focus = getDailyFocus(date);
  const item = focus[section]?.find(i => i.id === itemId);
  if (item) { item.text = text; save(); }
}

function getSupplementDefaults() {
  if (!data.supplementDefaults) data.supplementDefaults = [];
  return data.supplementDefaults;
}

function setSupplementDefaults(items) {
  data.supplementDefaults = items;
  save();
}

module.exports = {
  init, getClients, getSections, getDayData, addItem,
  updateItemStatus, updateItemText, updateItemMeeting, deleteItem,
  addClient, updateClient, deleteClient, reorderClients, getAvailableColors, setClientStatus,
  addSection, updateSection, deleteSection,
  getPersonalTasks, addPersonalTask, updatePersonalTask, deletePersonalTask,
  getTaskNotes, getTaskNote, addTaskNote, updateTaskNote, deleteTaskNote,
  getFolders, addFolder, updateFolder, deleteFolder,
  getRecurring, addRecurring, updateRecurring, deleteRecurring,
  getDatesWithData, exportAll, importAll,
  getDailyFocus, addDailyFocusItem, toggleDailyFocusItem, deleteDailyFocusItem, updateDailyFocusItem,
  getSupplementDefaults, setSupplementDefaults
};
