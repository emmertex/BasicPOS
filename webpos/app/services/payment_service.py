from app import db
from app.models import Sale, Payment
from app.services.sale_service import SaleService
from app.services.tyro_service import TyroService
from sqlalchemy.exc import IntegrityError
import uuid
import json
from flask import current_app

class PaymentService:
    ALLOWED_PAYMENT_TYPES = ['Cash', 'Cheque', 'EFTPOS', 'Tyro EFTPOS']

    @staticmethod
    def record_payment(sale_id, payment_data):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found"

        payment_type = payment_data.get('payment_type')
        amount = payment_data.get('amount')
        payment_details_from_request = payment_data.get('payment_details', {})

        if not all([payment_type, amount]):
            return None, "Missing required fields: payment_type and amount"
        
        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError("Amount must be positive.")
        except (ValueError, TypeError):
            return None, "Invalid amount"

        if payment_type == 'Tyro EFTPOS':
            # Tyro payment logic is now handled by the backend
            mid = payment_details_from_request.get('mid')
            tid = payment_details_from_request.get('tid')
            if not mid or not tid:
                return None, "MID and TID are required for Tyro payments."

            tyro_service = TyroService()
            
            # Generate a unique ID for the POS-initiated sale reference for Tyro
            transaction_id = str(uuid.uuid4())
            amount_cents = int(round(amount * 100))

            tyro_result, tyro_error = tyro_service.process_payment(
                mid=mid,
                tid=tid,
                transaction_id=transaction_id,
                amount_cents=amount_cents
            )

            if tyro_error:
                return None, f"Tyro payment failed: {tyro_error}"
            
            # If successful, use the response from Tyro as the payment details
            payment_details = tyro_result

        else:
            # For other payment types, just use the details from the request
            payment_details = payment_details_from_request

        current_app.logger.info(f"--- TYRO PAYMENT DEBUG ---")
        current_app.logger.info(f"Data type of 'payment_details' before serialization: {type(payment_details)}")
        current_app.logger.info(f"Content of 'payment_details': {payment_details}")

        serialized_details = json.dumps(payment_details)
        
        current_app.logger.info(f"Data type of 'payment_details' after serialization: {type(serialized_details)}")
        current_app.logger.info(f"Content of serialized details: {serialized_details}")


        new_payment = Payment(
            sale_id=sale_id,
            payment_type=payment_type,
            amount=amount,
            payment_details=serialized_details
        )

        try:
            db.session.add(new_payment)
            
            # Recalculate and update sale totals and status
            updated_sale, error = SaleService.update_sale_after_payment(sale_id)
            if error:
                db.session.rollback()
                return None, error

            db.session.commit()
            return updated_sale, None
            
        except IntegrityError:
            db.session.rollback()
            return None, "Database integrity error."
        except Exception as e:
            db.session.rollback()
            return None, f"An unexpected error occurred: {str(e)}"

    @staticmethod
    def get_payments_for_sale(sale_id):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found"
        return sale.payments, None 