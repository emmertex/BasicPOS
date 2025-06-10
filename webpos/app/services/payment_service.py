from app import db
from app.models.payment import Payment
from app.models.sale import Sale
from decimal import Decimal
from flask import current_app
from app.services.sale_service import SaleService
from app.services.xero_service import XeroService
from app.utils.serializers import payment_to_dict

class PaymentService:
    ALLOWED_PAYMENT_TYPES = ['Cash', 'Cheque', 'EFTPOS']

    @staticmethod
    def record_payment(sale_id, data):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found."

        payment_type = data.get('payment_type')
        amount_str = data.get('amount')

        if not payment_type or not amount_str:
            return None, "Missing required fields: payment_type and amount."

        if payment_type not in PaymentService.ALLOWED_PAYMENT_TYPES:
            return None, f"Invalid payment_type. Allowed types are: {PaymentService.ALLOWED_PAYMENT_TYPES}"
        
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                return None, "Payment amount must be positive."
        except ValueError:
            return None, "Invalid amount format."

        # Optional: Check if sale status allows payment (e.g., 'Invoice', 'Open')
        # For now, we allow payment on any sale, POS logic might restrict this.
        # if sale.status not in ['Open', 'Quote', 'Invoice']:
        #     return None, f"Cannot record payment for a sale with status '{sale.status}'." 

        try:
            new_payment = Payment(
                sale_id=sale_id,
                payment_type=payment_type,
                amount=amount
                # payment_date is default NOW in model
            )
            db.session.add(new_payment)
            db.session.commit()
            
            # Try to send to Xero, but continue even if it fails
            try:
                xero_service = XeroService()
                payment_dict = payment_to_dict(new_payment)
                xero_payment, error = xero_service.create_payment(sale_id, payment_dict)
                if error:
                    # Using current_app logger is better in service modules
                    # Make sure to have `from flask import current_app` at the top of your service file
                    # Use Flask's logger instead of print
                    current_app.logger.error(f"Failed to create Xero payment: {error}")
            except Exception as xero_error:
                # Log the error but continue with local processing
                current_app.logger.error(f"Error sending payment to Xero: {xero_error}")

            # Check if sale is fully paid and update sale.status to 'Paid'
            updated_sale, status_message = SaleService.check_and_update_payment_status(sale_id)
            # status_message can be logged or returned if needed
            # For now, the primary return is the new_payment object.
            # The route handler will fetch the updated sale anyway.

            return new_payment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_payments_for_sale(sale_id):
        sale = Sale.query.get(sale_id)
        if not sale:
            # Depending on desired behavior, could return empty list or error
            return None, "Sale not found."
        return sale.payments, None # payments relationship from Sale model 