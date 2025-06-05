from app import db
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.item import Item
from app.models.customer import Customer # Import if needed for validation
from sqlalchemy.exc import IntegrityError
from decimal import Decimal, ROUND_HALF_UP # Import ROUND_HALF_UP for consistent rounding
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

        return query.order_by(Sale.id.desc()).limit(50).all()

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

        # price_at_sale is the item's master price at the time of adding to cart.
        # Frontend sends this as 'price_at_sale' or just 'price' from itemService.js -> cart.js
        # It should be item.price.
        price_at_sale_value = item_data.get('price_at_sale', item.price) 
        if price_at_sale_value is None: # Should not happen if item.price is mandatory
            price_at_sale_value = item.price 

        try:
            new_sale_item = SaleItem(
                sale_id=sale_id,
                item_id=item_id,
                quantity=int(quantity),
                price_at_sale=Decimal(price_at_sale_value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                # Initially, sale_price is the same as price_at_sale (no discount on add)
                sale_price=Decimal(price_at_sale_value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                notes=item_data.get('notes'),
                discount_type=None, # No discount on initial add
                discount_value=None
            )
            db.session.add(new_sale_item)
            db.session.commit()
            SaleService.check_and_update_payment_status(sale_id) # This should recalculate sale totals
            return new_sale_item, None
        except ValueError as ve:
            db.session.rollback()
            current_app.logger.error(f"ValueError adding item to sale: {ve} Data: {item_data}")
            return None, "Invalid quantity or price format provided."
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Exception adding item to sale: {e}")
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
                     return None, "Quantity must be positive. To remove, use the remove item function."
                sale_item.quantity = new_quantity
            
            # Discount handling
            # price_at_sale is the original unit price and should not change during this update.
            original_unit_price = Decimal(sale_item.price_at_sale)
            new_effective_unit_price = original_unit_price # Start with original price

            if 'discount_type' in data and 'discount_value' in data:
                discount_type = data['discount_type']
                raw_discount_value = data['discount_value']

                if discount_type and raw_discount_value is not None:
                    discount_value = Decimal(raw_discount_value)
                    if discount_value < 0:
                        return None, "Discount value cannot be negative."

                    sale_item.discount_type = discount_type
                    sale_item.discount_value = discount_value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

                    if discount_type == 'Percentage':
                        if not (0 <= discount_value <= 100):
                            return None, "Percentage discount must be between 0 and 100."
                        discount_amount = (original_unit_price * discount_value / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        new_effective_unit_price = original_unit_price - discount_amount
                    elif discount_type == 'Absolute':
                        new_effective_unit_price = original_unit_price - discount_value
                    else:
                        # Invalid discount type, revert to no discount for this update
                        sale_item.discount_type = None
                        sale_item.discount_value = None
                        # new_effective_unit_price remains original_unit_price
                        current_app.logger.warning(f"Invalid discount type '{discount_type}' provided for sale_item {sale_item.id}. Discount not applied.")
                else: # Discount explicitly removed or not provided correctly
                    sale_item.discount_type = None
                    sale_item.discount_value = None
                    # new_effective_unit_price remains original_unit_price
            
            # Ensure sale_price doesn't go below zero
            sale_item.sale_price = max(Decimal('0.00'), new_effective_unit_price.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

            if 'notes' in data:
                sale_item.notes = data['notes']
            
            db.session.commit()
            SaleService.check_and_update_payment_status(sale_id) # This should recalculate sale totals
            return sale_item, None
        except ValueError as ve:
            db.session.rollback()
            current_app.logger.error(f"ValueError updating sale item: {ve} Data: {data}")
            return None, "Invalid data format for quantity or discount."
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Exception updating sale item {sale_item_id}: {e}")
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
                        if item.stock_quantity <= 0:
                            item.show_on_website = False
                            item.is_active = False
            # db.session.commit() will be handled by the calling function
            return True, None
        except Exception as e:
            # db.session.rollback() should be handled by the calling function
            return False, str(e)

    @staticmethod
    def check_and_update_payment_status(sale_id):
        sale = Sale.query.get(sale_id)
        if not sale:
            current_app.logger.error(f"[check_and_update_payment_status] Sale ID {sale_id} not found.")
            return None, "Sale not found for payment status check."

        current_sale_total = Decimal('0.00')
        for si in sale.sale_items:
            item_price = si.sale_price if si.sale_price is not None else Decimal('0.00')
            item_quantity = si.quantity if si.quantity is not None else 0
            current_sale_total += (item_price * item_quantity)
        
        total_paid = Decimal('0.00')
        for p in sale.payments:
            total_paid += p.amount

        original_status = sale.status
        
        if sale.status not in ['Void', 'Quote']: 
            if total_paid >= current_sale_total and current_sale_total > 0:
                sale.status = 'Paid'
            elif total_paid > 0 and total_paid < current_sale_total:
                sale.status = 'Invoice' 
            elif total_paid == 0 and current_sale_total > 0 and sale.status == 'Invoice':
                # If it was 'Invoice' and items are removed making total > 0 but paid is 0, revert to Open
                # Or, more simply, if no payment, keep/revert to 'Open' unless it's already 'Paid' (which is covered above)
                pass # Let it remain 'Invoice' if it was already that, or 'Open'
            elif sale.status != 'Open' and total_paid == 0 and current_sale_total == 0:
                 # If all items are removed from a non-Open sale, and no payment, make it Open again
                 sale.status = 'Open'
            # The key change: If total_paid is 0 and sale_total > 0, it should generally remain 'Open' 
            # unless explicitly moved to another state like 'Quote'.
            # The previous logic would set it to 'Invoice'. We want to avoid that for this workflow.
            # If it was already 'Invoice' and items are added/removed but no payment, it can stay 'Invoice' or go to 'Open'.
            # For simplicity: if no payment has been made, and it's not a quote/void, it should be 'Open' if it has items, 
            # or if it was 'Invoice' and now has items and 0 payment.
            # More direct: if total_paid == 0 and current_sale_total > 0 and sale.status not in ['Quote', 'Void']:
            #    sale.status = 'Open' # This might be too aggressive if it was manually set to 'Invoice'

            # Revised logic for status update based on payment:
            if sale.status not in ['Void', 'Quote']:
                if total_paid >= current_sale_total and current_sale_total > 0:
                    sale.status = 'Paid'
                elif total_paid > 0 and total_paid < current_sale_total:
                    sale.status = 'Invoice' # Partial payment implies an invoice state
                elif total_paid == 0 and current_sale_total > 0:
                    if sale.status == 'Paid': # Should not happen if total_paid is 0
                        pass # Error condition or needs refund logic
                    elif sale.status == 'Invoice': 
                        pass # If it was already an Invoice (e.g. set by quote, or partial payment then items removed), let it be
                    else: # Otherwise, if no payment and items exist, it's 'Open'
                        sale.status = 'Open' 
                elif total_paid == 0 and current_sale_total == 0 and sale.status != 'Open':
                    # If sale becomes empty and no payment, revert to Open if it wasn't already
                    sale.status = 'Open'

        try:
            if sale.status != original_status:
                current_app.logger.info(f"Sale {sale.id} status changing from {original_status} to {sale.status} based on payment. Total: {current_sale_total}, Paid: {total_paid}")
            db.session.commit() # Commit status change if any
            return sale, None
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error committing sale status update for Sale ID {sale.id}: {e}")
            return None, f"Error updating sale status: {str(e)}"

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