const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database');

let mainWindow;
let pomoWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'OtP',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F6F4F0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  db.init();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC HANDLERS ───

// Day data
ipcMain.handle('get-day-data', (_, date) => db.getDayData(date));
ipcMain.handle('get-dates-with-data', () => db.getDatesWithData());

// Items
ipcMain.handle('add-item', (_, sectionId, date, text, parentId) => db.addItem(sectionId, date, text, parentId));
ipcMain.handle('update-status', (_, itemId, status) => db.updateItemStatus(itemId, status));
ipcMain.handle('update-text', (_, itemId, text) => db.updateItemText(itemId, text));
ipcMain.handle('update-item-meeting', (_, itemId, meetingTime, meetingDuration) => db.updateItemMeeting(itemId, meetingTime, meetingDuration));
ipcMain.handle('delete-item', (_, itemId) => db.deleteItem(itemId));

// Projects
ipcMain.handle('get-clients', (_, includeArchived) => db.getClients(includeArchived));
ipcMain.handle('add-client', (_, name, color) => db.addClient(name, color));
ipcMain.handle('update-client', (_, clientId, updates) => db.updateClient(clientId, updates));
ipcMain.handle('delete-client', (_, clientId) => db.deleteClient(clientId));
ipcMain.handle('reorder-clients', (_, orderedIds) => db.reorderClients(orderedIds));
ipcMain.handle('get-available-colors', () => db.getAvailableColors());

// Sections
ipcMain.handle('add-section', (_, clientId, name) => db.addSection(clientId, name));
ipcMain.handle('update-section', (_, sectionId, name) => db.updateSection(sectionId, name));
ipcMain.handle('delete-section', (_, sectionId) => db.deleteSection(sectionId));

// Personal Tasks
ipcMain.handle('get-personal-tasks', () => db.getPersonalTasks());
ipcMain.handle('add-personal-task', (_, text, folderId) => db.addPersonalTask(text, folderId));
ipcMain.handle('update-personal-task', (_, taskId, updates) => db.updatePersonalTask(taskId, updates));
ipcMain.handle('delete-personal-task', (_, taskId) => db.deletePersonalTask(taskId));

// Task Notes
ipcMain.handle('get-task-notes', (_, clientId) => db.getTaskNotes(clientId));
ipcMain.handle('get-task-note', (_, noteId) => db.getTaskNote(noteId));
ipcMain.handle('add-task-note', (_, title, clientId, folderId, isNote) => db.addTaskNote(title, clientId, folderId, isNote));
ipcMain.handle('update-task-note', (_, noteId, updates) => db.updateTaskNote(noteId, updates));
ipcMain.handle('delete-task-note', (_, noteId) => db.deleteTaskNote(noteId));

// Folders
ipcMain.handle('get-folders', (_, type) => db.getFolders(type));
ipcMain.handle('add-folder', (_, name, type) => db.addFolder(name, type));
ipcMain.handle('update-folder', (_, folderId, updates) => db.updateFolder(folderId, updates));
ipcMain.handle('delete-folder', (_, folderId) => db.deleteFolder(folderId));

// Recurring
ipcMain.handle('get-recurring', () => db.getRecurring());
ipcMain.handle('add-recurring', (_, sectionId, text, days, time) => db.addRecurring(sectionId, text, days, time));
ipcMain.handle('update-recurring', (_, recId, updates) => db.updateRecurring(recId, updates));
ipcMain.handle('delete-recurring', (_, recId) => db.deleteRecurring(recId));

// Daily Focus
ipcMain.handle('get-daily-focus', (_, date) => db.getDailyFocus(date));
ipcMain.handle('add-daily-focus-item', (_, date, section, text) => db.addDailyFocusItem(date, section, text));
ipcMain.handle('toggle-daily-focus-item', (_, date, section, itemId) => db.toggleDailyFocusItem(date, section, itemId));
ipcMain.handle('delete-daily-focus-item', (_, date, section, itemId) => db.deleteDailyFocusItem(date, section, itemId));
ipcMain.handle('update-daily-focus-item', (_, date, section, itemId, text) => db.updateDailyFocusItem(date, section, itemId, text));
ipcMain.handle('get-supplement-defaults', () => db.getSupplementDefaults());
ipcMain.handle('set-supplement-defaults', (_, items) => db.setSupplementDefaults(items));

// Export / Import
ipcMain.handle('export-data', () => db.exportAll());
ipcMain.handle('import-data', (_, data) => db.importAll(data));

// Claude Improve
let storedApiKey = '';
const apiKeyPath = require('path').join(app.getPath('userData'), '.api-key');

ipcMain.handle('get-api-key', () => {
  if (storedApiKey) return storedApiKey;
  try {
    storedApiKey = require('fs').readFileSync(apiKeyPath, 'utf8').trim();
    return storedApiKey;
  } catch { return ''; }
});

ipcMain.handle('set-api-key', (_, key) => {
  storedApiKey = key;
  require('fs').writeFileSync(apiKeyPath, key, 'utf8');
});

ipcMain.handle('claude-improve', async (_, htmlContent, instructions) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: storedApiKey });

    // Extract images and replace with placeholders to avoid token limits
    const images = [];
    const stripped = htmlContent.replace(/<img\b[^>]*>/gi, (match) => {
      const idx = images.length;
      images.push(match);
      return `<!--IMG_${idx}-->`;
    });

    const baseInstructions = `You are a professional editor. Improve the following document by:
- Fixing grammar, spelling, and punctuation errors
- Improving clarity and readability
- Better sentence structure and flow
- Keeping the same meaning, tone, and intent`;

    const extra = instructions ? `\n\nAdditional instructions from the user:\n${instructions}` : '';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${baseInstructions}${extra}

The content is HTML from a rich text editor. Preserve all HTML tags, formatting, structure, and image placeholders (<!--IMG_0-->, <!--IMG_1-->, etc.). Only improve the text content.

Return ONLY the improved HTML, no explanations or markdown wrapping.

Content:
${stripped}`
      }]
    });

    // Restore images
    let result = msg.content[0].text;
    images.forEach((img, i) => {
      result = result.replace(`<!--IMG_${i}-->`, img);
    });

    return { content: result };
  } catch(e) {
    return { error: e.message || 'Unknown error' };
  }
});

// Export note to PDF
ipcMain.handle('export-note-pdf', async (_, title, html) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const os = require('os');

  // Write HTML to temp file to avoid data URL size limits
  const tmpPath = path.join(os.tmpdir(), `otp-export-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf8');

  // Create hidden window to render the HTML
  const printWin = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  await printWin.loadFile(tmpPath);
  // Wait for images/fonts to load
  await new Promise(r => setTimeout(r, 800));
  // Clean up temp file
  try { fs.unlinkSync(tmpPath); } catch(e) {}

  const pdfData = await printWin.webContents.printToPDF({
    marginsType: 0,
    printBackground: true,
    pageSize: 'A4',
  });

  printWin.close();

  const safeName = (title || 'note').replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() || 'note';
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${safeName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (filePath) {
    fs.writeFileSync(filePath, pdfData);
    return true;
  }
  return false;
});

// Dictation — record audio in renderer, transcribe with macOS SFSpeechRecognizer
ipcMain.handle('transcribe-audio', async (_, audioData) => {
  const fs = require('fs');
  const os = require('os');
  const { execSync, execFileSync } = require('child_process');

  const tmpWav = path.join(os.tmpdir(), `otp-audio-${Date.now()}.wav`);
  fs.writeFileSync(tmpWav, Buffer.from(audioData));

  // Path to cached transcriber binary
  const binPath = path.join(app.getPath('userData'), 'otp-transcriber');

  // Build transcriber if not cached
  if (!fs.existsSync(binPath)) {
    const swiftSrc = `
import Foundation
import Speech

let semaphore = DispatchSemaphore(value: 0)
var output = ""

SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else { print(""); semaphore.signal(); return }
    guard let recognizer = SFSpeechRecognizer() else { print(""); semaphore.signal(); return }
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    let request = SFSpeechURLRecognitionRequest(url: url)
    recognizer.recognitionTask(with: request) { result, error in
        if let result = result, result.isFinal {
            output = result.bestTranscription.formattedString
            semaphore.signal()
        } else if error != nil { semaphore.signal() }
    }
}
_ = semaphore.wait(timeout: .now() + 30)
print(output)
`;
    const srcPath = path.join(os.tmpdir(), 'otp-transcriber.swift');
    fs.writeFileSync(srcPath, swiftSrc);
    try {
      execSync(`swiftc "${srcPath}" -o "${binPath}" -framework Speech -framework Foundation -O`, { timeout: 120000 });
    } catch(e) {
      console.error('Failed to compile transcriber:', e.message);
      try { fs.unlinkSync(tmpWav); } catch(x) {}
      return '';
    }
  }

  // Run transcription
  try {
    const text = execSync(`"${binPath}" "${tmpWav}"`, { timeout: 30000 }).toString().trim();
    try { fs.unlinkSync(tmpWav); } catch(x) {}
    return text;
  } catch(e) {
    console.error('Transcription error:', e.message);
    try { fs.unlinkSync(tmpWav); } catch(x) {}
    return '';
  }
});

// Pomodoro
ipcMain.on('pomo-open', () => {
  if (pomoWindow) { pomoWindow.focus(); return; }
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  pomoWindow = new BrowserWindow({
    width: 280,
    height: 52,
    x: width - 300,
    y: height - 68,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'pomo-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  pomoWindow.loadFile(path.join(__dirname, 'pomodoro.html'));
  pomoWindow.on('closed', () => {
    pomoWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pomo-closed');
    }
  });
});

ipcMain.on('pomo-close', () => {
  if (pomoWindow) { pomoWindow.close(); pomoWindow = null; }
});

ipcMain.on('pomo-window-move', (_, dx, dy) => {
  if (!pomoWindow) return;
  const [x, y] = pomoWindow.getPosition();
  pomoWindow.setPosition(x + dx, y + dy);
});
