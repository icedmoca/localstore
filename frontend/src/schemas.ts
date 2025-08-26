// Auto-generated from backend/schemas.py
// DO NOT EDIT MANUALLY

export const schemas = {
  "toolMetadata": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$",
        "minLength": 3,
        "maxLength": 50
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "description": {
        "type": "string",
        "maxLength": 500
      },
      "version": {
        "type": "string",
        "pattern": "^\\d+\\.\\d+\\.\\d+$"
      },
      "author": {
        "type": "string",
        "maxLength": 100
      },
      "path": {
        "type": "string"
      },
      "entry": {
        "type": "string",
        "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z_][a-zA-Z0-9_]*$"
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^[a-z0-9-]+$"
        },
        "maxItems": 10
      },
      "icon": {
        "type": "string"
      },
      "repository": {
        "type": "string",
        "format": "uri"
      },
      "homepage": {
        "type": "string",
        "format": "uri"
      }
    },
    "required": [
      "id",
      "name",
      "path",
      "entry"
    ],
    "additionalProperties": false
  },
  "toolState": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "path": {
        "type": "string"
      },
      "venv": {
        "type": "string"
      },
      "entry": {
        "type": "string"
      },
      "status": {
        "type": "string",
        "enum": [
          "stopped",
          "running",
          "error",
          "installing"
        ]
      },
      "port": {
        "type": [
          "integer",
          "null"
        ],
        "minimum": 1024,
        "maximum": 65535
      },
      "autostart": {
        "type": "boolean"
      },
      "python": {
        "type": "string"
      },
      "installedAt": {
        "type": "string",
        "format": "date-time"
      },
      "lastStarted": {
        "type": "string",
        "format": "date-time"
      },
      "error": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "path",
      "venv",
      "entry",
      "status"
    ],
    "additionalProperties": true
  },
  "installRequest": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      }
    },
    "required": [
      "id"
    ],
    "additionalProperties": false
  },
  "createFolder": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      },
      "name": {
        "type": "string",
        "minLength": 1
      },
      "path": {
        "type": "string",
        "minLength": 1
      },
      "entry": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "path"
    ],
    "additionalProperties": false
  },
  "createGit": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      },
      "name": {
        "type": "string",
        "minLength": 1
      },
      "repo": {
        "type": "string",
        "format": "uri"
      },
      "ref": {
        "type": "string"
      },
      "subdir": {
        "type": "string"
      },
      "entry": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "repo"
    ],
    "additionalProperties": false
  },
  "createPip": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      },
      "name": {
        "type": "string",
        "minLength": 1
      },
      "spec": {
        "type": "string",
        "minLength": 1
      },
      "entry": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "spec"
    ],
    "additionalProperties": false
  },
  "fileContent": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1
      },
      "content": {
        "type": "string"
      }
    },
    "required": [
      "path",
      "content"
    ],
    "additionalProperties": false
  },
  "execCommand": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "python": {
        "type": "boolean"
      }
    },
    "required": [
      "command"
    ],
    "additionalProperties": false
  }
} as const;

// Type helpers
export type ToolMetadata = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  path: string;
  entry: string;
  tags?: string[];
  icon?: string;
  repository?: string;
  homepage?: string;
};

export type ToolState = {
  id: string;
  name: string;
  path: string;
  venv: string;
  entry: string;
  status: 'stopped' | 'running' | 'error' | 'installing';
  port?: number | null;
  autostart?: boolean;
  python?: string;
  installedAt?: string;
  lastStarted?: string;
  error?: string | null;
};

export type InstallRequest = {
  id: string;
};

export type CreateFolderRequest = {
  id: string;
  name: string;
  path: string;
  entry?: string;
};

export type CreateGitRequest = {
  id: string;
  name: string;
  repo: string;
  ref?: string;
  subdir?: string;
  entry?: string;
};

export type CreatePipRequest = {
  id: string;
  name: string;
  spec: string;
  entry?: string;
};
