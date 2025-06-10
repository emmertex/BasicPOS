from flask import Flask, request
from flask_sqlalchemy import SQLAlchemy
from .utils.logger import setup_logger

db = SQLAlchemy()

def create_app(config_class_string):
    app = Flask(__name__)
    app.config.from_object(config_class_string) # Points to web_frontend.config_web

    # Setup logging
    logger = setup_logger(app)
    app.logger = logger

    db.init_app(app)

    # Import models here to avoid circular imports with routes if models are needed by context processor
    from .models import Category

    # Register blueprints for web routes
    from .routes import web_bp  # Assuming routes are in routes.py
    app.register_blueprint(web_bp)

    @app.context_processor
    def inject_categories():
        top_level_categories = Category.query.filter(Category.parent_id.is_(None)).order_by(Category.name).all()
        return dict(top_level_categories=top_level_categories)

    @app.before_request
    def log_request_info():
        app.logger.info(f"Request received: {request.method} {request.url}")

    @app.after_request
    def log_response_info(response):
        app.logger.info(f"Response sent: {response.status}")
        return response

    return app 