from flask import Blueprint, request, jsonify, current_app
from app.services.quick_add_item_service import QuickAddItemService # Uncommented
from app import db # Uncommented

quick_add_items_bp = Blueprint('quick_add_items_bp', __name__)

@quick_add_items_bp.route('/', methods=['GET'])
def get_quick_add_items_for_page():
    current_app.logger.info(f"[ROUTE_HIT] /api/quick_add_items called with args: {request.args}") # Restored original log message slightly
    page_number = request.args.get('page', default=1, type=int)
    if page_number < 1:
        return jsonify({"error": "Page number must be positive"}), 400
    
    # Restore the service call and original logic
    items_list_of_dicts = QuickAddItemService.get_quick_add_items_by_page(page_number)
    
    if items_list_of_dicts is None: 
        current_app.logger.error(f"QuickAddItemService.get_quick_add_items_by_page returned None for page {page_number} - this should not happen.")
        return jsonify({"error": "Failed to retrieve quick add items due to an unexpected service error"}), 500
    
    return jsonify(items_list_of_dicts), 200

@quick_add_items_bp.route('/', methods=['POST'])
def create_quick_add_item_route():
    # Restore original POST route logic
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    try:
        new_item = QuickAddItemService.create_quick_add_item(data)
        return jsonify(new_item), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"Error in create_quick_add_item_route: {e}", exc_info=True) # Added exc_info
        return jsonify({"error": "An unexpected error occurred creating the quick add item."}), 500

@quick_add_items_bp.route('/<int:qai_id>', methods=['PUT'])
def update_quick_add_item_route(qai_id):
    # Restore original PUT route logic
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided for update"}), 400
    try:
        updated_item = QuickAddItemService.update_quick_add_item(qai_id, data)
        return jsonify(updated_item), 200
    except ValueError as ve: 
        return jsonify({"error": str(ve)}), 404 if "not found" in str(ve).lower() else 400
    except Exception as e:
        current_app.logger.error(f"Error in update_quick_add_item_route for ID {qai_id}: {e}", exc_info=True) # Added exc_info
        return jsonify({"error": "An unexpected error occurred updating the quick add item."}), 500

@quick_add_items_bp.route('/<int:qai_id>', methods=['DELETE'])
def delete_quick_add_item_route(qai_id):
    # Restore original DELETE route logic
    try:
        result = QuickAddItemService.delete_quick_add_item(qai_id)
        return jsonify(result), 200 
    except ValueError as ve: 
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        current_app.logger.error(f"Error in delete_quick_add_item_route for ID {qai_id}: {e}", exc_info=True) # Added exc_info
        return jsonify({"error": "An unexpected error occurred deleting the quick add item."}), 500

@quick_add_items_bp.route('/reorder', methods=['PUT'])
def reorder_quick_add_items_route():
    # Restore original reorder route logic
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid payload: No data provided."}), 400

    ordered_ids = data.get('ordered_ids')
    page_number = data.get('page_number')

    if not isinstance(ordered_ids, list):
        return jsonify({"error": "Invalid payload: 'ordered_ids' must be a list."}), 400
    if not isinstance(page_number, int) or page_number <= 0:
        return jsonify({"error": "Invalid payload: 'page_number' must be a positive integer."}), 400
    
    try:
        reordered_item_models = QuickAddItemService.reorder_quick_add_items(page_number, ordered_ids)
        if reordered_item_models is None:
            return jsonify({"error": "Failed to reorder items due to a server-side issue or invalid input for service."}), 500
        return jsonify([item.to_dict() for item in reordered_item_models]), 200 # Service returns models here, so to_dict is needed
    except ValueError as ve: 
        return jsonify({"error": f"Validation error during reorder: {str(ve)}"}), 400
    except Exception as e:
        current_app.logger.error(f"Error in reorder_quick_add_items_route: {e}", exc_info=True) # Added exc_info
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