"""
LocalStore Notepad - A simple web-based text editor
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import json
import os
from pathlib import Path

app = FastAPI(title="Notepad", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data directory for notes
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Models
class Note(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    tags: List[str] = []

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None

class HealthCheck(BaseModel):
    status: str
    name: str
    version: str

# In-memory storage (could be replaced with a database)
notes_file = DATA_DIR / "notes.json"

def load_notes() -> Dict[str, Note]:
    """Load notes from file"""
    if notes_file.exists():
        try:
            data = json.loads(notes_file.read_text())
            return {k: Note(**v) for k, v in data.items()}
        except Exception:
            return {}
    return {}

def save_notes(notes: Dict[str, Note]):
    """Save notes to file"""
    data = {k: v.dict() for k, v in notes.items()}
    notes_file.write_text(json.dumps(data, indent=2))

# Health check
@app.get("/health", response_model=HealthCheck)
async def health():
    return HealthCheck(
        status="healthy",
        name="Notepad",
        version="1.0.0"
    )

# HTML interface
@app.get("/", response_class=HTMLResponse)
async def root():
    return """
<!DOCTYPE html>
<html>
<head>
    <title>LocalStore Notepad</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            display: grid;
            grid-template-columns: 250px 1fr;
            gap: 20px;
            height: calc(100vh - 100px);
        }
        .sidebar {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .editor {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .note-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .note-item {
            padding: 10px;
            margin-bottom: 5px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .note-item:hover {
            background: #f0f0f0;
        }
        .note-item.active {
            background: #007bff;
            color: white;
        }
        input[type="text"], textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 10px;
            box-sizing: border-box;
        }
        textarea {
            flex: 1;
            resize: none;
            font-family: 'Monaco', 'Consolas', monospace;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        button:hover {
            background: #0056b3;
        }
        button.secondary {
            background: #6c757d;
        }
        button.secondary:hover {
            background: #545b62;
        }
        button.danger {
            background: #dc3545;
        }
        button.danger:hover {
            background: #c82333;
        }
        .empty-state {
            text-align: center;
            color: #999;
            padding: 40px;
        }
        .button-group {
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <h1>📝 LocalStore Notepad</h1>
    <div class="container">
        <div class="sidebar">
            <button onclick="createNote()">+ New Note</button>
            <h3>Notes</h3>
            <ul class="note-list" id="noteList">
                <li class="empty-state">No notes yet</li>
            </ul>
        </div>
        <div class="editor" id="editor" style="display: none;">
            <input type="text" id="noteTitle" placeholder="Note title..." />
            <textarea id="noteContent" placeholder="Start typing..."></textarea>
            <div class="button-group">
                <button onclick="saveNote()">Save</button>
                <button class="danger" onclick="deleteNote()">Delete</button>
            </div>
        </div>
        <div class="empty-state" id="emptyEditor">
            <p>Select a note or create a new one</p>
        </div>
    </div>

    <script>
        let notes = {};
        let currentNoteId = null;

        // Load notes on startup
        async function loadNotes() {
            try {
                const response = await fetch('/api/notes');
                notes = await response.json();
                renderNoteList();
            } catch (error) {
                console.error('Failed to load notes:', error);
            }
        }

        // Render note list
        function renderNoteList() {
            const noteList = document.getElementById('noteList');
            const noteIds = Object.keys(notes);
            
            if (noteIds.length === 0) {
                noteList.innerHTML = '<li class="empty-state">No notes yet</li>';
                return;
            }

            noteList.innerHTML = noteIds.map(id => {
                const note = notes[id];
                const isActive = id === currentNoteId ? 'active' : '';
                return `
                    <li class="note-item ${isActive}" onclick="selectNote('${id}')">
                        <strong>${note.title || 'Untitled'}</strong>
                        <br>
                        <small>${new Date(note.updated_at).toLocaleDateString()}</small>
                    </li>
                `;
            }).join('');
        }

        // Create new note
        async function createNote() {
            const note = {
                title: 'New Note',
                content: '',
                tags: []
            };

            try {
                const response = await fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(note)
                });
                
                const created = await response.json();
                notes[created.id] = created;
                renderNoteList();
                selectNote(created.id);
            } catch (error) {
                console.error('Failed to create note:', error);
            }
        }

        // Select note
        function selectNote(id) {
            currentNoteId = id;
            const note = notes[id];
            
            document.getElementById('noteTitle').value = note.title || '';
            document.getElementById('noteContent').value = note.content || '';
            
            document.getElementById('editor').style.display = 'flex';
            document.getElementById('emptyEditor').style.display = 'none';
            
            renderNoteList();
        }

        // Save note
        async function saveNote() {
            if (!currentNoteId) return;

            const title = document.getElementById('noteTitle').value;
            const content = document.getElementById('noteContent').value;

            try {
                const response = await fetch(`/api/notes/${currentNoteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content })
                });
                
                const updated = await response.json();
                notes[currentNoteId] = updated;
                renderNoteList();
            } catch (error) {
                console.error('Failed to save note:', error);
            }
        }

        // Delete note
        async function deleteNote() {
            if (!currentNoteId) return;
            
            if (!confirm('Delete this note?')) return;

            try {
                await fetch(`/api/notes/${currentNoteId}`, {
                    method: 'DELETE'
                });
                
                delete notes[currentNoteId];
                currentNoteId = null;
                
                document.getElementById('editor').style.display = 'none';
                document.getElementById('emptyEditor').style.display = 'block';
                
                renderNoteList();
            } catch (error) {
                console.error('Failed to delete note:', error);
            }
        }

        // Auto-save
        let saveTimeout;
        document.getElementById('noteTitle').addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveNote, 1000);
        });
        document.getElementById('noteContent').addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveNote, 1000);
        });

        // Load notes on startup
        loadNotes();
    </script>
</body>
</html>
"""

# API endpoints
@app.get("/api/notes")
async def get_notes():
    """Get all notes"""
    notes = load_notes()
    return notes

@app.post("/api/notes", response_model=Note)
async def create_note(note: Note):
    """Create a new note"""
    notes = load_notes()
    
    # Generate ID
    note.id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    note.created_at = datetime.now().isoformat()
    note.updated_at = note.created_at
    
    notes[note.id] = note
    save_notes(notes)
    
    return note

@app.get("/api/notes/{note_id}", response_model=Note)
async def get_note(note_id: str):
    """Get a specific note"""
    notes = load_notes()
    
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return notes[note_id]

@app.put("/api/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, update: NoteUpdate):
    """Update a note"""
    notes = load_notes()
    
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note = notes[note_id]
    
    if update.title is not None:
        note.title = update.title
    if update.content is not None:
        note.content = update.content
    if update.tags is not None:
        note.tags = update.tags
    
    note.updated_at = datetime.now().isoformat()
    
    notes[note_id] = note
    save_notes(notes)
    
    return note

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str):
    """Delete a note"""
    notes = load_notes()
    
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    
    del notes[note_id]
    save_notes(notes)
    
    return {"ok": True}

@app.get("/api/info")
async def info():
    """Get app info"""
    notes = load_notes()
    return {
        "name": "Notepad",
        "version": "1.0.0",
        "notes_count": len(notes),
        "features": [
            "Create, edit, and delete notes",
            "Auto-save functionality",
            "Clean, simple interface",
            "Persistent storage"
        ]
    }
