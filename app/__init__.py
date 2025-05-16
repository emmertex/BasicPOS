from flask import Flask, send_from_directory, current_app
from flask_sqlalchemy import SQLAlchemy
from config import Config
import os

db = SQLAlchemy()

def create_app(config_class=Config):
    # app.root_path is the path to the directory where the app package (app/) is located.
    # We want to go one level up from app.root_path to get to the project root,
    # and then into the 'frontend' directory.
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    static_folder_path = os.path.join(project_root, 'frontend', 'static')
    frontend_dir_path = os.path.join(project_root, 'frontend')

    app = Flask(__name__, static_folder=static_folder_path)
    app.config.from_object(config_class)

    db.init_app(app)

    from . import models

    # Register blueprints here
    from app.routes.items import bp as items_bp
    app.register_blueprint(items_bp, url_prefix='/api/items')

    from app.routes.customers import bp as customers_bp
    app.register_blueprint(customers_bp, url_prefix='/api/customers')

    from app.routes.sales import bp as sales_bp
    app.register_blueprint(sales_bp, url_prefix='/api/sales')

    from app.routes.payments import bp as payments_bp
    app.register_blueprint(payments_bp, url_prefix='/api')

    from app.routes.quick_add_items import quick_add_items_bp
    app.register_blueprint(quick_add_items_bp, url_prefix='/api/quick_add_items')

    @app.route('/')
    def serve_index():
        return send_from_directory(frontend_dir_path, 'index.html')
    
    # The static_url_path defaults to /static, so Flask will serve files from 
    # static_folder_path (e.g., frontend/static/css/style.css) at /static/css/style.css
    # No need for an explicit @app.route('/static/<path:filename>') if using default static handling.

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)

    return app 