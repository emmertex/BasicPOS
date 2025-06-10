import logging
from logging.handlers import TimedRotatingFileHandler
import os
from datetime import datetime
import json
from flask import request, has_request_context

class RequestFormatter(logging.Formatter):
    def format(self, record):
        if has_request_context():
            # Get request details
            record.url = request.url
            record.method = request.method
            record.remote_addr = request.remote_addr
            record.user_agent = request.user_agent.string
            record.is_bot = self._is_bot(request.user_agent.string)
            record.referrer = request.referrer
            record.timestamp = datetime.utcnow().isoformat()
            
            # Get additional headers that might be useful
            record.headers = dict(request.headers)
            
            # Create a structured log entry
            log_data = {
                'timestamp': record.timestamp,
                'level': record.levelname,
                'message': record.getMessage(),
                'url': record.url,
                'method': record.method,
                'remote_addr': record.remote_addr,
                'user_agent': record.user_agent,
                'is_bot': record.is_bot,
                'referrer': record.referrer,
                'headers': record.headers
            }
            
            return json.dumps(log_data)
        return super().format(record)

    def _is_bot(self, user_agent):
        """Simple bot detection based on common bot user agent strings"""
        bot_indicators = [
            'bot', 'crawler', 'spider', 'slurp', 'search', 'mediapartners',
            'nagios', 'monitoring', 'curl', 'wget', 'python-requests'
        ]
        user_agent_lower = user_agent.lower()
        return any(indicator in user_agent_lower for indicator in bot_indicators)

def setup_logger(app):
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure the logger
    logger = logging.getLogger('flask_app')
    logger.setLevel(logging.INFO)
    
    # Create a handler that rotates logs daily
    log_file = os.path.join(log_dir, 'flask_app.log')
    handler = TimedRotatingFileHandler(
        log_file,
        when='midnight',
        interval=1,
        backupCount=30,  # Keep 30 days of logs
        encoding='utf-8'
    )
    
    # Set the custom formatter
    handler.setFormatter(RequestFormatter())
    logger.addHandler(handler)
    
    return logger 