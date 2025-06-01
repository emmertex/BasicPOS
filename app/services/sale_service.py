from app import db
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.item import Item
from app.models.customer import Customer # Import if needed for validation
from sqlalchemy.exc import IntegrityError
from decimal import Decimal
from flask import current_app # Added for config access

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
                internal_notes=data.get('internal_notes'),
                purchase_order_number=data.get('purchase_order_number') # Added PO Number
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

        valid_statuses = [s for s in Sale.__table__.columns['status'].type.enums]
        if new_status not in valid_statuses:
            return None, f"Invalid status: {new_status}. Valid statuses are: {valid_statuses}"

        original_status = sale.status
        sale.status = new_status

        # Handle stock adjustment if voiding a previously paid sale
        if new_status == 'Void' and original_status == 'Paid':
            updated_stock, stock_error = SaleService._update_stock_for_sale_items(sale, increment=True)
            if not updated_stock:
                # Rollback status change if stock adjustment fails?
                # For now, log and proceed with status change.
                db.session.rollback() # Rollback the status change if stock update fails critically
                return None, f"Failed to void sale: stock adjustment error - {stock_error}"

        try:
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

        # Determine the sale_price: use override if provided, else item's master price.
        # This is the price the item will actually be sold for in this line item.
        sale_price_override = item_data.get('sale_price') # For future use if we allow overriding sale_price directly on add
        effective_sale_price = Decimal(sale_price_override) if sale_price_override is not None else item.price

        # Determine price_at_sale: This should be the item's master price at the time of adding to cart.
        # The frontend sends this as 'price_at_sale' in item_data, originally sourced from item.price when first added from search/quickadd.
        price_for_price_at_sale_field = item_data.get('price_at_sale') 
        if price_for_price_at_sale_field is None:
            # Fallback if frontend didn't send it (should not happen with current frontend)
            price_for_price_at_sale_field = item.price 

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
                sale_price=effective_sale_price, # The price it's actually sold at for this line
                price_at_sale=Decimal(price_for_price_at_sale_field), # The item's price when added
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
            return None, None, None, None # sale_total, amount_paid, amount_due, total_tax_amount

        sale_total = Decimal('0.00')
        for si in sale.sale_items:
            sale_total += (si.sale_price * si.quantity)
        
        amount_paid = Decimal('0.00')
        for p in sale.payments:
            amount_paid += p.amount
            
        amount_due = sale_total - amount_paid

        # Calculate GST component from the GST-inclusive sale_total
        gst_rate = Decimal(current_app.config.get('GST_RATE_PERCENTAGE', 10))
        if sale_total > 0 and gst_rate > 0: # Avoid division by zero or negative rates
            total_tax_amount = sale_total * (gst_rate / (Decimal('100') + gst_rate))
        else:
            total_tax_amount = Decimal('0.00')
        
        return sale_total, amount_paid, amount_due, total_tax_amount.quantize(Decimal('0.01'))

    @staticmethod
    def _update_stock_for_sale_items(sale_instance, increment=False):
        """ Helper method to update stock quantities for items in a sale. """
        if not sale_instance:
            return False, "Sale instance not provided."

        try:
            for sale_item in sale_instance.sale_items:
                item = Item.query.get(sale_item.item_id)
                if item and item.is_stock_tracked:
                    if increment:
                        item.stock_quantity += sale_item.quantity
                    else:
                        # Prevent stock from going excessively negative if not allowed
                        # This basic deduction assumes sufficient stock or allows negative stock
                        item.stock_quantity -= sale_item.quantity
            # db.session.commit() will be handled by the calling function
            return True, None
        except Exception as e:
            # db.session.rollback() should be handled by the calling function
            return False, str(e)

    @staticmethod
    def check_and_update_payment_status(sale_id):
        """Checks if a sale is fully paid and updates its status to 'Paid' if so.
           If not fully paid and status is 'Paid', it could revert to 'Invoice' or other appropriate status.
        """
        sale = Sale.query.get(sale_id)
        if not sale:
            return None, "Sale not found for status update."

        # _calculate_sale_details now returns: sale_total, amount_paid, amount_due, total_tax_amount
        _sale_total, _amount_paid, amount_due, _total_tax = SaleService._calculate_sale_details(sale_id)
        
        if amount_due is None: # Should not happen if sale exists and _calculate_sale_details succeeded
            current_app.logger.error(f"_calculate_sale_details returned None for amount_due for sale_id: {sale_id}")
            return sale, "Could not calculate sale details properly."

        original_status = sale.status

        if amount_due <= Decimal('0.00') and sale.status != 'Paid':
            if sale.status != 'Void': 
                sale.status = 'Paid'
                # Decrement stock when sale becomes Paid
                updated_stock, stock_error = SaleService._update_stock_for_sale_items(sale, increment=False)
                if not updated_stock:
                    # This is tricky: payment is made, sale is Paid, but stock update failed.
                    # For now, we'll log this. Ideally, this entire block should be atomic or have compensation.
                    print(f"Critical: Failed to update stock for sale {sale.id} after payment: {stock_error}")
                    # Potentially raise an error or set a flag on the sale for manual review.
        elif amount_due > Decimal('0.00') and sale.status == 'Paid':
            # Sale was Paid, but now is not (e.g. payment reversed - not a current feature, but for robustness)
            # Revert to 'Invoice' or another appropriate status
            sale.status = 'Invoice' # Example revert status
            # Increment stock back if a Paid sale becomes unpaid
            updated_stock, stock_error = SaleService._update_stock_for_sale_items(sale, increment=True)
            if not updated_stock:
                print(f"Critical: Failed to increment stock for sale {sale.id} after status change from Paid: {stock_error}")

        if original_status != sale.status:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                return None, f"Failed to commit status/stock changes: {str(e)}"
        
        return sale, None # Return the sale instance, potentially with new status

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
            if 'purchase_order_number' in data:
                sale.purchase_order_number = data['purchase_order_number']
            
            # Add other updatable fields as needed

            db.session.commit() # updated_at is handled by model
            return sale, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    # More methods will be added: park_sale, record_payment etc. 