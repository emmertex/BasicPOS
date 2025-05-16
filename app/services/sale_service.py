from app import db
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.item import Item
from app.models.customer import Customer # Import if needed for validation
from sqlalchemy.exc import IntegrityError
from decimal import Decimal

class SaleService:
    @staticmethod
    def create_sale(data):
        try:
            customer_id = data.get('customer_id')
            if customer_id:
                customer = Customer.query.get(customer_id)
                if not customer:
                    return None, "Customer not found."

            new_sale = Sale(
                customer_id=customer_id,
                status=data.get('status', 'Open'), # Default to 'Open', can be 'Quote'
                customer_notes=data.get('customer_notes'),
                internal_notes=data.get('internal_notes')
            )
            db.session.add(new_sale)
            db.session.commit()
            return new_sale, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_sale_by_id(sale_id):
        return Sale.query.get(sale_id)

    @staticmethod
    def get_all_sales(filters=None):
        query = Sale.query

        if filters:
            sale_id_filter = filters.get('sale_id')
            status_filter = filters.get('status')
            customer_query_filter = filters.get('customer_query') # Search by name or phone

            if sale_id_filter:
                try:
                    query = query.filter(Sale.id == int(sale_id_filter))
                except ValueError:
                    # Handle cases where sale_id_filter is not a valid integer, maybe log or ignore
                    pass # Or return empty if ID is malformed and strict checking is needed

            if status_filter:
                query = query.filter(Sale.status == status_filter)

            if customer_query_filter:
                # This requires a join with Customer and filtering on Customer fields
                # Using Sale.customer relationship (assuming it's defined as backref or similar)
                # Search in name or phone
                query = query.join(Sale.customer).filter(
                    db.or_(
                        Customer.name.ilike(f"%{customer_query_filter}%"),
                        Customer.phone.ilike(f"%{customer_query_filter}%")
                    )
                )

        return query.order_by(Sale.created_at.desc()).all()

    @staticmethod
    def get_sales_by_status(status_value):
        # Ensure the status_value is valid if using Enum strictly, though SQLAlchemy handles it
        return Sale.query.filter_by(status=status_value).order_by(Sale.updated_at.desc()).all()

    @staticmethod
    def update_sale_status(sale_id, new_status):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found."

        # Optional: Add logic here to validate status transitions 
        # (e.g., cannot go from 'Paid' back to 'Open' directly without specific rules)
        valid_statuses = [s for s in Sale.__table__.columns['status'].type.enums]
        if new_status not in valid_statuses:
            return None, f"Invalid status: {new_status}. Valid statuses are: {valid_statuses}"

        try:
            sale.status = new_status
            # sale.updated_at will be handled by the model's onupdate setting
            db.session.commit()
            return sale, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def add_item_to_sale(sale_id, item_data):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found."
        
        if sale.status in ['Paid', 'Void']:
            return None, f"Cannot add items to a sale with status '{sale.status}'."

        item_id = item_data.get('item_id')
        quantity = item_data.get('quantity', 1)
        
        item = Item.query.filter_by(id=item_id, is_current_version=True, is_active=True).first()
        if not item:
            return None, "Item not found or not active."

        sale_price_override = item_data.get('sale_price')
        sale_price = Decimal(sale_price_override) if sale_price_override is not None else item.price

        try:
            # Check if item already exists in sale, if so, update quantity (optional behavior)
            existing_sale_item = SaleItem.query.filter_by(sale_id=sale_id, item_id=item_id).first()
            if existing_sale_item:
                # Option 1: Update quantity of existing item
                # existing_sale_item.quantity += int(quantity)
                # existing_sale_item.sale_price = sale_price # Update price if it changed
                # db.session.commit()
                # return existing_sale_item, None
                # Option 2: Return error or handle as new line (current: create new line)
                # For now, we'll allow adding the same item multiple times as distinct SaleItems
                # if you want to merge, the logic above can be uncommented & adjusted.
                pass # Proceed to create a new SaleItem entry

            new_sale_item = SaleItem(
                sale_id=sale_id,
                item_id=item_id,
                quantity=int(quantity),
                sale_price=sale_price,
                notes=item_data.get('notes')
            )
            db.session.add(new_sale_item)
            
            # Optionally, update sale's updated_at timestamp explicitly if not handled by DB trigger for relations
            # sale.updated_at = db.func.now() # Already handled by onupdate=func.now() in Sale model
            db.session.commit()
            SaleService.check_and_update_payment_status(sale_id)
            return new_sale_item, None
        except ValueError:
            db.session.rollback()
            return None, "Invalid quantity or price."
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    
    @staticmethod
    def update_sale_item_details(sale_id, sale_item_id, data):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found."
        
        if sale.status in ['Paid', 'Void']:
            return None, f"Cannot modify items in a sale with status '{sale.status}'."

        sale_item = SaleItem.query.filter_by(id=sale_item_id, sale_id=sale_id).first()
        if not sale_item:
            return None, "Sale item not found in this sale."

        try:
            if 'quantity' in data:
                new_quantity = int(data['quantity'])
                if new_quantity <= 0:
                    # If quantity is zero or less, consider it a removal or handle as error
                    # For now, let's treat 0 as remove, anything less as error.
                    # Or simply update and let POS decide if 0 means remove later.
                    # Current: allow update to 0. Frontend can interpret 0 as to-be-deleted.
                     return None, "Quantity must be positive. To remove, use the remove item endpoint."
                sale_item.quantity = new_quantity
            
            if 'sale_price' in data:
                # Ensure item exists to validate against, or just trust input price
                item = Item.query.get(sale_item.item_id)
                if not item:
                     return None, "Original item not found, cannot update price without context."
                sale_item.sale_price = Decimal(data['sale_price'])

            if 'notes' in data:
                sale_item.notes = data['notes']
            
            # sale.updated_at will be handled by the model's onupdate setting
            db.session.commit()
            SaleService.check_and_update_payment_status(sale_id)
            return sale_item, None
        except ValueError:
            db.session.rollback()
            return None, "Invalid quantity or price format."
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def remove_sale_item_from_sale(sale_id, sale_item_id):
        sale = Sale.query.get(sale_id)
        if not sale:
            return False, "Sale not found."

        if sale.status in ['Paid', 'Void']:
            return False, f"Cannot remove items from a sale with status '{sale.status}'."

        sale_item = SaleItem.query.filter_by(id=sale_item_id, sale_id=sale_id).first()
        if not sale_item:
            return False, "Sale item not found in this sale."
        
        try:
            db.session.delete(sale_item)
            db.session.commit()
            SaleService.check_and_update_payment_status(sale_id)
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def _calculate_sale_details(sale_id):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, None, None # sale_total, amount_paid, amount_due

        sale_total = Decimal('0.00')
        for si in sale.sale_items:
            sale_total += (si.sale_price * si.quantity)
        
        amount_paid = Decimal('0.00')
        for p in sale.payments:
            amount_paid += p.amount
            
        amount_due = sale_total - amount_paid
        return sale_total, amount_paid, amount_due

    @staticmethod
    def check_and_update_payment_status(sale_id):
        """Checks if a sale is fully paid and updates its status to 'Paid' if so.
           If not fully paid and status is 'Paid', it could revert to 'Invoice' or other appropriate status.
        """
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found for status update."

        _ , _ , amount_due = SaleService._calculate_sale_details(sale_id)
        if amount_due is None: # Should not happen if sale exists
            return sale, "Could not calculate sale details."

        original_status = sale.status

        if amount_due <= Decimal('0.00') and sale.status != 'Paid':
            # Fully paid or overpaid
            if sale.status != 'Void': # Don't change status if it's already Void
                sale.status = 'Paid'
        elif amount_due > Decimal('0.00') and sale.status == 'Paid':
            # Was marked Paid, but now is not (e.g., a payment was reversed, or items added after paid)
            # Revert to a sensible previous status, e.g., 'Invoice' or 'Open' depending on workflow
            # For now, let's simplify and revert to 'Invoice' if it was 'Paid'.
            # More complex logic could check previous status history if that was stored.
            sale.status = 'Invoice' # Or based on business rules
        
        if sale.status != original_status:
            try:
                db.session.commit()
                return sale, f"Sale status updated to {sale.status}."
            except Exception as e:
                db.session.rollback()
                return sale, f"Error updating sale status: {str(e)}"
        
        return sale, "Sale payment status remains unchanged."

    @staticmethod
    def update_sale_details(sale_id, data):
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found."

        # Only allow updates to certain fields and on certain statuses
        if sale.status in ['Paid', 'Void']:
            return None, f"Cannot update details for a sale with status '{sale.status}'."

        try:
            if 'customer_id' in data:
                customer_id = data['customer_id']
                if customer_id is not None:
                    customer = Customer.query.get(customer_id)
                    if not customer:
                        return None, "Customer not found for association."
                    sale.customer_id = customer_id
                else:
                    sale.customer_id = None # Allow disassociating customer
            
            if 'customer_notes' in data:
                sale.customer_notes = data['customer_notes']
            if 'internal_notes' in data:
                sale.internal_notes = data['internal_notes']
            
            # Add other updatable fields as needed

            db.session.commit() # updated_at is handled by model
            return sale, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    # More methods will be added: park_sale, record_payment etc. 