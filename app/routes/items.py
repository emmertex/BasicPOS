from flask import Blueprint, request, jsonify, current_app
from app.services.item_service import ItemService
from app.services.image_service import ImageService # Import ImageService
from app.models.item import Item # Import Item to assist with serialization if needed
from app.models.photo import Photo # Import Photo model for validation
import os # Added for path manipulation

bp = Blueprint('items', __name__)

def item_to_dict(item):
    if not item:
        return None
    
    item_details = {
        'id': item.id,
        'parent_id': item.parent_id,
        'is_current_version': item.is_current_version,
        'sku': item.sku,
        'stock_quantity': item.stock_quantity,
        'is_stock_tracked': item.is_stock_tracked,
        'title': item.title,
        'description': item.description,
        'price': float(item.price) if item.price is not None else None, # Ensure Decimal is serialized to float
        'show_on_website': item.show_on_website,
        'is_active': item.is_active,
        'photos': [] # Initialize photos list
    }

    # If item is marked as a parent (parent_id == -2), check if it actually has active, current variants.
    # If not, present it as a standalone item (parent_id = -1) to the frontend for display logic.
    if item_details['parent_id'] == -2:
        if not ItemService.has_active_current_variants(item_details['id']):
            item_details['parent_id'] = -1 # Override for frontend display

    if hasattr(item, 'photos') and item.photos: # Check if photos relationship is loaded and not empty
        for photo in item.photos:
            if photo.image_url:
                base_filename = photo.image_url
                name, ext = os.path.splitext(base_filename)
                
                small_url = f"/uploads/{name}_small{ext}"
                large_url = f"/uploads/{name}_large{ext}"
                # In case original is also stored/needed, or for direct base_filename access
                # original_sized_url = f"/static/uploads/{base_filename}" 

                photo_dict = {
                    'id': photo.id,
                    'image_url_base': base_filename, # Storing the raw DB value
                    'small_url': small_url,
                    'large_url': large_url,
                    'is_primary': photo.is_primary
                }
                item_details['photos'].append(photo_dict)
            
    return item_details

@bp.route('/', methods=['POST'])
def create_item_route():
    # Data from form fields
    form_data = request.form.to_dict() 
    if not form_data:
        return jsonify({"error": "Invalid input, form data missing"}), 400

    # Extract and type-cast item data
    item_data = {}
    try:
        item_data['title'] = form_data.get('title')
        item_data['price'] = float(form_data.get('price')) if form_data.get('price') is not None else None
        
        if not item_data['title'] or item_data['price'] is None:
             return jsonify({"error": "Title and Price are required fields."}), 400

        # Optional fields
        item_data['sku'] = form_data.get('sku', '').strip()
        item_data['parent_id'] = int(form_data.get('parent_id')) if form_data.get('parent_id') else -1 # Default to standalone
        
        raw_stock_quantity = form_data.get('stock_quantity')
        item_data['stock_quantity'] = int(raw_stock_quantity) if raw_stock_quantity is not None and raw_stock_quantity.strip() != '' else 0
        
        # Boolean fields (handle 'true'/'false' strings, or '1'/'0')
        def to_bool(value):
            if isinstance(value, str):
                return value.lower() in ['true', '1', 'yes']
            return bool(value)

        item_data['is_stock_tracked'] = to_bool(form_data.get('is_stock_tracked', True))
        item_data['description'] = form_data.get('description')
        item_data['show_on_website'] = to_bool(form_data.get('show_on_website', False))
        item_data['is_active'] = to_bool(form_data.get('is_active', True))

    except ValueError as e:
        return jsonify({"error": f"Invalid data format for a field: {e}"}), 400
    except KeyError as e:
        return jsonify({"error": f"Missing expected form field: {e}"}), 400


    # Image files from request.files
    # 'images' is the expected field name for multiple files
    image_files = request.files.getlist("images") 
    
    item, error = ItemService.create_item(item_data, image_files=image_files)
    if error:
        # Consider specific error codes, e.g. 409 for SKU conflict
        status_code = 400
        if "SKU" in error and "in use" in error:
            status_code = 409
        return jsonify({"error": error}), status_code
    return jsonify(item_to_dict(item)), 201

@bp.route('/<int:item_id>', methods=['GET'])
def get_item_route(item_id):
    item = ItemService.get_item_by_id(item_id)
    if not item:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(item_to_dict(item)), 200

@bp.route('/', methods=['GET'])
def get_all_items_route():
    filters = {}
    q_param = request.args.get('q')
    sku_query = request.args.get('sku') # Keep direct SKU query if needed for other use cases
    is_current_version = request.args.get('is_current_version', default=True, type=lambda v: v.lower() == 'true') # Handle string 'true'/'false'
    limit = request.args.get('limit', type=int)

    if q_param:
        filters['title_query'] = q_param  # Use 'q' for general title/SKU search in service
    if sku_query:
        filters['sku'] = sku_query # Allow specific SKU search to override/coexist if backend logic supports it
    
    # The ItemService.get_items_for_display already filters by is_current_version=True and is_active=True by default
    # So, explicitly passing is_current_version from request args to filters might be redundant unless service changes.
    # For now, we'll rely on service default. If specific control is needed, add to filters:
    # filters['is_current_version'] = is_current_version 

    items = ItemService.get_items_for_display(filters=filters if filters else None, limit=limit)
    return jsonify([item_to_dict(item) for item in items]), 200

@bp.route('/<int:parent_item_id>/variants', methods=['GET'])
def get_item_variants_route(parent_item_id):
    current_app.logger.info(f"[get_item_variants_route] Received request for variants for parent_item_id: {parent_item_id}")
    # Use find_parent_definition_by_id to be less strict on is_current_version for the parent placeholder
    parent_item = ItemService.find_parent_definition_by_id(parent_item_id)
    if not parent_item:
        current_app.logger.warning(f"[get_item_variants_route] Parent item definition not found for ID: {parent_item_id} by ItemService.find_parent_definition_by_id")
        # This means no active item exists with this ID and parent_id = -2
        return jsonify({"error": "Parent item definition not found or not marked as a parent (-2)"}), 404
    # The check `parent_item.parent_id != -2` is now redundant due to the new service method query

    current_app.logger.info(f"[get_item_variants_route] Parent item found: {parent_item.title}. Fetching variants.")
    variants = ItemService.get_variants_for_parent(parent_item_id)
    # get_variants_for_parent already filters for active, current variants.
    # If variants list is empty, it's handled by frontend. This is fine.
    current_app.logger.info(f"[get_item_variants_route] Found {len(variants) if variants else 0} variants for parent ID: {parent_item_id}")
    return jsonify([item_to_dict(variant) for variant in variants]), 200

@bp.route('/<int:item_id>', methods=['PUT'])
def update_item_route(item_id):
    form_data = request.form.to_dict()
    # No explicit check for empty form_data, as an update might only involve images,
    # or the service layer handles empty data appropriately (e.g., no changes).

    item_data = {}
    try:
        # Helper for boolean conversion
        def to_bool(value):
            if isinstance(value, str):
                return value.lower() in ['true', '1', 'yes']
            return bool(value)

        # Populate item_data only with fields present in the form
        if 'title' in form_data:
            item_data['title'] = form_data['title']
        if form_data.get('price') is not None:
            item_data['price'] = float(form_data['price'])
        if form_data.get('sku') is not None: # SKU can be empty string if user wants to trigger auto-generation for a new version perhaps, or just cleared
            item_data['sku'] = form_data['sku'].strip()
        if form_data.get('parent_id') is not None:
            item_data['parent_id'] = int(form_data['parent_id'])
        
        if form_data.get('stock_quantity') is not None:
            sq = form_data['stock_quantity']
            item_data['stock_quantity'] = int(sq) if sq.strip() != '' else 0

        if 'is_stock_tracked' in form_data:
            item_data['is_stock_tracked'] = to_bool(form_data['is_stock_tracked'])
        if 'description' in form_data:
            item_data['description'] = form_data['description']
        if 'show_on_website' in form_data:
            item_data['show_on_website'] = to_bool(form_data['show_on_website'])
        if 'is_active' in form_data:
            item_data['is_active'] = to_bool(form_data['is_active'])
            
    except ValueError as e:
        return jsonify({"error": f"Invalid data format for a field: {e}"}), 400

    image_files = request.files.getlist("images")

    # If no item data fields are provided and no images, it's arguably a bad request,
    # but ItemService.update_item might handle it gracefully (e.g. "No versionable changes detected")
    if not item_data and not image_files:
        # You could return a 400 here, or let the service decide.
        # For now, let service handle it, it might return "No versionable changes detected."
        pass 

    item, error = ItemService.update_item(item_id, item_data, image_files=image_files)
    
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        if "SKU" in error and "in use" in error:
            status_code = 409
        return jsonify({"error": error}), status_code
    
    if item is None and not error: # Should ideally not happen if service layer is robust
        return jsonify({"error": "Update failed for an unknown reason or no changes made and no item returned."}), 500
        
    return jsonify(item_to_dict(item)), 200

@bp.route('/<int:item_id>', methods=['DELETE'])
def delete_item_route(item_id):
    success, error = ItemService.delete_item(item_id)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    if not success: # Should be caught by error generally
        return jsonify({"error": "Failed to delete item"}), 500
    return jsonify({"message": "Item marked as inactive"}), 200

@bp.route('/<int:item_id>/photos/<int:photo_id>', methods=['DELETE'])
def delete_item_photo_route(item_id, photo_id):
    # Optional: Validate that the photo belongs to the item_id
    photo_to_check = Photo.query.filter_by(id=photo_id, item_id=item_id).first()
    if not photo_to_check:
        # Return 404 if photo doesn't exist or doesn't belong to the item
        return jsonify({"error": "Photo not found for this item or photo ID is invalid."}), 404

    success, error = ImageService.delete_photo(photo_id)
    if not success:
        status_code = 404 if "not found" in error.lower() else 500 # 500 for other deletion errors
        return jsonify({"error": error}), status_code
    
    return jsonify({"message": "Photo deleted successfully"}), 200 