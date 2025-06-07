from flask import Blueprint, request, jsonify
from app.services.payment_service import PaymentService
from app.services.sale_service import SaleService # To get updated sale
from app.routes.sales import sale_to_dict # To serialize the updated sale

bp = Blueprint('payments', __name__)

def payment_to_dict(payment):
    if not payment:
        return None
    return {
        'id': payment.id,
        'sale_id': payment.sale_id,
        'payment_type': payment.payment_type,
        'amount': float(payment.amount) if payment.amount is not None else None,
        'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
    }

@bp.route('/', methods=['POST'])
def record_payment_route():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Invalid input"}), 400

    sale_id = data.get('sale_id')
    if not sale_id:
        return jsonify({"success": False, "message": "Sale ID is missing"}), 400
    
    payment, error = PaymentService.record_payment(sale_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        if "Invalid payment_type" in error or "Invalid amount" in error or "Missing required fields" in error:
            status_code = 400
        return jsonify({"success": False, "message": error}), status_code
    
    return jsonify({"success": True, "message": "Payment recorded successfully", "payment": payment_to_dict(payment)}), 201

@bp.route('/sale/<int:sale_id>', methods=['GET'])
def get_payments_for_sale_route(sale_id):
    payments, error = PaymentService.get_payments_for_sale(sale_id)
    if error: # e.g., Sale not found
        return jsonify({"success": False, "message": error}), 404
    if payments is None: # Should be caught by error, but as a safeguard
        return jsonify({"success": False, "message": "Could not retrieve payments"}), 500
        
    return jsonify([payment_to_dict(p) for p in payments]), 200 