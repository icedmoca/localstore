"""
Security utilities for LocalStore
"""
import time
from collections import defaultdict
from threading import Lock
from flask import Response
import secrets


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.lock = Lock()
    
    def check_rate_limit(self, key: str, max_requests: int, window: int) -> bool:
        """
        Check if request is within rate limit
        
        Args:
            key: Unique identifier (e.g., IP address)
            max_requests: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            True if within limit, False if exceeded
        """
        with self.lock:
            now = time.time()
            
            # Clean old requests
            self.requests[key] = [
                timestamp for timestamp in self.requests[key]
                if now - timestamp < window
            ]
            
            # Check limit
            if len(self.requests[key]) >= max_requests:
                return False
            
            # Add current request
            self.requests[key].append(now)
            return True
    
    def cleanup(self):
        """Clean up old entries"""
        with self.lock:
            now = time.time()
            for key in list(self.requests.keys()):
                # Remove entries older than 1 hour
                self.requests[key] = [
                    ts for ts in self.requests[key]
                    if now - ts < 3600
                ]
                if not self.requests[key]:
                    del self.requests[key]


class SecurityHeaders:
    """Apply security headers to responses"""
    
    def __init__(self):
        self.headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
            'Content-Security-Policy': self._build_csp()
        }
    
    def _build_csp(self) -> str:
        """Build Content Security Policy"""
        directives = {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],  # Monaco needs eval
            'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            'font-src': ["'self'", "data:", "https://fonts.gstatic.com"],
            'img-src': ["'self'", "data:", "blob:", "https:"],
            'connect-src': ["'self'", "ws://localhost:*", "wss://localhost:*", "http://localhost:*", "http://127.0.0.1:*"],
            'frame-ancestors': ["'self'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"]
        }
        
        return '; '.join(
            f"{key} {' '.join(values)}"
            for key, values in directives.items()
        )
    
    def apply(self, response: Response) -> Response:
        """Apply security headers to response"""
        for header, value in self.headers.items():
            response.headers[header] = value
        return response


def generate_api_key() -> str:
    """Generate a secure API key"""
    return secrets.token_urlsafe(32)


def sanitize_path(path: str) -> str:
    """Sanitize file paths to prevent traversal"""
    # Remove any path traversal attempts
    parts = path.split('/')
    clean_parts = []
    
    for part in parts:
        if part in ('', '.', '..'):
            continue
        # Remove any special characters
        clean_part = ''.join(c for c in part if c.isalnum() or c in '-_.')
        if clean_part:
            clean_parts.append(clean_part)
    
    return '/'.join(clean_parts)


class SessionManager:
    """Manage user sessions (for future use)"""
    
    def __init__(self):
        self.sessions = {}
        self.lock = Lock()
    
    def create_session(self, user_id: str) -> str:
        """Create a new session"""
        with self.lock:
            session_id = secrets.token_urlsafe(32)
            self.sessions[session_id] = {
                'user_id': user_id,
                'created': time.time(),
                'last_accessed': time.time()
            }
            return session_id
    
    def validate_session(self, session_id: str) -> bool:
        """Validate a session"""
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            session = self.sessions[session_id]
            now = time.time()
            
            # Session expires after 24 hours
            if now - session['created'] > 86400:
                del self.sessions[session_id]
                return False
            
            # Update last accessed
            session['last_accessed'] = now
            return True
    
    def cleanup_sessions(self):
        """Clean up expired sessions"""
        with self.lock:
            now = time.time()
            expired = [
                sid for sid, session in self.sessions.items()
                if now - session['created'] > 86400
            ]
            for sid in expired:
                del self.sessions[sid]
