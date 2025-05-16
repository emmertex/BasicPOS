from flask import Blueprint, request, jsonify
from app.services.customer_service import CustomerService

bp = Blueprint('customers', __name__)

def customer_to_dict(customer):
    if not customer:
        return None
    return {
        'id': customer.id,
        'phone': customer.phone,
        'email': customer.email,
        'name': customer.name,
        'address': customer.address,
        'company_name': customer.company_name
    }

@bp.route('/', methods=['POST'])
def create_customer_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input"}), 400
    
    customer, error = CustomerService.create_customer(data)
    if error:
        # More specific error codes could be returned based on error type (e.g., 409 for duplicate)
        return jsonify({"error": error}), 400 
    return jsonify(customer_to_dict(customer)), 201

@bp.route('/<int:customer_id>', methods=['GET'])
def get_customer_by_id_route(customer_id):
    customer = CustomerService.get_customer_by_id(customer_id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer_to_dict(customer)), 200

@bp.route('/phone/<string:phone_number>', methods=['GET'])
def get_customer_by_phone_route(phone_number):
    customer = CustomerService.get_customer_by_phone(phone_number)
    if not customer:
        return jsonify({"error": "Customer not found with that phone number"}), 404
    return jsonify(customer_to_dict(customer)), 200

@bp.route('/', methods=['GET'])
def get_all_customers_route():
    customers = CustomerService.get_all_customers()
    return jsonify([customer_to_dict(cust) for cust in customers]), 200

@bp.route('/<int:customer_id>', methods=['PUT'])
def update_customer_route(customer_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid input"}), 400

    customer, error = CustomerService.update_customer(customer_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    return jsonify(customer_to_dict(customer)), 200

@bp.route('/<int:customer_id>', methods=['DELETE'])
def delete_customer_route(customer_id):
    success, error = CustomerService.delete_customer(customer_id)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status_code
    # If success is False but no error, it implies an issue not caught by specific error handling.
    # However, delete_customer service method is designed to return an error string in case of failure.
    return jsonify({"message": "Customer deleted successfully"}), 200 