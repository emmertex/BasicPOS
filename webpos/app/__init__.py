from flask import Flask, send_from_directory, current_app, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_mail import Mail
from config import Config
import os

db = SQLAlchemy()
migrate = Migrate()
mail = Mail()

def create_app(config_class=Config):
    # app.root_path is the path to the directory where the app package (app/) is located.
    # We want to go one level up from app.root_path to get to the project root,
    # and then into the 'frontend' directory.
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    static_folder_path = os.path.join(project_root, 'frontend', 'static')
    template_folder_path = os.path.join(project_root, 'templates')
    frontend_dir_path = os.path.join(project_root, 'frontend')

    app = Flask(__name__, 
                static_folder=static_folder_path, 
                template_folder=template_folder_path)
    app.config.from_object(config_class)
    
    # Enable CORS for all routes
    CORS(app, resources={r"/*": {"origins": "*"}})

    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)

    from app.services.quick_add_item_service import QuickAddItemService

    # WORKAROUND: Direct route for /api/quick-add-items GET requests
    @app.route('/api/quick-add-items', methods=['GET'])
    def direct_get_quick_add_items():
        current_app.logger.info(f"[DIRECT_ROUTE_WORKAROUND] GET /api/quick-add-items called with args: {request.args}")
        page_number = request.args.get('page', default=1, type=int)
        if page_number < 1:
            return jsonify({"error": "Page number must be positive"}), 400
        
        items_list_of_dicts = QuickAddItemService.get_quick_add_items_by_page(page_number)
        
        if items_list_of_dicts is None: 
            current_app.logger.error(f"WORKAROUND: QuickAddItemService.get_quick_add_items_by_page returned None for page {page_number}")
            return jsonify({"error": "Failed to retrieve quick add items via direct route workaround"}), 500
        
        return jsonify(items_list_of_dicts), 200

    # WORKAROUND: Direct route for /api/quick-add-items POST requests
    @app.route('/api/quick-add-items', methods=['POST'])
    def direct_post_quick_add_items():
        current_app.logger.info(f"[DIRECT_ROUTE_WORKAROUND] POST /api/quick-add-items called.")
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400
        try:
            # This logic is similar to create_quick_add_item_route in the blueprint
            new_item = QuickAddItemService.create_quick_add_item(data)
            return jsonify(new_item), 201
        except ValueError as ve:
            return jsonify({"error": str(ve)}), 400
        except Exception as e:
            current_app.logger.error(f"Error in direct_post_quick_add_items: {e}", exc_info=True)
            return jsonify({"error": "An unexpected error occurred creating the quick add item via direct route."}), 500

    # WORKAROUND: Direct route for /api/quick-add-items/<int:qai_id> PUT requests
    @app.route('/api/quick-add-items/<int:qai_id>', methods=['PUT'])
    def direct_put_quick_add_item(qai_id):
        current_app.logger.info(f"[DIRECT_ROUTE_WORKAROUND] PUT /api/quick-add-items/{qai_id} called.")
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided for update"}), 400
        try:
            updated_item = QuickAddItemService.update_quick_add_item(qai_id, data)
            return jsonify(updated_item), 200
        except ValueError as ve:
            return jsonify({"error": str(ve)}), 404 if "not found" in str(ve).lower() else 400
        except Exception as e:
            current_app.logger.error(f"Error in direct_put_quick_add_item for ID {qai_id}: {e}", exc_info=True)
            return jsonify({"error": "An unexpected error occurred updating the quick add item via direct route."}), 500

    # WORKAROUND: Direct route for /api/quick-add-items/<int:qai_id> DELETE requests
    @app.route('/api/quick-add-items/<int:qai_id>', methods=['DELETE'])
    def direct_delete_quick_add_item(qai_id):
        current_app.logger.info(f"[DIRECT_ROUTE_WORKAROUND] DELETE /api/quick-add-items/{qai_id} called.")
        try:
            result = QuickAddItemService.delete_quick_add_item(qai_id)
            return jsonify(result), 200
        except ValueError as ve:
            return jsonify({"error": str(ve)}), 404
        except Exception as e:
            current_app.logger.error(f"Error in direct_delete_quick_add_item for ID {qai_id}: {e}", exc_info=True)
            return jsonify({"error": "An unexpected error occurred deleting the quick add item via direct route."}), 500

    # WORKAROUND: Direct route for /api/quick-add-items/reorder PUT requests
    @app.route('/api/quick-add-items/reorder', methods=['PUT'])
    def direct_put_quick_add_items_reorder():
        current_app.logger.info(f"[DIRECT_ROUTE_WORKAROUND] PUT /api/quick-add-items/reorder called.")
        data = request.get_json()
        current_app.logger.info(f"[REORDER_PAYLOAD_RECEIVED] Data: {data}")
        if not data:
            return jsonify({"error": "Invalid payload: No data provided."}), 400

        positions_data = data.get('positions')
        page_number = data.get('page_number')

        if not isinstance(positions_data, list) or page_number is None:
            current_app.logger.error(f"[REORDER_VALIDATION_FAIL] positions_data type: {type(positions_data)}, page_number: {page_number}")
            return jsonify({"error": "Invalid payload: 'positions' must be a list and 'page_number' must be provided."}), 400
        
        ordered_ids = []
        for item_pos_data in positions_data:
            if item_pos_data is None or item_pos_data.get('id') is None:
                current_app.logger.error(f"[REORDER_VALIDATION_FAIL] Malformed item in positions_data: {item_pos_data}")
                return jsonify({"error": "Invalid payload: Malformed item in 'positions' list (missing or null ID)."}),400
            ordered_ids.append(item_pos_data.get('id'))
        # The check len(ordered_ids) != len(positions_data) is now implicitly handled by the loop above if an id is None.

        current_app.logger.info(f"[REORDER_PROCESSING] Page: {page_number}, Ordered IDs: {ordered_ids}")
        try:
            reordered_item_models = QuickAddItemService.reorder_quick_add_items(page_number, ordered_ids)
            if reordered_item_models is None:
                current_app.logger.error(f"[REORDER_SERVICE_FAIL] Service returned None for page {page_number}, IDs {ordered_ids}")
                return jsonify({"error": "Failed to reorder items (service error)."}), 500
            return jsonify([item.to_dict() for item in reordered_item_models]), 200
        except ValueError as ve:
            current_app.logger.error(f"[REORDER_SERVICE_VALUE_ERROR] Error: {ve}", exc_info=True)
            return jsonify({"error": f"Validation error during reorder: {str(ve)}"}), 400
        except Exception as e:
            current_app.logger.error(f"Error in direct_put_quick_add_items_reorder: {e}", exc_info=True)
            return jsonify({"error": "An unexpected error occurred reordering items via direct route."}), 500

    from . import models

    # Register blueprints here
    from app.routes.items import bp as items_bp, items_ui_bp
    app.register_blueprint(items_bp, url_prefix='/api/items')
    app.register_blueprint(items_ui_bp)

    from app.routes.customers import bp as customers_bp
    app.register_blueprint(customers_bp, url_prefix='/api/customers')

    from app.routes.sales import bp as sales_bp
    app.register_blueprint(sales_bp, url_prefix='/api/sales')

    from app.routes.payments import bp as payments_bp
    app.register_blueprint(payments_bp, url_prefix='/api/payments')

    from app.routes.quick_add_items import quick_add_items_bp
    app.register_blueprint(quick_add_items_bp, url_prefix='/api/quick_add_items')

    from app.routes.print_routes import print_bp
    app.register_blueprint(print_bp)

    # Register Combination Items blueprint
    from app.routes.combination_items import combination_items_bp
    app.register_blueprint(combination_items_bp, url_prefix='/api/combination-items')

    # Register Category Management blueprint
    from app.routes.categories import bp as categories_bp
    app.register_blueprint(categories_bp, url_prefix='/categories')

    # Register Admin blueprint
    from app.routes.admin import bp as admin_bp
    app.register_blueprint(admin_bp)

    @app.route('/')
    def serve_index():
        return send_from_directory(frontend_dir_path, 'index.html')
    
    # The static_url_path defaults to /static, so Flask will serve files from 
    # static_folder_path (e.g., frontend/static/css/style.css) at /static/css/style.css
    # No need for an explicit @app.route('/static/<path:filename>') if using default static handling.
 
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        try:
            return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=False)
        except FileNotFoundError:
            return "File not found", 404
        
    @app.route('/stock/')
    def stock_management():
        return send_from_directory(frontend_dir_path, 'stock_management.html')

    return app 