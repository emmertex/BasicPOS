from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app(config_class_string):
    app = Flask(__name__)
    app.config.from_object(config_class_string) # Points to web_frontend.config_web

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

    return app 