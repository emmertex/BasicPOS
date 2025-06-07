from app import db
from app.models.payment import Payment
from app.models.sale import Sale
from decimal import Decimal
from app.services.sale_service import SaleService
from app.services.tyro_service import TyroService
import json

class PaymentService:
    ALLOWED_PAYMENT_TYPES = ['Cash', 'Cheque', 'EFTPOS', 'Tyro EFTPOS']

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

        # Handle Tyro EFTPOS payments
        if payment_type == 'Tyro EFTPOS':
            tyro_service = TyroService()
            merchant_id = data.get('merchant_id')
            terminal_id = data.get('terminal_id')
            integration_key = data.get('integration_key')

            if not all([merchant_id, terminal_id, integration_key]):
                return None, "Missing required Tyro EFTPOS fields: merchant_id, terminal_id, and integration_key"

            # Process payment through Tyro
            result, error = tyro_service.process_payment(
                float(amount),
                merchant_id,
                terminal_id,
                integration_key
            )

            if error:
                return None, f"Tyro payment failed: {error}"

            # If payment was successful, record it in our database
            try:
                new_payment = Payment(
                    sale_id=sale_id,
                    payment_type=payment_type,
                    amount=amount,
                    payment_details=json.dumps(result)  # Store Tyro response details
                )
                db.session.add(new_payment)
                db.session.commit()
                
                # Check if sale is fully paid and update status
                updated_sale, status_message = SaleService.check_and_update_payment_status(sale_id)
                
                return new_payment, None
            except Exception as e:
                db.session.rollback()
                return None, str(e)

        # Handle other payment types
        try:
            new_payment = Payment(
                sale_id=sale_id,
                payment_type=payment_type,
                amount=amount
            )
            db.session.add(new_payment)
            db.session.commit()
            
            # Check if sale is fully paid and update sale.status to 'Paid'
            updated_sale, status_message = SaleService.check_and_update_payment_status(sale_id)

            return new_payment, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_payments_for_sale(sale_id):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found."
        return sale.payments, None 