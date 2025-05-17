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

@quick_add_items_bp.route('/reorder', methods=['PUT'])
def reorder_quick_add_items_route():
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
        # The service expects a list of strings for ordered_ids, as sent by the frontend
        # The frontend already maps them to int for the payload, but let's ensure they are strings for the service as per its signature
        # ordered_ids_str = [str(id_val) for id_val in ordered_ids] # Ensure service gets strings if it expects them
        # Correction: The service method `reorder_quick_add_items` takes `ordered_ids_str` as its param name, 
        # but the frontend now sends integer IDs in the payload. The service converts them. So direct pass is fine.

        reordered_item_models = QuickAddItemService.reorder_quick_add_items(page_number, ordered_ids)
        
        if reordered_item_models is None:
            # This indicates an issue within the service (e.g., DB error, fundamental validation)
            return jsonify({"error": "Failed to reorder items due to a server-side issue or invalid input for service."}), 500
        
        return jsonify([item.to_dict() for item in reordered_item_models]), 200
    except ValueError as ve: # Catch specific errors if service raises them
        return jsonify({"error": f"Validation error during reorder: {str(ve)}"}), 400
    except Exception as e:
        # Log the exception e (e.g., import logging; logging.exception("Reorder error"))
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