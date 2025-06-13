from flask import Blueprint, request, jsonify
from app.services.sale_service import SaleService
from app.utils.serializers import sale_to_dict

bp = Blueprint('sales', __name__)

@bp.route('/', methods=['POST'])
def create_sale_route():
    data = request.get_json()
    # Basic validation, can be expanded
    if not data:
        return jsonify({"error": "Invalid input"}), 400
    
    sale, error = SaleService.create_sale(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(sale_to_dict(sale)), 201

@bp.route('/<int:sale_id>', methods=['GET'])
def get_sale_route(sale_id):
    sale = SaleService.get_sale_by_id(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    return jsonify(sale_to_dict(sale)), 200

@bp.route('/', methods=['GET'])
def get_all_sales_route():
    filters = {}
    sale_id_query = request.args.get('sale_id')
    status_query = request.args.get('status')
    customer_query = request.args.get('customer_query') # For customer name or phone

    if sale_id_query:
        filters['sale_id'] = sale_id_query
    if status_query:
        filters['status'] = status_query
    if customer_query:
        filters['customer_query'] = customer_query

    sales = SaleService.get_all_sales(filters=filters if filters else None)
    return jsonify([sale_to_dict(s) for s in sales]), 200

@bp.route('/status/<string:status_value>', methods=['GET'])
def get_sales_by_status_route(status_value):
    # Basic validation for status string can be added here if desired
    # e.g. if status_value.capitalize() not in ['Open', 'Quote', 'Invoice', 'Paid', 'Void']:
    # return jsonify({"error": "Invalid status value"}), 400
    sales = SaleService.get_sales_by_status(status_value.capitalize()) # Capitalize to match Enum typically
    if sales is None: # Should not happen with current service, which returns [] or raises error
        return jsonify({"error": "Failed to retrieve sales by status"}), 500
    return jsonify([sale_to_dict(s) for s in sales]), 200

@bp.route('/<int:sale_id>/status', methods=['PUT'])
def update_sale_status_route(sale_id):
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({"error": "Invalid input, new 'status' is required"}), 400
    
    new_status = data['status']
    sale, error = SaleService.update_sale_status(sale_id, new_status)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        if "Invalid status" in error:
            status_code = 400 # Bad request for invalid status value
        return jsonify({"error": error}), status_code
    return jsonify(sale_to_dict(sale)), 200

@bp.route('/<int:sale_id>/items', methods=['POST'])
def add_item_to_sale_route(sale_id):
    data = request.get_json()
    if not data or 'item_id' not in data or 'quantity' not in data:
        return jsonify({"error": "Invalid input, item_id and quantity are required"}), 400
    
    sale_item, error = SaleService.add_item_to_sale(sale_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() or "item not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    
    updated_sale = SaleService.get_sale_by_id(sale_id) # Fetch the updated sale object
    return jsonify(sale_to_dict(updated_sale)), 200

@bp.route('/<int:sale_id>/items/<int:sale_item_id>', methods=['PUT'])
def update_sale_item_route(sale_id, sale_item_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input, no data provided for update."}), 400
    
    # Expanded list of potentially updatable fields from frontend
    allowed_keys = ['quantity', 'notes', 'discount_type', 'discount_value']
    if not any(key in data for key in allowed_keys):
        return jsonify({"error": f"Invalid input, provide at least one of the following to update: {', '.join(allowed_keys)}."}), 400

    updated_sale_item, error = SaleService.update_sale_item_details(sale_id, sale_item_id, data)

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    
    updated_sale = SaleService.get_sale_by_id(sale_id) 
    return jsonify(sale_to_dict(updated_sale)), 200

@bp.route('/<int:sale_id>/items/<int:sale_item_id>', methods=['DELETE'])
def remove_sale_item_route(sale_id, sale_item_id):
    success, error = SaleService.remove_sale_item_from_sale(sale_id, sale_item_id)

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    
    if not success: # Should be covered by error, but as a fallback
        return jsonify({"error": "Failed to remove sale item for an unknown reason"}), 500

    # Return the entire updated sale
    updated_sale = SaleService.get_sale_by_id(sale_id)
    if not updated_sale: # Should not happen if sale_id was valid for deletion
         return jsonify({"message": "Sale item removed, but sale not found for updated view"}), 200
    return jsonify(sale_to_dict(updated_sale)), 200

@bp.route('/<int:sale_id>', methods=['PUT'])
def update_sale_details_route(sale_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input, no data provided."}), 400
    
    # Ensure at least one valid field is being updated
    valid_update_fields = ['customer_id', 'customer_notes', 'internal_notes', 'purchase_order_number'] # Add more as service supports
    if not any(key in data for key in valid_update_fields):
        return jsonify({"error": f"Invalid input. Provide at least one of {valid_update_fields} to update."}), 400

    sale, error = SaleService.update_sale_details(sale_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    return jsonify(sale_to_dict(sale)), 200

@bp.route('/<int:sale_id>/overall_discount', methods=['PUT'])
def apply_overall_discount_route(sale_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input, no data provided."}), 400

    discount_type = data.get('discount_type')
    discount_value_str = data.get('discount_value') # Keep as string for service to parse
    rounding_target = data.get('rounding_target') # Optional: e.g., 'round_down_dollar', 'round_down_ten_dollar'

    if discount_type is None or discount_value_str is None:
        # 'none' type might not require a value, but service handles 'none' type value if null.
        # For other types, value is essential.
        if discount_type != 'none':
             return jsonify({"error": "Missing discount_type or discount_value."}), 400

    sale, error = SaleService.apply_overall_sale_discount(
        sale_id,
        discount_type,
        discount_value_str,
        rounding_target
    )

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    
    return jsonify(sale_to_dict(sale)), 200

# Payment related routes
@bp.route('/<int:sale_id>/payments', methods=['POST'])
def add_payment_to_sale_route(sale_id):
    data = request.get_json()
    if not data or 'amount' not in data or 'payment_type' not in data:
        return jsonify({"error": "Invalid input, amount and payment_type are required"}), 400
    
    payment, error = SaleService.add_payment_to_sale(sale_id, data)
    return jsonify(sale_to_dict(sale)), 200 

@bp.route('/<int:sale_id>/eftpos_fee', methods=['PUT'])
def toggle_eftpos_fee_route(sale_id):
    data = request.get_json()
    if not data or 'enabled' not in data:
        return jsonify({"error": "Missing 'enabled' flag in request."}), 400

    is_enabled = data.get('enabled')

    sale, error = SaleService.toggle_eftpos_fee(sale_id, is_enabled)

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    
    return jsonify(sale_to_dict(sale)), 200 