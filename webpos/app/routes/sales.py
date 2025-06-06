from flask import Blueprint, request, jsonify, current_app
from app.services.sale_service import SaleService
from app.routes.items import item_to_dict # Corrected import
from app.routes.customers import customer_to_dict # Import for customer details
from app.models.customer import Customer # To fetch customer object
from decimal import Decimal, ROUND_HALF_UP
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
        'amount': float(payment.amount) if payment.amount is not None else 0.0,
        'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
    }

bp = Blueprint('sales', __name__)


def sale_item_to_dict(sale_item):
    if not sale_item:
        return None
    # Ensure sale_item.item is loaded, might need to adjust lazy loading or query options
    # For now, assuming it gets loaded by accessing it.

    # Safely get price_at_sale, defaulting to None if attribute is missing or value is None
    price_at_sale_value = getattr(sale_item, 'price_at_sale', None)
    discount_type_value = getattr(sale_item, 'discount_type', None)
    discount_value_value = getattr(sale_item, 'discount_value', None)

    return {
        'id': sale_item.id,
        'sale_id': sale_item.sale_id,
        'item_id': sale_item.item_id,
        'item': item_to_dict(sale_item.item) if sale_item.item else None, 
        'quantity': sale_item.quantity,
        'price_at_sale': float(price_at_sale_value) if price_at_sale_value is not None else None,
        'discount_type': discount_type_value,
        'discount_value': float(discount_value_value) if discount_value_value is not None else None,
        'sale_price': float(sale_item.sale_price) if sale_item.sale_price is not None else None,
        'notes': sale_item.notes,
        'line_total': float(sale_item.line_total) if hasattr(sale_item, 'line_total') and sale_item.line_total is not None else (sale_item.quantity * sale_item.sale_price)
    }


def sale_to_dict(sale):
    if not sale:
        return None
    
    customer_details = None
    if sale.customer_id:
        customer = Customer.query.get(sale.customer_id) # Fetch the customer object
        customer_details = customer_to_dict(customer) # Serialize it

    # Calculate new detailed breakdown of totals
    subtotal_gross_original_calc = sum(
        (si.price_at_sale * si.quantity) for si in sale.sale_items if si.price_at_sale is not None and si.quantity is not None
    )
    subtotal_gross_original_calc = Decimal(subtotal_gross_original_calc).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    total_line_item_discounts_calc = sum(
        ((si.price_at_sale - si.sale_price) * si.quantity) 
        for si in sale.sale_items 
        if si.price_at_sale is not None and si.sale_price is not None and si.quantity is not None
    )
    total_line_item_discounts_calc = Decimal(total_line_item_discounts_calc).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    overall_discount_amount_applied_calc = Decimal(sale.overall_discount_amount_applied or '0.00').quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    net_subtotal_before_tax_calc = subtotal_gross_original_calc - total_line_item_discounts_calc - overall_discount_amount_applied_calc
    net_subtotal_before_tax_calc = net_subtotal_before_tax_calc.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    gst_rate_percentage = Decimal(current_app.config.get('GST_RATE_PERCENTAGE', '10'))
    gst_amount_calc = Decimal('0.00')
    if net_subtotal_before_tax_calc > 0 and gst_rate_percentage > 0:
        # Since prices are GST inclusive, we need to calculate GST portion by dividing by (1 + GST rate)
        gst_divisor = Decimal('1') + (gst_rate_percentage / Decimal('100'))
        gst_amount_calc = (net_subtotal_before_tax_calc - (net_subtotal_before_tax_calc / gst_divisor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    final_grand_total_calc = net_subtotal_before_tax_calc
    
    amount_paid_calc = sum(p.amount for p in sale.payments if p.amount is not None)
    amount_paid_calc = Decimal(amount_paid_calc).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    amount_due_calc = final_grand_total_calc - amount_paid_calc

    return {
        'id': sale.id,
        'customer_id': sale.customer_id,
        'customer': customer_details,
        'status': sale.status,
        'created_at': sale.created_at.isoformat() if sale.created_at else None,
        'updated_at': sale.updated_at.isoformat() if sale.updated_at else None,
        'customer_notes': sale.customer_notes,
        'internal_notes': sale.internal_notes,
        'purchase_order_number': sale.purchase_order_number,
        
        'overall_discount_type': sale.overall_discount_type,
        'overall_discount_value': float(sale.overall_discount_value) if sale.overall_discount_value is not None else 0.0,
        # 'overall_discount_amount_applied' is one of the main fields below

        'sale_items': [sale_item_to_dict(si) for si in sale.sale_items],
        'payments': [_simple_payment_to_dict_for_sale(p) for p in sale.payments], 
        
        # New detailed financial breakdown
        'subtotal_gross_original': float(subtotal_gross_original_calc),
        'total_line_item_discounts': float(total_line_item_discounts_calc),
        'overall_discount_amount_applied': float(overall_discount_amount_applied_calc), # Renamed from previous overall_discount_amount_applied
        'net_subtotal_before_tax': float(net_subtotal_before_tax_calc),
        'gst_amount': float(gst_amount_calc), # Renamed from total_tax
        'final_grand_total': float(final_grand_total_calc), # Renamed from sale_total
        
        'amount_paid': float(amount_paid_calc),
        'amount_due': float(amount_due_calc),
        'gst_rate_percentage': float(gst_rate_percentage)
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