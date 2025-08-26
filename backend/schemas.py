"""
JSON Schema validation for LocalStore
Shared between TypeScript and Python for consistency
"""
import json
from typing import Dict, Any, Optional
import jsonschema
from jsonschema import ValidationError
from pathlib import Path


# Tool metadata schema
TOOL_METADATA_SCHEMA = {
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
    "required": ["id", "name", "path", "entry"],
    "additionalProperties": False
}

# Tool state schema
TOOL_STATE_SCHEMA = {
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
            "enum": ["stopped", "running", "error", "installing"]
        },
        "port": {
            "type": ["integer", "null"],
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
            "type": ["string", "null"]
        }
    },
    "required": ["id", "name", "path", "venv", "entry", "status"],
    "additionalProperties": True
}

# Install request schema
INSTALL_REQUEST_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "pattern": "^[a-z0-9-]+$"
        }
    },
    "required": ["id"],
    "additionalProperties": False
}

# Create tool schemas
CREATE_FOLDER_SCHEMA = {
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
    "required": ["id", "name", "path"],
    "additionalProperties": False
}

CREATE_GIT_SCHEMA = {
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
    "required": ["id", "name", "repo"],
    "additionalProperties": False
}

CREATE_PIP_SCHEMA = {
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
    "required": ["id", "name", "spec"],
    "additionalProperties": False
}

# File operation schemas
FILE_CONTENT_SCHEMA = {
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
    "required": ["path", "content"],
    "additionalProperties": False
}

EXEC_COMMAND_SCHEMA = {
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
    "required": ["command"],
    "additionalProperties": False
}


def validate_schema(data: Dict[str, Any], schema: Dict[str, Any]) -> Optional[str]:
    """
    Validate data against a JSON schema
    
    Args:
        data: Data to validate
        schema: JSON schema to validate against
        
    Returns:
        None if valid, error message if invalid
    """
    try:
        jsonschema.validate(data, schema)
        return None
    except ValidationError as e:
        # Return user-friendly error message
        if e.path:
            field = '.'.join(str(p) for p in e.path)
            return f"Invalid {field}: {e.message}"
        return e.message


def validate_tool_install(data: Dict[str, Any]) -> Optional[str]:
    """Validate tool install request"""
    return validate_schema(data, INSTALL_REQUEST_SCHEMA)


def validate_tool_create(data: Dict[str, Any]) -> Optional[str]:
    """Validate tool creation request"""
    # Determine which schema to use based on request type
    if 'path' in data and 'repo' not in data and 'spec' not in data:
        return validate_schema(data, CREATE_FOLDER_SCHEMA)
    elif 'repo' in data:
        return validate_schema(data, CREATE_GIT_SCHEMA)
    elif 'spec' in data:
        return validate_schema(data, CREATE_PIP_SCHEMA)
    else:
        return "Invalid tool creation request"


def validate_file_content(data: Dict[str, Any]) -> Optional[str]:
    """Validate file content request"""
    return validate_schema(data, FILE_CONTENT_SCHEMA)


def validate_exec_command(data: Dict[str, Any]) -> Optional[str]:
    """Validate exec command request"""
    return validate_schema(data, EXEC_COMMAND_SCHEMA)


def export_schemas_for_typescript() -> str:
    """Export schemas as TypeScript for frontend validation"""
    schemas = {
        "toolMetadata": TOOL_METADATA_SCHEMA,
        "toolState": TOOL_STATE_SCHEMA,
        "installRequest": INSTALL_REQUEST_SCHEMA,
        "createFolder": CREATE_FOLDER_SCHEMA,
        "createGit": CREATE_GIT_SCHEMA,
        "createPip": CREATE_PIP_SCHEMA,
        "fileContent": FILE_CONTENT_SCHEMA,
        "execCommand": EXEC_COMMAND_SCHEMA
    }
    
    ts_content = """// Auto-generated from backend/schemas.py
// DO NOT EDIT MANUALLY

export const schemas = """ + json.dumps(schemas, indent=2) + """ as const;

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
"""
    
    return ts_content


if __name__ == "__main__":
    # Generate TypeScript schemas
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        output_path = Path(__file__).parent.parent / "frontend" / "src" / "schemas.ts"
        output_path.write_text(export_schemas_for_typescript())
        print(f"Exported schemas to {output_path}")
