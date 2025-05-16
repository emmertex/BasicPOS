from flask import Blueprint, request, jsonify
from app.services.quick_add_item_service import QuickAddItemService
from app import db # Corrected: import db from the app package

quick_add_items_bp = Blueprint('quick_add_items_bp', __name__)

@quick_add_items_bp.route('/', methods=['GET'])
def get_quick_add_items_for_page():
    page_number = request.args.get('page', default=1, type=int)
    if page_number < 1:
        return jsonify({"error": "Page number must be positive"}), 400
    
    items = QuickAddItemService.get_quick_add_items_by_page(page_number)
    if items is None: # Should not happen if service returns [] on error, but good practice
        return jsonify({"error": "Failed to retrieve quick add items"}), 500
    return jsonify(items), 200

@quick_add_items_bp.route('/', methods=['POST'])
def create_quick_add_item_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400

    try:
        new_item = QuickAddItemService.create_quick_add_item(data)
        return jsonify(new_item), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # Log the exception e.g. current_app.logger.error(f"Error creating quick add item: {e}")
        return jsonify({"error": "An unexpected error occurred creating the quick add item."}), 500

@quick_add_items_bp.route('/<int:qai_id>', methods=['PUT'])
def update_quick_add_item_route(qai_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided for update"}), 400
    try:
        updated_item = QuickAddItemService.update_quick_add_item(qai_id, data)
        return jsonify(updated_item), 200
    except ValueError as ve: # Typically for "not found" or validation errors from service
        return jsonify({"error": str(ve)}), 404 if "not found" in str(ve).lower() else 400
    except Exception as e:
        # Log error
        return jsonify({"error": "An unexpected error occurred updating the quick add item."}), 500

@quick_add_items_bp.route('/<int:qai_id>', methods=['DELETE'])
def delete_quick_add_item_route(qai_id):
    try:
        result = QuickAddItemService.delete_quick_add_item(qai_id)
        return jsonify(result), 200 # Or 204 if no content in response
    except ValueError as ve: # Typically for "not found"
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        # Log error
        return jsonify({"error": "An unexpected error occurred deleting the quick add item."}), 500

@quick_add_items_bp.route('/page/<int:page_number>/reorder', methods=['POST'])
def reorder_quick_add_items_route(page_number):
    data = request.get_json()
    if not data or 'ordered_ids' not in data or not isinstance(data['ordered_ids'], list):
        return jsonify({"error": "Invalid payload: 'ordered_ids' list is required."}), 400
    
    ordered_ids = data['ordered_ids']
    try:
        result = QuickAddItemService.reorder_quick_add_items(page_number, ordered_ids)
        return jsonify(result), 200
    except ValueError as ve: # For specific validation errors from service
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # Log error
        return jsonify({"error": "An unexpected error occurred reordering the quick add items."}), 500

# Future: Add PUT and DELETE endpoints for managing quick_add_items if needed
# @quick_add_items_bp.route('/<int:item_id>', methods=['PUT'])
# def update_quick_add_item_route(item_id):
#     # ... implementation ...
#     pass

# @quick_add_items_bp.route('/<int:item_id>', methods=['DELETE'])
# def delete_quick_add_item_route(item_id):
#     # ... implementation ...
#     pass 