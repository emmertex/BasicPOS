from flask import Blueprint, request, jsonify
from app.services.sale_service import SaleService
from app.routes.items import item_to_dict # Corrected import
from app.routes.customers import customer_to_dict # Import for customer details
from app.models.customer import Customer # To fetch customer object
from decimal import Decimal
# Import payment_to_dict - might cause circular if payments imports sale_to_dict directly
# It's better if payment_to_dict is self-contained or defined in a utility module.
# For now, let's assume app.routes.payments.payment_to_dict is accessible or defined here if simple enough.
# To avoid circular dependency, we can define a simple payment_to_dict here for the sale representation,
# or ensure app.routes.payments does not import from app.routes.sales.

# Temporary simple payment_to_dict for sale serialization to avoid circular import issues
# The full payment_to_dict is in app.routes.payments
def _simple_payment_to_dict_for_sale(payment):
    if not payment:
        return None
    return {
        'id': payment.id,
        'payment_type': payment.payment_type,
        'amount': float(payment.amount) if payment.amount is not None else None,
        'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
    }

bp = Blueprint('sales', __name__)

def sale_item_to_dict(sale_item):
    if not sale_item:
        return None
    # Ensure sale_item.item is loaded, might need to adjust lazy loading or query options
    # For now, assuming it gets loaded by accessing it.
    return {
        'id': sale_item.id,
        'sale_id': sale_item.sale_id,
        'item_id': sale_item.item_id,
        'item': item_to_dict(sale_item.item) if sale_item.item else None, 
        'sale_price': float(sale_item.sale_price) if sale_item.sale_price is not None else None,
        'notes': sale_item.notes,
        'quantity': sale_item.quantity
    }

def sale_to_dict(sale):
    if not sale:
        return None
    
    customer_details = None
    if sale.customer_id:
        customer = Customer.query.get(sale.customer_id) # Fetch the customer object
        customer_details = customer_to_dict(customer) # Serialize it

    # Calculate sale totals
    # Use SaleService method to keep logic centralized if complex, or calculate directly
    # For now, direct calculation for simpler _calculate_sale_details call
    from app.services.sale_service import SaleService # Import here to use _calculate_sale_details
    sale_total, amount_paid, amount_due = SaleService._calculate_sale_details(sale.id)

    return {
        'id': sale.id,
        'customer_id': sale.customer_id,
        'customer': customer_details, # Embed customer details
        'status': sale.status,
        'created_at': sale.created_at.isoformat() if sale.created_at else None,
        'updated_at': sale.updated_at.isoformat() if sale.updated_at else None,
        'customer_notes': sale.customer_notes,
        'internal_notes': sale.internal_notes,
        'sale_items': [sale_item_to_dict(si) for si in sale.sale_items],
        'payments': [_simple_payment_to_dict_for_sale(p) for p in sale.payments], 
        'sale_total': float(sale_total) if sale_total is not None else 0.0,
        'amount_paid': float(amount_paid) if amount_paid is not None else 0.0,
        'amount_due': float(amount_due) if amount_due is not None else 0.0,
    }

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
    
    # Basic validation: Ensure at least one modifiable field is present
    if not any(key in data for key in ['quantity', 'sale_price', 'notes']):
        return jsonify({"error": "Invalid input, provide quantity, sale_price, or notes to update."}), 400

    updated_sale_item, error = SaleService.update_sale_item_details(sale_id, sale_item_id, data)

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    
    # Return the entire updated sale, as item changes affect the sale totals and representation
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
    valid_update_fields = ['customer_id', 'customer_notes', 'internal_notes'] # Add more as service supports
    if not any(key in data for key in valid_update_fields):
        return jsonify({"error": f"No valid fields to update. Provide one of: {valid_update_fields}"}), 400

    sale, error = SaleService.update_sale_details(sale_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    return jsonify(sale_to_dict(sale)), 200 